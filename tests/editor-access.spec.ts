import { expect, test, type Page } from '@playwright/test';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene } from '../lib/scene-model';
import { student, token } from './editor-fixture';
import { recoveryRows } from './recovery-fixture';

const other = { ...student, id: 'e6d7e9f1-91eb-44d2-8b7e-84920bed16ed', alias: 'sol', displayName: 'Sol' };
const key = (id: string) => `capibloques-account:${id}:project-v2`;
const project = (title: string) => JSON.stringify(makeProject(title, createEmptyScene(), {}, 1));

async function sessionRoutes(page: Page, read: () => typeof student | null, failed: () => boolean = () => false) {
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user: read(), csrfToken: token } }));
  await page.route('**/api/auth/editor-session/', route => {
    const user = read();
    return route.fulfill(failed() ? { status: 503, body: 'Unavailable' } : user && !user.mustChangePassword
      ? { json: { user, csrfToken: token, context: `context-${user.id}` } }
      : { status: user ? 403 : 401, json: { code: user ? 'password_change_required' : 'login_required' } });
  });
}

test('editor: sin sesión no lee proyectos, ni confía en una identidad local', async ({ page }) => {
  await sessionRoutes(page, () => null);
  await page.addInitScript(({ storageKey, raw }) => {
    localStorage.setItem(storageKey, raw);
    localStorage.setItem('capibloques-user', JSON.stringify({ id: 'falso', roles: ['administrador'] }));
  }, { storageKey: key(student.id), raw: project('Proyecto privado de Luna') });
  await page.goto('/');
  await expect(page).toHaveURL(/\/cuenta\/\?editor=1$/);
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Proyecto privado de Luna');
  await page.reload();
  await expect(page.getByLabel('Alias', { exact: true })).toBeVisible();
});

test('editor: login desde la puerta abre el editor; contraseña temporal no', async ({ page }) => {
  let user: typeof student | null = null;
  await sessionRoutes(page, () => user);
  await page.route('**/api/auth/login/', route => {
    user = { ...student, mustChangePassword: true };
    return route.fulfill({ json: { user, csrfToken: token } });
  });
  await page.route('**/api/auth/password/', route => {
    user = student;
    return route.fulfill({ json: { user, csrfToken: token } });
  });
  await page.goto('/');
  await page.getByLabel('Alias', { exact: true }).fill('luna');
  await page.getByLabel('Contraseña', { exact: true }).fill('Temporal de prueba');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Elegí tu contraseña' })).toBeVisible();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveCount(0);
  await page.getByLabel('Contraseña actual', { exact: true }).fill('Temporal de prueba');
  await page.getByLabel('Contraseña nueva', { exact: true }).fill('Nueva de prueba');
  await page.getByLabel('Repetir contraseña nueva', { exact: true }).fill('Nueva de prueba');
  await page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click();
  await expect(page.getByLabel('Editor visual de bloques')).toBeVisible();
});

test('editor: salida captura cambios recientes y la otra cuenta nunca los hereda', async ({ page }) => {
  let user: typeof student | null = student;
  await sessionRoutes(page, () => user);
  await page.route('**/api/auth/logout/', route => { user = null; return route.fulfill({ json: { user: null, csrfToken: token } }); });
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Luna solamente');
  // Enviar la salida en la misma tarea del navegador, antes del debounce de 350 ms.
  await page.getByRole('button', { name: 'Opciones de mi cuenta' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).evaluate((button: HTMLElement) => button.click());
  await page.getByRole('button', { name: 'Salir y conservar copias', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  expect(JSON.parse((await recoveryRows(page, student.id))[0].document).metadata.title).toBe('Luna solamente');
  user = other;
  await page.goto('/');
  await expect(page.getByLabel('Nombre del proyecto')).not.toHaveValue('Luna solamente');
  await page.getByLabel('Nombre del proyecto').fill('Sol solamente');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  user = student;
  await page.reload();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Luna solamente');
  expect(JSON.parse((await recoveryRows(page, other.id))[0].document).metadata.title).toBe('Sol solamente');
});

test('editor: logout en otra pestaña oculta también un diálogo abierto', async ({ page, context }) => {
  let user: typeof student | null = student;
  await sessionRoutes(page, () => user);
  await page.goto('/');
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const second = await context.newPage();
  await sessionRoutes(second, () => user);
  await second.route('**/api/auth/logout/', route => { user = null; return route.fulfill({ json: { user: null, csrfToken: token } }); });
  await second.goto('/cuenta/');
  await second.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await second.getByRole('button', { name: 'Salir y conservar copias', exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta\/\?editor=1$/);
  await expect(page.getByLabel('Nombre del proyecto')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await second.close();
  await page.bringToFront();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
});

test('editor: fallo de sesión bloquea y reintento conserva el mismo borrador', async ({ page }) => {
  let failed = false;
  await sessionRoutes(page, () => student, () => failed);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('No perder al reconectar');
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  failed = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('alert')).toContainText('No pudimos verificar');
  await expect(page.getByLabel('Nombre del proyecto')).not.toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText('Verificamos tu acceso');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('No perder al reconectar');
});

test('editor: cierre fallido no afirma éxito ni vuelve a mostrar el proyecto', async ({ page }) => {
  let user: typeof student | null = student;
  let failed = true;
  await sessionRoutes(page, () => user);
  await page.route('**/api/auth/logout/', route => {
    if (failed) return route.fulfill({ status: 503 });
    user = null; return route.fulfill({ json: { user: null, csrfToken: token } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Opciones de mi cuenta' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Salir y conservar copias', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos confirmar el cierre');
  await expect(page.getByLabel('Nombre del proyecto')).not.toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
});

test('editor: si falla el guardado permite exportar antes de una salida voluntaria', async ({ page }) => {
  await sessionRoutes(page, () => student);
  let logouts = 0;
  await page.route('**/api/auth/logout/', route => { logouts++; return route.fulfill({ json: { user: null, csrfToken: token } }); });
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Conservar aunque no haya espacio');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'drafts') throw new DOMException('Quota', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Opciones de mi cuenta' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByText('No pudimos conservar el último cambio. Exportá una copia JSON antes de cerrar sesión.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Conservar aunque no haya espacio');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  await download;
  expect(logouts).toBe(0);
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Guardar sólo en este navegador' }).click();
  await expect(page.locator('.notice')).toContainText('No pudimos guardar');
});

for (const changeAccount of [false, true]) {
  test(`editor: importación durante verificación ${changeAccount ? 'no pasa a otra cuenta' : 'continúa en la misma cuenta'}`, async ({ page }) => {
    let user = student;
    let hold = false;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await sessionRoutes(page, () => user);
    await page.route('**/api/auth/editor-session/', async route => {
      if (hold) await pending;
      await route.fulfill({ json: { user, csrfToken: token, context: `context-${user.id}` } });
    });
    await page.goto('/');
    await expect(page.getByLabel('Editor visual de bloques')).toBeVisible();
    hold = true;
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('capibloques-account-session', { detail: { changing: false } })));
    await expect(page.getByText('Comprobando tu sesión…')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({ name: 'importado.json', mimeType: 'application/json', buffer: Buffer.from(project('Importación de Luna')) });
    await expect(page.locator('.notice')).toContainText('Esperando verificar tu sesión');
    if (changeAccount) user = other;
    release();
    await expect(page.getByLabel('Nombre del proyecto')).toBeVisible();
    if (changeAccount) await expect(page.getByLabel('Nombre del proyecto')).not.toHaveValue('Importación de Luna');
    else await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Importación de Luna');
  });
}

test('editor: borrador anónimo intacto y recuperación sólo explícita del administrador', async ({ page }) => {
  let user = student;
  const raw = project('Anterior sin dueño');
  await sessionRoutes(page, () => user);
  await page.addInitScript(value => localStorage.setItem('capibloques-project-v2', value), raw);
  await page.goto('/');
  await expect(page.getByLabel('Nombre del proyecto')).not.toHaveValue('Anterior sin dueño');
  await page.goto('/cuenta/');
  await expect(page.getByRole('button', { name: 'Recuperar proyecto anterior a las cuentas' })).toHaveCount(0);
  user = { ...other, roles: ['administrador'] };
  await page.reload();
  await page.getByRole('button', { name: 'Recuperar proyecto anterior a las cuentas' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar copia anterior (v2)' }).click();
  expect((await download).suggestedFilename()).toBe('proyecto-anterior-v2.capibloques.json');
  expect(await page.evaluate(() => localStorage.getItem('capibloques-project-v2'))).toBe(raw);
});
