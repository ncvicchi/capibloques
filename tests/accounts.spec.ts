import { expect, test, type Page } from '@playwright/test';

// Contratos de UI con respuestas controladas. El backend se prueba con PostgreSQL
// real en Django; los casos marcados API_REAL no interceptan la red.
const student = { id: 'student-fixture', alias: 'luna', displayName: 'Luna', roles: ['alumno'], mustChangePassword: false };
const token = 'browser-contract-test-only';

async function mockSession(page: Page, user: typeof student | null | (() => typeof student | null)) {
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user: typeof user === 'function' ? user() : user, csrfToken: token } }));
}

test('cuenta: error de acceso, contraseña visible y reintento conservan alias', async ({ page }) => {
  let currentUser: typeof student | null = null;
  await mockSession(page, () => currentUser);
  let requests = 0;
  await page.route('**/api/auth/login/', async route => {
    requests++;
    expect(route.request().headers()['x-csrftoken']).toBe(token);
    if (requests === 1) await route.fulfill({ status: 401, json: { error: 'Revisá tu alias y contraseña.', code: 'invalid_credentials' } });
    else { currentUser = student; await route.fulfill({ json: { user: student, csrfToken: token } }); }
  });
  await page.goto('/cuenta/');
  await page.getByLabel('Alias', { exact: true }).fill('luna');
  await page.getByLabel('Contraseña', { exact: true }).fill('Sólo un dato de prueba');
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Revisá');
  await expect(page.getByLabel('Alias', { exact: true })).toHaveValue('luna');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
  await expect(page.getByText('@luna · alumno')).toBeVisible();
  await expect(page.getByText('El editor todavía guarda en esta computadora.')).toBeVisible();
});

test('cuenta: cancelar contraseña no envía ni conserva el borrador', async ({ page }) => {
  await mockSession(page, student);
  let writes = 0;
  await page.route('**/api/auth/password/', route => { writes++; return route.fulfill({ status: 500 }); });
  await page.goto('/cuenta/');
  await page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click();
  await page.getByLabel('Contraseña nueva', { exact: true }).fill('Borrador privado de prueba');
  // Recuperar foco no debe descartar un formulario si sigue la misma cuenta.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Contraseña nueva', { exact: true })).toHaveValue('Borrador privado de prueba');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Contraseña nueva', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click();
  await expect(page.getByLabel('Contraseña nueva', { exact: true })).toHaveValue('');
  expect(writes).toBe(0);
});

test('cuenta: contraseña temporal, guardar y cerrar sesión', async ({ page }) => {
  let currentUser: typeof student | null = { ...student, mustChangePassword: true };
  await mockSession(page, () => currentUser);
  await page.route('**/api/auth/password/', route => { currentUser = student; return route.fulfill({ json: { user: student, csrfToken: token } }); });
  await page.route('**/api/auth/logout/', route => { currentUser = null; return route.fulfill({ json: { user: null, csrfToken: token } }); });
  await page.goto('/cuenta/');
  await expect(page.getByRole('heading', { name: 'Elegí tu contraseña' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toHaveCount(0);
  await page.getByLabel('Contraseña actual', { exact: true }).fill('Anterior de prueba');
  await page.getByLabel('Contraseña nueva', { exact: true }).fill('Nueva frase de prueba');
  await page.getByLabel('Repetir contraseña nueva', { exact: true }).fill('Nueva frase de prueba');
  await page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click();
  await expect(page.getByText('Contraseña guardada. Las otras sesiones quedaron cerradas.')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
});

test('cuenta: servidor caído muestra recuperación sin fingir ingreso', async ({ page }) => {
  await page.route('**/api/auth/session/', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/cuenta/');
  await expect(page.getByRole('alert')).toContainText('No pudimos conectar');
  await expect(page.getByRole('button', { name: 'Reintentar conexión' })).toBeVisible();
  await expect(page.getByLabel('Alias', { exact: true })).toHaveCount(0);
  await mockSession(page, null);
  await page.getByRole('button', { name: 'Reintentar conexión' }).click();
  await expect(page.getByLabel('Alias', { exact: true })).toBeVisible();
});

test('cuenta: formulario usable en pantalla angosta y texto ampliado', async ({ page }) => {
  await mockSession(page, null);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cuenta/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await expect(page.getByLabel('Alias', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ingresar', exact: true }).scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
});

if (process.env.PLAYWRIGHT_API === '1') {
  test('cuenta API_REAL: sesión anónima y acceso inválido contra Django', async ({ page }) => {
    await page.goto('/cuenta/');
    await page.getByLabel('Alias', { exact: true }).fill('cuenta-inexistente-e2e');
    await page.getByLabel('Contraseña', { exact: true }).fill('No es una credencial real');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('No pudimos ingresar con esos datos');
    await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toHaveCount(0);
  });
}
