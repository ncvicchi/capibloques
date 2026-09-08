import { expect, test } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';

// Explicit visual benchmark only; not a substitute for DEV acceptance.
if (process.env.CAPIBLOQUES_MEASURE_LAYOUT === '1') {
  test('medición comparable de altura útil a 1366 por 768', async ({ page }, info) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockEditorSession(page); await page.goto('/');
    await expect(page.locator('.blocklySvg')).toBeVisible();
    const box = (await page.locator('.workspace-grid').boundingBox())!;
    const measure = { viewportHeight: 768, workspaceTop: box.y, workspaceHeight: box.height, usefulPercent: Math.round(box.height / 768 * 1000) / 10 };
    console.log(JSON.stringify(measure));
    await info.attach('layout.json', { body: JSON.stringify(measure), contentType: 'application/json' });
    await page.screenshot({ path: info.outputPath('layout.png') });
  });
}
