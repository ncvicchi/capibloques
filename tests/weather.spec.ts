import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';
async function openWeather(page: Page, modular = false) {
  await mockEditorSession(page); await page.goto('/'); await expect(page.locator('.blocklySvg')).toBeVisible();
  const e = examples.find(e => e.id === (modular ? 'weatherLabProcedures' : 'weatherLab'))!;
  const scene = structuredClone(e.scene); scene.canvas.weatherEnvironment = { condition: 'sunny', night: false, automatic: false };
  await page.locator('input[type=file]').setInputFiles({ name: 'clima.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeProject(e.title, scene, e.workspace, 4))) });
  const confirm = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  await expect(page.locator('[data-weather-condition]')).toBeVisible();
}
for (const modular of [false, true]) test(`clima ${modular ? 'protegido' : 'informativo'}: lluvia, sensores, techo, pausa y reset`, async ({ page }, info) => {
  await openWeather(page, modular);
  if (modular) await expect(page.getByRole('tab', { name: 'Protección', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await page.getByRole('button', { name: 'Lluvia intensa', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Es de noche', exact: true }).check();
  await expect(page.getByRole('slider', { name: /Detector de lluvia/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Escena', exact: true }).click(); await page.getByRole('button', { name: 'Simular', exact: true }).click();
  const world = page.locator('[data-weather-condition]'); await expect(world).toHaveAttribute('data-weather-condition', 'heavyRain'); await expect(world).toHaveAttribute('data-weather-night', 'true');
  await expect.poll(async () => Number(await world.getAttribute('data-weather-detector'))).toBeGreaterThan(60);
  await expect(world).toHaveAttribute('data-weather-roof', modular ? '0.0' : '90.0');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click(); await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
  const before = await world.innerHTML(); await page.waitForTimeout(250); expect(await world.innerHTML()).toBe(before);
  await page.screenshot({ path: info.outputPath(`clima-${modular ? 'protegido' : 'informativo'}.png`) });
  await page.getByRole('button', { name: 'Más herramientas', exact: true }).click(); await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
  await expect(world).toHaveAttribute('data-weather-condition', 'sunny'); await expect(world).toHaveAttribute('data-weather-detector', '0.0'); await expect(world).toHaveAttribute('data-weather-table', '0.0');
});
test('clima: condiciones iniciales, guardar/cancelar/deshacer/rehacer', async ({ page }) => {
  await openWeather(page); await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de escenas', exact: true });
  await editor.getByText('Clima al comenzar', { exact: true }).click(); await editor.getByRole('button', { name: 'Nublado', exact: true }).click();
  await editor.getByRole('button', { name: /Deshacer/ }).click(); await expect(editor.getByRole('button', { name: 'Soleado', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await editor.getByRole('button', { name: /Rehacer/ }).click(); await expect(editor.getByRole('button', { name: 'Nublado', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click(); await page.getByRole('alertdialog', { name: '¿Salir sin guardar la escena?' }).getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await expect(page.locator('[data-weather-condition]')).toHaveAttribute('data-weather-condition', 'sunny');
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click(); await editor.getByText('Clima al comenzar', { exact: true }).click(); await editor.getByRole('button', { name: 'Lluvia suave', exact: true }).click(); await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await expect(editor).toHaveCount(0); await expect(page.locator('[data-weather-condition]')).toHaveAttribute('data-weather-condition', 'rain');
});
