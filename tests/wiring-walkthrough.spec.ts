import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene, createSceneDevice } from '../lib/scene-model';
import { projectTargetForBoard, type BoardProfileId } from '../lib/board-profiles';

async function openGuide(page: Page, board: BoardProfileId, missing = false) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const scene = createEmptyScene('Prueba de conexiones');
  const led = createSceneDevice('led', [], { boardProfile: board });
  led.name = 'Luz del jardín';
  scene.devices.push(led);
  const project = makeProject('Recorrido de cables', scene, { blocks: { languageVersion: 0, blocks: [{ type: 'capi_start', id: 'start' }] } }, 1, projectTargetForBoard(board));
  if (missing) (project.scene.devices[0].pins as Record<string, number | null>).signal = null;
  await page.locator('input[type="file"]').setInputFiles({ name: 'wiring.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  const replacement = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' }).or(replacement)).toBeVisible();
  if (await replacement.isVisible()) await replacement.getByRole('button', { name: 'Conservar copia local y abrir' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(project.metadata.title);
  await page.getByRole('button', { name: 'Más herramientas' }).click();
  await page.getByRole('menuitem', { name: 'Ver conexiones' }).click();
  return page.getByRole('dialog', { name: /Conectar .* sin adivinar/ });
}

for (const board of ['wemos-d1-r32', 'diymall-esp32-s3-devkitc-v1-n16r8'] as const) {
  test(`${board}: guía ida/vuelta, pin exacto y revisión conservada`, async ({ page }, info) => {
    const dialog = await openGuide(page, board);
    const pin = await dialog.locator('.wiring-pin-button').first().textContent();
    await dialog.getByRole('checkbox').first().check();
    await dialog.getByRole('button', { name: 'Paso a paso', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Primero, alimentación y materiales' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Atrás', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Uní las masas: GND' })).toBeVisible();
    expect(await dialog.locator('.board-contact.selected').count()).toBeGreaterThan(0);
    await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(dialog.locator('.wiring-step-route')).toContainText(pin!);
    await expect(dialog.locator('.board-contact.selected')).toHaveCount(1);
    await expect(dialog.locator('.board-contact.selected .board-active-arrow')).toHaveCount(1);
    await expect(dialog.locator('.wiring-step-component')).toHaveText('Luz del jardín');
    await expect(dialog.getByRole('heading', { name: 'LED', exact: true })).toBeFocused();
    await page.screenshot({ path: info.outputPath('conexion-resaltada.png') });
    await dialog.getByRole('button', { name: 'Atrás', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Uní las masas: GND' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await dialog.getByRole('button', { name: 'Terminar recorrido' }).click();
    await expect(dialog.getByRole('heading', { name: 'Recorrido terminado' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Volver al listado y al chequeo' }).click();
    await expect(dialog.locator('.wiring-pin-button').first()).toHaveText(pin!);
    await expect(dialog.getByRole('checkbox').first()).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Conexiones revisadas', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Paso a paso', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Primero, alimentación y materiales' })).toBeVisible();
  });
}

test('no inventa un destino cuando falta asignar el pin', async ({ page }) => {
  const dialog = await openGuide(page, 'wemos-d1-r32', true);
  await dialog.getByRole('button', { name: 'Paso a paso', exact: true }).click();
  await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(dialog.getByText('Esta señal está sin asignar.', { exact: false })).toBeVisible();
  await expect(dialog.locator('.board-contact.selected')).toHaveCount(0);
});

test('Waveshare virtual explica por qué no hay recorrido de cables', async ({ page }) => {
  const dialog = await openGuide(page, 'waveshare-esp32-s3-touch-lcd-5-28117');
  await expect(dialog.getByRole('button', { name: 'Paso a paso', exact: true })).toBeDisabled();
  await expect(dialog.getByText('En la Waveshare los componentes son virtuales: no llevan cables GPIO.')).toBeVisible();
});
