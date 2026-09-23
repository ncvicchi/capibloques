import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene } from '../lib/scene-model';
import { viewportBounds } from './viewport-fixture';

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

function threeBlockProgram() {
  return start('drag-root', {
    ...block('counter_change', 'drag-first', { DELTA: 1 }),
    next: {
      block: {
        ...block('wait', 'drag-middle', { SECONDS: 1 }),
        next: { block: block('counter_change', 'drag-last', { DELTA: 2 }) },
      },
    },
  });
}

async function dragProgramBlock(page: Page, id: string, withControl: boolean) {
  const path = page
    .locator(`.blocklyBlockCanvas [data-id="${id}"] .blocklyPath`)
    .first();
  const box = (await path.boundingBox())!;
  if (withControl) await page.keyboard.down('Control');
  await page.mouse.move(
    box.x + Math.min(45, box.width / 2),
    box.y + Math.min(18, box.height / 2),
  );
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 135, { steps: 12 });
  await page.mouse.up();
  if (withControl) await page.keyboard.up('Control');
}

function savedBlock(value: unknown, id: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.id === id) return candidate;
  for (const child of Object.values(candidate)) {
    const found = savedBlock(child, id);
    if (found) return found;
  }
}

function nextBlockId(value: Record<string, unknown> | undefined) {
  const next = value?.next;
  if (!next || typeof next !== 'object') return undefined;
  const nested = (next as Record<string, unknown>).block;
  if (!nested || typeof nested !== 'object') return undefined;
  return (nested as Record<string, unknown>).id;
}

test('arrastre normal mueve sólo el bloque y Control mueve los siguientes', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await importBlocks(page, [threeBlockProgram()]);

  await dragProgramBlock(page, 'drag-middle', false);
  let saved = await exportWorkspace(page);
  expect(nextBlockId(savedBlock(saved, 'drag-first'))).toBe('drag-last');
  expect(nextBlockId(savedBlock(saved, 'drag-middle'))).toBeUndefined();

  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  saved = await exportWorkspace(page);
  expect(nextBlockId(savedBlock(saved, 'drag-first'))).toBe('drag-middle');
  expect(nextBlockId(savedBlock(saved, 'drag-middle'))).toBe('drag-last');

  await dragProgramBlock(page, 'drag-middle', true);
  saved = await exportWorkspace(page);
  expect(nextBlockId(savedBlock(saved, 'drag-first'))).toBeUndefined();
  expect(nextBlockId(savedBlock(saved, 'drag-middle'))).toBe('drag-last');

  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  saved = await exportWorkspace(page);
  expect(nextBlockId(savedBlock(saved, 'drag-first'))).toBe('drag-middle');
  expect(nextBlockId(savedBlock(saved, 'drag-middle'))).toBe('drag-last');
});

test('permite elegir simulador o placa sin confundir sus controles', async ({ page }) => {
  await open(page);
  await importBlocks(page, [start('board-start', block('wait', 'board-wait', { SECONDS: 1 }))]);
  await page.getByLabel('Dónde ejecutar').selectOption('board');
  await expect(page.getByRole('button', { name: 'Conectar y ejecutar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Paso' })).toBeDisabled();
  await page.getByRole('button', { name: 'Conectar y ejecutar' }).click();
  await expect(page.getByRole('heading', { name: '⚡ Ejecutar en la placa' })).toBeVisible();
  await expect(page.getByText('No compila el proyecto y no manda el programa al servidor.')).toBeVisible();
});

test('el autoguardado conserva un proyecto válido durante un arrastre prolongado', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await importBlocks(page, [threeBlockProgram()]);
  await page.waitForTimeout(600);

  const path = page
    .locator('.blocklyBlockCanvas [data-id="drag-middle"] .blocklyPath')
    .first();
  const box = (await path.boundingBox())!;
  await page.mouse.move(box.x + Math.min(45, box.width / 2), box.y + 18);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.min(45, box.width / 2) + 8, box.y + 26, {
    steps: 12,
  });
  await expect(page.locator('.blocklyInsertionMarker')).toBeVisible();
  await page.waitForTimeout(900);

  await expect(page.getByLabel('Editor visual de bloques')).toBeVisible();
  expect((await page.locator('.notice').allTextContents()).join(' ')).not.toContain(
    'No pudimos guardar en este navegador',
  );

  await page.mouse.up();
  await page.waitForTimeout(600);
  const saved = await exportWorkspace(page);
  expect(savedBlock(saved, 'drag-middle')).toBeDefined();
  await expect(page.getByLabel('Editor visual de bloques')).toBeVisible();
  expect((await page.locator('.notice').allTextContents()).join(' ')).not.toContain(
    'No pudimos guardar en este navegador',
  );
});

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
  await expect(page.locator('[data-id="choice"] .capi-execution-badge title')).toContainText(
    'condición es verdadera',
  );
  await expect(
    page.locator('[data-id="choice"].capi-block-active'),
  ).toHaveCount(1);
  await page.getByText(/Últimos .* pasos \(máximo 30\)/).click();
  await page.getByRole('button', { name: 'Centrar el último bloque' }).click();
  await page.getByText(/Últimos .* pasos \(máximo 30\)/).click();
  await page.getByRole('button', { name: 'Paso', exact: true }).click();
  await expect(page.locator('[data-id="yes"] .capi-execution-badge title')).toContainText('Contador = 1');
  await page.getByRole('button', { name: 'Paso', exact: true }).click();
  await expect(page.locator('[data-id="wait"] .capi-execution-badge-detail')).toContainText('s restantes');
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
  const bounds = await viewportBounds(page);
  expect(bounds.width, JSON.stringify(bounds)).toBeLessThanOrEqual(391);
  await page
    .getByRole('region', { name: 'Qué se está ejecutando' })
    .screenshot({ path: testInfo.outputPath('execution-mobile.png') });
});
