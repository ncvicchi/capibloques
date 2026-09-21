import { expect, test, type Page } from '@playwright/test';
import { makeProject } from '../lib/capiblocks';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model';
import { mockEditorSession } from './editor-fixture';

async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
}

test('Otto: se agrega y la escena se guarda', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  await editor.getByRole('button', { name: /^Agregar Robot Otto/ }).click();
  await expect(editor.locator('.stage-otto')).toHaveAttribute('data-profile', 'biped4');
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('article', { name: 'Robot Otto 1', exact: true })).toBeVisible();
});

test('Otto: representa el perfil y cambia la cara al simular', async ({ page }) => {
  await open(page);
  const added = addDeviceToScene(createEmptyScene('Otto expresivo'), 'otto');
  const otto = added.device;
  if (otto.kind !== 'otto') throw new Error('La prueba requiere un Otto');
  otto.config.profile = 'biped4-expressive';
  const project = makeProject('Otto expresivo', added.scene, { blocks: { languageVersion: 0, blocks: [{
    type: 'capi_start', id: 'start', x: 40, y: 40, inputs: { DO: { block: {
      type: 'capi_otto_expression', id: 'face', fields: { DEVICE_ID: otto.id, EXPRESSION: 'LOVE' },
    } } },
  }] } });
  await page.locator('input[type=file]').setInputFiles({
    name: 'otto-expresivo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)),
  });
  const visual = page.locator('.stage-otto[data-profile="biped4-expressive"]');
  await expect(visual).toBeVisible();
  await expect(visual.locator('.otto-face')).toHaveText('😄');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(visual.locator('.otto-face')).toHaveText('😍');
});

test('Guardar escena explica junto al botón qué impide guardar', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  await editor.getByRole('button', { name: /^Agregar Robot Otto/ }).click();
  await editor.getByLabel('Nombre de la escena').fill('');
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(editor.locator('.scene-save-error')).toContainText('necesita un nombre');
});
