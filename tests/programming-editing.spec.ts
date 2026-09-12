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
  await expect(page.locator('.execution-trace')).toContainText(
    'caminos al mismo tiempo',
  );
  await expect(roads.getByText('↓ Camino 1', { exact: true })).toBeVisible();
  await expect(roads.getByText('↓ Camino 4', { exact: true })).toBeVisible();
  const branchTops = await Promise.all(
    [1, 2, 3, 4].map(index =>
      roads
        .getByText(`↓ Camino ${index}`, { exact: true })
        .evaluate(node => node.getBoundingClientRect().top),
    ),
  );
  expect(branchTops).toEqual([...branchTops].sort((left, right) => left - right));
  expect(new Set(branchTops).size).toBe(4);
  await page.screenshot({
    path: testInfo.outputPath('parallel-desktop.png'),
    fullPage: true,
  });
});

test('progreso por camino queda junto al bloque sin mover el lienzo y se limpia al detener', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const project = makeProject('Progreso paralelo', createEmptyScene('Prueba'), {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'capi_start',
          id: 'start-progress',
          x: 48,
          y: 40,
          inputs: {
            DO: {
              block: {
                type: 'capi_parallel',
                id: 'progress-roads',
                fields: { BRANCHES: '2' },
                extraState: { branches: 2 },
                inputs: {
                  BRANCH0: {
                    block: {
                      type: 'capi_repeat',
                      id: 'progress-loop',
                      fields: { TIMES: 2 },
                      inputs: {
                        DO: {
                          block: {
                            type: 'capi_wait',
                            id: 'short-delay',
                            fields: { SECONDS: 2 },
                          },
                        },
                      },
                    },
                  },
                  BRANCH1: {
                    block: {
                      type: 'capi_wait',
                      id: 'long-delay',
                      fields: { SECONDS: 4 },
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
  await page.locator('input[type="file"]').setInputFiles({
    name: 'progress.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  const blockCanvas = page.locator('.blockly-host .blocklyBlockCanvas[transform]');
  const viewportBefore = await blockCanvas.getAttribute('transform');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  const badges = page.locator('.capi-execution-badge');
  await expect(badges).toHaveCount(2);
  await expect(page.locator('[data-id="short-delay"] .capi-execution-badge-detail')).toContainText('s restantes');
  await expect(page.locator('[data-id="short-delay"] .capi-execution-badge-detail')).toContainText('V1/2');
  await expect(page.locator('.capi-execution-progress-fill')).toHaveCount(2);
  const colours = await badges.evaluateAll(nodes =>
    nodes.map(node => (node as SVGElement).style.getPropertyValue('--capi-thread-colour')),
  );
  expect(new Set(colours).size).toBe(2);
  expect(await blockCanvas.getAttribute('transform')).toBe(viewportBefore);

  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByText('Programa en pausa', { exact: true })).toBeVisible();
  const pausedText = await page.locator('[data-id="long-delay"] .capi-execution-badge-detail').textContent();
  await page.waitForTimeout(350);
  expect(await page.locator('[data-id="long-delay"] .capi-execution-badge-detail').textContent()).toBe(pausedText);
  expect(await blockCanvas.getAttribute('transform')).toBe(viewportBefore);
  await page.screenshot({
    path: testInfo.outputPath('parallel-progress-reduced-motion.png'),
    fullPage: true,
  });

  const exported = await exportProject(page);
  expect(exported.workspace.blocks.blocks[0].inputs.DO.block.id).toBe('progress-roads');
  expect(JSON.stringify(exported)).not.toContain('remainingMs');
  await page.getByRole('button', { name: 'Detener', exact: true }).click();
  await expect(badges).toHaveCount(0);
  await expect(page.locator('.capi-block-active')).toHaveCount(0);
});
