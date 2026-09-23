import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model';

async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible({ timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 10000 });
}

function sample(text = 'HOLA', repeatMode = 'FOREVER') {
  const { scene, device } = addDeviceToScene(createEmptyScene('Matriz'), 'ledMatrix');
  return makeProject('Cartel luminoso', scene, { blocks: { languageVersion: 0, blocks: [{
    type: 'capi_start', id: 'start', x: 40, y: 40, inputs: { DO: { block: {
      type: 'capi_matrix_pattern', id: 'pattern', fields: { DEVICE_ID: device.id, PATTERN_ID: 'heart' }, next: { block: {
        type: 'capi_matrix_scroll', id: 'scroll', fields: { DEVICE_ID: device.id, TEXT: text, SPEED: 80, REPEAT_MODE: repeatMode, REPEAT_COUNT: 2 },
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
  await expect(editor.getByLabel('Orden físico de los módulos')).toHaveValue('right-to-left');
  await editor.getByLabel('Orden físico de los módulos').selectOption('left-to-right');
  await editor.getByLabel('Orientación').selectOption('rotated');
  const cell = editor.getByRole('button', { name: 'Columna 32, fila 8' });
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(editor.getByRole('button', { name: /^Agregar Pantalla de texto/ })).toBeDisabled();
  await expect(editor.getByRole('note')).toContainText('Ya usás Matriz LED 1');
  await expect(editor.getByRole('note')).toContainText('Pantalla de texto o Matriz LED');
  await expect(editor.getByRole('button', { name: /Agregar Pantalla de texto.*No disponible: ya usás Matriz LED 1/ })).toBeDisabled();
  await expect(editor.getByRole('combobox', { name: /^Datos \(DIN\) de/ })).toHaveCount(1);
});

test('Matriz LED: explica por qué no puede agregarse si ya hay una pantalla', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  await editor.getByRole('button', { name: /^Agregar Pantalla de texto/ }).click();
  await expect(editor.getByRole('note')).toContainText('Ya usás Pantalla de texto 1');
  await expect(editor.getByRole('note')).toContainText('Para elegir otra, primero quitá la actual');
  await expect(editor.getByRole('button', { name: /Agregar Matriz LED.*No disponible: ya usás Pantalla de texto 1/ })).toBeDisabled();
});

test('Escena: el tachito y Supr permiten quitar la salida visual', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  await editor.getByRole('button', { name: /^Agregar Matriz LED/ }).click();
  await editor.getByRole('button', { name: /Quitar Matriz LED 1/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(editor.getByRole('button', { name: /^Agregar Pantalla de texto/ })).toBeEnabled();

  await editor.getByRole('button', { name: /^Agregar Matriz LED/ }).click();
  const matrix = editor.getByRole('button', { name: 'Mover Matriz LED 1', exact: true });
  await matrix.focus();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('alertdialog')).toContainText('¿Quitar este componente?');
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

test('Matriz LED: limita el texto a 32 caracteres sin trabar la simulación', async ({ page }) => {
  await open(page);
  const project = sample('12345678901234567890123456789012NO-DEBE-ENTRAR', 'ONCE');
  await page.locator('input[type=file]').setInputFiles({
    name: 'matriz-limite.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });

  const block = page.locator('[data-id="scroll"]');
  await expect(block).toContainText('12345678901234567890123456789012');
  await expect(block).not.toContainText('NO-DEBE-ENTRAR');
  await expect(block).toContainText('32/32 · límite');

  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.locator('.notice')).not.toContainText('necesitan una corrección');
  await expect(page.locator('.led-matrix-preview')).toBeVisible();
});
