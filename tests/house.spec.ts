import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';

async function openHouse(page: Page, modular = false) {
  await mockEditorSession(page); await page.goto('/'); await expect(page.locator('.blocklySvg')).toBeVisible();
  const e = examples.find(e => e.id === (modular ? 'smartHouseProcedures' : 'smartHouse'))!;
  const scene = structuredClone(e.scene);
  scene.canvas.houseEnvironment = { night: true, automaticDay: false, automaticArrivals: false, nextVisitor: 'known' };
  await page.locator('input[type=file]').setInputFiles({ name: 'casa.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeProject(e.title, scene, e.workspace, 4))) });
  const confirm = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  await expect(page.locator('.scene-world-smartHouse')).toBeVisible();
}
for (const modular of [false, true]) test(`casa ${modular ? 'con tarjetas' : 'directa'}: visitante, luz, paso, pausa y reset`, async ({ page }, info) => {
  await openHouse(page, modular);
  if (modular) await expect(page.getByRole('tab', { name: 'Acceso', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar visitante', exact: true }).click();
  await expect(page.getByText('Automático: lo genera la casa virtual.', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Valor simulado de Luminosidad interior' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Escena', exact: true }).click();
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  const world = page.locator('.scene-world-smartHouse');
  await expect(world.locator('[data-house-person][data-phase="inside"]').first()).toBeVisible({ timeout: 15000 });
  await expect(world).toHaveAttribute('data-house-inside-lux', '2700');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
  const before = await world.innerHTML(); await page.waitForTimeout(250); expect(await world.innerHTML()).toBe(before);
  await page.screenshot({ path: info.outputPath(`casa-${modular ? 'modular' : 'directa'}.png`) });
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click(); await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(world.locator('[data-house-person]')).toHaveCount(0); await expect(world).toHaveAttribute('data-house-door-angle', '0.0');
});
test('casa: condiciones iniciales con undo, guardar y cancelar', async ({ page }) => {
  await openHouse(page); await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de escenas', exact: true });
  await expect(editor.getByRole('button', { name: /^Agregar Servo/ })).toBeDisabled();
  await expect(editor.getByRole('button', { name: /^Agregar LED/ })).toBeEnabled();
  await editor.getByText('Casa al comenzar', { exact: true }).click();
  await editor.getByLabel('Es de noche').uncheck(); await editor.getByRole('button', { name: /Deshacer/ }).click(); await expect(editor.getByLabel('Es de noche')).toBeChecked();
  await editor.getByRole('button', { name: /Rehacer/ }).click(); await expect(editor.getByLabel('Es de noche')).not.toBeChecked();
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('alertdialog', { name: '¿Salir sin guardar la escena?' }).getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await expect(editor).toHaveCount(0); await expect(page.locator('.scene-world-smartHouse')).toHaveAttribute('data-house-night', 'true');
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click(); await editor.getByText('Casa al comenzar', { exact: true }).click(); await editor.getByLabel('Es de noche').uncheck();
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click(); await expect(editor).toHaveCount(0); await expect(page.locator('.scene-world-smartHouse')).toHaveAttribute('data-house-night', 'false');
});
