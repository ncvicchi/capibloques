import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';

async function openWorkshop(page: Page, modular = false) {
  await mockEditorSession(page); await page.goto('/'); await expect(page.locator('.blocklySvg')).toBeVisible();
  const e = examples.find(e => e.id === (modular ? 'conveyorProcedures' : 'conveyor'))!;
  const scene = structuredClone(e.scene); scene.canvas.conveyorEnvironment = { automaticArrivals: false, color: 'red', weight: 800 };
  await page.locator('input[type=file]').setInputFiles({ name: 'taller.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeProject(e.title, scene, e.workspace, 4))) });
  const confirm = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  await expect(page.locator('[data-conveyor-jammed]')).toBeVisible();
}
for (const modular of [false, true]) test(`taller ${modular ? 'modular' : 'directo'}: envío, entrega, pausa y reset`, async ({ page }, info) => {
  await openWorkshop(page, modular);
  if (modular) await expect(page.getByRole('tab', { name: 'Clasificación', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar paquete', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Valor simulado de Peso del paquete' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Escena', exact: true }).click(); await page.getByRole('button', { name: 'Simular', exact: true }).click();
  const world = page.locator('[data-conveyor-jammed]');
  await expect(world).toHaveAttribute('data-conveyor-delivered', '1', { timeout: 15000 }); await expect(world).toHaveAttribute('data-conveyor-jammed', 'false');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const before = await world.innerHTML(); await page.waitForTimeout(250); expect(await world.innerHTML()).toBe(before);
  await page.screenshot({ path: info.outputPath(`taller-${modular ? 'modular' : 'directo'}.png`) });
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click(); await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(world).toHaveAttribute('data-conveyor-delivered', '0'); await expect(world.locator('[data-package]')).toHaveCount(0);
});
test('taller: condiciones iniciales, guardar, cancelar y deshacer', async ({ page }) => {
  await openWorkshop(page); await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de escenas', exact: true });
  await expect(editor.getByRole('button', { name: /^Agregar Motor DC/ })).toBeDisabled();
  await editor.getByText('Taller al comenzar', { exact: true }).click(); await editor.getByLabel('Llegadas automáticas').check();
  await editor.getByRole('button', { name: /Deshacer/ }).click(); await expect(editor.getByLabel('Llegadas automáticas')).not.toBeChecked();
  await editor.getByRole('button', { name: /Rehacer/ }).click(); await expect(editor.getByLabel('Llegadas automáticas')).toBeChecked();
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('alertdialog', { name: '¿Salir sin guardar la escena?' }).getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click(); await editor.getByText('Taller al comenzar', { exact: true }).click(); await expect(editor.getByLabel('Llegadas automáticas')).not.toBeChecked();
  await editor.getByLabel('Color del paquete', { exact: true }).selectOption('blue'); await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click(); await expect(editor).toHaveCount(0);
  await page.getByRole('tab', { name: 'Estado', exact: true }).click(); await expect(page.getByRole('combobox', { name: 'Color del paquete', exact: true })).toHaveValue('blue');
});
