import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';
async function openLine(page: Page, modular = false) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const e = examples.find(
    (e) => e.id === (modular ? 'lineTrackProcedures' : 'lineTrack'),
  )!;
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'linea.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify(makeProject(e.title, e.scene, e.workspace, 4)),
      ),
    });
  const dialog = page.getByRole('alertdialog', {
    name: 'Antes de reemplazar el editor',
  });
  if (await dialog.isVisible())
    await dialog
      .getByRole('button', { name: 'Descartar cambios y abrir' })
      .click();
  await expect(page.locator('[data-line-pattern]')).toBeVisible();
}
for (const modular of [false, true])
  test(`seguidor ${modular ? 'modular' : 'básico'}: rueda, sensores, pausa y reset`, async ({
    page,
  }, info) => {
    await openLine(page, modular);
    if (modular)
      await expect(
        page.getByRole('tab', { name: 'Búsqueda', exact: true }),
      ).toBeVisible();
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    const world = page.locator('[data-line-pattern]');
    await expect
      .poll(async () => Number(await world.getAttribute('data-line-distance')))
      .toBeGreaterThan(160);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Reanudar', exact: true }),
    ).toBeVisible();
    const before = await world.innerHTML();
    await page.waitForTimeout(250);
    expect(await world.innerHTML()).toBe(before);
    await page.screenshot({
      path: info.outputPath(`seguidor-${modular ? 'modular' : 'basico'}.png`),
    });
    await page
      .getByRole('button', { name: 'Más herramientas', exact: true })
      .click();
    await page
      .getByRole('menuitem', { name: 'Reiniciar programa y escena' })
      .click();
    await expect(world).toHaveAttribute('data-line-distance', '0.0');
    await expect(world).toHaveAttribute('data-line-pattern', '010');
  });
test('circuito: recta/curva/lápiz/mover/borrar, undo/redo y guardar/cancelar', async ({
  page,
}) => {
  await openLine(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const scene = page.getByRole('dialog', {
    name: 'Editor de escenas',
    exact: true,
  });
  await scene
    .getByRole('button', { name: 'Editar circuito', exact: true })
    .click();
  const editor = page.getByRole('dialog', {
      name: 'Editar circuito de línea',
      exact: true,
    }),
    canvas = editor.getByLabel('Lienzo del circuito');
  const box = (await canvas.boundingBox())!;
  const click = async (x: number, y: number) =>
    page.mouse.click(
      box.x + (x / 960) * box.width,
      box.y + (y / 540) * box.height,
    );
  const drag = async (x: number, y: number, x2: number, y2: number) => {
    await page.mouse.move(
      box.x + (x / 960) * box.width,
      box.y + (y / 540) * box.height,
    );
    await page.mouse.down();
    await page.mouse.move(
      box.x + (x2 / 960) * box.width,
      box.y + (y2 / 540) * box.height,
      { steps: 12 },
    );
    await page.mouse.up();
  };
  await editor
    .getByRole('button', { name: 'Recta', exact: true })
    .last()
    .click();
  await drag(180, 100, 400, 100);
  await expect(canvas.locator('polyline')).toHaveCount(2);
  await editor.getByRole('button', { name: 'Curva', exact: true }).click();
  await click(180, 200);
  await click(250, 100);
  await click(400, 200);
  await expect(canvas.locator('polyline')).toHaveCount(3);
  await editor.getByRole('button', { name: 'Lápiz', exact: true }).click();
  await drag(180, 250, 400, 250);
  await expect(canvas.locator('polyline')).toHaveCount(4);
  await editor
    .getByRole('button', { name: 'Seleccionar y mover', exact: true })
    .click();
  await drag(290, 100, 300, 130);
  await expect(
    editor.getByRole('combobox', { name: 'Trazo seleccionado' }),
  ).not.toHaveValue('-1');
  await editor
    .getByRole('button', { name: 'Borrar trazo', exact: true })
    .click();
  await expect(canvas.locator('polyline')).toHaveCount(3);
  await editor
    .getByRole('button', { name: 'Deshacer trazo', exact: true })
    .click();
  await expect(canvas.locator('polyline')).toHaveCount(4);
  await editor
    .getByRole('button', { name: 'Rehacer trazo', exact: true })
    .click();
  await expect(canvas.locator('polyline')).toHaveCount(3);
  await editor
    .getByRole('button', { name: 'Guardar circuito', exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await scene.getByRole('button', { name: /Deshacer/ }).click();
  await scene.getByRole('button', { name: /Rehacer/ }).click();
  await scene
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(scene).toHaveCount(0);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await scene
    .getByRole('button', { name: 'Editar circuito', exact: true })
    .click();
  await expect(
    editor.getByLabel('Lienzo del circuito').locator('polyline'),
  ).toHaveCount(3);
  await editor.getByRole('combobox', {name:'Trazo seleccionado'}).selectOption('0');
  await editor.getByRole('button', {name:'Borrar trazo',exact:true}).click();
  await expect(editor.getByLabel('Lienzo del circuito').locator('polyline')).toHaveCount(2);
  page.once('dialog',dialog=>dialog.accept());
  await editor
    .getByRole('button', { name: 'Cancelar circuito', exact: true })
    .click();
  await scene.getByRole('button',{name:'Editar circuito',exact:true}).click();
  await expect(editor.getByLabel('Lienzo del circuito').locator('polyline')).toHaveCount(3);
  await editor.getByRole('button',{name:'Cancelar circuito',exact:true}).click();
  await scene.getByRole('button', { name: 'Cancelar', exact: true }).click();
});
