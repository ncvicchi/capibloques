import { expect, test, type Page } from '@playwright/test';
import { makeProject } from '../lib/capiblocks';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model';
import { mockEditorSession } from './editor-fixture';

async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible({ timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 10000 });
}

function barrierProject() {
  let scene = createEmptyScene('Paso protegido');
  const barrierResult = addDeviceToScene(scene, 'infraredBarrier');
  scene = barrierResult.scene;
  const barrier = barrierResult.device;
  const ledResult = addDeviceToScene(scene, 'led');
  scene = ledResult.scene;
  const led = ledResult.device;
  return makeProject('Barrera infrarroja', scene, { blocks: { languageVersion: 0, blocks: [{
    type: 'capi_start', id: 'start', x: 40, y: 40, inputs: { DO: { block: {
      type: 'capi_if', id: 'if-barrier', inputs: {
        CONDITION: { block: { type: 'capi_barrier_state', id: 'barrier-state', fields: { DEVICE_ID: barrier.id, STATE: 'INTERRUPTED' } } },
        DO: { block: { type: 'capi_led', id: 'led-on', fields: { DEVICE_ID: led.id, BRIGHTNESS: 100 } } },
        ELSE: { block: { type: 'capi_led', id: 'led-off', fields: { DEVICE_ID: led.id, BRIGHTNESS: 0 } } },
      },
    } } },
  }] } });
}

test('Barrera infrarroja: se agrega y configura la polaridad en la escena', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  await editor.getByRole('button', { name: /^Agregar Barrera infrarroja/ }).click();
  await expect(editor.getByLabel('Nivel de interrupción de Barrera infrarroja 1')).toHaveValue('LOW');
  await editor.getByLabel('Nivel de interrupción de Barrera infrarroja 1').selectOption('HIGH');
  await expect(editor.getByRole('combobox', { name: /^Salida digital del detector de/ })).toHaveCount(1);
  await editor.getByRole('button', { name: 'Guardar cambios', exact: false }).click();
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Barrera infrarroja 1', exact: true })).toBeVisible();
});

test('Barrera infrarroja: alterna libre/interrumpida y decide una acción', async ({ page }) => {
  await open(page);
  const project = barrierProject();
  await page.locator('input[type=file]').setInputFiles({
    name: 'barrera.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('[data-id="barrier-state"]')).toContainText('interrumpida');

  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  const interrupted = page.getByRole('button', { name: 'Interrumpida', exact: true });
  await interrupted.click();
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();

  await expect(interrupted).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.device-state-grid article').filter({ hasText: 'LED 1' })).toContainText('100%');
  await expect(page.locator('.device-state-grid article').filter({ hasText: 'Barrera infrarroja 1' })).toContainText('Interrumpida');
});
