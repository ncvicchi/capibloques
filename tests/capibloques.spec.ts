import { expect, test, type Page } from '@playwright/test';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene } from '../lib/scene-model';

function collectPageErrors(page: Page) {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return errors;
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByLabel('Editor visual de bloques')).toBeVisible();
  await expect(page.locator('.blocklySvg')).toBeVisible();
}

test.describe('CapiBloques', () => {
  test('carga Blockly y ofrece los controles principales en escritorio', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await openApp(page);

    await expect(
      page.getByRole('textbox', { name: 'Nombre del proyecto' }),
    ).toBeVisible();

    const projectActions = page.getByRole('navigation', {
      name: 'Acciones del proyecto',
    });
    for (const name of [
      'Guardar',
      'Armar escena',
      'Conectar',
      'Abrir ejemplos',
      'Silenciar sonidos',
      'Exportar',
    ]) {
      await expect(projectActions.getByRole('button', { name })).toBeVisible();
    }

    const simulator = page.getByRole('region', {
      name: 'Controles del simulador',
    });
    for (const name of [
      'Ejecutar',
      'Paso',
      'Detener',
      'Reiniciar',
      'Ver código ESP32',
    ]) {
      await expect(simulator.getByRole('button', { name })).toBeVisible();
    }
    await expect(simulator.getByRole('combobox')).toHaveValue('1');
    expect(pageErrors).toEqual([]);
  });

  test('mantiene accesibles los controles esenciales en una pantalla móvil', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const pageErrors = collectPageErrors(page);
    await openApp(page);

    const projectActions = page.getByRole('navigation', {
      name: 'Acciones del proyecto',
    });
    for (const name of [
      'Guardar',
      'Armar escena',
      'Conectar',
      'Abrir ejemplos',
      'Exportar',
    ]) {
      await expect(projectActions.getByRole('button', { name })).toBeVisible();
    }

    const simulator = page.getByRole('region', {
      name: 'Controles del simulador',
    });
    for (const name of ['Ejecutar', 'Paso', 'Detener', 'Reiniciar']) {
      await expect(simulator.getByRole('button', { name })).toBeVisible();
    }
    await expect(simulator.getByRole('combobox')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Editar escena' }),
    ).toBeVisible();

    await projectActions
      .getByRole('button', { name: 'Abrir ejemplos' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Elige una misión' }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('permite agregar, deshacer, rehacer, cancelar y guardar una escena', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await openApp(page);

    await page.getByRole('button', { name: 'Armar escena' }).click();
    let editor = page.getByRole('dialog', { name: 'Arma tu mundo' });
    await expect(editor).toBeVisible();
    await expect(editor.getByText(/^1 objeto ·/)).toBeVisible();

    await editor.getByRole('button', { name: /^Agregar LED\./ }).click();
    await expect(editor.getByText(/^2 objetos ·/)).toBeVisible();

    const undo = editor.getByRole('button', {
      name: 'Deshacer último cambio',
    });
    const redo = editor.getByRole('button', {
      name: 'Rehacer último cambio',
    });
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(editor.getByText(/^1 objeto ·/)).toBeVisible();
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(editor.getByText(/^2 objetos ·/)).toBeVisible();

    await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
    const discard = page.getByRole('alertdialog', {
      name: '¿Salir sin guardar la escena?',
    });
    await expect(discard).toBeVisible();
    await discard.getByRole('button', { name: 'Salir sin guardar' }).click();
    await expect(editor).toBeHidden();

    await page.getByRole('button', { name: 'Armar escena' }).click();
    editor = page.getByRole('dialog', { name: 'Arma tu mundo' });
    await expect(editor.getByText(/^1 objeto ·/)).toBeVisible();
    await editor.getByRole('button', { name: /^Agregar LED\./ }).click();
    await editor.getByRole('button', { name: 'Guardar escena' }).click();
    await expect(editor).toBeHidden();

    await page.getByRole('button', { name: 'Armar escena' }).click();
    editor = page.getByRole('dialog', { name: 'Arma tu mundo' });
    await expect(editor.getByText(/^2 objetos ·/)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('rechaza un JSON inválido y conserva el editor utilizable', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await openApp(page);

    await page.locator('input[type="file"]').setInputFiles({
      name: 'proyecto-invalido.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":2,"workspace":{"blocks":[null]}}'),
    });

    const notice = page.locator('output.notice');
    await expect(notice).toHaveClass(/error/);
    await expect(notice).not.toContainText('Proyecto importado correctamente');
    await expect(page.getByLabel('Editor visual de bloques')).toBeVisible();
    await expect(page.locator('.blocklySvg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ejecutar' })).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 568, height: 320 },
  ]) {
    test(`permite editar y guardar una escena a ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const errors = collectPageErrors(page);
      await openApp(page);
      await page.getByRole('button', { name: 'Armar escena' }).click();
      const editor = page.getByRole('dialog', { name: 'Arma tu mundo' });
      await expect(editor).toBeVisible();
      const grid = await editor.locator('.scene-builder-grid').boundingBox();
      expect(grid?.height).toBeGreaterThanOrEqual(120);
      await editor.getByRole('button', { name: /^Agregar LED\./ }).click();
      await expect(editor.getByText(/^2 objetos ·/)).toBeVisible();
      await editor.locator('#selected-device-name').fill('Luz de la casa');
      await editor.getByRole('button', { name: 'Guardar cambios' }).click();
      await editor.getByRole('button', { name: 'Guardar escena' }).click();
      await expect(editor).toBeHidden();
      await expect(
        page
          .locator('article[data-device-id]')
          .filter({ hasText: 'Luz de la casa' }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('cancela propiedades y revierte cambios guardados, movimientos y borrados', async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await openApp(page);
    await page.getByRole('button', { name: 'Armar escena' }).click();
    const editor = page.getByRole('dialog', { name: 'Arma tu mundo' });
    await editor.getByRole('button', { name: /^Agregar LED\./ }).click();
    const name = editor.locator('#selected-device-name');
    const originalName = await name.inputValue();
    await name.fill('Nombre descartado');
    await editor.getByRole('button', { name: 'Cancelar cambios' }).click();
    await expect(name).toHaveValue(originalName);
    await name.fill('Luz guardada');
    await editor.getByRole('button', { name: 'Guardar cambios' }).click();
    const undo = editor.getByRole('button', { name: 'Deshacer último cambio' });
    const redo = editor.getByRole('button', { name: 'Rehacer último cambio' });
    await undo.click();
    await expect(name).toHaveValue(originalName);
    await redo.click();
    await expect(name).toHaveValue('Luz guardada');

    const object = editor.getByRole('button', {
      name: 'Mover Luz guardada',
      exact: true,
    });
    const before = await object.getAttribute('style');
    const box = (await object.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 45,
      box.y + box.height / 2 + 30,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(object).not.toHaveAttribute('style', before!);
    const after = await object.getAttribute('style');
    await undo.click();
    await expect(object).toHaveAttribute('style', before!);
    await redo.click();
    await expect(object).toHaveAttribute('style', after!);

    await editor.getByRole('button', { name: 'Quitar', exact: false }).click();
    const confirmation = page.getByRole('alertdialog', {
      name: '¿Quitar este componente?',
    });
    await expect(confirmation).toBeVisible();
    await page.keyboard.press('Control+z');
    await confirmation.getByRole('button', { name: 'Volver' }).click();
    await expect(object).toHaveAttribute('style', after!);
    await editor.getByRole('button', { name: 'Quitar', exact: false }).click();
    await confirmation.getByRole('button', { name: 'Sí, quitar' }).click();
    await expect(editor.getByText(/^1 objeto ·/)).toBeVisible();
    await undo.click();
    await expect(editor.getByText(/^2 objetos ·/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('arrastra bloques y conserva el proyecto guardado al recargar', async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await openApp(page);
    const block = page
      .locator('.blocklyWorkspace .blocklyBlockCanvas > .blocklyDraggable')
      .first();
    const before = await block.getAttribute('transform');
    const box = (await block.locator('.blocklyPath').first().boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 65, { steps: 10 });
    await page.mouse.up();
    await expect(block).not.toHaveAttribute('transform', before!);
    const after = await block.getAttribute('transform');
    const [savedX, savedY] = after!
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number)
      .map(Math.round);
    await page
      .getByRole('textbox', { name: 'Nombre del proyecto' })
      .fill('Prueba persistente');
    await page
      .getByRole('navigation', { name: 'Acciones del proyecto' })
      .getByRole('button', { name: 'Guardar', exact: true })
      .click();
    await expect(page.locator('output.notice')).toContainText(
      'Proyecto guardado',
    );
    await page.reload();
    await expect(page.locator('.blocklySvg')).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Nombre del proyecto' }),
    ).toHaveValue('Prueba persistente');
    await expect(block).toHaveAttribute(
      'transform',
      `translate(${savedX}, ${savedY})`,
    );
    expect(errors).toEqual([]);
  });

  test('importa GPIO avanzado y exige revisar cables antes de descargar desde la vista de código', async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await openApp(page);
    const project = makeProject(
      'Salida avanzada',
      createEmptyScene('Banco de pruebas'),
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: 'capi_start',
              id: 'raw-start',
              x: 48,
              y: 42,
              inputs: {
                DO: {
                  block: {
                    type: 'capi_pin_write',
                    id: 'raw-pin',
                    fields: { PIN: '18', STATE: 'HIGH' },
                  },
                },
              },
            },
          ],
        },
      },
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: 'gpio.capibloques.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    await expect(page.locator('output.notice')).toContainText(
      'Proyecto importado correctamente',
    );
    await expect(
      page.locator('.blocklyBlockCanvas > [data-id="raw-start"]'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Ver código ESP32' }).click();
    await page.getByRole('button', { name: 'Descargar .ino' }).click();
    const wiring = page.getByRole('dialog', {
      name: 'Conectar la Wemos sin adivinar',
    });
    await expect(wiring).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(
      wiring.getByRole('cell', { name: 'Salida avanzada (bloque)' }),
    ).toBeVisible();
    const confirm = wiring.getByRole('button', {
      name: 'Conexiones revisadas',
    });
    await expect(confirm).toBeDisabled();
    for (const checkbox of await wiring.getByRole('checkbox').all())
      await checkbox.check();
    await confirm.click();
    await page.getByRole('button', { name: 'Ver código ESP32' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar .ino' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.ino$/);
    expect(errors).toEqual([]);
  });

  test('exporta y vuelve a importar el proyecto completo como JSON editable', async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await openApp(page);
    await page
      .getByRole('textbox', { name: 'Nombre del proyecto' })
      .fill('Mi semáforo exportado');
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('menuitem', { name: 'Proyecto editable JSON' })
      .click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const buffer = Buffer.concat(chunks);
    const exported = JSON.parse(buffer.toString());
    expect(exported.schemaVersion).toBe(2);
    expect(exported.scene.devices).toHaveLength(1);
    expect(exported.workspace.blocks.blocks).not.toHaveLength(0);
    await page
      .getByRole('textbox', { name: 'Nombre del proyecto' })
      .fill('Otro proyecto');
    await page.locator('input[type="file"]').setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'application/json',
      buffer,
    });
    await expect(
      page.getByRole('textbox', { name: 'Nombre del proyecto' }),
    ).toHaveValue('Mi semáforo exportado');
    await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
    await expect(page.getByText('Programa en marcha')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('abre un ejemplo y lo ejecuta sin errores de página', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await openApp(page);

    await page.getByRole('button', { name: 'Abrir ejemplos' }).click();
    const examples = page.getByRole('dialog', { name: 'Elige una misión' });
    await examples
      .getByRole('button', { name: /Semáforo de la plaza/ })
      .click();
    await expect(examples).toBeHidden();

    await page.getByRole('button', { name: 'Ejecutar' }).click();
    await expect(page.getByText('Programa en marcha')).toBeVisible();
    await page.getByRole('button', { name: 'Detener' }).click();
    await expect(page.getByText('Programa detenido')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
