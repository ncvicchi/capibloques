import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';

async function openParking(page: Page, modular = false) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const example = examples.find(item => item.id === (modular ? 'parkingProcedures' : 'parking'))!;
  const project = makeProject(example.title, example.scene, example.workspace, 4);
  await page.locator('input[type=file]').setInputFiles({ name: 'estacionamiento.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  const confirmation = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirmation.isVisible()) await confirmation.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  await expect(page.locator('.scene-world-parking')).toBeVisible();
}

for (const modular of [false, true]) test(`estacionamiento ${modular ? 'modular' : 'directo'}: autos, detectores, pausa y reinicio`, async ({ page }, info) => {
  await openParking(page, modular);
  const world = page.locator('.scene-world-parking');
  await expect(world.locator('[data-parking-space]')).toHaveCount(8);
  if (modular) {
    await expect(page.getByRole('tab', { name: 'Accesos', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Paso completo', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Cartel', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(world.locator('[data-parking-car][data-phase="parked"]').first()).toBeVisible({ timeout: 15000 });
  await expect(world).toHaveAttribute('data-parking-jammed', 'false');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
  const before = await world.innerHTML();
  await page.waitForTimeout(250);
  expect(await world.innerHTML()).toBe(before);
  await page.screenshot({ path: info.outputPath(`estacionamiento-${modular ? 'modular' : 'directo'}.png`) });
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await expect(page.getByText('Automático: lo activa el auto virtual.', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Interrumpida', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Escena', exact: true }).click();
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(world.locator('[data-parking-car]')).toHaveCount(0);
  await expect(world.locator('[data-parking-detector][data-interrupted="true"]')).toHaveCount(0);
});

test('estacionamiento: capacidad con deshacer, guardar y cancelar; slots y ayuda', async ({ page }) => {
  await openParking(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de escenas', exact: true });
  await expect(editor.getByRole('button', { name: /^Agregar Servo/ })).toBeDisabled();
  await expect(editor.getByRole('button', { name: /^Agregar Barrera infrarroja/ })).toBeDisabled();
  const select = editor.getByLabel('Plazas del estacionamiento', { exact: true });
  await select.selectOption('4');
  await expect(editor.locator('[data-parking-space]')).toHaveCount(4);
  await editor.getByRole('button', { name: /Deshacer/ }).click();
  await expect(select).toHaveValue('8');
  await editor.getByRole('button', { name: /Rehacer/ }).click();
  await expect(select).toHaveValue('4');
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('alertdialog', { name: '¿Salir sin guardar la escena?' }).getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.scene-world-parking [data-parking-space]')).toHaveCount(8);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await editor.getByLabel('Plazas del estacionamiento', { exact: true }).selectOption('12');
  await editor.getByRole('button', { name: 'Mover Barrera de entrada', exact: true }).click();
  await expect(editor.getByText(/Función: Barrera de entrada/)).toContainText('1,2 s');
  await expect(editor.locator('#selected-device-rotation')).toBeDisabled();
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.scene-world-parking [data-parking-space]')).toHaveCount(12);
});
