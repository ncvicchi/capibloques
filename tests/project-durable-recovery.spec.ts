import { chromium, expect, test } from '@playwright/test';
import { mockEditorSession, student, token } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';
import { recoveryRows } from './recovery-fixture';

test('recuperación durable: primer envío con ACK perdido sobrevive reiniciar el navegador', async ({}, info) => {
  const profile = info.outputPath('recovery-profile');
  const options = {
    baseURL: info.project.use.baseURL,
    channel:
      info.project.name === 'edge'
        ? 'msedge'
        : info.project.name === 'chrome'
          ? 'chrome'
          : undefined,
    headless: true,
  };
  let context = await chromium.launchPersistentContext(profile, options);
  try {
    let page = context.pages()[0];
    await mockEditorSession(page, { autosave: true });
    const api = await mockLibrary(page);
    api.loseNextAck = true;
    await page.goto('/');
    await page.getByLabel('Nombre del proyecto').fill('Sigo mañana');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.cloud-state')).toContainText('sin confirmar');
    const before = (await recoveryRows(page, student.id))[0];
    expect(before.pending).not.toBeNull();
    expect(api.writes).toBe(1);
    await context.close();
    context = await chromium.launchPersistentContext(profile, options);
    page = context.pages()[0];
    await mockEditorSession(page, { autosave: true });
    await mockLibrary(page, api);
    await page.goto('/');
    await expect(page.getByLabel('Nombre del proyecto')).toHaveValue(
      'Sigo mañana',
    );
    await expect(page.locator('.cloud-state')).toContainText(
      'Guardado en tu cuenta',
    );
    expect(api.writes).toBe(1);
    expect(api.projects.size).toBe(1);
    expect((await recoveryRows(page, student.id))[0].pending).toBeNull();
  } finally {
    await context.close();
  }
});

test('recuperación durable: operación y cambios posteriores se recuperan separados al recargar', async ({
  page,
}) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Base');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  api.loseNextAck = true;
  await page.getByLabel('Nombre del proyecto').fill('Instantánea enviada');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('sin confirmar');
  await page.getByLabel('Nombre del proyecto').fill('Edición posterior');
  await expect
    .poll(
      async () =>
        JSON.parse((await recoveryRows(page, student.id))[0].document).metadata
          .title,
    )
    .toBe('Edición posterior');
  const operation = (await recoveryRows(page, student.id))[0].pending!;
  expect(JSON.parse(operation.body).document.metadata.title).toBe(
    'Instantánea enviada',
  );
  await page.reload();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue(
    'Edición posterior',
  );
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Cambios sólo');
  expect(api.writes).toBe(2);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  expect(api.writes).toBe(3);
  expect(api.projects.size).toBe(1);
  expect([...api.projects.values()][0].project.title).toBe('Edición posterior');
});

test('recuperación durable: aborto de la transacción local impide enviar y permite reintentar', async ({
  page,
}) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Sin perder');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    Object.assign(window, {
      restoreRecoveryPut: () => {
        IDBObjectStore.prototype.put = original;
      },
    });
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      if (this.name === 'drafts' && args[0].pending)
        request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
  });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-error').first()).toContainText(
    /local|transact|abort/i,
  );
  expect(api.writes).toBe(0);
  await page.evaluate(() =>
    (
      window as unknown as { restoreRecoveryPut: () => void }
    ).restoreRecoveryPut(),
  );
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  expect(api.writes).toBe(1);
});

test('recuperación durable: cambiar de proyecto conserva su pendiente y permite volver sin duplicar', async ({
  page,
}) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  api.loseNextAck = true;
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Primero');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('sin confirmar');
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Nuevo proyecto', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Conservar copia local y abrir', exact: true })
    .click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue(
    'Mi aventura',
  );
  await page.getByLabel('Nombre del proyecto').fill('Segundo');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  expect(api.projects.size).toBe(2);
  await page.reload();
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Recuperar Primero', exact: true })
    .click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Primero');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  expect(api.projects.size).toBe(2);
  expect(api.writes).toBe(2);
});

test('recuperación durable: dos pestañas no sobrescriben sus copias locales', async ({
  page,
  context,
}) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Original');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  const second = await context.newPage();
  await mockEditorSession(second);
  await mockLibrary(second, api);
  await second.goto('/');
  await expect(second.getByLabel('Nombre del proyecto')).toHaveValue(
    'Original',
  );
  await page.bringToFront();
  await page.getByLabel('Nombre del proyecto').fill('Trabajo A');
  await expect
    .poll(async () =>
      (await recoveryRows(page, student.id)).some(
        (row) => row.title === 'Trabajo A',
      ),
    )
    .toBe(true);
  await second.bringToFront();
  await second.getByLabel('Nombre del proyecto').fill('Trabajo B');
  await expect
    .poll(async () =>
      (await recoveryRows(second, student.id)).map((row) => row.title).sort(),
    )
    .toEqual(['Trabajo A', 'Trabajo B']);
  await page.bringToFront();
  await page.reload();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Trabajo A');
  expect(api.writes).toBe(1);
});

test('recuperación durable: otra cuenta no hereda el documento ni la operación pendiente', async ({
  page,
}) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  api.loseNextAck = true;
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Privado de Luna');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('sin confirmar');
  const other = {
    ...student,
    id: 'e6d7e9f1-91eb-44d2-8b7e-84920bed16ed',
    alias: 'sol',
    displayName: 'Sol',
  };
  await page.route('**/api/auth/editor-session/', (route) =>
    route.fulfill({
      json: { user: other, csrfToken: token, context: `context-${other.id}` },
    }),
  );
  await page.reload();
  await expect(page.getByLabel('Nombre del proyecto')).not.toHaveValue(
    'Privado de Luna',
  );
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Copias en esta computadora' }),
  ).not.toContainText('Privado de Luna');
  expect(api.writes).toBe(1);
  expect((await recoveryRows(page, student.id))[0].pending).not.toBeNull();
});

test('recuperación durable: quitar copia requiere confirmar y no elimina el proyecto del servidor', async ({
  page,
}) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Para exportar');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Nuevo proyecto', exact: true })
    .click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue(
    'Mi aventura',
  );
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', {
      name: 'Exportar copia local de Para exportar',
      exact: true,
    })
    .click();
  const chunks: Buffer[] = [];
  const stream = await (await download).createReadStream();
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const file = JSON.parse(Buffer.concat(chunks).toString());
  expect(file.metadata.title).toBe('Para exportar');
  expect(file.pending).toBeUndefined();
  expect(file.remote).toBeUndefined();
  await page
    .getByRole('button', {
      name: 'Quitar copia local de Para exportar',
      exact: true,
    })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Recuperar Para exportar', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Quitar copia local de Para exportar',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Quitar sólo esta copia local', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Recuperar Para exportar', exact: true }),
  ).toHaveCount(0);
  expect(api.projects.size).toBe(1);
  expect(api.writes).toBe(1);
});

test('recuperación durable: un envío almacenado adulterado no se ejecuta', async ({
  page,
}) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  api.loseNextAck = true;
  await page.goto('/');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('sin confirmar');
  const row = (await recoveryRows(page, student.id))[0];
  await page.evaluate(
    (data) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('capibloques-recovery', 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction('drafts', 'readwrite');
          data.pending!.url = '/must-not-send';
          tx.objectStore('drafts').put(data);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
    row,
  );
  let badRequests = 0;
  await page.route('**/must-not-send', (route) => {
    badRequests++;
    return route.fulfill({ status: 400 });
  });
  await page.reload();
  await expect(page.locator('.notice')).toContainText(
    'El envío pendiente no coincide',
  );
  expect(badRequests).toBe(0);
  expect(api.writes).toBe(1);
});
