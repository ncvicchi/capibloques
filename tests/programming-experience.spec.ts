import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene } from '../lib/scene-model';

const block = (
  type: string,
  id: string,
  fields: Record<string, unknown> = {},
) => ({ type: `capi_${type}`, id, fields });
const start = (id: string, body?: unknown, y = 40) => ({
  type: 'capi_start',
  id,
  x: 48,
  y,
  ...(body ? { inputs: { DO: { block: body } } } : {}),
});
async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.getByLabel('Editor visual de bloques')).toBeVisible();
  await expect(page.locator('.blocklySvg')).toBeVisible({ timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 10000 });
}
async function importBlocks(page: Page, blocks: unknown[]) {
  const project = makeProject(
    'Caminos de prueba',
    createEmptyScene('Banco de pruebas'),
    { blocks: { languageVersion: 0, blocks } },
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: 'caminos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await expect(
    page.getByRole('textbox', { name: 'Nombre del proyecto' }),
  ).toHaveValue('Caminos de prueba');
}
async function exportWorkspace(page: Page) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  const stream = await (await pending).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString()).workspace;
}

test('inicio único: obligatorio, sin categoría y protegido de borrar/copiar; acciones editables', async ({
  page,
}) => {
  await open(page);
  await importBlocks(page, [
    start('only', block('counter_change', 'action', { DELTA: 1 })),
  ]);
  await expect(
    page.getByRole('treeitem', { name: 'Inicio', exact: true }),
  ).toHaveCount(0);
  const root = page.locator('.blocklyBlockCanvas > [data-id="only"]');
  const box = (await root.locator('.blocklyPath').first().boundingBox())!;
  await page.mouse.click(box.x + 40, box.y + 20);
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  let saved = await exportWorkspace(page);
  expect(
    saved.blocks.blocks.filter(
      (item: { type: string }) => item.type === 'capi_start',
    ),
  ).toHaveLength(1);
  expect(JSON.stringify(saved)).toContain('action');
  // Opening the header menu can scroll its own action strip. Read the current
  // geometry after closing it instead of dragging a stale screen coordinate.
  const beforeMove = await root.getAttribute('transform');
  const dragBox = (await root.locator('.blocklyPath').first().boundingBox())!;
  await page.mouse.move(dragBox.x + 40, dragBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + 110, dragBox.y - 30, { steps: 10 });
  await page.mouse.up();
  await expect(root).not.toHaveAttribute('transform', beforeMove!);
  const undo = page.getByRole('button', { name: 'Deshacer', exact: true });
  await expect(undo).toBeEnabled();
  await undo.click();
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  saved = await exportWorkspace(page);
  expect(
    saved.blocks.blocks.filter(
      (item: { type: string }) => item.type === 'capi_start',
    ),
  ).toHaveLength(1);
});

test('importación antigua: reúne inicios, conserva acciones y exporta paralelo portable', async ({
  page,
}) => {
  await open(page);
  await importBlocks(page, [
    start('first', block('counter_change', 'add-one', { DELTA: 1 })),
    start('second', block('counter_change', 'add-ten', { DELTA: 10 }), 200),
  ]);
  const saved = await exportWorkspace(page);
  expect(saved.blocks.blocks).toHaveLength(1);
  const root = saved.blocks.blocks[0];
  expect(root.id).toBe('first');
  expect(root).not.toHaveProperty('deletable'); // Protection is a runtime invariant, not a user edit.
  const fork = root.inputs.DO.block;
  expect(fork.type).toBe('capi_parallel');
  expect(fork.inputs.BRANCH0.block.id).toBe('add-one');
  expect(fork.inputs.BRANCH1.block.id).toBe('add-ten');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(
    page.getByText('Programa terminado', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('region', { name: 'Qué se está ejecutando' })
    .getByText(/Últimos/)
    .click();
  await expect(page.locator('.execution-trace')).toContainText('Contador = 11');
});

test('paso visible: condición, espera y continuación, guiado y normal sin reiniciar contador', async ({
  page,
}) => {
  await open(page);
  await importBlocks(page, [
    start('start', {
      ...block('if', 'choice'),
      inputs: {
        CONDITION: {
          block: block('compare', 'comparison', {
            LEFT: 3,
            OPERATOR: 'GT',
            RIGHT: 2,
          }),
        },
        DO: {
          block: {
            ...block('counter_change', 'yes', { DELTA: 1 }),
            next: {
              block: {
                ...block('wait', 'wait', { SECONDS: 0.1 }),
                next: {
                  block: block('counter_change', 'after', { DELTA: 10 }),
                },
              },
            },
          },
        },
      },
    }),
  ]);
  await page
    .getByRole('combobox', { name: 'Modo de ejecución' })
    .selectOption('guided');
  await page.getByRole('button', { name: 'Paso', exact: true }).click();
  await expect(page.locator('.execution-now')).toContainText(
    'condición es verdadera',
  );
  await expect(
    page.locator('[data-id="choice"].capi-block-active'),
  ).toHaveCount(1);
  await page
    .getByRole('checkbox', { name: 'Seguir el bloque en pantalla' })
    .check();
  await page.getByRole('button', { name: 'Paso', exact: true }).click();
  await expect(page.locator('.execution-now')).toContainText('Contador = 1');
  await page.getByRole('button', { name: 'Paso', exact: true }).click();
  await expect(page.locator('.execution-now')).toContainText('Esperamos 0.1');
  await page
    .getByRole('combobox', { name: 'Modo de ejecución' })
    .selectOption('normal');
  await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
  await expect(
    page.getByText('Programa terminado', { exact: true }),
  ).toBeVisible();
  await page.locator('.execution-panel summary').click();
  await expect(page.locator('.execution-trace')).toContainText('Contador = 11');
});

test('vacío y móvil: comienzo automático, ayuda y controles al 200%', async ({
  page,
}, testInfo) => {
  await open(page);
  await importBlocks(page, []);
  const saved = await exportWorkspace(page);
  expect(saved.blocks.blocks).toHaveLength(1);
  expect(saved.blocks.blocks[0].type).toBe('capi_start');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page
    .getByRole('combobox', { name: 'Modo de ejecución' })
    .selectOption('guided');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(391);
  await page
    .getByRole('region', { name: 'Qué se está ejecutando' })
    .screenshot({ path: testInfo.outputPath('execution-mobile.png') });
});
