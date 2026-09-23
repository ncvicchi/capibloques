import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    locale: 'es-AR',
  });
  const user = {
    id: 'a77913f4-508f-4d16-bd16-d94cccb98c89',
    alias: 'luna',
    displayName: 'Luna',
    roles: ['alumno'],
    mustChangePassword: false,
  };
  const projects = ['Semáforo de la plaza', 'Robot explorador'].map(
    (title, index) => ({
      id: `af272cd1-10ce-44ff-952d-398e8a9cddc${index}`,
      title,
      revision: 1,
      updatedAt: '2026-09-07T03:00:00Z',
      trashedAt: null,
    }),
  );

  await page.route('**/api/auth/editor-session/', (route) =>
    route.fulfill({
      json: { user, csrfToken: 'qa-ui-only', context: 'qa-visual' },
    }),
  );
  await page.route('**/api/projects/**', (route) =>
    route.fulfill({
      json: {
        projects,
        count: 2,
        page: 1,
        pageSize: 20,
        actor: user,
        csrfToken: 'qa-ui-only',
      },
    }),
  );

  await page.goto('http://localhost:3000/');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page
    .getByRole('button', { name: 'Abrir Robot explorador', exact: true })
    .waitFor();
  await page.screenshot({ path: 'outputs/library-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'outputs/library-mobile.png' });
  const dialog = page.getByRole('dialog', {
    name: 'Mis proyectos',
    exact: true,
  });
  assert(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.screenshot({ path: 'outputs/library-text-200.png' });
  assert(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1));
  await dialog
    .getByRole('button', { name: 'Volver al editor', exact: true })
    .click();

  console.log(
    'Visual QA: desktop, mobile 390px, text 200%, no horizontal overflow; library exit operable.',
  );
} finally {
  await browser.close();
}
