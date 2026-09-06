import type { Page } from '@playwright/test';

// Sólo contratos UI: identidad simulada en la red de Playwright, nunca en la app.
export const student = { id: 'a77913f4-508f-4d16-bd16-d94cccb98c89', alias: 'luna', displayName: 'Luna', roles: ['alumno'], mustChangePassword: false };
export const token = 'browser-contract-test-only';
export async function mockEditorSession(page: Page) {
  await page.route('**/api/auth/editor-session/', route => route.fulfill({ json: { user: student, csrfToken: token, context: 'ui-session-a' } }));
}
