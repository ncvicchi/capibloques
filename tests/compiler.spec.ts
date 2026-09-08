import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mockEditorSession, student, token } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';

async function builds(page: Page) {
  const control = { jobs: [] as Record<string, unknown>[], requests: [] as Record<string, unknown>[], loseNext: false, hide: false };
  const bytes = Buffer.from('synthetic firmware download for UI transport test');
  const hash = createHash('sha256').update(bytes).digest('hex');
  await page.route('**/api/builds/**', async route => {
    const request = route.request();
    expect(request.headers()['x-capi-account']).toBe(student.id);
    const parts = new URL(request.url()).pathname.split('/'), id = parts[3];
    if (request.method() === 'POST') {
      const data = request.postDataJSON(); control.requests.push(data);
      let job = control.jobs.find(job => job.id === data.id);
      if (!job) {
        job = { id: data.id, projectId: data.projectId, revision: data.revision, title: 'Proyecto de prueba', framework: data.framework, state: 'queued', containsWifi: Boolean(data.wifi), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), message: '', sha256: hash, bytes: bytes.length, metrics: {} };
        control.jobs.push(job);
      }
      if (control.loseNext) { control.loseNext = false; control.hide = true; return route.abort('connectionfailed'); }
      control.hide = false;
      return route.fulfill({ status: 201, json: { job } });
    }
    if (!id) return route.fulfill({ json: { jobs: control.hide ? [] : control.jobs, settings: { available: true, paused: false, concurrency: 1 }, csrfToken: token } });
    const job = control.jobs.find(job => job.id === id);
    if (!job) return route.fulfill({ status: 404, json: { error: 'No disponible' } });
    if (parts[4] === 'download') return route.fulfill({ body: bytes, contentType: 'application/zip' });
    if (request.method() === 'DELETE') job.state = 'cancelled';
    return route.fulfill({ json: { job } });
  });
  return control;
}
async function open(page: Page) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Compilar y descargar firmware', exact: true }).click();
  return page.getByRole('dialog', { name: 'Compilar y descargar firmware' });
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
}
async function acknowledge(page: Page) {
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Conectar la Wemos sin adivinar', exact: true });
  await expect(guide.getByRole('checkbox').first()).toBeVisible();
  for (const checkbox of await guide.getByRole('checkbox').all()) await checkbox.check();
  await guide.getByRole('button', { name: 'Conexiones revisadas', exact: true }).click();
}
async function setup(page: Page) {
  await mockEditorSession(page); const library = await mockLibrary(page); const queue = await builds(page);
  await page.goto('/'); await expect(page.locator('.blocklySvg')).toBeVisible();
  return { library, queue };
}

test('firmware: exige guardado y cableado; cancelar cola conserva el proyecto y no agrega headers', async ({ page }) => {
  const { library, queue } = await setup(page);
  const dialog = await open(page);
  await expect(dialog.getByRole('button', { name: 'Compilar versión guardada' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cerrar y seguir programando' }).click();
  await save(page);
  await open(page); await dialog.getByRole('button', { name: 'Compilar versión guardada' }).click();
  const guide = page.getByRole('dialog', { name: 'Conectar la Wemos sin adivinar' });
  await expect(guide).toBeVisible(); expect(queue.requests).toHaveLength(0);
  for (const checkbox of await guide.getByRole('checkbox').all()) await checkbox.check();
  await guide.getByRole('button', { name: 'Conexiones revisadas', exact: true }).click();
  await open(page); await dialog.getByRole('button', { name: 'Compilar versión guardada' }).click();
  await expect(dialog).toContainText('En cola'); expect(queue.requests).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Cancelar pedido' }).click();
  await expect(dialog).toContainText('Cancelado / retirado'); expect(library.projects.size).toBe(1);
});

test('firmware: cerrar no cancela, descarga con hash y avisa versión anterior al editar', async ({ page }, info) => {
  const { queue } = await setup(page); await save(page); await acknowledge(page);
  const dialog = await open(page); await dialog.getByRole('button', { name: 'Compilar versión guardada' }).click();
  await expect(dialog).toContainText('En cola'); await dialog.getByRole('button', { name: 'Cerrar y seguir programando' }).click();
  queue.jobs[0].state = 'ready'; queue.jobs[0].message = 'Firmware listo';
  await page.getByLabel('Nombre del proyecto').fill('Cambios posteriores'); await open(page);
  await expect(dialog).toContainText('no incluye los cambios actuales');
  await expect(dialog.getByRole('button', { name: 'Compilar versión guardada' })).toBeDisabled();
  const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Descargar firmware completo' }).click();
  expect((await download).suggestedFilename()).toContain('-arduino-r1-');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('firmware-mobile.png'), fullPage: true });
  expect(queue.requests).toHaveLength(1);
});

test('firmware: Wi-Fi explícito y privado; reintentar conserva pedido y clave fuera del proyecto', async ({ page }) => {
  const { library, queue } = await setup(page);
  const examples = JSON.parse(readFileSync('backend/tests/fixtures/projects-v2.json', 'utf8'));
  await page.locator('input[type=file]').setInputFiles({ name: 'wifi.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(examples[3])) });
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue(examples[3].metadata.title);
  await save(page); await acknowledge(page);
  const dialog = await open(page);
  await dialog.getByLabel('Herramientas de compilación').selectOption('esp-idf');
  await dialog.getByRole('button', { name: 'Compilar versión guardada' }).click();
  await expect(dialog.getByLabel('Nombre de la red (SSID)')).toBeVisible(); expect(queue.requests).toHaveLength(0);
  await dialog.getByLabel('Nombre de la red (SSID)').fill('Red sintética privada');
  await dialog.getByLabel('Clave Wi-Fi (vacía si la red es abierta)').fill('synthetic-secret-only');
  await dialog.getByRole('checkbox').check(); queue.loseNext = true;
  await dialog.getByRole('button', { name: 'Compilar versión guardada' }).click();
  await expect(dialog.getByRole('button', { name: 'Reintentar el mismo pedido' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Reintentar el mismo pedido' }).click();
  await expect(dialog).toContainText('En cola');
  expect(queue.requests).toHaveLength(2); expect(queue.requests[0]).toEqual(queue.requests[1]);
  expect(JSON.stringify([...library.projects.values()])).not.toContain('synthetic-secret-only');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('synthetic-secret-only');
  await expect(dialog.getByLabel('Clave Wi-Fi (vacía si la red es abierta)')).toHaveValue('');
});

test('compilaciones admin: guardar, cancelar y conflicto de revisión sin mostrar proyectos privados', async ({ page }) => {
  const admin = { ...student, roles: ['administrador'] };
  let settings = { concurrency: 1, ceiling: 2, paused: false, revision: 1, available: true };
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user: admin, csrfToken: token } }));
  await page.route('**/api/management/compiler/', route => {
    if (route.request().method() === 'PUT') {
      const data = route.request().postDataJSON();
      expect(data.revision).toBe(settings.revision);
      settings = { ...settings, ...data, revision: settings.revision + 1 };
    }
    return route.fulfill({ json: { settings, queued: 3, building: 1, recent: [], csrfToken: token } });
  });
  await page.goto('/gestion/compilaciones/');
  await page.getByLabel('Compilaciones simultáneas').selectOption('2');
  await page.getByRole('button', { name: 'Cancelar edición' }).click();
  await expect(page.getByLabel('Compilaciones simultáneas')).toHaveValue('1');
  await page.getByLabel('Compilaciones simultáneas').selectOption('2');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Configuración guardada.', { exact: false })).toBeVisible();
  settings = { ...settings, paused: true, revision: settings.revision + 1 };
  await page.getByRole('button', { name: 'Actualizar estado' }).click();
  await expect(page.getByText('La configuración cambió.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar edición' }).click();
  await expect(page.getByRole('checkbox')).toBeChecked();
});
