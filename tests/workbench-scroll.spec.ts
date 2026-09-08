import { expect, test } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';

test('mesa móvil: al bajar a la escena, ejecución no se superpone con proyecto', async ({ page }) => {
  await mockEditorSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.locator('.simulator-panel').scrollIntoViewIfNeeded();
  const header = (await page.locator('.topbar').boundingBox())!;
  const toolbar = (await page.locator('.toolbar').boundingBox())!;
  expect(header.y + header.height, JSON.stringify({ header, toolbar })).toBeLessThanOrEqual(toolbar.y + 1);
  await expect(page.getByRole('button', { name: 'Detener', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await page.getByRole('button', { name: 'Detener', exact: true }).click();
});
