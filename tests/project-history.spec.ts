import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';

async function setup(page: Page) {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Mi semáforo');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  const row = [...api.projects.values()][0];
  const original = structuredClone(row.document);
  row.project.revision = 2;
  const state = { writes: 0, loseAck: false, removed: false, payloads: [] as string[] };
  const operations = new Set<string>();
  await page.route(`**/api/projects/${row.project.id}/history/**`, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === 'GET') return route.fulfill({ json: path.endsWith('/history/') ? { project: row.project, versions: [
      { revision: row.project.revision, current: true, title: row.project.title, createdAt: row.project.updatedAt, kind: 'manual', pinned: false, bytes: 2000 },
      ...(state.removed ? [] : [{ revision: 1, current: false, title: 'Mi semáforo', createdAt: row.project.updatedAt, kind: 'manual', pinned: false, bytes: 2000 }]),
    ] } : { document: original } });
    const body = request.postDataJSON(); state.payloads.push(request.postData()!);
    if (!operations.has(body.operationId)) {
      operations.add(body.operationId); state.writes++; row.project.revision++;
      if (request.method() === 'DELETE') state.removed = true;
      else { row.document = structuredClone(original); row.project.title = original.metadata.title; }
    }
    if (state.loseAck) { state.loseAck = false; return route.abort('connectionfailed'); }
    return route.fulfill({ json: { project: row.project } });
  });
  return { api, row, state };
}

test('historial: exporta, cancela y restaura sin reemplazar la edición local', async ({ page }) => {
  const { state } = await setup(page);
  await page.getByLabel('Nombre del proyecto').fill('Cambios locales intactos');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Historial de Mi semáforo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Historial de Mi semáforo', exact: true });
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Exportar versión 1', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('-v1.capibloques.json');
  await dialog.getByRole('button', { name: 'Restaurar versión 1', exact: true }).click();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toBe(0);
  await dialog.getByRole('button', { name: 'Restaurar versión 1', exact: true }).click();
  await dialog.getByRole('button', { name: 'Restaurar como nueva versión' }).click();
  await expect(dialog.locator('output')).toContainText('Tu editor no cambió');
  await dialog.getByRole('button', { name: 'Volver a la biblioteca' }).click();
  await page.getByRole('button', { name: 'Volver al editor', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Cambios locales intactos');
  expect(state.writes).toBe(1);
});

test('historial: un ACK perdido reintenta la misma operación y borrar versión exige confirmación', async ({ page }) => {
  const { state } = await setup(page); state.loseAck = true;
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Historial de Mi semáforo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Historial de Mi semáforo', exact: true });
  await dialog.getByRole('button', { name: 'Restaurar versión 1', exact: true }).click();
  await dialog.getByRole('button', { name: 'Restaurar como nueva versión' }).click();
  await dialog.getByRole('button', { name: 'Reintentar misma operación' }).click();
  await expect(dialog.locator('output')).toContainText('Versión restaurada');
  expect(state.writes).toBe(1); expect(state.payloads[0]).toBe(state.payloads[1]);
  await dialog.getByRole('button', { name: 'Eliminar versión 1', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Eliminar esta versión', exact: true })).toBeDisabled();
  await dialog.getByLabel('Confirmación de borrado').fill('1');
  await dialog.getByRole('button', { name: 'Eliminar esta versión', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Exportar versión 1', exact: true })).toHaveCount(0);
  expect(state.writes).toBe(2);
});

test('papelera: purga sólo elegible tras treinta días y confirmación exacta', async ({ page }, info) => {
  const { api, row } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  row.project.trashedAt = new Date().toISOString();
  row.project.purgeAfter = new Date(Date.now() + 30 * 86400000).toISOString();
  let purges = 0;
  await page.route(`**/api/projects/${row.project.id}/purge/`, route => { purges++; api.projects.delete(row.project.id); return route.fulfill({ json: { deleted: true } }); });
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('combobox', { name: 'Mostrar' }).selectOption('trash');
  await page.getByRole('button', { name: 'Historial de Mi semáforo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Historial de Mi semáforo', exact: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect(dialog).toBeVisible();
  const titleBox = await dialog.getByRole('heading', { name: 'Historial de Mi semáforo', exact: true }).boundingBox();
  const closeBox = await dialog.getByRole('button', { name: 'Cerrar', exact: true }).boundingBox();
  expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(closeBox!.x);
  await page.screenshot({ path: info.outputPath('history-mobile.png') });
  await expect(dialog.getByRole('button', { name: 'Eliminar definitivamente…', exact: true })).toBeDisabled();
  row.project.purgeAfter = new Date(Date.now() - 86400000).toISOString();
  await dialog.getByRole('button', { name: 'Actualizar historial' }).click();
  await dialog.getByRole('button', { name: 'Eliminar definitivamente…', exact: true }).click();
  await dialog.getByLabel('Confirmación de borrado').fill('incorrecto');
  await expect(dialog.getByRole('button', { name: 'Eliminar proyecto definitivamente', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(purges).toBe(0);
  await dialog.getByRole('button', { name: 'Eliminar definitivamente…', exact: true }).click();
  await dialog.getByLabel('Confirmación de borrado').fill('Mi semáforo');
  await dialog.getByRole('button', { name: 'Eliminar proyecto definitivamente', exact: true }).click();
  await expect(dialog).toBeHidden(); expect(purges).toBe(1);
});

test('historial: respuesta inválida permite reintentar sin romper el editor', async ({ page }) => {
  const { row } = await setup(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let invalid = true;
  await page.route(`**/api/projects/${row.project.id}/history/`, route => invalid ? route.fulfill({ json: { unexpected: true } }) : route.fallback());
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Historial de Mi semáforo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Historial de Mi semáforo', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('La respuesta del historial no es válida');
  invalid = false;
  await dialog.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Exportar versión 1', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
