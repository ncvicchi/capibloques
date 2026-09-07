import { expect, test } from '@playwright/test';
import { mockEditorSession, student } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';
import { clearRecovery, recoveryRows } from './recovery-fixture';

test.beforeEach(async ({ page }) => { await mockEditorSession(page); });

test('biblioteca: guardar, recuperar desde servidor sin borrador local y exportar JSON portable', async ({ page }) => {
  const api = await mockLibrary(page);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Dos semáforos');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  expect(api.projects.size).toBe(1);
  await page.evaluate(() => localStorage.clear());
  await clearRecovery(page);
  await page.reload();
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir Dos semáforos', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Dos semáforos');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON de Dos semáforos', exact: true }).click();
  const chunks: Buffer[] = []; const stream = await (await download).createReadStream(); for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const file = JSON.parse(Buffer.concat(chunks).toString());
  expect(file.schemaVersion).toBe(2); expect(file.owner).toBeUndefined(); expect(file.projectId).toBeUndefined();
  expect(file.scene.devices).toHaveLength(1); expect(file.workspace.blocks.blocks.length).toBeGreaterThan(0);
});

test('biblioteca: renombrar y duplicar, cancelar baja, papelera y restauración', async ({ page }) => {
  const api = await mockLibrary(page);
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Robot');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicar Robot', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir Robot (copia)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Renombrar Robot (copia)', exact: true }).click();
  await page.getByRole('dialog', { name: 'Renombrar proyecto' }).getByLabel('Nombre', { exact: true }).fill('Robot azul');
  await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar Robot azul', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect([...api.projects.values()].every(item => !item.project.trashedAt)).toBe(true);
  await page.getByRole('button', { name: 'Eliminar Robot azul', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar a papelera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir Robot azul', exact: true })).toBeHidden();
  await page.getByRole('combobox', { name: 'Mostrar' }).selectOption('trash');
  await page.getByRole('button', { name: 'Restaurar Robot azul', exact: true }).click();
  await expect(page.getByText('La papelera está vacía.')).toBeVisible();
  expect(api.projects.size).toBe(2);
});

test('biblioteca: confirmación permite cancelar, guardar antes de abrir y nuevo proyecto independiente', async ({ page }) => {
  const api = await mockLibrary(page);
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Sin perder');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.projects.size).toBe(0);
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y abrir', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Mi aventura');
  expect([...api.projects.values()][0].project.title).toBe('Sin perder');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect.poll(() => api.projects.size).toBe(2);
});

test('biblioteca: reintentar una respuesta perdida no duplica y conserva ediciones posteriores', async ({ page }) => {
  const api = await mockLibrary(page); api.loseNextAck = true;
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Antes');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('sin confirmar');
  await page.getByLabel('Nombre del proyecto').fill('Después');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Cambios sólo');
  expect(api.writes).toBe(1); expect(api.projects.size).toBe(1);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  expect([...api.projects.values()][0].project.title).toBe('Después');
  expect(api.writes).toBe(2);
});

test('biblioteca: conflicto ofrece copia sin sobrescribir y el borrador separa cuenta e identidad del JSON', async ({ page }) => {
  const api = await mockLibrary(page);
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Original');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  await page.getByLabel('Nombre del proyecto').fill('Edición local'); api.staleNext = true;
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar guardado', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar editor como copia', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir Edición local (copia)', exact: true })).toBeVisible();
  expect([...api.projects.values()][0].project.title).toBe('Original');
  const bundle = (await recoveryRows(page, student.id))[0];
  expect(bundle.accountId).toBe(student.id); expect(bundle.remote?.id).toBe([...api.projects.keys()][1]);
  expect(JSON.parse(bundle.document).remote).toBeUndefined();
});

for (const width of [390, 768]) test(`biblioteca: controles utilizables sin desborde a ${width}px`, async ({ page }) => {
  await mockLibrary(page); await page.setViewportSize({ width, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Mis proyectos', exact: true });
  await expect(dialog.getByRole('button', { name: 'Nuevo proyecto', exact: true })).toBeVisible();
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await dialog.getByRole('button', { name: 'Volver al editor', exact: true }).click();
});
