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
  const { scene, device } = addDeviceToScene(createEmptyScene('Mensajes'), 'messages', {
    name: 'Robot del portón',
    config: { mode: 'both', baudRate: 9600, messages: ['AVANZAR', 'DETENER'] },
  });
  return makeProject('Mensajes protegidos', scene, {
    blocks: { languageVersion: 0, blocks: [{
      type: 'capi_start', id: 'start', x: 40, y: 40, inputs: { DO: { block: {
        type: 'capi_message_send', id: 'send', fields: { DEVICE_ID: device.id, MESSAGE: 'AVANZAR' }, next: { block: {
          type: 'capi_message_receive', id: 'receive', fields: { DEVICE_ID: device.id, MESSAGE: 'DETENER', TIMEOUT: 5 },
          inputs: {
            EQUAL: { block: { type: 'capi_serial', id: 'equal', fields: { TEXT: 'Se detuvo' } } },
            DIFFERENT: { block: { type: 'capi_serial', id: 'different', fields: { TEXT: 'Mensaje diferente' } } },
            TIMEOUT_DO: { block: { type: 'capi_serial', id: 'timeout', fields: { TEXT: 'No llegó' } } },
          },
        } },
      } } },
    }] },
  });
}

async function importSample(page: Page) {
  const project = sample();
  await page.locator('input[type=file]').setInputFiles({ name: 'mensajes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('[data-id="receive"]')).toContainText('si es distinto');
}

test('Mensajes: configura modo, velocidad, lista y pines usados', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  await editor.getByRole('button', { name: /^Agregar Mensajes/ }).click();
  await editor.getByRole('combobox', { name: /^Modo de/ }).selectOption('send');
  await editor.getByRole('combobox', { name: /^Velocidad de/ }).selectOption('19200');
  await editor.getByRole('textbox', { name: /^Mensajes disponibles/ }).fill('ABRIR\nCERRAR');
  await expect(editor.getByRole('combobox', { name: /^Recibir de/ })).toHaveCount(0);
  await expect(editor.getByRole('combobox', { name: /^Enviar de/ })).toHaveCount(1);
});

test('Mensajes: simula botones predefinidos y toma la rama igual', async ({ page }) => {
  await open(page);
  await importSample(page);
  await page.getByRole('combobox', { name: 'Modo de ejecución' }).selectOption('guided');
  const step = page.getByRole('button', { name: 'Paso', exact: true });
  await step.click();
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  const state = page.getByRole('tabpanel', { name: 'Estado', exact: true });
  await state.getByRole('button', { name: 'DETENER', exact: true }).click();
  for (let index = 0; index < 4; index += 1) await step.click();
  await page.getByRole('tab', { name: 'Consola', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Consola', exact: true })).toContainText('Se detuvo');
});
