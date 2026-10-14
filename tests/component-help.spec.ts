import { expect, test } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';

test.beforeEach(async ({ page }) => {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
});

test('ayuda: catálogo e inspector explican y actualizan las conexiones', async ({ page }) => {
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  await editor.getByRole('button', { name: 'Ayuda sobre LED' }).click();

  let help = page.getByRole('dialog', { name: /Ayuda: LED$/ });
  await expect(help.getByText('Ilustración orientativa')).toBeVisible();
  await expect(help.getByText(/no es una foto del modelo exacto/i)).toBeVisible();
  await expect(help.getByRole('heading', { name: '¿Cómo funciona?' })).toBeVisible();
  await help.getByRole('button', { name: 'Entendido' }).click();

  await editor.getByRole('button', { name: /^Agregar LED\./ }).click();
  await editor.getByRole('button', { name: 'Auto conectar' }).click();
  await editor.locator('.inspector-help-button').click();
  help = page.getByRole('dialog', { name: /Ayuda: LED 1/ });
  await expect(help.getByRole('heading', { name: /Conectalo a/ })).toBeVisible();
  await expect(help.getByRole('cell', { name: /GPIO/ })).toBeVisible();
  await expect(help.getByRole('button', { name: /Imprimir ficha/ })).toBeVisible();
});

test('ayuda: se adapta a una pantalla angosta sin perder navegación', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  await editor.getByRole('button', { name: 'Ayuda sobre Botón' }).click();
  const help = page.getByRole('dialog', { name: /Ayuda: Botón$/ });
  await expect(help.getByRole('link', { name: 'Conectalo' })).toBeVisible();
  await expect(help.getByRole('button', { name: 'Entendido' })).toBeVisible();
  await expect(help).toHaveCSS('overflow', 'hidden');
});
