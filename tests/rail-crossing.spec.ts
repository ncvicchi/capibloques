import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { createSceneFromTemplate } from '../lib/scene-model';

type Block = Record<string, unknown>;
const chain = (...blocks: Block[]) => blocks.reduceRight<Block | undefined>((next, block) => next ? { ...block, next: { block: next } } : block, undefined)!;
async function openRail(page: Page, protectedCrossing = true) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const watch = { type: 'capi_if', id: 'detector-if', inputs: {
    CONDITION: { block: { type: 'capi_barrier_state', id: 'detector-read', fields: { DEVICE_ID: 'rail-westDetector', STATE: 'INTERRUPTED' } } },
    DO: { block: { type: 'capi_led', id: 'detector-light', fields: { DEVICE_ID: 'rail-warning-1', BRIGHTNESS: 100 } } },
  } };
  const loop = { type: 'capi_forever', id: 'rail-loop', inputs: { DO: { block: protectedCrossing ? chain(watch, { type: 'capi_wait', id: 'poll', fields: { SECONDS: 0.02 } }) : { type: 'capi_wait', id: 'poll', fields: { SECONDS: 0.1 } } } } };
  const body = protectedCrossing ? chain(
    { type: 'capi_servo', id: 'close-north', fields: { DEVICE_ID: 'rail-northGate', ANGLE: 0 } },
    { type: 'capi_servo', id: 'close-south', fields: { DEVICE_ID: 'rail-southGate', ANGLE: 0 } }, loop,
  ) : loop;
  const project = makeProject('Paso a nivel de prueba', createSceneFromTemplate('railCrossing'), { blocks: { languageVersion: 0, blocks: [{ type: 'capi_start', id: 'main', x: 30, y: 30, inputs: { DO: { block: body } } }] } }, 4);
  await page.locator('input[type=file]').setInputFiles({ name: 'tren.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  const confirmation = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirmation.isVisible()) await confirmation.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  await expect(page.locator('.scene-world-railCrossing')).toBeVisible();
  await expect(page.locator('[data-id="rail-loop"]')).toBeVisible();
}

test('paso a nivel: detector del tren alimenta un if, cierre no bloqueante, pausa y reinicio', async ({ page }, info) => {
  await openRail(page);
  const world = page.locator('.scene-world-railCrossing');
  await expect(world.locator('[data-rail-gate="northGate"]')).toHaveAttribute('data-angle', '90.00');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(world.locator('[data-rail-gate="northGate"]')).toHaveAttribute('data-angle', '0.00');
  await expect(world.locator('[data-rail-gate="southGate"]')).toHaveAttribute('data-angle', '0.00');
  await expect(world.locator('[data-rail-train]')).toBeVisible();
  await expect.poll(async () => Number(await page.locator('[data-device-id="rail-warning-1"] .stage-led').evaluate(element => getComputedStyle(element).opacity))).toBeGreaterThan(0.9);
  await expect(world.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
  const before = await world.innerHTML();
  await page.waitForTimeout(250);
  expect(await world.innerHTML()).toBe(before);
  await page.screenshot({ path: info.outputPath('paso-a-nivel.png') });
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await expect(page.getByText('Automático: lo activa el tren virtual.', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Interrumpida', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Escena', exact: true }).click();
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(world.locator('[data-rail-train]')).toHaveCount(0);
  await expect(world.locator('[data-rail-car]')).toHaveCount(0);
  await expect(world.locator('[data-rail-gate="northGate"]')).toHaveAttribute('data-angle', '90.00');
});

test('paso a nivel: accidente auto–tren queda marcado y sólo reiniciar limpia el mundo', async ({ page }) => {
  await openRail(page, false);
  const world = page.locator('.scene-world-railCrossing');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(world.getByRole('alert')).toContainText('Choque auto–tren', { timeout: 15000 });
  await expect(world.locator('[data-rail-car][data-involved="true"]')).toHaveCount(1);
  await expect(world.locator('[data-rail-train][data-involved="true"]')).toHaveCount(1);
  const before = await world.innerHTML();
  await page.waitForTimeout(250);
  expect(await world.innerHTML()).toBe(before);
  await page.getByRole('button', { name: 'Detener', exact: true }).click();
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(world.getByRole('alert')).toContainText('Choque auto–tren');
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(world.getByRole('alert')).toHaveCount(0);
});

test('paso a nivel: armador explica roles, lugares ocupados y cancelación', async ({ page }) => {
  await openRail(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de escenas', exact: true });
  await expect(editor.getByRole('button', { name: /^Agregar Servo/ })).toBeDisabled();
  await expect(editor.getByRole('button', { name: /^Agregar Barrera infrarroja/ })).toBeDisabled();
  await editor.getByRole('button', { name: 'Mover Barrera norte', exact: true }).click();
  await expect(editor.getByText(/Función: Barrera norte/)).toContainText('Movimiento de 1,2 s');
  await expect(editor.locator('#selected-device-rotation')).toBeDisabled();
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.scene-world-railCrossing')).toBeVisible();
});
