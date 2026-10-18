import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';

async function example(page: Page, title: string) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  await page.getByRole('button', { name: 'Opciones del proyecto' }).click();
  await page.getByRole('menuitem', { name: 'Abrir un ejemplo' }).click();
  await page.getByRole('dialog', { name: 'Elige una misión' }).getByRole('button', { name: new RegExp(title) }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  if (await confirmation.isVisible()) await confirmation.getByRole('button', { name: 'Descartar cambios y abrir' }).click();
}

for (const count of [2, 4]) test(`paso a nivel ${count} vías: ejemplo completo y trenes simultáneos`, async ({ page }, info) => {
  await example(page, `Paso a nivel · ${count} vías`);
  const world = page.locator('.scene-world-railCrossing');
  await expect(world).toHaveAttribute('data-rail-tracks', String(count));
  await expect(world.locator('[data-rail-track]')).toHaveCount(count);
  await expect(world.locator('[data-rail-detector]')).toHaveCount(count * 2);
  await expect(page.locator('[data-id="rail-multi-parallel"]')).toBeVisible();
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(world.locator('[data-rail-train]')).toHaveCount(count, { timeout: 12000 });
  await expect(world.locator('[data-rail-gate="northGate"]')).toHaveAttribute('data-angle', '0.00', { timeout: 12000 });
  await expect(world.locator('[data-rail-gate="southGate"]')).toHaveAttribute('data-angle', '0.00');
  await expect(world.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`paso-${count}-vias.png`) });
});

test('cantidad de vías: borrador, deshacer, guardar, reabrir y cancelar', async ({ page }) => {
  await example(page, 'Paso a nivel con procedimientos');
  const world = page.locator('.scene-world-railCrossing');
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  let editor = page.getByRole('dialog', { name: 'Editor de escenas', exact: true });
  const count = editor.getByRole('combobox', { name: 'Cantidad de vías' });
  await count.selectOption('4');
  await expect(editor.locator('[data-rail-track]')).toHaveCount(4);
  await expect(editor.locator('[data-rail-detector]')).toHaveCount(8);
  page.once('dialog', dialog => dialog.dismiss());
  await count.selectOption('1');
  await expect(count).toHaveValue('4');
  page.once('dialog', dialog => dialog.accept());
  await count.selectOption('2');
  await expect(count).toHaveValue('2');
  await editor.getByRole('button', { name: 'Deshacer último cambio', exact: true }).click();
  await expect(count).toHaveValue('4');
  await editor.getByRole('button', { name: 'Deshacer último cambio', exact: true }).click();
  await expect(count).toHaveValue('1');
  await count.selectOption('2');
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(world).toHaveAttribute('data-rail-tracks', '2');
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Editor de escenas', exact: true });
  await expect(editor.getByRole('combobox', { name: 'Cantidad de vías' })).toHaveValue('2');
  await editor.getByRole('combobox', { name: 'Cantidad de vías' }).selectOption('4');
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('alertdialog', { name: '¿Salir sin guardar la escena?' }).getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(world).toHaveAttribute('data-rail-tracks', '2');
});
