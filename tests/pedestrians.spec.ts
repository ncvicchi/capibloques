import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { assignSafePins, createSceneFromTemplate } from '../lib/scene-model';

async function openCrossing(page: Page, cars = false) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const scene = createSceneFromTemplate('traffic');
  scene.canvas.trafficDirections = cars ? ['eastbound'] : [];
  const light = scene.devices[0];
  if (light.kind !== 'trafficLight') throw new Error('fixture semáforo');
  light.config.pedestrianDisplay = true;
  const wait = { type: 'capi_wait', id: 'hold', fields: { SECONDS: 60 } };
  const walk = { type: 'capi_traffic_pedestrian_display', id: 'walk', fields: { DEVICE_ID: light.id, VALUE: 'WALK' }, next: { block: wait } };
  const body = cars
    ? { type: 'capi_traffic', id: 'green', fields: { DEVICE_ID: light.id, COLOR: 'GREEN' }, next: { block: walk } }
    : { type: 'capi_wait', id: 'waiting', fields: { SECONDS: 2 }, next: { block: walk } };
  const project = makeProject('Cruce peatonal', assignSafePins(scene).scene, { blocks: { languageVersion: 0, blocks: [{ type: 'capi_start', id: 'main', x: 30, y: 30, inputs: { DO: { block: body } } }] } });
  await page.locator('input[type=file]').setInputFiles({ name: 'peatones.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  const confirmation = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirmation.isVisible()) await confirmation.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  await expect(page.locator('.scene-world-crossroads')).toBeVisible();
}

test('peatones: cartel asociado, espera, caminar, pausa y reinicio del mundo', async ({ page }, info) => {
  await openCrossing(page);
  const world = page.locator('.traffic-world');
  const waiting = world.locator('[data-pedestrian][data-started="false"]');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(world.locator('[data-crossing="east"]').first()).toHaveAttribute('aria-label', /Semáforo 1: Esperar/);
  await expect(waiting.first()).toBeVisible();
  await expect(world.locator('[data-crossing="west"]')).toHaveCount(0);
  await expect(world.locator('[data-pedestrian][data-started="true"]').first()).toBeVisible();
  await expect(world.locator('[data-crossing="east"]').first()).toHaveAttribute('aria-label', /Semáforo 1: Cruzar/);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const snapshot = await world.locator('[data-pedestrian]').evaluateAll(elements => elements.map(element => element.getAttribute('transform')));
  await page.waitForTimeout(250);
  expect(await world.locator('[data-pedestrian]').evaluateAll(elements => elements.map(element => element.getAttribute('transform')))).toEqual(snapshot);
  await page.screenshot({ path: info.outputPath('peatones-paso-asociado.png') });
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(world.locator('[data-pedestrian]')).toHaveCount(0);
  await expect(world.getByRole('alert')).toHaveCount(0);
});

test('peatones: conflicto espacial visible y reiniciable sin ocultar errores del programa', async ({ page }) => {
  await page.clock.install();
  await openCrossing(page, true);
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(page.locator('.traffic-world [data-pedestrian][data-started="true"]').first()).toBeVisible();
  await page.clock.runFor(20000);
  await expect(page.locator('.traffic-world').getByRole('alert')).toContainText('Conflicto auto–peatón');
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(page.locator('.traffic-world').getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.traffic-world [data-pedestrian]')).toHaveCount(0);
});
