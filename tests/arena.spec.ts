import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';
async function openArena(page: Page, modular = false) {
  await mockEditorSession(page); await page.goto('/'); await expect(page.locator('.blocklySvg')).toBeVisible();
  const e = examples.find(e => e.id === (modular ? 'robotArenaProcedures' : 'robotArena'))!;
  await page.locator('input[type=file]').setInputFiles({ name: 'pista.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeProject(e.title, e.scene, e.workspace, 4))) });
  const confirm = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  await expect(page.locator('[data-arena-goal]')).toBeVisible();
}
for (const modular of [false, true]) test(`pista ${modular ? 'modular' : 'secuencial'}: sensores, estaciones, meta y reset`, async ({ page }, info) => {
  await openArena(page, modular);
  if (modular) await expect(page.getByRole('tab', { name: 'Desvío', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await expect(page.getByText('Lectura de la pista virtual, no del hardware.', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('slider', { name: /Distancia frontal/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Escena', exact: true }).click(); await page.getByRole('button', { name: 'Simular', exact: true }).click();
  const world = page.locator('[data-arena-goal]');
  await expect(world).toHaveAttribute('data-arena-visits', '2', { timeout: 15000 });
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const before = await world.innerHTML(); await page.waitForTimeout(250); expect(await world.innerHTML()).toBe(before);
  await page.screenshot({ path: info.outputPath(`pista-${modular ? 'modular' : 'directa'}.png`) });
  await page.getByRole('button', { name: 'Reanudar', exact: true }).click(); await expect(world).toHaveAttribute('data-arena-goal', 'true', { timeout: 15000 });
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click(); await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(world).toHaveAttribute('data-arena-visits', '0'); await expect(world).toHaveAttribute('data-arena-goal', 'false'); await expect(world).toHaveAttribute('data-arena-x', '120.0');
});
test('pista: obstáculos, deshacer, rehacer, cancelar y guardar', async ({ page }) => {
  await openArena(page); await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de escenas', exact: true });
  await editor.getByText('Pista al comenzar', { exact: true }).click();
  const layout = editor.getByRole('combobox', { name: 'Disposición de la pista', exact: true });
  await layout.selectOption('obstacles'); await expect(editor.getByRole('slider', { name: 'Obstáculo 1 x', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: /Deshacer/ }).click(); await expect(layout).toHaveValue('clear');
  await editor.getByRole('button', { name: /Rehacer/ }).click(); await expect(layout).toHaveValue('obstacles');
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click(); await page.getByRole('alertdialog', { name: '¿Salir sin guardar la escena?' }).getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click(); await editor.getByText('Pista al comenzar', { exact: true }).click(); await expect(layout).toHaveValue('clear');
  await layout.selectOption('obstacles'); await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click(); await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click(); await editor.getByText('Pista al comenzar', { exact: true }).click(); await expect(layout).toHaveValue('obstacles');
});
