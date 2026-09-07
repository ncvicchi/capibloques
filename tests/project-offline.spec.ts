import { expect, test } from '@playwright/test';
import { mockEditorSession, student, token } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';
import { recoveryRows } from './recovery-fixture';

test('desconexión: continúa sólo local, exporta y revalida antes de enviar', async ({ page }) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  let failed = false;
  await page.route('**/api/auth/editor-session/', route => route.fulfill(failed ? { status: 503 } : {
    json: { user: student, csrfToken: token, context: 'offline-fixture', expiresAt: new Date(Date.now() + 3600000).toISOString() },
  }));
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Antes del corte');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  failed = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: 'Seguir sólo en esta computadora', exact: true }).click();
  await page.getByLabel('Nombre del proyecto').fill('Trabajé durante el corte');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.notice')).toContainText('Guardado sólo en esta computadora');
  await expect(page.getByRole('button', { name: 'Mis proyectos', exact: true })).toBeDisabled();
  expect(api.writes).toBe(1);
  expect((await recoveryRows(page, student.id))[0].title).toBe('Trabajé durante el corte');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  expect((await download).suggestedFilename()).toContain('.json');
  failed = false;
  await page.getByRole('button', { name: 'Reconectar', exact: true }).click();
  await expect(page.locator('.offline-banner')).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  expect(api.writes).toBe(2); expect([...api.projects.values()][0].project.title).toBe('Trabajé durante el corte');
});

test('desconexión: no ofrece entrada desde cero ni tras revocación o cambio de cuenta', async ({ page }) => {
  await mockEditorSession(page);
  let status = 503;
  let user: typeof student | null = student;
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user, csrfToken: token } }));
  await page.route('**/api/auth/editor-session/', route => route.fulfill(status === 200 ? {
    json: { user, csrfToken: token, context: 'offline-fixture', expiresAt: new Date(Date.now() + 3600000).toISOString() },
  } : { status, json: { code: 'login_required' } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seguir sólo en esta computadora', exact: true })).toHaveCount(0);
  status = 200; await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await page.getByLabel('Nombre del proyecto').fill('Privado de Luna');
  status = 503; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: 'Seguir sólo en esta computadora', exact: true }).click();
  status = 401; user = null;
  await page.getByRole('button', { name: 'Reconectar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveCount(0);
  expect((await recoveryRows(page, student.id))[0].title).toBe('Privado de Luna');
});

test('desconexión: el vencimiento conocido bloquea la copia aunque no vuelva la red', async ({ page }) => {
  await mockEditorSession(page);
  let failed = false;
  const deadline = new Date(Date.now() + 60000).toISOString();
  await page.clock.install();
  await page.route('**/api/auth/editor-session/', route => route.fulfill(failed ? { status: 503 } : {
    json: { user: student, csrfToken: token, context: 'offline-fixture', expiresAt: deadline },
  }));
  await page.goto('/'); await expect(page.getByLabel('Nombre del proyecto')).toBeVisible();
  failed = true; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: 'Seguir sólo en esta computadora', exact: true }).click();
  await page.clock.fastForward(61000);
  await expect(page.getByLabel('Nombre del proyecto')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Seguir sólo en esta computadora', exact: true })).toHaveCount(0);
});
