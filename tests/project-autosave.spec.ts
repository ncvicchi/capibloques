import { expect, test } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';

test.beforeEach(async ({ page }) => {
  await mockEditorSession(page, { autosave: true });
});

test('autoguardado: primer guardado explícito, cambios automáticos y pausa recordada', async ({
  page,
}) => {
  const api = await mockLibrary(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Primero');
  await page.clock.runFor(2500);
  expect(api.writes).toBe(0);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  await page.getByLabel('Nombre del proyecto').fill('Automático');
  await page.clock.runFor(2000);
  await expect.poll(() => api.writes).toBe(2);
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  expect([...api.projects.values()][0].project.title).toBe('Automático');
  await page.clock.runFor(12000);
  expect(api.writes).toBe(2);
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: 'Guardar automáticamente en mi cuenta' })
    .uncheck();
  await page
    .getByRole('button', { name: 'Volver al editor', exact: true })
    .click();
  await page.getByLabel('Nombre del proyecto').fill('Manual otra vez');
  await page.clock.runFor(12000);
  expect(api.writes).toBe(2);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect.poll(() => api.writes).toBe(3);
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  await expect(
    page.getByRole('checkbox', {
      name: 'Guardar automáticamente en mi cuenta',
    }),
  ).not.toBeChecked();
});

test('autoguardado: ACK perdido reintenta misma operación y después guarda lo nuevo', async ({
  page,
}) => {
  const api = await mockLibrary(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Base');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  api.loseNextAck = true;
  await page.getByLabel('Nombre del proyecto').fill('Enviado');
  await page.clock.runFor(2000);
  await expect(page.locator('.cloud-state')).toContainText('sin confirmar');
  expect(api.writes).toBe(2);
  await page.getByLabel('Nombre del proyecto').fill('Más reciente');
  await page.clock.runFor(5500);
  await expect(page.locator('.cloud-state')).toContainText('Cambios sólo');
  expect(api.writes).toBe(2);
  await page.clock.runFor(2000);
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  expect(api.projects.size).toBe(1);
  expect(api.writes).toBe(3);
  expect([...api.projects.values()][0].project.title).toBe('Más reciente');
});

test('autoguardado: conflicto pausa sin insistir ni pisar y permite guardar copia', async ({
  page,
}) => {
  const api = await mockLibrary(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Original');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  api.staleNext = true;
  await page.getByLabel('Nombre del proyecto').fill('Mi versión');
  let attempts = 0;
  page.on('request', (req) => {
    if (req.method() === 'PUT') attempts++;
  });
  await page.clock.runFor(2000);
  await expect(page.locator('.cloud-state')).toContainText(
    'Autoguardado pausado',
  );
  await page.clock.runFor(11000);
  expect(attempts).toBe(1);
  expect([...api.projects.values()][0].project.title).toBe('Original');
  await page
    .getByRole('button', { name: 'Revisar guardado', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Guardar editor como copia', exact: true })
    .click();
  await expect(
    page.getByText('Proyecto guardado en tu cuenta.', { exact: true }),
  ).toBeVisible();
  expect(api.projects.size).toBe(2);
});

test('autoguardado: no publica borrador de escena ni envía durante arrastre o biblioteca', async ({
  page,
}) => {
  const api = await mockLibrary(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await page.getByRole('button', { name: /^Agregar LED\./ }).click();
  await page.clock.runFor(12000);
  expect(api.writes).toBe(1);
  expect([...api.projects.values()][0].document.scene.devices).toHaveLength(1);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page
    .getByRole('button', { name: 'Salir sin guardar', exact: true })
    .click();
  await page.getByLabel('Nombre del proyecto').fill('Después de la escena');
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9 })),
  );
  await page.clock.runFor(12000);
  expect(api.writes).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9 })),
  );
  await page.clock.runFor(500);
  await expect.poll(() => api.writes).toBe(2);
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  await page.getByLabel('Nombre del proyecto').fill('Pendiente');
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  await page.clock.runFor(12000);
  expect(api.writes).toBe(2);
  await page
    .getByRole('button', { name: 'Volver al editor', exact: true })
    .click();
  await page.clock.runFor(500);
  await expect.poll(() => api.writes).toBe(3);
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await page.getByRole('button', { name: /^Agregar LED\./ }).click();
  await page
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await page.clock.runFor(2000);
  await expect.poll(() => api.writes).toBe(4);
  expect([...api.projects.values()][0].document.scene.devices).toHaveLength(2);
});

test('autoguardado: curso de sólo lectura no recibe envíos automáticos', async ({
  page,
}) => {
  const api = await mockLibrary(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  [...api.projects.values()][0].project.course = {
    id: '39b84a6d-6b64-42dd-a999-68579e4e099b',
    name: 'Robótica A',
    isArchived: true,
    ownerCanEdit: false,
  };
  await page.clock.fastForward(60000);
  await expect(page.locator('.cloud-state')).toContainText('Sólo lectura');
  await page
    .getByLabel('Nombre del proyecto')
    .fill('Sigo trabajando localmente');
  await page.clock.runFor(12000);
  expect(api.writes).toBe(1);
  await expect(page.locator('.cloud-state')).toContainText(
    'Autoguardado pausado',
  );
});

test('autoguardado: opción y salida alcanzables a 390px y con texto al 200%', async ({
  page,
}, info) => {
  await mockLibrary(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Mis proyectos',
    exact: true,
  });
  const toggle = dialog.getByRole('checkbox', {
    name: 'Guardar automáticamente en mi cuenta',
  });
  await toggle.scrollIntoViewIfNeeded();
  await expect(toggle).toBeChecked();
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('autosave-mobile.png') });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  const overflowDetails = await dialog.evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    return [...node.querySelectorAll('*')]
      .filter((child) => child.getBoundingClientRect().right > bounds.right + 1)
      .map((child) => ({
        tag: child.tagName,
        id: child.id,
        slot: child.getAttribute('data-slot'),
        width: child.getBoundingClientRect().width,
        right: child.getBoundingClientRect().right,
      }));
  });
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    JSON.stringify(overflowDetails),
  ).toBe(true);
  await dialog
    .getByRole('button', { name: 'Volver al editor', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath('autosave-mobile-large-text.png'),
  });
  await dialog
    .getByRole('button', { name: 'Volver al editor', exact: true })
    .click();
  await expect(dialog).toBeHidden();
});

test('autoguardado: rechazo de validación requiere corrección y Guardar manual', async ({
  page,
}) => {
  const api = await mockLibrary(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  let reject = true,
    attempts = 0;
  await page.route('**/api/projects/*/', (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    attempts++;
    if (reject)
      return route.fulfill({
        status: 400,
        json: { error: 'Corregí el proyecto antes de guardar.' },
      });
    return route.fallback();
  });
  await page.getByLabel('Nombre del proyecto').fill('Rechazado');
  await page.clock.runFor(2000);
  await expect(page.locator('.cloud-state')).toContainText(
    'Autoguardado pausado',
  );
  await page.getByLabel('Nombre del proyecto').fill('Corregido');
  await page.clock.runFor(11000);
  expect(attempts).toBe(1);
  reject = false;
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  await page.getByLabel('Nombre del proyecto').fill('Automático recuperado');
  await page.clock.runFor(2000);
  await expect.poll(() => api.writes).toBe(3);
});

test('autoguardado: nuevo proyecto no hereda la identidad anterior ni su envío', async ({
  page,
}) => {
  const api = await mockLibrary(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill('Original');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  await page.getByLabel('Nombre del proyecto').fill('Descartar este cambio');
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Nuevo proyecto', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Descartar cambios y abrir', exact: true })
    .click();
  await page.getByLabel('Nombre del proyecto').fill('Nuevo local');
  await page.clock.runFor(12000);
  expect(api.writes).toBe(1);
  expect(api.projects.size).toBe(1);
  expect([...api.projects.values()][0].project.title).toBe('Original');
});

test('autoguardado: reconexión adelanta reintento pero respeta la sesión bloqueada', async ({
  page,
}) => {
  const api = await mockLibrary(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  let unavailable = true,
    attempts = 0;
  await page.route('**/api/projects/*/', (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    attempts++;
    if (unavailable) return route.abort('connectionfailed');
    return route.fallback();
  });
  await page.getByLabel('Nombre del proyecto').fill('Recuperado');
  await page.clock.runFor(2000);
  await expect(page.locator('.cloud-state')).toContainText('sin confirmar');
  unavailable = false;
  // Contrato del planificador: el evento de red no salta la barrera que controla EditorAccess.
  await page.evaluate(() => {
    document.documentElement.dataset.editorLocked = 'true';
    window.dispatchEvent(new Event('online'));
  });
  await page.clock.runFor(500);
  expect(attempts).toBe(1);
  await page.evaluate(() => {
    document.documentElement.dataset.editorLocked = 'false';
  });
  await page.clock.runFor(500);
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  expect(attempts).toBe(2);
  expect(api.writes).toBe(2);
  expect([...api.projects.values()][0].project.title).toBe('Recuperado');
});

test('autoguardado: deja editar durante el envío y conserva la instantánea posterior', async ({
  page,
}) => {
  const api = await mockLibrary(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.cloud-state')).toContainText(
    'Guardado en tu cuenta',
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  await page.route('**/api/projects/*/', async (route) => {
    if (route.request().method() === 'PUT' && !held) {
      held = true;
      await gate;
    }
    await route.fallback();
  });
  try {
    await page.getByLabel('Nombre del proyecto').fill('Primera instantánea');
    await page.clock.runFor(2000);
    await expect.poll(() => held).toBe(true);
    await expect(page.getByLabel('Nombre del proyecto')).toBeEnabled();
    await page.getByLabel('Nombre del proyecto').fill('Edición durante envío');
    release();
    await expect(page.locator('.cloud-state')).toContainText('Cambios sólo');
    expect([...api.projects.values()][0].project.title).toBe(
      'Primera instantánea',
    );
    await page.clock.runFor(2000);
    await expect(page.locator('.cloud-state')).toContainText(
      'Guardado en tu cuenta',
    );
    expect(api.writes).toBe(3);
    expect([...api.projects.values()][0].project.title).toBe(
      'Edición durante envío',
    );
  } finally {
    release();
  }
});
