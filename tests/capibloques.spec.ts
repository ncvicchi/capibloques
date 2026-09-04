import { expect, test, type Page } from '@playwright/test';

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
