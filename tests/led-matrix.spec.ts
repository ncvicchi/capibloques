import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model';

async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible({ timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 10000 });
}

function sample() {
  const { scene, device } = addDeviceToScene(createEmptyScene('Matriz'), 'ledMatrix');
  return makeProject('Cartel luminoso', scene, { blocks: { languageVersion: 0, blocks: [{
    type: 'capi_start', id: 'start', x: 40, y: 40, inputs: { DO: { block: {
      type: 'capi_matrix_pattern', id: 'pattern', fields: { DEVICE_ID: device.id, PATTERN_ID: 'heart' }, next: { block: {
        type: 'capi_matrix_scroll', id: 'scroll', fields: { DEVICE_ID: device.id, TEXT: 'HOLA', SPEED: 80 },
      } },
    } } },
  }] } });
}

test('Matriz LED: configura hardware y edita un dibujo de 32 × 8', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  await editor.getByRole('button', { name: /^Agregar Matriz LED/ }).click();
  await editor.getByRole('slider', { name: /^Brillo/ }).fill('9');
  await editor.getByLabel('Orden físico de los módulos').selectOption('right-to-left');
  await editor.getByLabel('Orientación').selectOption('rotated');
  const cell = editor.getByRole('button', { name: 'Columna 32, fila 8' });
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(editor.getByRole('button', { name: /^Agregar Pantalla de mensajes/ })).toBeDisabled();
  await expect(editor.getByRole('combobox', { name: /^Datos \(DIN\) de/ })).toHaveCount(1);
});

test('Matriz LED: muestra patrón y deja visible el progreso del texto', async ({ page }) => {
  await open(page);
  const project = sample();
  await page.locator('input[type=file]').setInputFiles({ name: 'matriz.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('[data-id="pattern"]')).toContainText('mostrar dibujo');
  await page.getByRole('combobox', { name: 'Modo de ejecución' }).selectOption('guided');
  const step = page.getByRole('button', { name: 'Paso', exact: true });
  await step.click();
  await expect(page.locator('.led-matrix-preview i.on').first()).toBeVisible();
  await step.click();
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Estado', exact: true })).toContainText('Texto en movimiento');
});
