import { test, expect, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';
async function openGorilla(
  page: Page,
  modular = false,
  postures = false,
  paths = false,
) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const e = examples.find(
    (e) =>
      e.id ===
      (paths
        ? modular
          ? 'gorillaTrajectoriesProcedures'
          : 'gorillaTrajectories'
        : postures
          ? modular
            ? 'gorillaPosturesProcedures'
            : 'gorillaPostures'
          : modular
            ? 'gorillaBenchProcedures'
            : 'gorillaBench'),
  )!;
  await page.locator('input[type=file]').setInputFiles({
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

for (const modular of [false, true])
  test(`posturas ${modular ? 'modulares' : 'directas'}: programa completo y ocho motores`, async ({
    page,
  }) => {
    await openGorilla(page, modular, true);
    if (modular)
      await expect(
        page.getByRole('tab', { name: 'Secuencia', exact: true }),
      ).toBeVisible();
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    const robot = page.locator('[data-gorilla-ready]');
    await expect(robot).toHaveAttribute('data-gorilla-ready', 'true');
    await expect
      .poll(async () => Number(await robot.getAttribute('data-gorilla-a')))
      .toBeGreaterThan(3);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    const held = await robot.getAttribute('data-gorilla-a');
    await page.waitForTimeout(200);
    expect(await robot.getAttribute('data-gorilla-a')).toBe(held);
  });
test('editor de posturas: alta, preview, undo/redo, guardar, reabrir y cancelar', async ({
  page,
}, info) => {
  await openGorilla(page, false, true);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const scene = page.getByRole('dialog', {
    name: 'Editor de escenas',
    exact: true,
  });
  await scene
    .getByRole('button', { name: 'Editar posturas', exact: true })
    .click();
  const editor = page.getByRole('dialog', {
    name: 'Posturas de GorillaBot',
    exact: true,
  });
  await editor
    .getByRole('button', { name: 'Nueva postura', exact: true })
    .click();
  await editor.getByLabel('Nombre de la postura').fill('Mi postura');
  const angle = editor.getByLabel('Motor A · Delantera izquierda', {
    exact: true,
  });
  await angle.fill('8');
  await editor
    .getByRole('button', { name: 'Deshacer postura', exact: true })
    .click();
  await expect(angle).toHaveValue('0');
  await editor
    .getByRole('button', { name: 'Rehacer postura', exact: true })
    .click();
  await expect(angle).toHaveValue('8');
  await editor
    .getByRole('button', { name: 'Ver desde referencia', exact: true })
    .click();
  await expect
    .poll(async () =>
      Number(
        await editor.locator('[data-gorilla-a]').getAttribute('data-gorilla-a'),
      ),
    )
    .toBeGreaterThan(1);
  await editor
    .getByRole('button', { name: 'Pausar vista previa', exact: true })
    .click();
  const held = await editor
    .locator('[data-gorilla-a]')
    .getAttribute('data-gorilla-a');
  await page.waitForTimeout(150);
  expect(
    await editor.locator('[data-gorilla-a]').getAttribute('data-gorilla-a'),
  ).toBe(held);
  await page.screenshot({
    path: info.outputPath('gorilla-posturas-editor.png'),
  });
  await editor
    .getByRole('button', { name: 'Guardar posturas', exact: true })
    .click();
  await scene.getByRole('button', { name: /Guardar cambios/ }).click();
  await scene
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(page.locator('[data-gorilla-ready]')).toHaveAttribute(
    'data-gorilla-ready',
    'false',
  );
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await scene
    .getByRole('button', { name: 'Editar posturas', exact: true })
    .click();
  await editor
    .getByLabel('Postura a editar')
    .selectOption({ label: 'Mi postura' });
  await expect(angle).toHaveValue('8');
  await angle.fill('21');
  await expect(
    editor.getByRole('button', { name: 'Guardar posturas', exact: true }),
  ).toBeDisabled();
  await expect(editor.getByRole('alert')).toContainText('No se puede guardar');
  page.once('dialog', (dialog) => dialog.accept());
  await editor
    .getByRole('button', { name: 'Cancelar posturas', exact: true })
    .click();
  await scene
    .getByRole('button', { name: 'Editar posturas', exact: true })
    .click();
  await editor
    .getByLabel('Postura a editar')
    .selectOption({ label: 'Mi postura' });
  await expect(angle).toHaveValue('8');
  await editor
    .getByRole('button', { name: 'Cancelar posturas', exact: true })
    .click();
  await scene.getByRole('button', { name: 'Cancelar', exact: true }).click();
});

for (const modular of [false, true])
  test(`trayectorias ${modular ? 'modulares' : 'directas'}: una pata, pausa y reset`, async ({
    page,
  }) => {
    await openGorilla(page, modular, false, true);
    const robot = page.locator('[data-gorilla-ready]');
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await expect
      .poll(async () => Number(await robot.getAttribute('data-gorilla-a')))
      .toBeLessThan(-2);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    const held = await robot.getAttribute('data-gorilla-a');
    await page.waitForTimeout(150);
    expect(await robot.getAttribute('data-gorilla-a')).toBe(held);
    await page
      .getByRole('button', { name: 'Más herramientas', exact: true })
      .click();
    await page
      .getByRole('menuitem', { name: 'Reiniciar programa y escena' })
      .click();
    await expect(robot).toHaveAttribute('data-gorilla-ready', 'false');
  });
test('editor de trayectorias: presets, puntos, undo, preview, guardar y reabrir', async ({
  page,
}, info) => {
  await openGorilla(page, false, false, true);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const scene = page.getByRole('dialog', {
    name: 'Editor de escenas',
    exact: true,
  });
  await scene
    .getByRole('button', {
      name: 'Editar trayectorias de una pata',
      exact: true,
    })
    .click();
  const editor = page.getByRole('dialog', {
    name: 'Trayectorias de una pata',
    exact: true,
  });
  await expect(
    editor.getByLabel(
      'Plano del recorrido: adelante horizontal, arriba vertical',
    ),
  ).toBeVisible();
  await editor.getByLabel('Tipo de recorrido inicial').selectOption('arc');
  await editor
    .getByRole('button', { name: 'Nueva trayectoria', exact: true })
    .click();
  await editor.getByLabel('Nombre del recorrido').fill('Mi arco');
  await editor
    .getByRole('button', { name: 'Probar recorrido', exact: true })
    .click();
  await expect(
    editor.getByRole('button', { name: 'Pausar recorrido', exact: true }),
  ).toBeVisible();
  await editor
    .getByRole('button', { name: 'Pausar recorrido', exact: true })
    .click();
  await page.screenshot({ path: info.outputPath('gorilla-trayectorias.png') });
  const plane=editor.getByLabel('Plano del recorrido: adelante horizontal, arriba vertical');
  const dot=plane.locator('g circle').nth(2),beforeDrag=await editor.getByLabel('Punto 3 forward',{exact:true}).inputValue(),box=await dot.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+8,box!.y+box!.height/2-2,{steps:3});await page.mouse.up();
  await expect(editor.getByLabel('Punto 3 forward',{exact:true})).not.toHaveValue(beforeDrag);
  await editor.getByRole('button',{name:'Deshacer recorrido',exact:true}).click();
  await expect(editor.getByLabel('Punto 3 forward',{exact:true})).toHaveValue(beforeDrag);
  const point = editor.getByLabel('Punto 3 up', { exact: true });
  await point.fill('30');
  await expect(
    editor.getByRole('button', { name: 'Guardar trayectorias', exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole('button', { name: 'Deshacer recorrido', exact: true })
    .click();
  await expect(
    editor.getByRole('button', { name: 'Guardar trayectorias', exact: true }),
  ).toBeEnabled();
  await editor
    .getByRole('button', { name: 'Guardar trayectorias', exact: true })
    .click();
  await scene.getByRole('button', { name: /Guardar cambios/ }).click();
  await scene
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await scene
    .getByRole('button', {
      name: 'Editar trayectorias de una pata',
      exact: true,
    })
    .click();
  await editor
    .getByLabel('Trayectoria a editar')
    .selectOption({ label: 'Mi arco' });
  await expect(editor.getByLabel('Nombre del recorrido')).toHaveValue(
    'Mi arco',
  );
  await editor
    .getByRole('button', { name: 'Cancelar trayectorias', exact: true })
    .click();
  await scene.getByRole('button', { name: 'Cancelar', exact: true }).click();
});

test('editar un recorrido actualiza los bloques sin recargar la página',async({page})=>{
  await openGorilla(page,false,false,true);
  await page.getByRole('button',{name:'Armar escena',exact:true}).click();
  const scene=page.getByRole('dialog',{name:'Editor de escenas',exact:true});
  await scene.getByRole('button',{name:'Editar trayectorias de una pata',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Trayectorias de una pata',exact:true});
  await editor.getByLabel('Trayectoria a editar').selectOption('lift');
  await editor.getByLabel('Punto 2 up',{exact:true}).fill('3');
  await editor.getByRole('button',{name:'Guardar trayectorias',exact:true}).click();
  await scene.getByRole('button',{name:/Guardar cambios/}).click();
  await scene.getByRole('button',{name:'Guardar escena',exact:true}).click();
  await page.getByRole('button',{name:'Simular',exact:true}).click();
  await expect(page.locator('[data-gorilla-ready]')).toHaveAttribute('data-gorilla-ready','true');
  await expect.poll(async()=>Number(await page.locator('[data-gorilla-a]').getAttribute('data-gorilla-a'))).toBeLessThan(-2);
});
