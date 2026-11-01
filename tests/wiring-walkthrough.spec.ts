import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene, createSceneDevice } from '../lib/scene-model';
import { projectTargetForBoard, type BoardProfileId } from '../lib/board-profiles';

async function openGuide(page: Page, board: BoardProfileId, missing = false, kind: 'led' | 'trafficLight' = 'led') {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const scene = createEmptyScene('Prueba de conexiones');
  if (kind === 'trafficLight') scene.canvas.background = 'crossroads';
  const led = createSceneDevice(kind, [], { boardProfile: board });
  led.name = kind === 'led' ? 'Luz del jardín' : 'Semáforo del cruce';
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
    await dialog.getByRole('combobox', { name: 'Resaltar conexiones de' }).selectOption({ label: 'Luz del jardín' });
    const selectedDevice = await dialog.getByRole('combobox', { name: 'Resaltar conexiones de' }).inputValue();
    await expect(dialog.locator('.board-contact[aria-pressed="true"]')).toHaveCount(1);
    await expect(dialog.locator('.wiring-table tr[data-selected="true"]')).toHaveCount(1);
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
    await expect(dialog.getByRole('img', { name: 'Luz del jardín: contacto LED. Ilustración de conexión.' })).toBeVisible();
    await expect(dialog.locator('[data-wire-connected="true"]')).toHaveCount(1);
    const wire = dialog.locator('.wiring-live-wire > path').last();
    const desktopPath = await wire.getAttribute('d');
    await page.setViewportSize({ width: 500, height: 900 });
    await expect.poll(() => wire.getAttribute('d')).not.toBe(desktopPath);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(() => wire.getAttribute('d')).toBe(desktopPath);
    await expect(dialog.getByRole('heading', { name: 'LED', exact: true })).toBeFocused();
    await page.screenshot({ path: info.outputPath('conexion-resaltada.png') });
    await dialog.getByRole('button', { name: 'Atrás', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Uní las masas: GND' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await dialog.getByRole('button', { name: 'Terminar recorrido' }).click();
    await expect(dialog.getByRole('heading', { name: 'Recorrido terminado' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Volver al listado y al chequeo' }).click();
    await expect(dialog.locator('.wiring-pin-button').first()).toHaveText(pin!);
    await expect(dialog.getByRole('combobox', { name: 'Resaltar conexiones de' })).toHaveValue(selectedDevice);
    await expect(dialog.locator('.wiring-table tr[data-selected="true"]')).toHaveCount(1);
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
  await expect(dialog.locator('[data-wire-connected="true"]')).toHaveCount(0);
});

test('Waveshare virtual explica por qué no hay recorrido de cables', async ({ page }) => {
  const dialog = await openGuide(page, 'waveshare-esp32-s3-touch-lcd-5-28117');
  await expect(dialog.getByRole('button', { name: 'Paso a paso', exact: true })).toBeDisabled();
  await expect(dialog.getByText('En la Waveshare los componentes son virtuales: no llevan cables GPIO.')).toBeVisible();
});

test('módulo de semáforo: conector GND/R/Y/G y cable en el pin físico del paso', async ({ page }, info) => {
  const dialog = await openGuide(page, 'wemos-d1-r32', false, 'trafficLight');
  await dialog.getByRole('button', { name: 'Paso a paso', exact: true }).click();
  await dialog.getByRole('radio', { name: 'Módulo', exact: true }).check();
  await expect(dialog.locator('.wiring-step-card')).not.toContainText(/resistencias/i);
  await expect(dialog.locator('[data-module-pin]')).toHaveCount(4);
  await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
  for (const pin of ['GND', 'R', 'Y', 'G']) {
    await expect(dialog.locator('[data-module-pin][data-active="true"]')).toHaveAttribute('data-module-pin', pin);
    await expect(dialog.locator(`[data-module-pin="${pin}"] .wiring-component-terminal`)).toHaveCount(1);
    await expect(dialog.locator('[data-wire-connected="true"]')).toHaveCount(1);
    if (pin === 'R') await page.screenshot({ path: info.outputPath('modulo-semaforo-R.png') });
    if (pin !== 'G') await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
  }
  await expect(dialog).toContainText('G (verde)');
  await expect(dialog.locator('.wiring-step-card')).not.toContainText(/resistencias/i);
});

test('orientación directa: invertir, guardar y localizar GND en el GPIO cambiado', async ({ page }) => {
  let dialog = await openGuide(page, 'wemos-d1-r32', false, 'trafficLight');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Editor de escenas', exact: true }) });
  await editor.getByRole('button', { name: 'Mover Semáforo del cruce', exact: true }).click();
  await editor.getByRole('button', { name: 'Invertir orientación', exact: true }).click();
  await editor.getByRole('button', { name: 'Guardar cambios', exact: false }).click();
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await page.getByRole('button', { name: 'Más herramientas' }).click();
  await page.getByRole('menuitem', { name: 'Ver conexiones' }).click();
  dialog = page.getByRole('dialog', { name: /Conectar .* sin adivinar/ });
  await dialog.getByRole('button', { name: 'Paso a paso', exact: true }).click();
  await expect(dialog.locator('[data-orientation="inverted"]')).toHaveCount(1);
  await expect(dialog.locator('.wiring-step-card')).toContainText('GND → GPIO 16');
  await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(dialog.locator('.wiring-step-route')).toContainText('GPIO 16');
  await expect(dialog.locator('.board-contact.selected')).toHaveAttribute('data-gpio', '16');
  await expect(dialog.locator('[data-module-pin="GND"] .wiring-component-terminal')).toHaveCount(1);
});

test('semáforo con LED sueltos: elección inicial, resistencia y polaridad; volver permite cambiar montaje', async ({ page }, info) => {
  const dialog = await openGuide(page, 'wemos-d1-r32', false, 'trafficLight');
  await dialog.getByRole('button', { name: 'Paso a paso', exact: true }).click();
  await dialog.getByRole('radio', { name: 'LED y resistencia en serie' }).check();
  await expect(dialog.locator('[data-loose-led]')).toHaveCount(3);
  await expect(dialog.locator('[data-module-pin]')).toHaveCount(0);
  await expect(dialog.locator('.wiring-step-card')).toContainText('una resistencia de 220–330 Ω para cada uno');
  await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(dialog.locator('.wiring-step-card')).toContainText('Conectá el cátodo (−) de cada LED a GND');
  await expect(dialog.locator('[data-wire-connected="true"]')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(dialog.locator('.wiring-step-card')).toContainText('ánodo (+, pata larga) del led rojo');
  await expect(dialog.locator('.wiring-component-figure')).toContainText('220–330 Ω');
  await page.screenshot({ path: info.outputPath('semaforo-led-resistencia.png') });
  await dialog.getByRole('button', { name: 'Atrás', exact: true }).click();
  await dialog.getByRole('button', { name: 'Atrás', exact: true }).click();
  await expect(dialog.getByRole('radio', { name: 'LED y resistencia en serie' })).toBeChecked();
  await dialog.getByRole('radio', { name: 'Módulo', exact: true }).check();
  await expect(dialog.locator('[data-module-pin]')).toHaveCount(4);
  await expect(dialog.locator('.wiring-step-card')).not.toContainText(/resistencias/i);
  await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(dialog.locator('[data-module-pin][data-active="true"]')).toHaveAttribute('data-module-pin', 'GND');
});
