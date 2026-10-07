import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene } from '../lib/scene-model';

async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
}
async function exported(page: Page) {
  await page.getByRole('button', { name: 'Opciones del proyecto' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  const stream = await (await pending).createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  await page.keyboard.press('Escape');
  const menu = page.getByRole('menu', { name: 'Opciones del proyecto' });
  if (await menu.isVisible()) await page.getByRole('button', { name: 'Opciones del proyecto' }).click();
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('campos y bloques sueltos son reconocibles sin modificar un proyecto importado', async ({ page }, info) => {
  await open(page);
  const project = makeProject('Ergonomía', createEmptyScene('Prueba'), { blocks: { languageVersion: 0, blocks: [
    { type: 'capi_start', id: 'erg-start', x: 48, y: 40 },
    { type: 'capi_compare', id: 'erg-compare', x: 230, y: 80, fields: { LEFT: 5, RIGHT: 3, OPERATOR: 'LT' } },
    { type: 'capi_wait', id: 'erg-wait', x: 230, y: 180, fields: { SECONDS: 2 } },
  ] } });
  await page.locator('input[type=file]').setInputFiles({ name: 'ergonomia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  const replacement = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await replacement.isVisible()) await replacement.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  const compare = page.locator('[data-id="erg-compare"]');
  await expect(compare).toContainText('menor que');
  await expect(compare).toHaveClass(/capi-block-detached/);
  await expect(compare.locator('.capi-choice-field')).toHaveCount(1);
  await expect.poll(() => compare.locator('.blocklyDropdownText').evaluate(node => getComputedStyle(node).fill)).toBe('rgb(41, 32, 63)');
  await expect(compare.locator('.capi-number-field')).toHaveCount(2);
  await expect(page.locator('.detached-blocks-notice')).toContainText('2 grupos fuera');
  const saved = await exported(page);
  expect(saved.workspace.blocks.blocks.find((block: { id: string }) => block.id === 'erg-compare').fields.OPERATOR).toBe('LT');
  expect(saved.workspace.blocks.blocks.find((block: { id: string }) => block.id === 'erg-wait').y).toBe(180);
  // Drop on the middle of the start, away from its connection notch.
  const wait = page.locator('[data-id="erg-wait"]');
  const start = page.locator('[data-id="erg-start"]');
  const source = (await wait.boundingBox())!, target = (await start.boundingBox())!;
  await page.mouse.move(source.x + 25, source.y + 12); await page.mouse.down();
  await page.mouse.move(target.x + 25, target.y + 12, { steps: 12 }); await page.mouse.up();
  await expect.poll(async () => { const a = (await wait.boundingBox())!, b = (await start.boundingBox())!; return a.y >= b.y + b.height; }).toBe(true);
  const separated = await exported(page);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  const undone = await exported(page);
  expect(undone.workspace.blocks.blocks.find((block: { id: string }) => block.id === 'erg-wait').y).toBe(180);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  const redone = await exported(page);
  expect(redone.workspace.blocks.blocks.find((block: { id: string }) => block.id === 'erg-wait').y).toBe(separated.workspace.blocks.blocks.find((block: { id: string }) => block.id === 'erg-wait').y);
  const free = (await wait.boundingBox())!, entry = (await start.boundingBox())!;
  await page.mouse.move(free.x + 25, free.y + 12); await page.mouse.down();
  await page.mouse.move(entry.x + 49, entry.y + 68, { steps: 12 }); await page.mouse.up();
  await expect(wait).not.toHaveClass(/capi-block-detached/);
  await expect(page.locator('.detached-blocks-notice')).toContainText('1 grupo fuera');
  const connected = await exported(page);
  expect(connected.workspace.blocks.blocks.find((block: { id: string }) => block.id === 'erg-start').inputs.DO.block.id).toBe('erg-wait');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 800, height: 900 });
  await page.getByLabel('Nombre del proyecto').click();
  await page.keyboard.press('Control+A'); await page.keyboard.type('Nombre editado');
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Nombre editado');
  await page.screenshot({ path: info.outputPath('ergonomia.png') });
});

test('borrador: mover propiedades pendientes y auto conectar conserva cancelar y deshacer', async ({ page }) => {
  await open(page);
  const before = await exported(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Arma tu mundo' });
  await dialog.getByRole('button', { name: /^Agregar LED\./ }).click();
  await dialog.locator('#selected-device-name').fill('Luz pendiente');
  const light = dialog.getByRole('button', { name: 'Mover Luz pendiente', exact: true });
  const initial = await light.getAttribute('style');
  await light.focus(); await page.keyboard.press('ArrowRight');
  await expect(light).not.toHaveAttribute('style', initial!);
  await expect(dialog.locator('#selected-device-name')).toHaveValue('Luz pendiente');
  await dialog.getByRole('button', { name: 'Auto conectar', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /Guardar cambios/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Deshacer último cambio' }).click();
  await expect(dialog.locator('#selected-device-name')).not.toHaveValue('Luz pendiente');
  await dialog.getByRole('button', { name: 'Rehacer último cambio' }).click();
  await expect(dialog.locator('#selected-device-name')).toHaveValue('Luz pendiente');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salir sin guardar' }).click();
  const after = await exported(page);
  expect(after.scene).toEqual(before.scene);
});

test('conexiones: estado de pines optativo, con texto y sin afirmaciones de medición', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click();
  await page.getByRole('menuitem', { name: /conexiones/i }).click();
  const dialog = page.getByRole('dialog', { name: /Conectar .* sin adivinar/ });
  await dialog.getByLabel('Ver estado simulado de los pines').check();
  await expect(dialog.getByText('Estado simulado', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Simulación lógica, no medición eléctrica/)).toBeVisible();
  await expect(dialog.getByText('0 · apagado').first()).toBeVisible();
  await dialog.getByLabel('Ver estado simulado de los pines').uncheck();
  await expect(dialog.getByText('Estado simulado', { exact: true })).toBeHidden();
});
