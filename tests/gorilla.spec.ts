import { test, expect, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';
async function openGorilla(page: Page, modular = false) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const e = examples.find(
    (e) => e.id === (modular ? 'gorillaBenchProcedures' : 'gorillaBench'),
  )!;
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'gorilla.json',
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
  await expect(page.locator('[data-gorilla-ready]')).toBeVisible();
}
for (const modular of [false, true])
  test(`GorillaBot ${modular ? 'pata modular' : 'un servo'}: preparar, mover, pausar y reset`, async ({
    page,
  }, info) => {
    await openGorilla(page, modular);
    if (modular)
      await expect(
        page.getByRole('tab', { name: 'Una pata', exact: true }),
      ).toBeVisible();
    const robot = page.locator('[data-gorilla-ready]');
    await expect(robot).toHaveAttribute('data-gorilla-ready', 'false');
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await expect(robot).toHaveAttribute('data-gorilla-ready', 'true');
    await expect
      .poll(async () => Number(await robot.getAttribute('data-gorilla-a')))
      .toBeGreaterThan(3);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Reanudar', exact: true }),
    ).toBeVisible();
    const before = await robot.getAttribute('data-gorilla-a');
    await page.waitForTimeout(250);
    expect(await robot.getAttribute('data-gorilla-a')).toBe(before);
    await page.screenshot({
      path: info.outputPath(`gorilla-${modular ? 'pata' : 'motor'}.png`),
    });
    await page
      .getByRole('button', { name: 'Más herramientas', exact: true })
      .click();
    await page
      .getByRole('menuitem', { name: 'Reiniciar programa y escena' })
      .click();
    await expect(robot).toHaveAttribute('data-gorilla-ready', 'false');
    await expect(robot).toHaveAttribute('data-gorilla-a', '0.0');
  });
test('calibración: motor seleccionado, vista previa no guardada, límites, guardar/cancelar', async ({
  page,
}) => {
  await openGorilla(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const scene = page.getByRole('dialog', {
      name: 'Editor de escenas',
      exact: true,
    }),
    cal = scene.getByRole('region', { name: 'Calibración de GorillaBot' });
  await expect(cal).toBeVisible();
  await cal.getByLabel('Pata a calibrar').selectOption('2');
  await cal.getByLabel('Vista previa motor A (−20° a +20°)').fill('10');
  await expect(cal.locator('[data-gorilla-a]')).toHaveAttribute(
    'data-gorilla-a',
    '10.0',
  );
  await cal.getByLabel('Centro', { exact: true }).first().fill('95');
  await scene.getByRole('button', { name: /Guardar cambios/ }).click();
  await scene
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(page.locator('[data-gorilla-a]')).toHaveAttribute(
    'data-gorilla-a',
    '0.0',
  );
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await cal.getByLabel('Pata a calibrar').selectOption('2');
  await expect(cal.getByLabel('Centro', { exact: true }).first()).toHaveValue(
    '95',
  );
  await cal.getByLabel('Límite mínimo', { exact: true }).first().fill('110');
  await expect(cal.getByRole('alert')).toContainText('No se puede guardar');
  await scene.getByRole('button', { name: /Cancelar cambios/ }).click();
  await expect(cal.getByLabel('Centro', { exact: true }).first()).toHaveValue(
    '95',
  );
  await scene.getByRole('button', { name: 'Cancelar', exact: true }).click();
});
