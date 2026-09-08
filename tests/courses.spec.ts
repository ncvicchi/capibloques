import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const admin = { id: 'admin-ui', alias: 'admin', displayName: 'Admin', roles: ['administrador'], mustChangePassword: false };
const teacher = { id: 'teacher-ui', alias: 'profe', displayName: 'Profe Sol', roles: ['docente'], mustChangePassword: false };
const student = { id: 'student-ui', alias: 'luna', displayName: 'Luna', roles: ['alumno'], mustChangePassword: false };
const people = [admin, teacher, student].map(person => ({ ...person, isActive: true }));
const initial = () => ({ id: 'course-ui', name: 'Robótica A', description: 'Semáforos y robots', isArchived: false, version: 'v1', members: [
  { id: teacher.id, alias: teacher.alias, displayName: teacher.displayName, role: 'docente', isActive: true },
  { id: student.id, alias: student.alias, displayName: student.displayName, role: 'alumno', isActive: true },
] });

async function fixture(page: Page, actor = admin) {
  const state = { actor, course: initial(), writes: 0, denied: false, removed: false, conflict: false, offline: false };
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user: state.actor, csrfToken: 'ui-token' } }));
  await page.route('**/api/management/users/**', route => route.fulfill({ json: { users: people, count: 3, page: 1, pageSize: 20 } }));
  await page.route(/\/api\/(management\/)?courses\//, async route => {
    const url = new URL(route.request().url());
    const management = url.pathname.includes('/management/');
    const detail = url.pathname.endsWith('/course-ui/');
    if (state.denied) return route.fulfill({ status: 403, json: { error: 'Sin permiso' } });
    if (state.offline) return route.fulfill({ status: 503, json: { error: 'Sin conexión' } });
    if (url.pathname.includes('/projects/')) return route.fulfill({ status: state.removed ? 404 : 200, json: { projects: [], count: 0, page: 1, pageSize: 20 } });
    if (detail && state.removed) return route.fulfill({ status: 404, json: { error: 'Curso no disponible' } });
    const method = route.request().method();
    if (method === 'POST' || method === 'PATCH') {
      state.writes++;
      expect(route.request().headers()['x-csrftoken']).toBe('ui-token');
      if (state.conflict) return route.fulfill({ status: 409, json: { error: 'El curso o sus cuentas cambiaron. Cancelá y volvé a abrirlo antes de guardar.' } });
      const data = route.request().postDataJSON();
      if (method === 'PATCH') expect(data.version).toBe(state.course.version);
      state.course = { ...state.course, ...data, version: `v${state.writes + 1}`, members: data.members.map((member: { id: string; role: string }) => {
        const person = people.find(person => person.id === member.id)!;
        return { id: person.id, alias: person.alias, displayName: person.displayName, role: member.role, isActive: true };
      }) };
      return route.fulfill({ json: { course: state.course } });
    }
    if (detail) {
      const { id, name, description, isArchived, members } = state.course;
      return route.fulfill({ json: { course: management ? state.course : { id, name, description, isArchived, myRole: actor.roles[0], ...(actor.roles.includes('docente') ? { members } : {}) } } });
    }
    const status = url.searchParams.get('status') ?? 'active';
    const visible = !state.removed && (status === 'all' || state.course.isArchived === (status === 'archived')) && state.course.name.toLowerCase().includes((url.searchParams.get('q') ?? '').toLowerCase());
    const { id, name, description, isArchived } = state.course;
    return route.fulfill({ json: { courses: visible ? [{ id, name, description, isArchived }] : [], count: visible ? 1 : 0, page: 1, pageSize: 20, actor: state.actor, csrfToken: 'ui-token' } });
  });
  return state;
}

test('cursos: crear, buscar personas, preparar selección, cancelar y guardar', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/cursos/');
  await page.getByRole('button', { name: 'Crear curso', exact: true }).click();
  await page.getByLabel('Nombre del curso', { exact: true }).fill('Robótica B');
  await page.getByRole('button', { name: 'Buscar personas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Agregar admin', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Agregar profe', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar luna', exact: true }).click();
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(page.getByLabel('Nombre del curso', { exact: true })).toHaveValue('Robótica B');
  await page.getByRole('button', { name: 'Guardar curso', exact: true }).click();
  await expect(page.getByText('Curso guardado.', { exact: false })).toBeVisible();
  expect(state.writes).toBe(1); expect(state.course.members).toHaveLength(2);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Robótica B', exact: true })).toBeVisible();
});

test('cursos: quitar, restaurar selección y descartar no escriben', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/cursos/');
  await page.getByRole('button', { name: 'Editar Robótica A', exact: true }).click();
  await page.getByRole('button', { name: 'Quitar luna', exact: true }).click();
  await expect(page.getByText('Al guardar se retirarán 1 membresías.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar selección guardada', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quitar luna', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar curso', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Quitar profe', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  expect(state.writes).toBe(0); expect(state.course.members).toHaveLength(2);
  await page.getByRole('button', { name: 'Editar Robótica A', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quitar profe', exact: true })).toBeVisible();
});

test('cursos: archivar, filtrar, retirar miembros y reactivar', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/cursos/');
  await page.getByRole('button', { name: 'Editar Robótica A', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Curso archivado', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Buscar personas', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar curso', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No hay cursos en esta vista' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Mostrar', exact: true }).click();
  await page.getByRole('option', { name: 'Archivados', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Robótica A', exact: true }).click();
  await page.getByRole('button', { name: 'Quitar profe', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Curso archivado', exact: true }).uncheck();
  await expect(page.getByRole('button', { name: 'Buscar personas', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar curso', exact: true }).click();
  await expect(page.getByText('Curso guardado.', { exact: false })).toBeVisible();
  expect(state.course.isArchived).toBe(false); expect(state.course.members).toHaveLength(1);
});

test('cursos: conflicto conserva borrador y conexión perdida bloquea hasta revalidar', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/cursos/');
  await page.getByRole('button', { name: 'Editar Robótica A', exact: true }).click();
  await page.getByLabel('Nombre del curso', { exact: true }).fill('Pendiente');
  state.conflict = true;
  await page.getByRole('button', { name: 'Guardar curso', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El curso o sus cuentas cambiaron');
  await expect(page.getByLabel('Nombre del curso', { exact: true })).toHaveValue('Pendiente');
  expect(state.course.name).toBe('Robótica A');
  state.offline = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('No pudimos verificar el acceso.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Nombre del curso', { exact: true })).not.toBeVisible();
  state.offline = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByLabel('Nombre del curso', { exact: true })).toHaveValue('Pendiente');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
});

test('cursos: docente ve su grupo y perder membresía limpia el detalle sin cerrar sesión', async ({ page }) => {
  const state = await fixture(page, teacher);
  await page.goto('/cursos/');
  await page.getByRole('button', { name: 'Ver Robótica A', exact: true }).click();
  await expect(page.getByText('Luna', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar curso', exact: true })).toHaveCount(0);
  state.removed = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('El curso ya no está disponible para tu cuenta.', { exact: true })).toBeVisible();
  await expect(page.getByText('Luna', { exact: true })).toHaveCount(0);
});

test('cursos: alumno recibe vista propia sin padrón ni controles de administración', async ({ page }) => {
  await fixture(page, student);
  await page.goto('/cursos/');
  await page.getByRole('button', { name: 'Ver Robótica A', exact: true }).click();
  await expect(page.getByText('Tu función: alumno', { exact: false })).toBeVisible();
  await expect(page.getByText('Luna', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Profe Sol', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Crear curso', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Proyectos guardados del curso' })).toHaveCount(0);
});

test('cursos: docente descarga copia portable sin modificar el original y retirada bloquea', async ({ page }, testInfo) => {
  const state = await fixture(page, teacher);
  const document = JSON.parse(readFileSync(new URL('../backend/tests/fixtures/projects-v2.json', import.meta.url), 'utf8'))[0];
  const project = { id: 'project-ui', title: document.metadata.title, revision: 3, updatedAt: '2026-09-07T12:00:00Z', trashedAt: null, owner: { alias: 'luna', displayName: 'Luna' } };
  await page.route('**/api/courses/course-ui/projects/**', route => {
    expect(route.request().method()).toBe('GET');
    expect(route.request().headers()['x-capi-account']).toBe(teacher.id);
    if (state.removed) return route.fulfill({ status: 404, json: { error: 'Sin acceso' } });
    return route.fulfill({ json: route.request().url().endsWith('/project-ui/') ? { project, document } : { projects: [project], count: 1, page: 1, pageSize: 20 } });
  });
  await page.goto('/cursos/');
  await page.getByRole('button', { name: 'Ver Robótica A', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: `Descargar JSON de ${project.title}`, exact: true }).click();
  const chunks: Buffer[] = []; const stream = await (await download).createReadStream();
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(document);
  await page.screenshot({ path: testInfo.outputPath('proyectos-docente.png'), fullPage: true });
  state.removed = true;
  await page.getByRole('button', { name: 'Actualizar proyectos', exact: true }).click();
  await expect(page.getByRole('button', { name: `Descargar JSON de ${project.title}`, exact: true })).toHaveCount(0);
  expect(state.writes).toBe(0);
});

test('cursos: revocar administrador limpia formulario y resultados de personas', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/gestion/cursos/');
  await page.getByRole('button', { name: 'Editar Robótica A', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar personas', exact: true }).click();
  state.denied = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('alert')).toContainText('Tu sesión o permiso cambió');
  await expect(page.getByLabel('Nombre del curso', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Luna', { exact: true })).toHaveCount(0);
  expect(state.writes).toBe(0);
});

test('cursos: salir durante una lectura no revalida ni altera la pantalla siguiente', async ({ page }) => {
  const state = await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  page.on('request', request => { if (request.url().includes('/api/management/courses/')) requests++; });
  await page.route('**/api/management/courses/course-ui/', async route => { await gate; await route.fulfill({ json: { course: state.course } }); });
  await page.goto('/gestion/cursos/');
  const requested = page.waitForRequest('**/api/management/courses/course-ui/');
  await page.getByRole('button', { name: 'Editar Robótica A', exact: true }).click();
  await requested;
  await page.getByRole('link', { name: 'Mi cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta\//);
  const before = requests;
  const finished = page.waitForResponse('**/api/management/courses/course-ui/');
  release(); await finished;
  // Dar salida a la continuación de fetch y dos frames, no esperar un timeout
  // arbitrario. La página desmontada no debe emitir otra consulta de cursos.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(requests).toBe(before);
  await expect(page.getByLabel('Nombre del curso', { exact: true })).toHaveCount(0);
});

test('cursos: recarga advierte y pantalla pequeña con texto ampliado conserva acciones', async ({ page }, testInfo) => {
  const state = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gestion/cursos/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await page.getByRole('button', { name: 'Editar Robótica A', exact: true }).click();
  await page.getByLabel('Nombre del curso', { exact: true }).fill('Curso con un nombre largo de prueba');
  const warning = page.waitForEvent('dialog');
  await page.evaluate(() => { window.setTimeout(() => window.location.reload(), 0); });
  const dialog = await warning;
  expect(dialog.type()).toBe('beforeunload'); await dialog.dismiss();
  await expect(page.getByLabel('Nombre del curso', { exact: true })).toHaveValue('Curso con un nombre largo de prueba');
  await page.getByRole('button', { name: 'Guardar curso', exact: true }).scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('main *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => ({ tag: node.tagName, text: node.textContent?.slice(0, 80), right: node.getBoundingClientRect().right })) }));
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width + 1);
  const modal = page.getByRole('dialog', { name: 'Editar curso', exact: true });
  expect(await modal.evaluate(node => node.scrollWidth > node.clientWidth + 1)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('courses-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  expect(state.writes).toBe(0);
});

if (process.env.PLAYWRIGHT_API === '1') {
  test('cursos API_REAL: rutas privadas no filtran datos antes de ingresar', async ({ request, page }) => {
    for (const path of ['/api/courses/', '/api/management/courses/']) expect((await request.get(path)).status()).toBe(401);
    await page.goto('/gestion/cursos/');
    await expect(page.getByRole('alert')).toContainText('Tu sesión o permiso cambió');
    await expect(page.getByRole('button', { name: 'Crear curso', exact: true })).toHaveCount(0);
  });
}
