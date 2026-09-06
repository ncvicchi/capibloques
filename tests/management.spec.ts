import { expect, test, type Page } from '@playwright/test';

const admin = { id: '2512cc10-4b68-4fb5-b1a2-9d7a72d54aa1', alias: 'admin', displayName: 'Admin', roles: ['administrador'], mustChangePassword: false, isActive: true, createdAt: '2026-09-06T12:00:00Z', version: 'v1' };
const student = { ...admin, id: 'be5c2b10-4b68-4fb5-b1a2-9d7a72d54aa2', alias: 'luna', displayName: 'Luna', roles: ['alumno'] };
const password = 'Frase temporal sólo de prueba 58';

// Contratos UI. Las mutaciones y permisos reales se verifican en Django/PG.
async function mockManagement(page: Page) {
  const state = { users: [admin, student].map(user => ({ ...user })), denied: false, fail: false, writes: 0, conflict: false };
  await page.route('**/api/management/users/**', async route => {
    if (state.denied) return route.fulfill({ status: 403, json: { error: 'Sin permiso', code: 'forbidden' } });
    if (state.fail) return route.fulfill({ status: 503 });
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (method === 'GET') {
      const q = url.searchParams.get('q')?.toLowerCase() || '';
      const role = url.searchParams.get('role');
      const active = url.searchParams.get('active');
      const users = state.users.filter(user => `${user.alias} ${user.displayName}`.toLowerCase().includes(q) && (!role || user.roles.includes(role)) && (!active || user.isActive === (active === 'true')));
      return route.fulfill({ json: { actor: admin, csrfToken: 'ui-only-token', users, count: users.length, page: 1, pageSize: 20 } });
    }
    state.writes++;
    expect(request.headers()['x-csrftoken']).toBe('ui-only-token');
    if (state.conflict) return route.fulfill({ status: 409, json: { error: 'La cuenta cambió en otra pestaña. Cancelá y volvé a abrirla antes de guardar.', code: 'stale_version' } });
    const data = request.postDataJSON();
    const id = url.pathname.split('/')[4];
    const target = state.users.find(user => user.id === id);
    if (method === 'DELETE') {
      expect(data.confirmationAlias).toBe(target?.alias); expect(data.understandsLocalDrafts).toBe(true);
      state.users = state.users.filter(user => user.id !== id);
      return route.fulfill({ json: { deleted: true, sessionEnded: false } });
    }
    if (method === 'PATCH' && target) {
      Object.assign(target, { alias: data.alias, displayName: data.displayName, roles: data.roles, isActive: data.isActive, version: 'v2' });
      return route.fulfill({ json: { user: target, sessionEnded: false } });
    }
    if (url.pathname.endsWith('/password/') && target) {
      expect(data.temporaryPassword).toBe(password); expect(data.confirmation).toBe(password);
      target.mustChangePassword = true;
      return route.fulfill({ json: { user: target, sessionEnded: false } });
    }
    const user = { ...student, id: 'ce5c2b10-4b68-4fb5-b1a2-9d7a72d54aa3', alias: data.alias, displayName: data.displayName, roles: data.roles, mustChangePassword: true, isActive: data.isActive };
    state.users.push(user);
    return route.fulfill({ status: 201, json: { user, sessionEnded: false } });
  });
  return state;
}

test('usuarios: crear, guardar y buscar con filtro de rol', async ({ page }) => {
  const state = await mockManagement(page);
  await page.goto('/gestion/usuarios/');
  await expect(page.getByRole('button', { name: 'Crear usuario', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('region', { name: 'Listado de usuarios' })).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
  await page.getByLabel('Alias', { exact: true }).fill('sol');
  await page.getByLabel('Nombre visible').fill('Sol');
  await page.getByRole('dialog').getByRole('radio', { name: 'Docente', exact: true }).check();
  await page.getByLabel('Contraseña temporal', { exact: true }).fill(password);
  await page.getByLabel('Repetir contraseña temporal').fill(password);
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Cuenta creada.', { exact: false })).toBeVisible();
  await page.getByLabel('Buscar por alias o nombre').fill('sol');
  await page.getByRole('group', { name: 'Filtrar por rol' }).getByRole('radio', { name: 'Docente', exact: true }).check();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar sol', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar luna', exact: true })).toHaveCount(0);
  expect(state.writes).toBe(1);
});

test('usuarios: cancelar pregunta por el borrador, foco lo conserva y guardar cambia estado', async ({ page }) => {
  const state = await mockManagement(page);
  await page.goto('/gestion/usuarios/');
  await page.getByRole('button', { name: 'Editar luna', exact: true }).click();
  await page.getByLabel('Nombre visible').fill('Luna editada');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Nombre visible')).toHaveValue('Luna editada');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(page.getByLabel('Nombre visible')).toHaveValue('Luna editada');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Editar luna', exact: true }).click();
  await expect(page.getByLabel('Nombre visible')).toHaveValue('Luna');
  await page.getByRole('checkbox', { name: 'Cuenta activa', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Inactiva', { exact: true })).toBeVisible();
});

test('usuarios: contraseña temporal no se conserva al cancelar ni tras guardar', async ({ page }) => {
  const state = await mockManagement(page);
  await page.goto('/gestion/usuarios/');
  await page.getByRole('button', { name: 'Restablecer contraseña de luna' }).click();
  await page.getByLabel('Contraseña temporal', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Mostrar contraseñas' }).click();
  await expect(page.getByLabel('Contraseña temporal', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar cambios' }).click();
  await page.getByRole('button', { name: 'Restablecer contraseña de luna' }).click();
  await expect(page.getByLabel('Contraseña temporal', { exact: true })).toHaveValue('');
  await page.getByLabel('Contraseña temporal', { exact: true }).fill(password);
  await page.getByLabel('Repetir contraseña temporal').fill(password);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Contraseña temporal guardada.', { exact: false })).toBeVisible();
  expect(state.writes).toBe(1);
});

test('usuarios: eliminación exige advertencia y alias y ofrece ficha sin proyectos', async ({ page }) => {
  const state = await mockManagement(page);
  await page.goto('/gestion/usuarios/');
  await page.getByRole('button', { name: 'Eliminar luna', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Eliminar definitivamente', exact: true })).toBeDisabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar ficha (sin proyectos)' }).click();
  expect((await download).suggestedFilename()).toBe('ficha-luna.json');
  await page.getByRole('checkbox', { name: /Entiendo que esta ficha/ }).check();
  await page.getByLabel('Escribí el alias exacto para confirmar').fill('otra');
  await expect(page.getByRole('button', { name: 'Eliminar definitivamente', exact: true })).toBeDisabled();
  await page.getByLabel('Escribí el alias exacto para confirmar').fill('luna');
  await page.getByRole('button', { name: 'Eliminar definitivamente', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar luna', exact: true })).toHaveCount(0);
  expect(state.writes).toBe(1);
});

test('usuarios: conflicto conserva el formulario y pérdida de permiso retira datos y diálogos', async ({ page }) => {
  const state = await mockManagement(page);
  await page.goto('/gestion/usuarios/');
  await page.getByRole('button', { name: 'Editar luna', exact: true }).click();
  await page.getByLabel('Nombre visible').fill('Cambio pendiente');
  state.conflict = true;
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('otra pestaña');
  await expect(page.getByLabel('Nombre visible')).toHaveValue('Cambio pendiente');
  state.denied = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert')).toContainText('Necesitás una cuenta administradora');
  await expect(page.getByLabel('Nombre visible')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Luna');
});

test('usuarios: acceso denegado y caída del servidor no muestran usuarios', async ({ page }) => {
  const state = await mockManagement(page); state.denied = true;
  await page.goto('/gestion/usuarios/');
  await expect(page.getByRole('alert')).toContainText('Necesitás una cuenta administradora');
  await expect(page.getByRole('table')).toHaveCount(0);
  state.denied = false; state.fail = true;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos verificar');
  state.fail = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('button', { name: 'Editar luna', exact: true })).toBeVisible();
});

test('usuarios: creación usable en 390 px y texto al 200%', async ({ page }) => {
  await mockManagement(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gestion/usuarios/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
  await page.getByLabel('Alias', { exact: true }).fill('prueba');
  await page.getByRole('button', { name: 'Guardar', exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(element => element.scrollWidth > element.clientWidth + 1)).toBe(false);
});

if (process.env.PLAYWRIGHT_API === '1') {
  test('usuarios API_REAL: ruta y API niegan acceso anónimo en DEV', async ({ page, request }) => {
    const response = await request.get('/api/management/users/');
    expect(response.status()).toBe(401);
    expect(await response.json()).not.toHaveProperty('users');
    await page.goto('/gestion/usuarios/');
    await expect(page.getByRole('alert')).toContainText('Necesitás una cuenta administradora');
    await expect(page.getByRole('table')).toHaveCount(0);
  });
}
