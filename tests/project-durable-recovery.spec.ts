import { chromium, expect, test } from '@playwright/test';
import { mockEditorSession, student, token } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';
import { recoveryRows } from './recovery-fixture';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene } from '../lib/scene-model';

test('recuperación durable: migra el borrador anterior sin borrarlo ni volver a usarlo como fuente', async ({
  page,
}) => {
  await mockEditorSession(page);
  await mockLibrary(page);
  const legacy = JSON.stringify(
    makeProject('De la versión anterior', createEmptyScene(), {}, 1),
  );
  const key = `capibloques-account:${student.id}:project-v2`;
  await page.addInitScript(
    ({ key, legacy }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, legacy);
    },
    { key, legacy },
  );
  await page.goto('/');
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue(
    'De la versión anterior',
  );
  await expect
    .poll(async () => (await recoveryRows(page, student.id)).length)
    .toBe(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    legacy,
  );
  await page.getByLabel('Nombre del proyecto').fill('La copia nueva');
  await expect
    .poll(async () => (await recoveryRows(page, student.id))[0].title)
    .toBe('La copia nueva');
  await page.reload();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue(
    'La copia nueva',
  );
});

test('recuperación durable: espera la lectura antes de permitir editar', async ({
  page,
}) => {
  await mockEditorSession(page);
  await mockLibrary(page);
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      const request = original.apply(this, args);
      if (args[0] === 'capibloques-recovery')
        Object.defineProperty(request, 'onsuccess', {
          set(handler: (this: IDBOpenDBRequest, event: Event) => void) {
            request.addEventListener('success', (event) =>
              window.setTimeout(() => handler.call(request, event), 1000),
            );
          },
        });
      return request;
    };
  });
  await page.goto('/');
  await expect(
    page.getByText('Recuperando tu proyecto de esta computadora…', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveCount(0);
  await expect(page.getByLabel('Nombre del proyecto')).toBeVisible();
});

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
  // Adulterar con el editor desmontado: su checkpoint legítimo al salir no
  // debe reparar el fixture antes de que probemos la validación de arranque.
  await page.goto('/cuenta/');
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
  await page.goto('/');
  await expect(page.locator('.notice')).toContainText(
    'El envío pendiente no coincide',
  );
  expect(badRequests).toBe(0);
  expect(api.writes).toBe(1);
});

test('recuperación durable: ACK confirmado con escritura local fallida se repite sin duplicar', async ({ page }) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Confirmado sin disco');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'drafts' && args[0].remote && !args[0].pending)
        throw new DOMException('Quota', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-error').first()).toContainText('Guardado en servidor');
  expect((await recoveryRows(page, student.id))[0].pending).not.toBeNull();
  await page.reload();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Confirmado sin disco');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  expect(api.writes).toBe(1);
  expect(api.projects.size).toBe(1);
  expect((await recoveryRows(page, student.id))[0].pending).toBeNull();
});

test('recuperación durable: límite local no expulsa copias ni envía sin conservar', async ({ page }) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Copia intacta');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  await page.goto('/cuenta/');
  const original = (await recoveryRows(page, student.id))[0];
  await page.evaluate(({ row, accountId }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('capibloques-recovery', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['drafts', 'accounts'], 'readwrite');
      for (let index = 1; index < 30; index++) tx.objectStore('drafts').put({ ...row, id: crypto.randomUUID(), updatedAt: row.updatedAt - index });
      tx.objectStore('accounts').put({ initialized: true, count: 30, bytes: row.bytes * 30, updatedAt: row.updatedAt }, accountId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
  }), { row: original, accountId: student.id });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await page.getByLabel('Nombre del proyecto').fill('Sin lugar todavía');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-error').first()).toContainText('límite de 30');
  const rows = await recoveryRows(page, student.id);
  expect(rows).toHaveLength(30);
  expect(rows.every(row => row.title === original.title && row.pending === null)).toBe(true);
  expect(api.writes).toBe(1);
});

test('recuperación durable: controles locales a 390px y texto 200%, con baja concurrente protegida', async ({ page }, info) => {
  await mockEditorSession(page);
  await mockLibrary(page);
  await page.goto('/');
  const title = 'Un semáforo para la escuela y el robot';
  await page.getByLabel('Nombre del proyecto').fill(title);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText('Guardado en tu cuenta');
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await page.getByRole('button', { name: 'Mis proyectos', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const region = page.getByRole('region', { name: 'Copias en esta computadora' });
  await region.scrollIntoViewIfNeeded();
  expect(await page.getByRole('dialog').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('copias-390.png'), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.getByRole('button', { name: `Quitar copia local de ${title}`, exact: true }).click();
  const modal = page.getByRole('alertdialog');
  expect(await modal.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  const confirm = modal.getByRole('button', { name: 'Quitar sólo esta copia local', exact: true });
  await confirm.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('quitar-local-200.png'), fullPage: true });
  const row = (await recoveryRows(page, student.id)).find(row => row.title === title)!;
  await page.evaluate(row => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('capibloques-recovery', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').put({ ...row, sequence: row.sequence + 1 });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
  }), row);
  await confirm.click();
  await expect(modal.getByRole('alert')).toContainText('cambió en otra pestaña');
  expect((await recoveryRows(page, student.id)).some(saved => saved.id === row.id)).toBe(true);
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
});
