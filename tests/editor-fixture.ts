import type { Page } from '@playwright/test';

// Sólo contratos UI: identidad simulada en la red de Playwright, nunca en la app.
export const student = { id: 'a77913f4-508f-4d16-bd16-d94cccb98c89', alias: 'luna', displayName: 'Luna', roles: ['alumno'], mustChangePassword: false };
export const token = 'browser-contract-test-only';
export async function mockEditorSession(page: Page, { autosave = false } = {}) {
  // Los contratos históricos prueban Guardar manual con la opción pública
  // desactivada. Los tests de autoguardado usan el valor predeterminado real.
  if (!autosave) await page.addInitScript(id => {
    const key = `capibloques-account:${id}:server-autosave`;
    if (localStorage.getItem(key) === null) localStorage.setItem(key, 'false');
  }, student.id);
  await page.route('**/api/auth/editor-session/', route => route.fulfill({ json: { user: student, csrfToken: token, context: 'ui-session-a' } }));
  const { mockLibrary } = await import('./project-library-fixture');
  await mockLibrary(page);
}
