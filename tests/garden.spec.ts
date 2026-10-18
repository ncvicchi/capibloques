import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';

async function openGarden(page: Page, modular = false) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const example = examples.find(item => item.id === (modular ? 'greenhouseProcedures' : 'greenhouse'))!;
  const project = makeProject(example.title, example.scene, example.workspace, 4);
  await page.locator('input[type=file]').setInputFiles({ name: 'huerta.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  const confirmation = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirmation.isVisible()) await confirmation.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  await expect(page.locator('.scene-world-greenhouse')).toBeVisible();
  await expect(page.locator('[data-id="start-main"]')).toBeInViewport();
}

for (const modular of [false, true]) test(`huerta ${modular ? 'modular' : 'directa'}: riego realimentado, pausa, clima y reinicio`, async ({ page }, info) => {
  await openGarden(page, modular);
  const world = page.locator('.scene-world-greenhouse');
  await expect(world.locator('[data-garden-bed]')).toHaveCount(2);
  if (modular) await expect(page.getByRole('tab', { name: 'Cuidar plantas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(world.locator('[data-garden-watering="outside"]')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
  const before = await world.innerHTML(); await page.waitForTimeout(250); expect(await world.innerHTML()).toBe(before);
  await page.screenshot({ path: info.outputPath(`huerta-${modular ? 'modular' : 'directa'}.png`) });
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await expect(page.getByText('Automático: lo genera la huerta virtual.', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('slider', { name: 'humedad simulada de Tierra de la huerta' })).toHaveCount(0);
  await page.getByLabel('Lluvia en la huerta exterior').check();
  await page.getByLabel('Sol de la huerta', { exact: true }).selectOption('strong');
  await page.getByRole('tab', { name: 'Escena', exact: true }).click();
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(world.locator('[data-garden-bed="outside"]')).toHaveAttribute('data-moisture', '55.0');
  await expect(world.locator('[data-garden-bed="inside"]')).toHaveAttribute('data-health', '90.0');
});

test('huerta: clima inicial, roles, límites, guardar y cancelar', async ({ page }) => {
  await openGarden(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de escenas', exact: true });
  await expect(editor.getByRole('button', { name: /^Agregar Servo/ })).toBeDisabled();
  await editor.getByText('Clima inicial de la huerta', { exact: true }).click();
  await editor.getByLabel('Sol de la huerta', { exact: true }).selectOption('strong');
  await editor.getByRole('button', { name: /Deshacer/ }).click();
  await expect(editor.getByLabel('Sol de la huerta', { exact: true })).toHaveValue('medium');
  await editor.getByRole('button', { name: /Rehacer/ }).click();
  await expect(editor.getByLabel('Sol de la huerta', { exact: true })).toHaveValue('strong');
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('alertdialog', { name: '¿Salir sin guardar la escena?' }).getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await editor.getByText('Clima inicial de la huerta', { exact: true }).click();
  await expect(editor.getByLabel('Sol de la huerta', { exact: true })).toHaveValue('medium');
  await editor.getByLabel('Lluvia en la huerta exterior').check();
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await expect(page.getByLabel('Lluvia en la huerta exterior')).toBeChecked();
});
