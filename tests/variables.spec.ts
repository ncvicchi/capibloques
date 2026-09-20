import { expect, test, type Page } from '@playwright/test';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene } from '../lib/scene-model';
import { mockEditorSession } from './editor-fixture';

async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
}

function variableProject() {
  return makeProject('Datos de la aventura', createEmptyScene('Laboratorio de datos'), {
    variables: [
      { name: 'puntos', id: 'score', type: 'Number' },
      { name: 'saludo', id: 'greeting', type: 'String' },
      { name: 'listo', id: 'ready', type: 'Boolean' },
    ],
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: 'capi_start', id: 'start', x: 40, y: 40, inputs: { DO: { block: {
          type: 'capi_counter_set', id: 'counter', fields: { VALUE: 7 }, next: { block: {
            type: 'capi_variable_set_number', id: 'set-score', fields: { VAR: { id: 'score' } },
            inputs: { VALUE: { block: {
              type: 'capi_number_math', id: 'sum', fields: { OPERATOR: 'ADD' }, inputs: {
                LEFT: { block: { type: 'capi_counter_value', id: 'counter-value' } },
                RIGHT: { shadow: { type: 'capi_value_number', id: 'five', fields: { VALUE: 5 } } },
              },
            } } },
            next: { block: {
              type: 'capi_serial', id: 'write-score', fields: { TEXT: 'El contador está en ' },
              inputs: { DYNAMIC: { block: { type: 'capi_variable_get_number', id: 'read-score', fields: { VAR: { id: 'score' } } } } },
            } },
          } },
        } } },
      }],
    },
  });
}

test('variables: conserva tipos, calcula valores y los usa dentro de mensajes', async ({ page }) => {
  await open(page);
  const project = variableProject();
  await page.locator('input[type=file]').setInputFiles({
    name: 'variables.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('[data-id="set-score"]')).toContainText('puntos');

  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  const state = page.getByRole('tabpanel', { name: 'Estado', exact: true });
  await expect(state).toContainText('puntos');
  await expect(state).toContainText('12');

  await page.getByRole('tab', { name: 'Consola', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Consola', exact: true })).toContainText('El contador está en 12');

  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.workspace.variables).toEqual(project.workspace.variables);
});

test('variables: la categoría Datos permite crear cada tipo con un nombre amigable', async ({ page }) => {
  await open(page);
  await page.locator('.blocklyToolboxCategory').filter({ hasText: 'Datos' }).click();
  await expect(page.getByText('Crear número', { exact: true })).toBeVisible();
  await expect(page.getByText('Crear texto', { exact: true })).toBeVisible();
  await expect(page.getByText('Crear sí/no', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept('vidas'));
  await page.getByText('Crear número', { exact: true }).click();

  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.workspace.variables).toContainEqual(expect.objectContaining({ name: 'vidas', type: 'Number' }));
});
