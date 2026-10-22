import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';

async function openTheater(page: Page, modular = false) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const example = examples.find(
    (e) => e.id === (modular ? 'ottoTheaterProcedures' : 'ottoTheater'),
  )!;
  const scene = structuredClone(example.scene);
  scene.canvas.theaterEnvironment = {
    automaticArrivals: false,
    count: 3,
    distance: 35,
    staySeconds: 40,
  };
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'teatro.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify(makeProject(example.title, scene, example.workspace, 1)),
      ),
    });
  const confirm = page.getByRole('alertdialog', {
    name: 'Antes de reemplazar el editor',
  });
  if (await confirm.isVisible())
    await confirm
      .getByRole('button', { name: 'Descartar cambios y abrir' })
      .click();
  await expect(page.locator('[data-theater-phase]')).toBeVisible();
}

for (const modular of [false, true])
  test(`teatro ${modular ? 'modular' : 'directo'}: petición, actuación, pausa y reset`, async ({
    page,
  }, info) => {
    test.setTimeout(60_000);
    await openTheater(page, modular);
    if (modular)
      await expect(
        page.getByRole('tab', { name: 'Actuación', exact: true }),
      ).toBeVisible();
    await page.getByRole('tab', { name: 'Estado', exact: true }).click();
    await expect(
      page.getByRole('slider', { name: /Distancia de Otto/ }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Llega público', exact: true })
      .click();
    await page.getByRole('tab', { name: 'Escena', exact: true }).click();
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    const world = page.locator('[data-theater-phase]');
    await expect(world).toHaveAttribute('data-theater-phase', 'watching');
    await expect(world.locator('[data-theater-person]')).toHaveCount(3);
    await expect(page.locator('[data-otto-motion]')).toHaveAttribute(
      'data-otto-motion',
      'HOME',
    );
    await page.getByRole('tab', { name: 'Estado', exact: true }).click();
    await page
      .getByRole('button', { name: 'Pedir actuación', exact: true })
      .click();
    await page.getByRole('tab', { name: 'Escena', exact: true }).click();
    await expect(page.locator('[data-otto-motion]')).toHaveAttribute(
      'data-otto-motion',
      'DANCE',
    );
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Reanudar', exact: true }),
    ).toBeVisible();
    const before = await world.innerHTML();
    await page.waitForTimeout(250);
    expect(await world.innerHTML()).toBe(before);
    await page.screenshot({
      path: info.outputPath(`teatro-${modular ? 'modular' : 'directo'}.png`),
    });
    await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
    await expect(page.locator('.otto-face')).toHaveText('😍');
    await page.getByRole('tab', { name: 'Estado', exact: true }).click();
    await page
      .getByRole('button', { name: 'Se retira el público', exact: true })
      .click();
    await page.getByRole('tab', { name: 'Escena', exact: true }).click();
    await expect(world).toHaveAttribute('data-theater-phase', 'empty');
    await page
      .getByRole('button', { name: 'Más herramientas', exact: true })
      .click();
    await page
      .getByRole('menuitem', { name: 'Reiniciar programa y escena' })
      .click();
    await expect(world).toHaveAttribute('data-theater-groups', '0');
    await expect(world).toHaveAttribute('data-theater-distance', '400');
  });

test('teatro: guardar/cancelar/deshacer/rehacer condiciones del público', async ({
  page,
}) => {
  await openTheater(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', {
    name: 'Editor de escenas',
    exact: true,
  });
  await editor.getByText('Público al comenzar', { exact: true }).click();
  await editor
    .getByRole('combobox', { name: 'Personas del público' })
    .selectOption('4');
  await editor.getByRole('button', { name: /Deshacer/ }).click();
  await expect(
    editor.getByRole('combobox', { name: 'Personas del público' }),
  ).toHaveValue('3');
  await editor.getByRole('button', { name: /Rehacer/ }).click();
  await expect(
    editor.getByRole('combobox', { name: 'Personas del público' }),
  ).toHaveValue('4');
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: '¿Salir sin guardar la escena?' })
    .getByRole('button', { name: 'Salir sin guardar', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Personas del público' }),
  ).toHaveValue('3');
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await editor.getByText('Público al comenzar', { exact: true }).click();
  await editor
    .getByRole('combobox', { name: 'Personas del público' })
    .selectOption('2');
  await editor
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByRole('combobox', { name: 'Personas del público' }),
  ).toHaveValue('2');
});
