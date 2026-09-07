import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene } from '../lib/scene-model';

async function exportProject(page: Page) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('paralelo editable: no retira caminos ocupados; ampliar, deshacer, rehacer y JSON conservan acciones', async ({
  page,
}, testInfo) => {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible({
    timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 10000,
  });
  const project = makeProject('Tres caminos', createEmptyScene('Prueba'), {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'capi_start',
          id: 'start',
          x: 48,
          y: 40,
          inputs: {
            DO: {
              block: {
                type: 'capi_parallel',
                id: 'roads',
                fields: { BRANCHES: '3' },
                extraState: { branches: 3 },
                inputs: {
                  BRANCH2: {
                    block: {
                      type: 'capi_counter_change',
                      id: 'keep-me',
                      fields: { DELTA: 7 },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
  });
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: 'parallel.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
  const roads = page.locator('[data-id="roads"]');
  const field = roads.locator('.blocklyDropdownText').first();
  // Blockly extracts the common "caminos" suffix from dropdown labels.
  await expect(field).toHaveText('3');
  await field.click();
  await page
    .locator('.blocklyDropDownDiv')
    .getByText(/^2(?: caminos)?$/)
    .click();
  await expect(field).toHaveText('3');
  await expect(page.locator('[data-id="keep-me"]')).toHaveCount(1);
  await field.click();
  await page
    .locator('.blocklyDropDownDiv')
    .getByText(/^4(?: caminos)?$/)
    .click();
  await expect(field).toHaveText('4');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(field).toHaveText('3');
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect(field).toHaveText('4');
  const exported = await exportProject(page);
  const parallel = exported.workspace.blocks.blocks[0].inputs.DO.block;
  expect(parallel.extraState.branches).toBe(4);
  expect(parallel.inputs.BRANCH2.block.id).toBe('keep-me');
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: 'roundtrip.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exported)),
    });
  await page
    .getByRole('alertdialog', { name: 'Antes de reemplazar el editor' })
    .getByRole('button', { name: 'Descartar cambios y abrir' })
    .click();
  await expect(field).toHaveText('4');
  await expect(page.locator('[data-id="keep-me"]')).toHaveCount(1);
  await page
    .getByRole('combobox', { name: 'Modo de ejecución' })
    .selectOption('guided');
  await page.getByRole('button', { name: 'Paso', exact: true }).click();
  await expect(page.locator('.execution-now')).toContainText(
    'caminos al mismo tiempo',
  );
  await page.screenshot({
    path: testInfo.outputPath('parallel-desktop.png'),
    fullPage: true,
  });
});
