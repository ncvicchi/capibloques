import { expect, test, type Page } from '@playwright/test';
import { student, token } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';
import { recoveryRows } from './recovery-fixture';

const otherId = 'e6d7e9f1-91eb-44d2-8b7e-84920bed16ed';

async function setup(page: Page) {
  await page.addInitScript(id => { localStorage.setItem(`capibloques-account:${id}:server-autosave`, 'false'); }, student.id);
  const control = { user: student as typeof student | null, fail: false, loseAck: false, logouts: 0 };
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user: control.user, csrfToken: token } }));
  await page.route('**/api/auth/editor-session/', route => route.fulfill(control.user
    ? { json: { user: control.user, csrfToken: token, context: `session-${control.user.id}` } }
    : { status: 401, json: { code: 'login_required' } }));
  await page.route('**/api/auth/logout*/', route => {
    control.logouts++;
    expect(route.request().headers()['x-capi-account']).toBe(student.id);
    if (control.fail) return route.fulfill({ status: 503 });
    control.user = null;
    if (control.loseAck) { control.loseAck = false; return route.abort('failed'); }
    return route.fulfill({ json: { user: null, csrfToken: token } });
  });
  const api = await mockLibrary(page);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Mi proyecto antes de salir');
  await expect.poll(async () => (await recoveryRows(page, student.id))[0]?.title).toBe('Mi proyecto antes de salir');
  return { control, api };
}

async function openExit(page: Page) {
  await page.getByRole('button', { name: 'Opciones de mi cuenta' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salir y conservar copias', exact: true })).toBeVisible();
}

test('salida compartida: cancelar conserva editor, copias y sesión sin enviar proyectos', async ({ page }) => {
  const { control, api } = await setup(page);
  await openExit(page);
  await expect(page.getByRole('button', { name: 'Salir y quitar copias', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Mi proyecto antes de salir');
  expect(control.logouts).toBe(0); expect(api.writes).toBe(0);
  expect((await recoveryRows(page, student.id)).length).toBe(1);
});

test('salida compartida: exporta y quita sólo las copias confirmadas, no otros usuarios ni servidor', async ({ page }) => {
  const { control, api } = await setup(page);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  await page.getByLabel('Nombre del proyecto').fill('Cambios que exporto');
  await expect.poll(async () => (await recoveryRows(page, student.id))[0]?.title).toBe('Cambios que exporto');
  await page.evaluate(async ({ id, otherId }) => {
    const path = '/lib/project-recovery.ts';
    const { RecoveryJournal } = await import(/* @vite-ignore */ path);
    const journal = new RecoveryJournal(id);
    const row = await journal.restore();
    const other = new RecoveryJournal(otherId);
    await other.write({ document: row.document, remote: null, pending: null });
    localStorage.setItem(`capibloques-account:${id}:project-v2`, row.document);
    localStorage.setItem(`capibloques-account:${otherId}:project-v2`, row.document);
    localStorage.setItem('capibloques-project-v2', row.document);
  }, { id: student.id, otherId });
  await openExit(page);
  await page.getByText('Revisar y exportar las copias JSON', { exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON de Cambios que exporto', exact: true }).first().click();
  const artifact = await download;
  const stream = await artifact.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(exported.metadata.title).toBe('Cambios que exporto');
  expect(exported).not.toHaveProperty('accountId'); expect(exported).not.toHaveProperty('pending');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Salir y quitar copias', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  await expect(page.getByText('Sesión cerrada. Se quitaron tus copias de proyectos de este navegador.', { exact: true })).toBeVisible();
  expect(await recoveryRows(page, student.id)).toEqual([]);
  expect((await recoveryRows(page, otherId)).length).toBe(1);
  expect(await page.evaluate(id => localStorage.getItem(`capibloques-account:${id}:project-v2`), student.id)).toBeNull();
  expect(await page.evaluate(id => localStorage.getItem(`capibloques-account:${id}:project-v2`), otherId)).not.toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('capibloques-project-v2'))).not.toBeNull();
  expect(api.projects.size).toBe(1); expect(api.writes).toBe(1);
  control.user = student; await page.goto('/');
  await expect(page.getByLabel('Nombre del proyecto')).not.toHaveValue('Cambios que exporto');
});

test('salida compartida: no limpia si el cierre falla y recupera una respuesta perdida', async ({ page }) => {
  const { control } = await setup(page); control.fail = true;
  await openExit(page); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Salir y quitar copias', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos confirmar el cierre');
  expect((await recoveryRows(page, student.id)).length).toBe(1);
  await expect(page.getByLabel('Nombre del proyecto')).not.toBeVisible();
  control.fail = false; control.loseAck = true;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect.poll(() => control.logouts).toBe(2);
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  expect((await recoveryRows(page, student.id)).length).toBe(1);
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  expect(await recoveryRows(page, student.id)).toEqual([]);
});

test('salida compartida: si otra pestaña cambia una copia no borra datos no confirmados', async ({ page }) => {
  await setup(page); await openExit(page);
  await page.evaluate(async id => {
    const path = '/lib/project-recovery.ts';
    const { RecoveryJournal } = await import(/* @vite-ignore */ path);
    const journal = new RecoveryJournal(id), row = await journal.restore();
    const document = JSON.parse(row.document); document.metadata.title = 'Otra pestaña llegó después';
    await journal.write({ document: JSON.stringify(document), remote: row.remote, pending: row.pending });
  }, student.id);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Salir y quitar copias', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Sesión cerrada, pero la limpieza local no se completó');
  expect((await recoveryRows(page, student.id))[0].title).toBe('Otra pestaña llegó después');
  await expect(page.getByRole('button', { name: /^Exportar JSON/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ir al ingreso', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
});

test('salida compartida: escritores anteriores a una limpieza no resucitan proyectos', async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async id => {
    const path = '/lib/project-recovery.ts';
    const { RecoveryJournal } = await import(/* @vite-ignore */ path);
    const stale = new RecoveryJournal(id), row = await stale.restore();
    const manager = new RecoveryJournal(id), snapshot = await manager.snapshot();
    await manager.removeAll(snapshot);
    let rejected = false;
    try { await stale.write({ document: row.document, remote: row.remote, pending: row.pending }); }
    catch { rejected = true; }
    const empty = await manager.list();
    const fresh = new RecoveryJournal(id);
    await fresh.restore();
    await fresh.write({ document: row.document, remote: null, pending: null });
    await manager.removeAll(snapshot); // Repetir la misma limpieza no borra trabajo nuevo.
    return { rejected, empty: empty.length, fresh: (await fresh.list()).length };
  }, student.id);
  expect(result).toEqual({ rejected: true, empty: 0, fresh: 1 });
});

test('salida compartida: aborto de IndexedDB no se presenta como limpieza completada', async ({ page }) => {
  await setup(page); await openExit(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (...args) {
      const request = original.apply(this, args);
      if (this.name === 'drafts') request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
  });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Salir y quitar copias', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('la limpieza local no se completó');
  expect((await recoveryRows(page, student.id)).length).toBe(1);
});

test('salida compartida: confirmación y cancelar alcanzables a 390px y texto 200%', async ({ page }, info) => {
  await setup(page); await page.setViewportSize({ width: 390, height: 844 });
  await openExit(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await page.getByRole('checkbox').scrollIntoViewIfNeeded();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  const overflow = await page.getByRole('dialog').evaluate(element => element.scrollWidth > element.clientWidth + 1);
  expect(overflow).toBe(false);
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
  await page.screenshot({ path: info.outputPath('salida-390-texto-200.png') });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Mi proyecto antes de salir');
});

test('salida compartida: desde Mi cuenta explica que cerrar todas no limpia otros equipos', async ({ page }) => {
  const { control } = await setup(page);
  await page.goto('/cuenta/');
  await page.getByRole('button', { name: 'Cerrar todas mis sesiones', exact: true }).click();
  await expect(page.getByText('Se cerrarán tus sesiones en todos los equipos.', { exact: false })).toContainText('no de otras computadoras');
  await page.getByRole('button', { name: 'Salir y conservar copias', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  expect(control.logouts).toBe(1); expect((await recoveryRows(page, student.id)).length).toBe(1);
});

test('salida compartida: conservar mantiene la misma operación pendiente después de reingresar', async ({ page }) => {
  const { control, api } = await setup(page);
  api.loseNextAck = true;
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('sin confirmar');
  const before = (await recoveryRows(page, student.id))[0];
  expect(before.pending).not.toBeNull();
  await openExit(page);
  await page.getByRole('button', { name: 'Salir y conservar copias', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  expect((await recoveryRows(page, student.id))[0].pending).toEqual(before.pending);
  control.user = student; await page.goto('/');
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Mi proyecto antes de salir');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  expect(api.projects.size).toBe(1); expect(api.writes).toBe(1);
});

test('salida compartida: otra pestaña se bloquea durante la elección y no recrea copias al salir', async ({ page, context }) => {
  const { control } = await setup(page);
  const second = await context.newPage();
  await second.route('**/api/auth/session/', route => route.fulfill({ json: { user: control.user, csrfToken: token } }));
  await second.route('**/api/auth/editor-session/', route => route.fulfill(control.user
    ? { json: { user: control.user, csrfToken: token, context: `session-${control.user.id}` } }
    : { status: 401, json: { code: 'login_required' } }));
  await mockLibrary(second);
  await second.goto('/');
  await second.getByLabel('Nombre del proyecto').fill('Trabajo de la otra pestaña');
  await expect.poll(async () => (await recoveryRows(second, student.id)).some(row => row.title === 'Trabajo de la otra pestaña')).toBe(true);
  await page.bringToFront(); await openExit(page);
  await expect(second.getByLabel('Nombre del proyecto')).not.toBeVisible();
  await page.getByRole('button', { name: 'Actualizar copias antes de salir' }).click();
  await expect(page.getByRole('checkbox')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Salir y quitar copias', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  await expect(second).toHaveURL(/\/cuenta\/\?editor=1$/);
  expect(await recoveryRows(page, student.id)).toEqual([]);
  await second.bringToFront(); await second.reload();
  await expect(second.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  expect(await recoveryRows(second, student.id)).toEqual([]);
});
