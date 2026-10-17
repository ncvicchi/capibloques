import { expect, test } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';

test('ejemplo modular: catálogo, pestañas, llamadas anidadas y simulación', async ({ page }) => {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  await page.getByRole('button', { name: 'Opciones del proyecto' }).click();
  await page.getByRole('menuitem', { name: 'Abrir un ejemplo' }).click();
  const chooser = page.getByRole('dialog', { name: 'Elige una misión' });
  await expect(chooser.getByRole('button', { name: /Paso a nivel con procedimientos/ })).toBeVisible();
  await expect(chooser.getByRole('button', { name: /Paso a nivel/ })).toHaveCount(2);
  await chooser.getByRole('button', { name: /Paso a nivel con procedimientos/ }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirmation.isVisible()) await confirmation.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
  const tabs = page.getByRole('tablist', { name: 'Secciones del programa' });
  for (const name of ['Principal', 'Control del cruce', 'Barreras', 'Avisos', 'Detectores']) {
    await expect(tabs.getByRole('tab', { name, exact: true })).toBeVisible();
  }
  await expect(page.locator('[data-id="rail-def-occupied"]')).toBeHidden();
  await expect(page.locator('[data-id="rail-mod-East-occupied"]')).toBeVisible();
  await page.locator('[data-id="rail-mod-East-occupied"]').dblclick({ position: { x: 18, y: 15 } });
  await expect(tabs.getByRole('tab', { name: 'Control del cruce', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-id="rail-def-occupied"]')).toBeVisible();
  await page.locator('[data-id="rail-occupied-close"]').dblclick({ position: { x: 18, y: 15 } });
  await expect(tabs.getByRole('tab', { name: 'Barreras', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-id="rail-def-close"]')).toBeVisible();
  await tabs.getByRole('tab', { name: 'Principal', exact: true }).click();
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  const world = page.locator('.scene-world-railCrossing');
  await expect(world.locator('[data-rail-gate="northGate"]')).toHaveAttribute('data-angle', '0.00', { timeout: 15000 });
  await expect(world.locator('[data-rail-gate="southGate"]')).toHaveAttribute('data-angle', '0.00');
  await expect(world.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
});
