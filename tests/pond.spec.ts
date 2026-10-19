import { test, expect, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';
async function openPond(page: Page, modular = false) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const e = examples.find(
    (e) => e.id === (modular ? 'pondLabProcedures' : 'pondLab'),
  )!;
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'laguna.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify(makeProject(e.title, e.scene, e.workspace, 4)),
      ),
    });
  const confirm = page.getByRole('alertdialog', {
    name: 'Antes de reemplazar el editor',
  });
  if (await confirm.isVisible())
    await confirm
      .getByRole('button', { name: 'Descartar cambios y abrir' })
      .click();
  await expect(page.locator('[data-pond-lagoon]')).toBeVisible();
}
for (const modular of [false, true])
  test(`laguna ${modular ? 'modular' : 'directa'}: agua, sensores, pausa y reinicio`, async ({
    page,
  }, info) => {
    await openPond(page, modular);
    if (modular)
      await expect(
        page.getByRole('tab', { name: 'Protección', exact: true }),
      ).toBeVisible();
    const world = page.locator('[data-pond-lagoon]');
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await expect
      .poll(async () => Number(await world.getAttribute('data-pond-lagoon')))
      .toBeGreaterThan(40);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Reanudar', exact: true }),
    ).toBeVisible();
    const before = await world.getAttribute('data-pond-lagoon');
    await page.waitForTimeout(250);
    expect(await world.getAttribute('data-pond-lagoon')).toBe(before);
    await page.screenshot({
      path: info.outputPath(`laguna-${modular ? 'modular' : 'directa'}.png`),
    });
    await page
      .getByRole('button', { name: 'Más herramientas', exact: true })
      .click();
    await page
      .getByRole('menuitem', { name: 'Reiniciar programa y escena' })
      .click();
    await expect(world).toHaveAttribute('data-pond-lagoon', '35.00');
    await expect(world).toHaveAttribute('data-pond-spilled', '0.00');
  });
test('laguna: configuración inicial guardar/cancelar y deshacer', async ({
  page,
}) => {
  await openPond(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const scene = page.getByRole('dialog', {
    name: 'Editor de escenas',
    exact: true,
  });
  await scene.getByText('Agua al comenzar', { exact: true }).first().click();
  const slider = scene.getByLabel('Laguna inicial (0–100 L)');
  await slider.fill('60');
  await scene
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(page.locator('[data-pond-lagoon]')).toHaveAttribute(
    'data-pond-lagoon',
    '60.00',
  );
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await scene.getByText('Agua al comenzar', { exact: true }).first().click();
  await scene.getByLabel('Laguna inicial (0–100 L)').fill('80');
  await scene
    .getByRole('button', { name: 'Deshacer último cambio', exact: true })
    .click();
  await expect(scene.getByLabel('Laguna inicial (0–100 L)')).toHaveValue('60');
  await scene
    .getByRole('button', { name: 'Rehacer último cambio', exact: true })
    .click();
  await expect(scene.getByLabel('Laguna inicial (0–100 L)')).toHaveValue('80');
  await scene.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const discard = page.getByRole('alertdialog');
  if (await discard.isVisible())
    await discard.getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await expect(page.locator('[data-pond-lagoon]')).toHaveAttribute(
    'data-pond-lagoon',
    '60.00',
  );
});
