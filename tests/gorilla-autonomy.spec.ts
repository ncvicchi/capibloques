import { test, expect } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';
for (const modular of [false, true])
  test(`Gorilla61 ${modular ? 'modular' : 'directo'}: botón, lectura automática, falta de eco y pausa`, async ({
    page,
  }) => {
    await mockEditorSession(page);
    await page.goto('/');
    await expect(page.locator('.blocklySvg')).toBeVisible();
    const e = examples.find(
      (e) =>
        e.id === (modular ? 'gorillaAutonomyProcedures' : 'gorillaAutonomy'),
    )!;
    await page
      .locator('input[type=file]')
      .setInputFiles({
        name: 'gorilla61.json',
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
    const world = page.locator('[data-gorilla-x]');
    await expect(world).toBeVisible();
    if (modular) {
      await expect(
        page.getByRole('tab', { name: 'Misiones', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Sensores', exact: true }),
      ).toBeVisible();
    }
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await expect(world).toHaveAttribute('data-gorilla-x', '120.00');
    const start = page.getByRole('button', {
      name: 'Pulsar y soltar botón de misión',
      exact: true,
    });
    await start.click();
    await expect
      .poll(async () => Number(await world.getAttribute('data-gorilla-x')), {
        timeout: 15000,
      })
      .toBeGreaterThan(121);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Reanudar', exact: true }),
    ).toBeVisible();
    const held = await world.getAttribute('data-gorilla-x');
    await page.waitForTimeout(200);
    await expect(world).toHaveAttribute('data-gorilla-x', held!);
    await page
      .getByText('Ensayos de sensor y obstáculos', { exact: true })
      .click();
    await page
      .getByLabel('Ensayo de distancia frontal')
      .selectOption('missing');
    await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Simular', exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(world).toHaveAttribute('data-gorilla-contact', 'false');
    await expect(world).toHaveAttribute('data-gorilla-valid', 'false');
    await page
      .getByRole('button', { name: 'Más herramientas', exact: true })
      .click();
    await page
      .getByRole('menuitem', { name: 'Reiniciar programa y escena' })
      .click();
    await expect(page.getByLabel('Ensayo de distancia frontal')).toHaveValue(
      'normal',
    );
    await expect(world).toHaveAttribute('data-gorilla-x', '120.00');
  });
