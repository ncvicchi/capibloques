import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockEditorSession } from './editor-fixture';
import { mockLibrary } from './project-library-fixture';
import {
  addFeedback,
  mockReview,
  nextVersion,
  pupil,
  teacher,
  reviewCourseId,
  reviewProjectId,
  reviewPath,
  sampleProject,
} from './project-review-fixture';

test('docente: curso, filtro por alumno y acceso a revisión en otra pestaña', async ({
  page,
}) => {
  const course = {
    id: reviewCourseId,
    name: 'Robótica A',
    description: 'Semáforos',
    isArchived: false,
  };
  const filters: string[] = [];
  await page.route('**/api/courses/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/projects/')) {
      const studentId = url.searchParams.get('student') ?? '';
      filters.push(studentId);
      return route.fulfill({
        json: {
          projects: [
            {
              id: reviewProjectId,
              title: 'Semáforo de Luna',
              revision: 3,
              updatedAt: '2026-09-07T12:00:00Z',
              trashedAt: null,
              course: { ...course, ownerCanEdit: true },
              owner: pupil,
              feedbackCount: 2,
            },
          ],
          count: 1,
          page: 1,
          pageSize: 20,
        },
      });
    }
    if (url.pathname.endsWith(`/${reviewCourseId}/`))
      return route.fulfill({
        json: {
          course: {
            ...course,
            myRole: 'docente',
            members: [
              { ...teacher, role: 'docente' },
              { ...pupil, role: 'alumno' },
            ],
          },
        },
      });
    return route.fulfill({
      json: {
        courses: [course],
        count: 1,
        page: 1,
        pageSize: 20,
        actor: teacher,
        csrfToken: 'review-token',
      },
    });
  });
  await page.goto('/cursos/');
  await page
    .getByRole('button', { name: 'Ver Robótica A', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Alumno', exact: true })
    .selectOption(pupil.id);
  await expect.poll(() => filters.at(-1)).toBe(pupil.id);
  const link = page.getByRole('link', {
    name: 'Revisar Semáforo de Luna · 2 devoluciones (otra pestaña)',
    exact: true,
  });
  await expect(link).toHaveAttribute('href', reviewPath);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(page.getByText(/Actualiza cada 15 segundos/)).toBeVisible();
});

test('biblioteca: devoluciones y procedencia visibles; curso con comentarios no se traslada', async ({
  page,
}) => {
  await mockEditorSession(page);
  const api = await mockLibrary(page);
  const doc = sampleProject();
  api.projects.set(reviewProjectId, {
    document: doc,
    project: {
      id: reviewProjectId,
      title: doc.metadata.title,
      revision: 2,
      updatedAt: '2026-09-07T12:00:00Z',
      trashedAt: null,
      course: {
        id: reviewCourseId,
        name: 'Robótica A',
        isArchived: false,
        ownerCanEdit: true,
      },
      feedbackCount: 1,
      provenance: {
        title: 'Ejemplo del profe',
        revision: 3,
        course: 'Robótica A',
      },
    },
  });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Mis proyectos', exact: true })
    .click();
  await expect(
    page.getByRole('link', {
      name: `Ver devoluciones de ${doc.metadata.title} (1) · otra pestaña`,
      exact: true,
    }),
  ).toHaveAttribute('href', `/revision/?project=${reviewProjectId}`);
  await expect(
    page.getByText(/Procedencia: copia de «Ejemplo del profe»/),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: `Elegir curso de ${doc.metadata.title}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/Este proyecto tiene devoluciones vinculadas/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Guardar curso del proyecto',
      exact: true,
    }),
  ).toBeDisabled();
  expect(api.writes).toBe(0);
});

test('revisión: bloques inmutables, simulación, pausa y exportación exacta sin alterar el editor', async ({
  page,
}) => {
  const state = await mockReview(page);
  await page.addInitScript(() =>
    localStorage.setItem('capibloques-project-v2', 'borrador ajeno intacto'),
  );
  await page.goto(reviewPath);
  const blocks = page.getByRole('application', {
    name: 'Bloques de la versión, sólo lectura',
  });
  await expect(
    blocks.locator('.blocklyBlockCanvas > .blocklyBlock'),
  ).not.toHaveCount(0);
  await expect(blocks.locator('.blocklyToolboxDiv')).toHaveCount(0);
  await expect(blocks.locator('.blocklyEditableText')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Guardar', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(page.locator('.review-sim-status')).toContainText('Ejecutando');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.locator('.review-sim-status')).toContainText('En pausa');
  await page.getByRole('button', { name: 'Un paso', exact: true }).click();
  await page.getByRole('button', { name: 'Detener', exact: true }).click();
  await expect(page.locator('.review-sim-status')).toContainText('Detenida');
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar JSON de versión 1', exact: true })
    .click();
  const file = await download;
  expect(JSON.parse(readFileSync((await file.path())!, 'utf8'))).toEqual(
    sampleProject(),
  );
  await expect(
    page.getByRole('button', {
      name: 'Descargar Arduino de versión 1',
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole('button', {
      name: 'Revisar cableado de esta versión',
      exact: true,
    })
    .click();
  const guide = page.getByRole('dialog', {
    name: 'Conectar la Wemos sin adivinar',
    exact: true,
  });
  for (const checkbox of await guide.getByRole('checkbox').all())
    await checkbox.check();
  await guide
    .getByRole('button', { name: 'Conexiones revisadas', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Descargar Arduino de versión 1',
      exact: true,
    }),
  ).toBeEnabled();
  const arduinoDownload = page.waitForEvent('download');
  await page
    .getByRole('button', {
      name: 'Descargar Arduino de versión 1',
      exact: true,
    })
    .click();
  const ino = await arduinoDownload;
  expect(ino.suggestedFilename()).toMatch(/-v1\.ino$/);
  expect(readFileSync((await ino.path())!, 'utf8')).toContain(
    '#include <Arduino.h>',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('capibloques-project-v2')),
  ).toBe('borrador ajeno intacto');
  expect(
    state.posts.every(
      (post) => post.path === 'versions/1/' && post.method === 'POST',
    ),
  ).toBe(true);
});

test('revisión: nueva versión no reemplaza lo revisado ni reinicia la simulación; comentario mantiene versión', async ({
  page,
}) => {
  const state = await mockReview(page);
  await page.goto(reviewPath);
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Nueva devolución · versión 1', exact: true })
    .fill('Revisá este semáforo');
  nextVersion(state);
  await page
    .getByRole('button', { name: 'Actualizar revisión', exact: true })
    .click();
  await expect(
    page.getByText(/Hay una versión más reciente \(2\)/),
  ).toBeVisible();
  await expect(page.locator('.review-sim-status')).toContainText('Ejecutando');
  await expect(
    page.getByRole('combobox', { name: 'Versión abierta', exact: true }),
  ).toHaveValue('1');
  await page
    .getByRole('button', { name: 'Abrir última versión', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page
    .getByRole('button', { name: 'Seguir con esta versión', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', {
      name: 'Nueva devolución · versión 1',
      exact: true,
    }),
  ).toHaveValue('Revisá este semáforo');
  await page
    .getByRole('button', { name: 'Enviar devolución', exact: true })
    .click();
  await expect(
    page.getByText('Devolución enviada sobre la versión 1.', { exact: true }),
  ).toBeVisible();
  expect(state.status.feedback[0].revision).toBe(1);
  await page
    .getByRole('button', { name: 'Abrir última versión', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Versión abierta', exact: true }),
  ).toHaveValue('2');
  await expect(
    page.getByText(state.status.feedback[0].text, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Ver versión 1 de esta devolución',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Versión abierta', exact: true }),
  ).toHaveValue('1');
});

test('devoluciones: cancelar no envía, texto plano y respuesta perdida no duplica', async ({
  page,
}) => {
  const state = await mockReview(page);
  await page.goto(reviewPath);
  const input = page.getByRole('textbox', {
    name: 'Nueva devolución · versión 1',
    exact: true,
  });
  await input.fill('Cancelar este texto');
  await page
    .getByRole('button', { name: 'Cancelar devolución', exact: true })
    .click();
  expect(state.status.feedback).toHaveLength(0);
  const text = '<img src=x onerror=alert(1)>\nRevisá 1 < 2';
  await input.fill(text);
  state.dropCommentAck = true;
  await page
    .getByRole('button', { name: 'Enviar devolución', exact: true })
    .click();
  await expect(
    page.getByText('Devolución confirmada en el servidor.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.feedback-text')).toHaveText(text);
  await expect(page.locator('.feedback-text img')).toHaveCount(0);
  expect(state.status.feedback).toHaveLength(1);
  await expect(input).toHaveValue('');
});

test('devoluciones: reintento conserva identidad y no pierde texto ante fallo de red', async ({
  page,
}) => {
  const state = await mockReview(page);
  await page.goto(reviewPath);
  await page
    .getByRole('textbox', { name: 'Nueva devolución · versión 1', exact: true })
    .fill('Probar dos semáforos');
  state.postOffline = true;
  await page
    .getByRole('button', { name: 'Enviar devolución', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Reintentar devolución', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', {
      name: 'Nueva devolución · versión 1',
      exact: true,
    }),
  ).toHaveValue('Probar dos semáforos');
  state.postOffline = false;
  await page
    .getByRole('button', { name: 'Reintentar devolución', exact: true })
    .click();
  await expect(
    page.getByText('Devolución enviada sobre la versión 1.', { exact: true }),
  ).toBeVisible();
  const attempts = state.posts.filter((post) => post.path === 'feedback/');
  expect(attempts).toHaveLength(2);
  expect(attempts[0].data).toEqual(attempts[1].data);
});

test('alumno: responder, cancelar, atender y reabrir sin escribir el proyecto', async ({
  page,
}) => {
  const state = await mockReview(page, true),
    item = addFeedback(state);
  await page.goto(reviewPath);
  await expect(page.getByLabel(/Nueva devolución/)).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Responder o marcar atendida', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Tu respuesta', exact: true })
    .fill('No guardar');
  await page
    .getByRole('button', { name: 'Cancelar respuesta', exact: true })
    .click();
  expect(item.reply).toBe('');
  await page
    .getByRole('button', { name: 'Responder o marcar atendida', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Tu respuesta', exact: true })
    .fill('Agregué un delay');
  await page.getByLabel('Ya atendí esta devolución', { exact: true }).check();
  await page
    .getByRole('button', { name: 'Guardar respuesta y estado', exact: true })
    .click();
  await expect(
    page.getByText('✓ Atendida por el alumno', { exact: true }),
  ).toBeVisible();
  expect(item.reply).toBe('Agregué un delay');
  expect(item.resolved).toBe(true);
  await page.reload();
  await expect(
    page.getByText('Agregué un delay', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Revisar mi respuesta y estado', exact: true })
    .click();
  await page.getByLabel('Ya atendí esta devolución', { exact: true }).uncheck();
  await page
    .getByRole('button', { name: 'Guardar respuesta y estado', exact: true })
    .click();
  await expect(
    page.getByText('Pendiente de atender', { exact: true }),
  ).toBeVisible();
  expect(state.status.project.revision).toBe(1);
});

test('alumno: conflicto conserva respuesta; cancelar muestra la actual sin sobrescritura', async ({
  page,
}) => {
  const state = await mockReview(page, true);
  addFeedback(state);
  await page.goto(reviewPath);
  await page
    .getByRole('button', { name: 'Responder o marcar atendida', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Tu respuesta', exact: true })
    .fill('Mi borrador');
  state.conflict = true;
  await page
    .getByRole('button', { name: 'Guardar respuesta y estado', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Tu respuesta', exact: true }),
  ).toHaveValue('Mi borrador');
  await expect(
    page.getByRole('button', {
      name: 'Guardar respuesta y estado',
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Cancelar respuesta', exact: true })
    .click();
  await expect(
    page.getByText('Respuesta desde otra pestaña', { exact: true }),
  ).toBeVisible();
  expect(state.status.feedback[0].reply).toBe('Respuesta desde otra pestaña');
});

test('revisión: revocar membresía limpia versión, conversación, borrador y simulador', async ({
  page,
}) => {
  const state = await mockReview(page);
  addFeedback(state);
  await page.goto(reviewPath);
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Nueva devolución · versión 1', exact: true })
    .fill('Texto privado todavía no enviado');
  state.denied = true;
  await page
    .getByRole('button', { name: 'Actualizar revisión', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Verificar acceso', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('application')).toHaveCount(0);
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await expect(page.getByLabel(/Nueva devolución/)).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toContain(
    'Texto privado todavía no enviado',
  );
});

test('revisión: corte detiene worker pero conserva texto; otra cuenta no hereda la revisión', async ({
  page,
}) => {
  const state = await mockReview(page);
  await page.goto(reviewPath);
  await page
    .getByRole('textbox', { name: 'Nueva devolución · versión 1', exact: true })
    .fill('Borrador conservado');
  state.offline = true;
  await page
    .getByRole('button', { name: 'Actualizar revisión', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Verificar acceso', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('application')).toHaveCount(0);
  state.offline = false;
  await page
    .getByRole('button', { name: 'Reintentar acceso', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', {
      name: 'Nueva devolución · versión 1',
      exact: true,
    }),
  ).toHaveValue('Borrador conservado');
  state.actor = pupil;
  await page
    .getByRole('button', { name: 'Actualizar revisión', exact: true })
    .click();
  await expect(
    page.getByText(/La cuenta cambió en otra pestaña/),
  ).toBeVisible();
  await expect(page.locator('.feedback-composer')).toHaveCount(0);
});

test('revisión: copia explícita sin tocar originales; cancelar no crea', async ({
  page,
}) => {
  const state = await mockReview(page);
  addFeedback(state);
  await page.goto(reviewPath);
  await page
    .getByRole('button', { name: 'Crear mi copia personal', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.copies).toBe(0);
  await page
    .getByRole('button', { name: 'Crear mi copia personal', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirmar copia personal', exact: true })
    .click();
  await expect(page.getByText(/Copia personal creada:/)).toBeVisible();
  expect(state.copies).toBe(1);
  expect(state.status.feedback).toHaveLength(1);
});

test('revisión: curso archivado permite leer y simular, sin nuevos mensajes', async ({
  page,
}) => {
  const state = await mockReview(page);
  addFeedback(state);
  state.status.project.course!.isArchived = true;
  state.status.canComment = false;
  state.status.canRespond = false;
  await page.goto(reviewPath);
  await expect(page.getByText(/Conversación de sólo lectura/)).toBeVisible();
  await expect(page.getByLabel(/Nueva devolución/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(page.locator('.review-sim-status')).toContainText('Ejecutando');
});

test('revisión: móvil, texto al 200%, controles y conversación accesibles', async ({
  page,
}, testInfo) => {
  const state = await mockReview(page);
  addFeedback(state);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(reviewPath);
  await expect(
    page.getByRole('button', { name: 'Simular', exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page
    .getByRole('textbox', { name: 'Nueva devolución · versión 1', exact: true })
    .fill('Probando teclado y texto grande');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Enviar devolución', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Cancelar devolución', exact: true })
    .click();
  const widths = await page.evaluate(() => ({
    actual: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(widths.actual).toBeLessThanOrEqual(widths.viewport + 1);
  await page.screenshot({
    path: testInfo.outputPath('revision-movil-200.png'),
    fullPage: true,
  });
});

test('revisión: enlace a versión retirada permite elegir otra explícitamente', async ({
  page,
}) => {
  const state = await mockReview(page);
  await page.goto(reviewPath + '&version=99');
  await expect(page.getByRole('alert')).toContainText(
    'Esta versión ya no está disponible',
  );
  await expect(page.getByRole('application')).toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Versión abierta', exact: true })
    .selectOption('1');
  await expect(page.getByRole('application')).toBeVisible();
  expect(state.snapshotOpens).toBe(2);
});

test('revisión: respuesta inválida bloquea sin perder borrador y se recupera', async ({
  page,
}) => {
  const state = await mockReview(page);
  await page.goto(reviewPath);
  await page
    .getByRole('textbox', { name: 'Nueva devolución · versión 1', exact: true })
    .fill('Texto antes del corte');
  state.status.feedback = [null as never];
  await page
    .getByRole('button', { name: 'Actualizar revisión', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Verificar acceso', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('application')).toHaveCount(0);
  state.status.feedback = [];
  await page
    .getByRole('button', { name: 'Reintentar acceso', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', {
      name: 'Nueva devolución · versión 1',
      exact: true,
    }),
  ).toHaveValue('Texto antes del corte');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('revisión: versión podada no se reemplaza ni publica el texto sobre otra', async ({
  page,
}) => {
  const state = await mockReview(page);
  await page.goto(reviewPath);
  await page
    .getByRole('textbox', { name: 'Nueva devolución · versión 1', exact: true })
    .fill('Sobre esta versión');
  nextVersion(state);
  state.documents.delete(1);
  state.status.versions = state.status.versions.filter(
    (item) => item.revision !== 1,
  );
  await page
    .getByRole('button', { name: 'Actualizar revisión', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'ya no está en el historial',
  );
  await expect(page.getByRole('application')).toHaveCount(0);
  await expect(
    page.getByRole('textbox', {
      name: 'Nueva devolución · versión sin abrir',
      exact: true,
    }),
  ).toHaveValue('Sobre esta versión');
  await expect(
    page.getByRole('button', { name: 'Enviar devolución', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('combobox', { name: 'Versión abierta', exact: true })
    .selectOption('2');
  await page
    .getByRole('button', { name: 'Seguir con esta versión', exact: true })
    .click();
  expect(state.status.feedback).toHaveLength(0);
});
