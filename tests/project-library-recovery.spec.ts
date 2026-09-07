import { expect, test } from '@playwright/test';
import { mockEditorSession, student } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';

test('biblioteca: un rechazo confirmado permite corregir y guardar otro contenido', async ({ page }) => {
  await mockEditorSession(page); const api = await mockLibrary(page);
  let reject = true;
  await page.route('**/api/projects/', route => {
    if (route.request().method() === 'POST' && reject) { reject = false; return route.fulfill({ status: 400, json: { error: 'Corregí el contenido del proyecto.' } }); }
    return route.fallback();
  });
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Rechazado');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Corregí el contenido');
  await expect(page.locator('.cloud-state')).not.toContainText('sin confirmar');
  await page.getByLabel('Nombre del proyecto').fill('Corregido');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  expect([...api.projects.values()][0].project.title).toBe('Corregido');
});

test('biblioteca: copia con respuesta perdida conserva identidad y nombre al reintentar', async ({ page }) => {
  await mockEditorSession(page); const api = await mockLibrary(page);
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Original');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  api.staleNext = true; await page.getByLabel('Nombre del proyecto').fill('Recuperado');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar guardado', exact: true }).click();
  api.loseNextAck = true;
  await page.getByRole('button', { name: 'Guardar editor como copia', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Mis proyectos', exact: true }).getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
  await expect(page.getByText('Proyecto guardado en tu cuenta.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver al editor', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Recuperado (copia)');
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  expect(api.projects.size).toBe(2); expect(api.writes).toBe(2);
});

test('biblioteca: guardar y reabrir el mismo proyecto no carga una instantánea anterior', async ({ page }) => {
  await mockEditorSession(page); const api = await mockLibrary(page);
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Anterior');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  await page.getByLabel('Nombre del proyecto').fill('Último cambio');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir Anterior', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y abrir', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Último cambio');
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  expect([...api.projects.values()][0].project.title).toBe('Último cambio');
});

test('biblioteca: editar mientras llega la confirmación no marca lo nuevo como guardado', async ({ page }) => {
  await mockEditorSession(page); const api = await mockLibrary(page); api.delayMs = 1500;
  await page.goto('/'); await page.getByLabel('Nombre del proyecto').fill('Instantánea enviada');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByLabel('Nombre del proyecto').fill('Cambio posterior');
  await expect(page.locator('.cloud-state')).toContainText('Cambios sólo');
  expect([...api.projects.values()][0].project.title).toBe('Instantánea enviada');
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Cambio posterior');
  const localTitle = await page.evaluate(id => JSON.parse(JSON.parse(localStorage.getItem(`capibloques-account:${id}:library-draft-v1`)!).document).metadata.title, student.id);
  expect(localTitle).toBe('Cambio posterior');
});
