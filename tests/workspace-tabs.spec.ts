import { expect, test } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';

test('organiza procedimientos en pestañas editables con deshacer y rehacer', async ({
  page,
}) => {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Secciones del programa' });
  await expect(tabs.getByRole('tab', { name: 'Principal' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await tabs.getByRole('button', { name: 'Agregar pestaña' }).click();
  const name = tabs.getByRole('textbox', { name: 'Nombre de la pestaña' });
  await expect(name).toBeFocused();
  await name.fill('Movimientos');
  await name.press('Enter');
  await expect(tabs.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(tabs.getByRole('tab', { name: 'Movimientos' })).toHaveCount(0);
  await expect(tabs.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(tabs.getByRole('tab', { name: 'Tab 1' })).toHaveCount(0);
  await expect(tabs.getByRole('tab', { name: 'Principal' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Rehacer' }).click();
  await expect(tabs.getByRole('tab', { name: 'Tab 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Rehacer' }).click();
  await expect(tabs.getByRole('tab', { name: 'Movimientos' })).toBeVisible();
});

test('envía un grupo de bloques a otra pestaña desde el botón derecho', async ({
  page,
}) => {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Secciones del programa' });
  await tabs.getByRole('button', { name: 'Agregar pestaña' }).click();
  const name = tabs.getByRole('textbox', { name: 'Nombre de la pestaña' });
  await name.fill('Movimientos');
  await name.press('Enter');
  await tabs.getByRole('tab', { name: 'Principal' }).click();

  const start = page
    .locator('.blocklyWorkspace > .blocklyBlockCanvas > .blocklyDraggable')
    .first();
  await expect(start).toBeVisible();
  await start.click({ button: 'right', position: { x: 80, y: 20 } });
  await expect(page.getByText('Enviar a…', { exact: true })).toBeVisible();
  await page.getByText('↗ Enviar a «Movimientos»', { exact: true }).click();

  await expect(tabs.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(start).toBeVisible();
  await tabs.getByRole('tab', { name: 'Principal' }).click();
  await expect(start).toBeHidden();

  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(start).toBeVisible();
  await page.getByRole('button', { name: 'Rehacer' }).click();
  await expect(start).toBeHidden();
  await tabs.getByRole('tab', { name: 'Movimientos' }).click();
  await expect(start).toBeVisible();
});
