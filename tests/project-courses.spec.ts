import { expect, test } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';

test('contexto de curso: respuesta anterior a un guardado no produce un conflicto falso', async ({ page }) => {
  await mockEditorSession(page); const api = await mockLibrary(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let held = false;
  await page.route('**/api/projects/*/?metadata=1', async route => {
    const id = new URL(route.request().url()).pathname.split('/')[3];
    const project = structuredClone(api.projects.get(id)!.project);
    if (!held) { held = true; await gate; }
    await route.fulfill({ json: { project } });
  });
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Primero');
  const metadata = page.waitForRequest('**/api/projects/*/?metadata=1');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await metadata;
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  await page.getByLabel('Nombre del proyecto').fill('Segundo');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect.poll(() => [...api.projects.values()][0].project.revision).toBe(2);
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  const finished = page.waitForResponse('**/api/projects/*/?metadata=1');
  release(); await finished;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await expect(page.locator('.library-recovery')).toHaveCount(0);
  expect(api.writes).toBe(2);
});

test('proyecto de curso: cancelar no escribe; compartir, duplicar personal y retirar', async ({ page }, testInfo) => {
  await mockEditorSession(page); const api = await mockLibrary(page);
  api.courses.push({ id: '39b84a6d-6b64-42dd-a999-68579e4e099b', name: 'Robótica A' });
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Semáforo de Luna');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  const choose = page.getByRole('button', { name: 'Elegir curso de Semáforo de Luna', exact: true });
  await choose.click();
  await page.getByLabel('Compartir con').selectOption(api.courses[0].id);
  await page.getByRole('dialog', { name: 'Elegir curso del proyecto' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.writes).toBe(1);
  await choose.click();
  await expect(page.getByLabel('Compartir con')).toHaveValue('');
  await page.getByLabel('Compartir con').selectOption(api.courses[0].id);
  await page.screenshot({ path: testInfo.outputPath('compartir-curso.png'), fullPage: true });
  await page.getByRole('button', { name: 'Guardar curso del proyecto', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Elegir curso del proyecto' })).toHaveCount(0);
  expect([...api.projects.values()][0].project.course?.name).toBe('Robótica A');
  await page.getByRole('button', { name: 'Duplicar Semáforo de Luna', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir Semáforo de Luna (copia)', exact: true })).toBeVisible();
  expect([...api.projects.values()][1].project.course ?? null).toBeNull();
  await choose.click();
  await page.getByLabel('Compartir con').selectOption('');
  await page.getByRole('button', { name: 'Guardar curso del proyecto', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Elegir curso del proyecto' })).toHaveCount(0);
  expect([...api.projects.values()][0].project.course).toBeNull();
});

test('proyecto de curso: conflicto conserva selección y curso bloqueado ofrece copia', async ({ page }) => {
  await mockEditorSession(page); const api = await mockLibrary(page);
  api.courses.push({ id: '39b84a6d-6b64-42dd-a999-68579e4e099b', name: 'Robótica A' });
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Original');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Elegir curso de Original', exact: true }).click();
  await page.getByLabel('Compartir con').selectOption(api.courses[0].id);
  api.staleNext = true;
  await page.getByRole('button', { name: 'Guardar curso del proyecto', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Elegir curso del proyecto' }).getByRole('alert')).toContainText('Otra pestaña');
  await expect(page.getByLabel('Compartir con')).toHaveValue(api.courses[0].id);
  expect(api.writes).toBe(1);
  await page.getByRole('dialog', { name: 'Elegir curso del proyecto' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
  [...api.projects.values()][0].project.course = { ...api.courses[0], isArchived: true, ownerCanEdit: false };
  await page.reload();
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Elegir curso de Original', exact: true }).click();
  await expect(page.getByText(/Conservamos el original; duplicalo/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar curso del proyecto', exact: true })).toBeDisabled();
});
