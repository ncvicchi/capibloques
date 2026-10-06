import { test, expect, type Page } from '@playwright/test';
import { mockEditorSession, student, token } from './editor-fixture';
import { challengeCatalog } from '../lib/challenges';

async function open(page: Page, teacher = false) {
  await mockEditorSession(page);
  if (teacher)
    await page.route('**/api/auth/editor-session/', (route) =>
      route.fulfill({
        json: {
          user: { ...student, roles: ['docente'] },
          csrfToken: token,
          context: 'ui-session-a',
        },
      }),
    );
  await page.route('**/api/challenges/', (route) =>
    route.fulfill({
      json: {
        courses: teacher
          ? [
              {
                id: 'd26a6695-8d37-4d86-82df-8f4fa4e3dd37',
                name: 'Curso de prueba',
                teacher: true,
                version: 'v1',
                items: [],
              },
            ]
          : [],
        progress: {},
      },
    }),
  );
  await page.route('**/api/challenges/progress/', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: {
        progress: {
          status: body.status,
          hints: body.hints,
          attempts: body.status === 'started' ? 0 : 1,
        },
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
}

test('Desafíos: catálogo, pistas, validación independiente y copia libre', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Desafíos', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Desafíos para explorar' });
  await expect(
    dialog.getByRole('button', { name: 'Abrir desafío', exact: true }),
  ).toHaveCount(17);
  await dialog
    .getByRole('button', { name: 'Abrir desafío', exact: true })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Descartar cambios y abrir', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Mi desafío', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Una luz con intención' });
  await dialog.getByRole('button', { name: 'Pedir pista' }).click();
  await expect(dialog).toContainText('Pista 1:');
  await dialog.getByRole('button', { name: 'Comprobar solución' }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Seguí probando', exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText('La luz queda encendida');
  await dialog.getByRole('button', { name: 'Abrir copia libre' }).click();
  await page
    .getByRole('button', { name: 'Descartar cambios y abrir', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Desafíos', exact: true }),
  ).toBeVisible();
});

test('Solución importada conserva el reto y aprobar no depende de posición de bloques', async ({
  page,
}) => {
  await open(page);
  const c = challengeCatalog[0],
    project = structuredClone(c.initial),
    led = project.scene.devices.find((d) => d.kind === 'led')!;
  project.workspace = {
    capiChallenge: { id: c.id, version: c.version },
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'capi_start',
          id: 'test-start',
          x: 320,
          y: 80,
          inputs: {
            DO: {
              block: {
                type: 'capi_led',
                id: 'test-led',
                fields: { DEVICE_ID: led.id, BRIGHTNESS: 100 },
              },
            },
          },
        },
      ],
    },
  };
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: 'reto.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await page
    .getByRole('button', { name: 'Descartar cambios y abrir', exact: true })
    .click();
  await page.getByRole('button', { name: 'Mi desafío', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: c.title });
  await dialog.getByRole('button', { name: 'Comprobar solución' }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Funciona', exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText('autoevaluación');
});

test('Docente: borrador visual, deshacer/rehacer y publicación explícita', async ({
  page,
}) => {
  await open(page, true);
  const actions: string[] = [];
  await page.route('**/api/challenges/courses/*/', async (route) => {
    const body = route.request().postDataJSON();
    actions.push(body.action);
    await route.fulfill({
      json: {
        version: `v${actions.length + 1}`,
        item: { id: body.challenge.id, draft: body.challenge },
      },
    });
  });
  await page.getByRole('button', { name: 'Desafíos', exact: true }).click();
  await page.getByRole('button', { name: 'Crear desde mi proyecto' }).click();
  const author = page.getByRole('dialog', {
    name: 'Crear desafío · Curso de prueba',
  });
  const original = await author
    .getByLabel('Título', { exact: true })
    .inputValue();
  await author.getByLabel('Título', { exact: true }).fill('Mi reto propio');
  await author.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(author.getByLabel('Título', { exact: true })).toHaveValue(
    original,
  );
  await author.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect(author.getByLabel('Título', { exact: true })).toHaveValue(
    'Mi reto propio',
  );
  await author
    .getByRole('button', { name: 'Guardar borrador', exact: true })
    .click();
  await expect(author).toContainText('Borrador guardado');
  await author
    .getByRole('button', { name: 'Publicar versión', exact: true })
    .click();
  await expect(author).toContainText('Versión publicada e inmutable');
  await author
    .getByRole('button', { name: 'Asignar al curso', exact: true })
    .click();
  await expect(author).toContainText('Asignada al curso');
  expect(actions).toEqual(['save', 'publish', 'assign']);
});
