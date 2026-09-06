import { expect, test, type Page } from '@playwright/test';

const admin = { id: 'school-admin-fixture', alias: 'admin', displayName: 'Admin', roles: ['administrador'], mustChangePassword: false };
const digest = 'a'.repeat(64);
const logoUrl = `/api/school/logo/${digest}/`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64');

async function fixture(page: Page) {
  const state = { school: { name: 'Escuela del Río', logoUrl: logoUrl as string | null }, version: 'v1', writes: 0, denied: false, failed: false, conflict: false };
  await page.route('**/api/school/logo/**', route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.route('**/api/school/', route => route.fulfill({ json: state.school }));
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user: null, csrfToken: 'ui-token' } }));
  await page.route('**/api/management/school/', async route => {
    if (state.denied) return route.fulfill({ status: 403, json: { error: 'Sin permiso' } });
    if (state.failed) return route.fulfill({ status: 503, json: { error: 'Sin conexión' } });
    if (route.request().method() === 'POST') {
      state.writes++;
      expect(route.request().headers()['x-csrftoken']).toBe('ui-token');
      if (state.conflict) return route.fulfill({ status: 409, json: { error: 'Otro administrador cambió el colegio. Cancelá para cargar la versión actual antes de guardar.' } });
      const request = route.request();
      const payload = await new Response(new Uint8Array(request.postDataBuffer()!).buffer, { headers: { 'Content-Type': request.headers()['content-type'] } }).formData();
      expect(payload.get('version')).toBe(state.version);
      state.school = { name: String(payload.get('name')).trim(), logoUrl: payload.get('logoAction') === 'remove' ? null : logoUrl };
      if (payload.get('logoAction') === 'replace') expect(payload.get('logo')).toBeInstanceOf(File);
      state.version = 'v2';
    }
    return route.fulfill({ json: { school: state.school, version: state.version, actor: admin, csrfToken: 'ui-token' } });
  });
  return state;
}

test('colegio: marca pública antes del login y fallo de logo no bloquea ingreso', async ({ page }) => {
  await fixture(page);
  await page.goto('/cuenta/');
  await expect(page.getByText('Escuela del Río', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Logo de Escuela del Río' })).toBeVisible();
  await expect(page.getByLabel('Alias', { exact: true })).toBeVisible();
  await page.route('**/api/school/logo/**', route => route.fulfill({ status: 404 }));
  await page.reload();
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByText('Escuela del Río', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeEnabled();
});

test('colegio: ausencia o caída de marca conserva el formulario', async ({ page }) => {
  const state = await fixture(page);
  state.school = { name: '', logoUrl: null };
  await page.goto('/cuenta/');
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByLabel('Alias', { exact: true })).toBeVisible();
  await page.route('**/api/school/', route => route.abort());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeEnabled();
});

test('colegio: seleccionar, previsualizar, cancelar y guardar archivo', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/colegio/');
  await page.getByRole('button', { name: 'Editar colegio', exact: true }).click();
  await page.getByLabel('Nombre del colegio', { exact: true }).fill('Escuela Nueva');
  await page.getByLabel('Logo del colegio (opcional)').setInputFiles({ name: 'nuevo.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('img', { name: 'Logo de Escuela Nueva' })).toHaveAttribute('src', /^blob:/);
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(page.getByLabel('Nombre del colegio', { exact: true })).toHaveValue('Escuela Nueva');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Editar colegio', exact: true }).click();
  await expect(page.getByLabel('Nombre del colegio', { exact: true })).toHaveValue('Escuela del Río');
  await expect(page.getByText('Seleccionado:', { exact: false })).toHaveCount(0);
  await page.getByLabel('Nombre del colegio', { exact: true }).fill('Escuela Nueva');
  await page.getByLabel('Logo del colegio (opcional)').setInputFiles({ name: 'nuevo.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Guardar colegio', exact: true }).click();
  await expect(page.getByText('Colegio guardado.', { exact: false })).toBeVisible();
  expect(state.school.name).toBe('Escuela Nueva'); expect(state.writes).toBe(1);
  await page.goto('/cuenta/');
  await expect(page.getByText('Escuela Nueva', { exact: true })).toBeVisible();
});

test('colegio: rechazo local preserva imagen seleccionada, quitar se confirma al guardar', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/colegio/');
  await page.getByRole('button', { name: 'Editar colegio', exact: true }).click();
  const file = page.getByLabel('Logo del colegio (opcional)');
  await file.setInputFiles({ name: 'correcto.png', mimeType: 'image/png', buffer: png });
  await file.setInputFiles({ name: 'malo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('La selección anterior se conserva');
  await expect(page.getByText('Seleccionado: correcto.png')).toBeVisible();
  await page.getByRole('button', { name: 'Usar logo guardado' }).click();
  await expect(page.getByRole('img')).toHaveAttribute('src', logoUrl);
  await page.getByRole('button', { name: 'Quitar logo' }).click();
  await expect(page.getByRole('img')).toHaveCount(0);
  expect(state.school.logoUrl).toBe(logoUrl);
  await page.getByRole('button', { name: 'Guardar colegio', exact: true }).click();
  await expect(page.getByText('Colegio guardado.', { exact: false })).toBeVisible();
  expect(state.school.logoUrl).toBeNull();
});

test('colegio: conflicto conserva borrador y cancelar carga la versión actual', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/colegio/');
  await page.getByRole('button', { name: 'Editar colegio', exact: true }).click();
  await page.getByLabel('Nombre del colegio', { exact: true }).fill('Mi borrador');
  state.conflict = true; state.school.name = 'Otra edición'; state.version = 'v2';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Nombre del colegio', { exact: true })).toHaveValue('Mi borrador');
  await page.getByRole('button', { name: 'Guardar colegio', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Otro administrador');
  await expect(page.getByLabel('Nombre del colegio', { exact: true })).toHaveValue('Mi borrador');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  await page.getByRole('button', { name: 'Editar colegio', exact: true }).click();
  await expect(page.getByLabel('Nombre del colegio', { exact: true })).toHaveValue('Otra edición');
});

test('colegio: corte de conexión conserva borrador, revocación retira formulario y diálogo', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/colegio/');
  await page.getByRole('button', { name: 'Editar colegio', exact: true }).click();
  await page.getByLabel('Nombre del colegio', { exact: true }).fill('Borrador privado');
  state.failed = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert')).toContainText('No pudimos verificar');
  state.failed = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByLabel('Nombre del colegio', { exact: true })).toHaveValue('Borrador privado');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  state.denied = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert')).toContainText('Necesitás una cuenta administradora');
  await expect(page.locator('body')).not.toContainText('Borrador privado');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('colegio: salir por Mi cuenta confirma cambios sin guardar', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/colegio/');
  await page.getByRole('button', { name: 'Editar colegio', exact: true }).click();
  await page.getByLabel('Nombre del colegio', { exact: true }).fill('Pendiente');
  await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(page).toHaveURL(/gestion\/colegio/);
  await expect(page.getByLabel('Nombre del colegio', { exact: true })).toHaveValue('Pendiente');
  await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  await expect(page).toHaveURL(/cuenta\//);
  expect(state.writes).toBe(0);
});

test('colegio: recargar advierte sobre el borrador y descartar no pide doble confirmación', async ({ page }) => {
  await fixture(page);
  await page.goto('/gestion/colegio/');
  await page.getByRole('button', { name: 'Editar colegio', exact: true }).click();
  await page.getByLabel('Nombre del colegio', { exact: true }).fill('Pendiente');
  const warning = page.waitForEvent('dialog');
  // No esperar page.reload(): al cancelar beforeunload nunca habrá un load nuevo.
  await page.evaluate(() => { window.setTimeout(() => window.location.reload(), 0); });
  const dialog = await warning;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await expect(page.getByLabel('Nombre del colegio', { exact: true })).toHaveValue('Pendiente');
  let extraPrompts = 0;
  page.on('dialog', dialog => { extraPrompts++; void dialog.dismiss(); });
  await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  await expect(page).toHaveURL(/cuenta\//);
  expect(extraPrompts).toBe(0);
});

test('colegio: nombre largo y carga utilizables a 390 px con texto al 200%', async ({ page }) => {
  await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gestion/colegio/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await page.getByRole('button', { name: 'Editar colegio', exact: true }).click();
  await page.getByLabel('Nombre del colegio', { exact: true }).fill('Colegio con un nombre institucional muy largo para probar el ajuste');
  await page.getByRole('button', { name: 'Guardar colegio', exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  await page.goto('/cuenta/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await expect(page.getByLabel('Alias', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

if (process.env.PLAYWRIGHT_API === '1') {
  test('colegio API_REAL: marca pública mínima y gestión privada', async ({ page, request }) => {
    const response = await request.get('/api/school/');
    expect(response.status()).toBe(200);
    expect(Object.keys(await response.json()).sort()).toEqual(['logoUrl', 'name']);
    expect((await request.get('/api/management/school/')).status()).toBe(401);
    await page.goto('/gestion/colegio/');
    await expect(page.getByRole('alert')).toContainText('Necesitás una cuenta administradora');
    await expect(page.getByLabel('Nombre del colegio', { exact: true })).toHaveCount(0);
  });
}
