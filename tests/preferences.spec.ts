import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession, student, token } from './editor-fixture';
import type { Preferences } from '../lib/user-preferences';

async function mockPreferences(page: Page) {
  await mockEditorSession(page);
  const state = {
    value: {
      avatarId: 'capybara',
      favorites: [],
      version: 1,
      configured: false,
    } as Preferences,
    writes: 0,
    offline: false,
    conflict: false,
    loseAck: false,
    denied: false,
  };
  await page.route('**/api/auth/session/', (route) =>
    route.fulfill({ json: { user: student, csrfToken: token } }),
  );
  await page.route('**/api/auth/preferences/', async (route) => {
    const req = route.request();
    if (state.denied)
      return route.fulfill({
        status: 409,
        json: { code: 'account_changed', error: 'La cuenta cambió.' },
      });
    if (state.offline) return route.abort();
    expect(req.headers()['x-capi-account']).toBe(student.id);
    if (req.method() === 'PATCH') {
      expect(req.headers()['x-csrftoken']).toBe(token);
      const data = req.postDataJSON();
      if (state.conflict) {
        state.conflict = false;
        state.value = {
          ...state.value,
          avatarId: 'flower',
          version: state.value.version + 1,
        };
      }
      const same = Object.entries(data).every(
        ([key, value]) =>
          key === 'version' ||
          JSON.stringify(value) ===
            JSON.stringify(state.value[key as keyof Preferences]),
      );
      if (data.version !== state.value.version && !same)
        return route.fulfill({
          status: 409,
          json: {
            code: 'stale_revision',
            error: 'Cambió en otra pestaña.',
            preferences: state.value,
            csrfToken: token,
          },
        });
      if (!same) {
        const { version, ...patch } = data;
        state.value = {
          ...state.value,
          ...patch,
          version: state.value.version + 1,
          configured: state.value.configured || Boolean(data.avatarId),
        };
        state.writes++;
      }
      if (state.loseAck) {
        state.loseAck = false;
        return route.abort();
      }
    }
    return route.fulfill({
      json: { preferences: state.value, csrfToken: token },
    });
  });
  return state;
}

test('avatar: galería, categoría, cancelar y guardar persisten sin alterar acceso', async ({
  page,
}) => {
  const state = await mockPreferences(page);
  await page.goto('/cuenta/');
  await page
    .getByRole('button', { name: 'Elegir avatar', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Elegí tu avatar',
    exact: true,
  });
  await dialog
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption('Animales');
  await dialog.getByRole('radio', { name: /Lila la rana/ }).check();
  await dialog
    .getByRole('button', { name: 'Cancelar avatar', exact: true })
    .click();
  expect(state.writes).toBe(0);
  await page
    .getByRole('button', { name: 'Elegir avatar', exact: true })
    .click();
  await dialog.getByRole('radio', { name: /Lila la rana/ }).check();
  await dialog
    .getByRole('button', { name: 'Guardar avatar', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.value.avatarId).toBe('frog');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible({ timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 10000 });
  await expect(
    page
      .getByRole('region', { name: 'Mi avatar' })
      .getByRole('img', { name: 'Lila la rana' }),
  ).toBeVisible();
  await expect(page.getByText('@luna · alumno', { exact: true })).toBeVisible();
});

test('avatar: cerrar pide descartar y conflicto mantiene selección para elegir explícitamente', async ({
  page,
}) => {
  const state = await mockPreferences(page);
  await page.goto('/cuenta/');
  await page
    .getByRole('button', { name: 'Elegir avatar', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Elegí tu avatar' });
  await dialog.getByRole('radio', { name: /Lila la rana/ }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Seguir eligiendo' }).click();
  await expect(
    dialog.getByRole('radio', { name: /Lila la rana/ }),
  ).toBeChecked();
  state.conflict = true;
  await dialog.getByRole('button', { name: 'Guardar avatar' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Guardar mi selección igualmente' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('radio', { name: /Lila la rana/ }),
  ).toBeChecked();
  expect(state.value.avatarId).toBe('flower');
  await dialog.getByRole('button', { name: 'Usar lo guardado' }).click();
  await expect(
    dialog.getByRole('radio', { name: /Flora la flor/ }),
  ).toBeChecked();
  await dialog.getByRole('button', { name: 'Cancelar avatar' }).click();
  expect(state.writes).toBe(0);
});

test('avatar: corte y respuesta perdida conservan elección y no duplican guardado', async ({
  page,
}) => {
  const state = await mockPreferences(page);
  await page.goto('/cuenta/');
  await page
    .getByRole('button', { name: 'Elegir avatar', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Elegí tu avatar' });
  await dialog.getByRole('radio', { name: /Lila la rana/ }).check();
  state.offline = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(
    dialog.getByRole('button', { name: 'Reintentar conexión de preferencias' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('radio', { name: /Lila la rana/ }),
  ).toBeChecked();
  state.offline = false;
  await dialog
    .getByRole('button', { name: 'Reintentar conexión de preferencias' })
    .click();
  await expect(
    dialog.getByRole('button', { name: 'Guardar avatar' }),
  ).toBeEnabled();
  state.loseAck = true;
  await dialog.getByRole('button', { name: 'Guardar avatar' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar avatar' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toBe(1);
});

test('avatar: cuenta revocada retira el selector y no aplica el borrador', async ({
  page,
}) => {
  const state = await mockPreferences(page);
  await page.goto('/cuenta/');
  await page
    .getByRole('button', { name: 'Elegir avatar', exact: true })
    .click();
  await page.getByRole('radio', { name: /Lila la rana/ }).check();
  state.denied = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes).toBe(0);
});

test('favoritos: primera categoría, estrellas, cancelar, guardar y recargar sin cambiar bloques', async ({
  page,
}) => {
  const state = await mockPreferences(page);
  await page.goto('/');
  await page
    .locator('.blocklyToolboxCategory')
    .filter({ hasText: '★ Favoritos' })
    .click();
  await expect(
    page.getByText('Marcá estrellas para agregar tus bloques.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator('.blocklyFlyoutButton')
    .filter({ hasText: '☆ Elegir favoritos' })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Elegí tus bloques favoritos',
  });
  await dialog.getByRole('checkbox', { name: /Semáforo/ }).check();
  await dialog.getByRole('checkbox', { name: /Esperar/ }).check();
  await dialog.getByRole('button', { name: 'Cancelar favoritos' }).click();
  expect(state.writes).toBe(0);
  await page
    .getByRole('treeitem', { name: '★ Favoritos', exact: true })
    .click();
  await page
    .locator('.blocklyFlyoutButton')
    .filter({ hasText: '☆ Elegir favoritos' })
    .click();
  await expect(
    dialog.getByRole('checkbox', { name: /Esperar/ }),
  ).not.toBeChecked();
  await dialog.getByRole('checkbox', { name: /Semáforo/ }).check();
  await dialog.getByRole('checkbox', { name: /Esperar/ }).check();
  await dialog.getByRole('button', { name: 'Guardar favoritos' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.value.favorites).toEqual(['capi_traffic', 'capi_wait']);
  await page
    .getByRole('treeitem', { name: '★ Favoritos', exact: true })
    .click();
  await expect(
    page.locator('.blocklyFlyout .blocklyBlockCanvas > .blocklyBlock'),
  ).toHaveCount(2);
  await page.reload();
  await page
    .locator('.blocklyToolboxCategory')
    .filter({ hasText: '★ Favoritos' })
    .click();
  await expect(
    page.locator('.blocklyFlyout .blocklyBlockCanvas > .blocklyBlock'),
  ).toHaveCount(2);
  expect(state.writes).toBe(1);
});

test('preferencias: móvil 390 px, texto al 200% y teclado', async ({
  page,
}, testInfo) => {
  await mockPreferences(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cuenta/');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page
    .getByRole('button', { name: 'Elegir avatar', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Elegí tu avatar' });
  await dialog.getByRole('radio', { name: /Bip el robot/ }).check();
  await dialog
    .getByRole('button', { name: 'Guardar avatar' })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('avatar-mobile.png'),
    fullPage: true,
  });
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    overflow: [...document.querySelectorAll('body *')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.right > innerWidth + 1;
      })
      .slice(0, 15)
      .map((element) => ({
        tag: element.tagName,
        className: String(element.className),
        width: element.getBoundingClientRect().width,
        text: element.textContent?.slice(0, 50),
      })),
  }));
  expect(layout.width, JSON.stringify(layout.overflow)).toBeLessThanOrEqual(
    391,
  );
  await dialog.getByRole('button', { name: 'Guardar avatar' }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
});
