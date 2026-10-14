import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { student } from './editor-fixture';
import { recoveryRows } from './recovery-fixture';
import { makeProject } from '../lib/capiblocks';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model';
import {
  displayConfig,
  displayProfiles,
  displayTargets,
  type DisplayProfile,
} from '../lib/display-model';
import { displayArtworkPixel } from '../lib/display-graphics';
import { projectTargetForBoard } from '../lib/board-profiles';
import { drawPixelShape, pixelIsOn, type PixelTool } from '../lib/pixel-art';

async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible({
    timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 10000,
  });
}
function sample(profile: DisplayProfile = 'ssd1306') {
  const boardProfile = profile === 'waveshare5' ? 'waveshare-esp32-s3-touch-lcd-5-28117' : 'wemos-d1-r32';
  const config = displayConfig(profile);
  // Imported identities may match Object.prototype names; an empty preview must remain safe.
  if (profile === 'ili9488') config.areas[0].id = 'constructor';
  if (displayProfiles[profile].graphic)
    config.areas.push({
      id: 'second',
      name: 'Estado',
      column: 0,
      row: 5,
      columns: 16,
      rows: 2,
    });
  const { scene, device } = addDeviceToScene(
    createEmptyScene('Pantalla de prueba'),
    'display',
    { config, name: 'Mi pantalla', position: { x: 480, y: 270 }, boardProfile },
  );
  const area = displayTargets(config)[0];
  const write = (id: string, areaId: string, text: string) => ({
    type: 'capi_display_write',
    id,
    fields: { DEVICE_ID: device.id, AREA_ID: areaId, TEXT: text },
  });
  const blocks: Record<string, unknown>[] = [
    write('write-one', area.id, 'Hola mundo'),
    ...(config.areas.length
      ? [write('write-two', 'second', 'Sigue aqui')]
      : []),
    ...(profile === 'lcd1602keypad' ? [{
      type: 'capi_if',
      id: 'keypad-if',
      inputs: {
        CONDITION: { block: { type: 'capi_display_button_pressed', id: 'keypad-select', fields: { DEVICE_ID: device.id, BUTTON: 'SELECT' } } },
        DO: { block: { type: 'capi_serial', id: 'keypad-message', fields: { TEXT: 'Elegir presionado' } } },
      },
    }] : []),
    {
      type: 'capi_display_clear',
      id: 'clear-one',
      fields: { DEVICE_ID: device.id, AREA_ID: area.id },
    },
    { type: 'capi_serial', id: 'console', fields: { TEXT: 'Solo consola' } },
  ];
  for (let index = 0; index < blocks.length - 1; index++)
    blocks[index].next = { block: blocks[index + 1] };
  return makeProject(`Mensajes ${profile}`, scene, {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'capi_start',
          id: 'start',
          x: 40,
          y: 40,
          inputs: { DO: { block: blocks[0] } },
        },
      ],
    },
  }, 1, projectTargetForBoard(boardProfile));
}

function animatedSample() {
  const config = displayConfig('ssd1306');
  config.animationSpeed = 'fast';
  config.artworks![0] = {
    ...config.artworks![0],
    name: 'Mi cohete',
    rows: displayArtworkPixel(config.artworks![0].rows, 15, 7, true),
  };
  const { scene, device } = addDeviceToScene(
    createEmptyScene('Pantalla animada'),
    'display',
    { config, name: 'Cartel divertido' },
  );
  return makeProject('Dibujos y avatares', scene, {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'capi_start',
          id: 'start-animated',
          x: 40,
          y: 40,
          inputs: {
            DO: {
              block: {
                type: 'capi_display_animate_text',
                id: 'animate-text',
                fields: {
                  DEVICE_ID: device.id,
                  AREA_ID: 'text-1',
                  TEXT: 'Hola!',
                  EFFECT: 'TYPE',
                  REPEAT_MODE: 'COUNT',
                  REPEAT_COUNT: 2,
                },
                next: {
                  block: {
                    type: 'capi_visual_wait',
                    id: 'wait-text-animation',
                    fields: { DEVICE_ID: device.id },
                    next: {
                      block: {
                        type: 'capi_display_artwork',
                        id: 'animate-artwork',
                        fields: {
                          DEVICE_ID: device.id,
                          ARTWORK_ID: 'builtin-capybara',
                          EFFECT: 'BLINK',
                          REPEAT_MODE: 'ONCE',
                          REPEAT_COUNT: 2,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
  });
}

function dashboardSample() {
  const board = 'waveshare-esp32-s3-touch-lcd-5-28117' as const;
  const screen = addDeviceToScene(createEmptyScene('Tablero táctil'), 'display', { config: displayConfig('waveshare5'), name: 'Pantalla táctil', boardProfile: board });
  const traffic = addDeviceToScene(screen.scene, 'trafficLight', { name: 'Semáforo del patio', boardProfile: board });
  const display = traffic.scene.devices.find(device => device.kind === 'display');
  if (!display || display.kind !== 'display') throw new Error('fixture sin pantalla');
  display.config.retiredAreaIds.push(...display.config.areas.map(area => area.id));
  display.config.areas = [];
  display.config.dashboard = { enabled: true, deviceIds: [traffic.device.id] };
  return makeProject('Tablero Waveshare', traffic.scene, { blocks: { languageVersion: 0, blocks: [{ type: 'capi_start', id: 'start-dashboard', x: 40, y: 40, inputs: { DO: { block: { type: 'capi_traffic', id: 'dashboard-green', fields: { DEVICE_ID: traffic.device.id, COLOR: 'GREEN' } } } } }] } }, 1, projectTargetForBoard(board));
}
async function importProject(
  page: Page,
  profile: DisplayProfile = 'ssd1306',
  replace = false,
) {
  const project = sample(profile);
  await page.locator('input[type=file]').setInputFiles({
    name: 'pantalla.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  if (replace)
    await page
      .getByRole('button', {
        name: 'Conservar copia local y abrir',
        exact: true,
      })
      .click();
  await expect(
    page.getByRole('textbox', { name: 'Nombre del proyecto' }),
  ).toHaveValue(project.metadata.title);
  await expect(
    page.locator('.blocklyBlockCanvas [data-id="write-one"]'),
  ).toBeVisible();
}
async function exportProject(page: Page) {
  await page.getByRole('button', { name: 'Opciones del proyecto' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  const stream = await (await pending).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('pantalla: crear, cambiar modelo con confirmación y autoconectar SPI', async ({
  page,
}, testInfo) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', {
    name: 'Arma tu escena',
    exact: true,
  });
  await editor
    .getByRole('button', { name: /^Agregar Pantalla de texto/ })
    .click();
  const model = editor.getByRole('combobox', {
    name: 'Modelo de pantalla',
    exact: true,
  });
  await expect(model).toHaveValue('lcd1602');
  await model.selectOption('ili9341');
  await editor
    .getByRole('button', { name: 'Conservar modelo', exact: true })
    .click();
  await expect(model).toHaveValue('lcd1602');
  await model.selectOption('ili9341');
  await editor
    .getByRole('button', { name: 'Cambiar modelo', exact: true })
    .click();
  await expect(model).toHaveValue('ili9341');
  await expect(editor.getByRole('combobox', { name: /^SCK de/ })).toHaveValue(
    '',
  );
  await expect(editor.getByRole('combobox', { name: /^SDA de/ })).toHaveCount(
    0,
  );
  await editor
    .getByRole('button', { name: 'Guardar cambios', exact: false })
    .click();
  await editor
    .getByRole('button', { name: 'Auto conectar', exact: true })
    .click();
  await expect(editor.getByRole('combobox', { name: /^SCK de/ })).toHaveValue(
    /^\d+$/,
  );
  await editor
    .getByRole('button', { name: 'Agregar zona de texto', exact: false })
    .click();
  await editor.getByLabel('Nombre de text-2', { exact: true }).fill('Estado');
  await editor
    .getByRole('button', { name: 'Guardar cambios', exact: false })
    .click();
  await page.screenshot({
    path: testInfo.outputPath('display-editor.png'),
    fullPage: true,
  });
  await editor
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(editor).toBeHidden();
  const saved = await exportProject(page);
  const screen = saved.scene.devices.find(
    (device: { kind: string }) => device.kind === 'display',
  );
  expect(screen.config.profile).toBe('ili9341');
  expect(
    screen.config.areas.map((area: { name: string }) => area.name),
  ).toEqual(['Mensaje', 'Estado']);
  expect(
    Object.values(screen.pins).filter((value) => value !== null),
  ).toHaveLength(5);
  expect(screen.pins.sda).toBeNull();
});

test('pantalla: paso visible, zonas independientes y consola separada', async ({
  page,
}) => {
  await open(page);
  await importProject(page);
  await expect(page.locator('[data-id="write-one"]')).toContainText('Mensaje');
  await expect(page.locator('[data-id="write-two"]')).toContainText('Estado');
  await page
    .getByRole('combobox', { name: 'Modo de ejecución' })
    .selectOption('guided');
  const preview = page.locator('.simulator-panel .display-preview');
  const step = page.getByRole('button', { name: 'Paso', exact: true });
  await step.click();
  await expect(preview).toContainText('Hola mundo');
  await expect(page.locator('.scene-device-display')).toHaveClass(
    /scene-device-active/,
  );
  await expect(page.locator('.device-now')).toContainText('escribimos');
  await step.click();
  await expect(preview).toContainText('Sigue aqui');
  await step.click();
  await expect(preview).not.toContainText('Hola mundo');
  await expect(preview).toContainText('Sigue aqui');
  await step.click();
  await page.getByRole('tab', { name: 'Consola', exact: true }).click();
  const consolePanel = page.getByRole('tabpanel', {
    name: 'Consola',
    exact: true,
  });
  await expect(consolePanel).toContainText('Solo consola');
  await expect(consolePanel).not.toContainText('Sigue aqui');
  await expect(consolePanel).not.toContainText('Hola mundo');
});

test('pantalla: Guardar/Cancelar y deshacer/rehacer conservan zonas e identidades', async ({
  page,
}) => {
  await open(page);
  await importProject(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', {
    name: 'Arma tu escena',
    exact: true,
  });
  await editor
    .getByRole('button', { name: 'Mover Mi pantalla', exact: true })
    .click();
  await expect(
    editor.getByRole('button', { name: /^Agregar Pantalla de texto/ }),
  ).toBeDisabled();
  await expect(
    editor.getByRole('button', { name: /Duplicar/, exact: false }),
  ).toBeDisabled();
  await editor.getByLabel('Nombre de text-1', { exact: true }).fill('Saludo');
  await editor
    .getByRole('button', { name: 'Cancelar cambios', exact: true })
    .click();
  await expect(
    editor.getByLabel('Nombre de text-1', { exact: true }),
  ).toHaveValue('Mensaje');
  await editor.getByLabel('Nombre de text-1', { exact: true }).fill('Saludo');
  await editor
    .getByRole('button', { name: 'Guardar cambios', exact: false })
    .click();
  await editor
    .getByRole('button', { name: 'Deshacer último cambio', exact: true })
    .click();
  await expect(
    editor.getByLabel('Nombre de text-1', { exact: true }),
  ).toHaveValue('Mensaje');
  await editor
    .getByRole('button', { name: 'Rehacer último cambio', exact: true })
    .click();
  await expect(
    editor.getByLabel('Nombre de text-1', { exact: true }),
  ).toHaveValue('Saludo');
  await editor
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(editor).toBeHidden();
  await expect(page.locator('[data-id="write-one"]')).toContainText('Saludo');
  const exported = await exportProject(page);
  expect(exported.scene.devices[0].config.areas[0]).toMatchObject({
    id: 'text-1',
    name: 'Saludo',
  });
  expect(JSON.stringify(exported.workspace)).toContain('text-1');
});

test('pantalla: retirar zona no retargetea bloques; layout inválido no se guarda', async ({
  page,
}) => {
  await open(page);
  await importProject(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', {
    name: 'Arma tu escena',
    exact: true,
  });
  await editor
    .getByRole('button', { name: 'Mover Mi pantalla', exact: true })
    .click();
  await editor.getByLabel('Fila inicial de second', { exact: true }).fill('0');
  await editor
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('alert').filter({ hasText: 'superponerse' }).first()).toBeVisible();
  await editor
    .getByRole('button', { name: 'Cancelar cambios', exact: true })
    .click();
  await editor
    .getByRole('button', { name: 'Quitar zona Mensaje', exact: true })
    .click();
  await editor
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(editor).toBeHidden();
  await expect(page.locator('[data-id="write-one"]')).toContainText(
    'Zona retirada',
  );
  const exported = await exportProject(page);
  expect(exported.scene.devices[0].config.retiredAreaIds).toContain('text-1');
  expect(JSON.stringify(exported.workspace)).toContain('text-1');
});

test('pantalla: los siete modelos se importan, simulan y exportan sin cambiar el destino', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  for (const [index, profile] of (Object.keys(displayProfiles) as DisplayProfile[]).entries()) {
    await importProject(page, profile, index > 0);
    await page
      .getByRole('combobox', { name: 'Modo de ejecución' })
      .selectOption('guided');
    await page.getByRole('button', { name: 'Paso', exact: true }).click();
    await expect(
      page.locator('.simulator-panel .display-preview'),
    ).toContainText('Hola mundo');
    const saved = await exportProject(page);
    expect(saved.scene.devices[0].config.profile).toBe(profile);
    if (profile === 'lcd1602keypad') {
      await expect(page.locator('[data-id="keypad-select"]')).toContainText('Elegir');
      await page.getByRole('tab', { name: 'Estado', exact: true }).click();
      const key = page.locator('.input-lab').getByRole('button', { name: 'Elegir', exact: true });
      await key.dispatchEvent('pointerdown');
      await expect(key).toHaveAttribute('aria-pressed', 'true');
      await key.dispatchEvent('pointerup');
      await expect(key).toHaveAttribute('aria-pressed', 'false');
      await page.getByRole('tab', { name: 'Escena', exact: true }).click();
    }
  }
  expect(errors).toEqual([]);
});

test('pantalla: recupera nombre vacío y layout incompleto sin publicarlos', async ({
  page,
}) => {
  await open(page);
  await importProject(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', {
    name: 'Arma tu escena',
    exact: true,
  });
  await editor
    .getByRole('button', { name: 'Mover Mi pantalla', exact: true })
    .click();
  await editor.getByLabel('Nombre de text-1', { exact: true }).fill('');
  await editor.getByLabel('Fila inicial de second', { exact: true }).fill('0');
  await expect
    .poll(async () => {
      const draft = (await recoveryRows(page, student.id)).find(
        (row) => row.sceneDraft,
      )?.sceneDraft;
      return draft?.inspector?.value;
    })
    .toMatchObject({ config: { areas: [{ name: '' }, { row: 0 }] } });
  await page.reload();
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  await page
    .getByRole('button', { name: 'Recuperar borrador', exact: true })
    .click();
  await expect(
    editor.getByLabel('Nombre de text-1', { exact: true }),
  ).toHaveValue('');
  await expect(
    editor.getByLabel('Fila inicial de second', { exact: true }),
  ).toHaveValue('0');
  await editor
    .getByRole('button', { name: 'Guardar escena', exact: true })
    .click();
  await expect(editor).toBeVisible();
  await editor
    .getByRole('button', { name: 'Cancelar cambios', exact: true })
    .click();
  await expect(
    editor.getByLabel('Nombre de text-1', { exact: true }),
  ).toHaveValue('Mensaje');
  await expect(
    editor.getByLabel('Fila inicial de second', { exact: true }),
  ).toHaveValue('5');
});

for (const width of [16, 32]) test(`animación por cuadros de ${width} columnas: dibujar, duplicar, importar y guardar`, async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu escena', exact: true });
  if (width === 16) {
    await editor.getByRole('button', { name: /^Agregar Pantalla de texto/ }).click();
    await editor.getByRole('combobox', { name: 'Modelo de pantalla' }).selectOption('ssd1306');
    await editor.getByRole('button', { name: 'Cambiar modelo' }).click();
  } else await editor.getByRole('button', { name: /^Agregar Matriz LED/ }).click();
  await editor.getByRole('button', { name: 'Nueva animación', exact: true }).click();
  const draft = page.getByRole('dialog', { name: 'Animación por cuadros', exact: true });
  await draft.getByLabel('Nombre de animación', { exact: true }).fill('Saludo');
  await draft.getByLabel('Tiempo de cada cuadro (ms)', { exact: true }).fill('100');
  await draft.getByRole('button', { name: 'Dibujar cuadro 1', exact: true }).click();
  const pixels = page.getByRole('dialog', { name: 'Editar cuadro 1', exact: true });
  await pixels.getByRole('button', { name: 'Columna 1, fila 1', exact: true }).click();
  await pixels.getByRole('button', { name: 'Guardar dibujo', exact: true }).click();
  await draft.getByRole('button', { name: /Duplicar/ }).click();
  await expect(draft.getByRole('button', { name: 'Cuadro 2', exact: true })).toBeVisible();
  const data = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 8; const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'black'; ctx.fillRect(0, 0, 32, 8); return canvas.toDataURL().split(',')[1]; });
  await draft.getByLabel('Importar cuadros desde imágenes', { exact: true }).setInputFiles({ name: 'negro.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await expect(draft.getByRole('button', { name: 'Cuadro 3', exact: true })).toBeVisible();
  await draft.getByRole('button', { name: 'Guardar animación', exact: true }).click();
  await expect(editor.getByText('Saludo · 3 cuadros · 100 ms', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Editar Saludo', exact: true }).click();
  await expect(draft.getByLabel('Nombre de animación', { exact: true })).toHaveValue('Saludo');
  await expect(draft.getByRole('button', { name: /^Cuadro [123]$/, exact: true })).toHaveCount(3);
  await draft.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await expect(editor).toBeHidden();
  const saved = await exportProject(page);
  const device = saved.scene.devices.find((item: { kind: string }) => item.kind === (width === 16 ? 'display' : 'ledMatrix'));
  expect(device.config.animations).toHaveLength(1);
  expect(device.config.animations[0]).toMatchObject({ name: 'Saludo', frameMs: 100 });
  expect(device.config.animations[0].frames).toHaveLength(3);
  saved.workspace = { blocks: { languageVersion: 0, blocks: [{ type: 'capi_start', id: 'start-frames', x: 40, y: 40, inputs: { DO: { block: {
    type: 'capi_frame_animation', id: 'show-frames', fields: { DEVICE_ID: device.id, ANIMATION_ID: device.config.animations[0].id, REPEAT_MODE: 'COUNT', REPEAT_COUNT: 2 }, next: { block: { type: 'capi_visual_wait', id: 'wait-frames', fields: { DEVICE_ID: device.id } } },
  } } } }] } };
  await page.locator('input[type=file]').setInputFiles({ name: 'cuadros.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await page.getByRole('button', { name: 'Conservar copia local y abrir', exact: true }).click();
  await expect(page.locator('[data-id="show-frames"]')).toContainText('Saludo');
  await expect(page.locator('[data-id="show-frames"]')).toContainText('varias veces');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(page.getByText('Programa terminado', { exact: true })).toBeVisible({ timeout: 15000 });
});

for (const width of [16, 32]) test(`editor de dibujos: arrastra figuras de ${width} columnas con preview y conserva deshacer, rehacer y guardado`, async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu escena', exact: true });
  if (width === 16) {
    await editor.getByRole('button', { name: /^Agregar Pantalla de texto/ }).click();
    await editor.getByRole('combobox', { name: 'Modelo de pantalla' }).selectOption('ssd1306');
    await editor.getByRole('button', { name: 'Cambiar modelo' }).click();
    await editor.getByRole('textbox', { name: 'Nombre del dibujo de pantalla' }).fill('Herramientas');
  } else {
    await editor.getByRole('button', { name: /^Agregar Matriz LED/ }).click();
    await editor.getByRole('textbox', { name: 'Nombre del dibujo' , exact: true }).fill('Herramientas');
  }
  await editor.getByRole('button', { name: 'Editar dibujo en grande' }).click();
  const drawing = page.getByRole('dialog', { name: 'Editar Herramientas' });
  const grid = drawing.locator('.pixel-editor-grid');
  const read = () => grid.locator('button').evaluateAll(cells => cells.map(cell => cell.getAttribute('aria-pressed') === 'true'));
  const start = { x: 2, y: 5 }, end = { x: width - 4, y: 2 };
  const center = async (point: { x: number; y: number }) => {
    const bounds = await grid.locator(`[data-x="${point.x}"][data-y="${point.y}"]`).boundingBox();
    if (!bounds) throw new Error('Missing pixel');
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  };
  let expected: boolean[] = [];
  for (const [tool, label] of [['line', 'Línea'], ['curve', 'Curva'], ['rectangle', 'Rectángulo'], ['filled-rectangle', 'Relleno'], ['ellipse', 'Círculo']] as [PixelTool, string][]) {
    await drawing.getByRole('button', { name: 'Borrar todo' }).click();
    await drawing.getByRole('button', { name: label, exact: false }).click();
    const from = await center(start), to = await center(end);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    const rows = drawPixelShape(Array(8).fill(0), width, tool, start, end);
    expected = Array.from({ length: width * 8 }, (_, index) => pixelIsOn(rows, width, index % width, Math.floor(index / width)));
    await expect.poll(read).toEqual(expected);
    await page.mouse.up();
    await expect.poll(read).toEqual(expected);
    await drawing.getByRole('button', { name: 'Deshacer', exact: false }).click();
    await expect.poll(read).toEqual(Array(width * 8).fill(false));
    await drawing.getByRole('button', { name: 'Rehacer', exact: false }).click();
    await expect.poll(read).toEqual(expected);
  }
  await drawing.getByRole('button', { name: 'Borrar todo' }).click();
  await drawing.getByRole('button', { name: 'Balde', exact: false }).click();
  await grid.locator('[data-x="4"][data-y="3"]').click();
  await expect.poll(read).toEqual(Array(width * 8).fill(true));
  await drawing.getByRole('button', { name: 'Guardar dibujo' }).click();
  await editor.getByRole('button', { name: 'Editar dibujo en grande' }).click();
  await expect.poll(read).toEqual(Array(width * 8).fill(true));
});

test('pantalla gráfica: crea dibujos, ofrece avatares y anima sin bloquear', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Arma tu escena', exact: true });
  await editor.getByRole('button', { name: /^Agregar Pantalla de texto/ }).click();
  const model = editor.getByRole('combobox', { name: 'Modelo de pantalla' });
  await model.selectOption('ssd1306');
  await editor.getByRole('button', { name: 'Cambiar modelo' }).click();
  await editor.getByRole('combobox', { name: 'Velocidad de animaciones' }).selectOption('fast');
  await editor.getByRole('textbox', { name: 'Nombre del dibujo de pantalla' }).fill('Cohete');
  await editor.getByRole('button', { name: 'Editar dibujo en grande' }).click();
  const drawing = page.getByRole('dialog', { name: 'Editar Cohete' });
  const pixel = drawing.getByRole('button', { name: 'Columna 16, fila 8' });
  await pixel.click();
  await expect(pixel).toHaveAttribute('aria-pressed', 'true');
  await drawing.getByRole('button', { name: 'Guardar dibujo' }).click();
  await editor.getByRole('button', { name: 'Guardar cambios', exact: false }).click();
  await editor.getByRole('button', { name: 'Auto conectar', exact: true }).click();
  await editor.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  const saved = await exportProject(page);
  const savedDisplay = saved.scene.devices.find(
    (device: { kind: string }) => device.kind === 'display',
  );
  expect(savedDisplay?.config).toMatchObject({
    profile: 'ssd1306',
    animationSpeed: 'fast',
    artworks: [{ name: 'Cohete' }],
  });

  const project = animatedSample();
  await page.locator('input[type=file]').setInputFiles({
    name: 'pantalla-animada.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByRole('button', { name: 'Conservar copia local y abrir', exact: true }).click();
  await expect(page.locator('[data-id="animate-text"]')).toContainText('máquina de escribir');
  await expect(page.locator('[data-id="animate-text"]')).toContainText('varias veces');
  await expect(page.locator('[data-id="wait-text-animation"]')).toContainText('esperar a que termine');
  await expect(page.locator('[data-id="animate-artwork"]')).toContainText('Capibara');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByText('Programa terminado', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.simulator-panel .display-preview')).toHaveAttribute('aria-label', /dibujo visible/);
  await expect(page.locator('.simulator-panel .display-preview rect[fill="#9fffd5"]')).not.toHaveCount(0);
});

test('Waveshare: tablero táctil conserva prioridad manual y vuelve al programa', async ({ page }) => {
  await open(page);
  const project = dashboardSample();
  await page.locator('input[type=file]').setInputFiles({ name: 'tablero.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  const preview = page.locator('.simulator-panel .display-preview');
  await expect(preview).toContainText('TABLERO LOCAL');
  await expect(preview).toContainText('PROGRAMA · OFF');
  await preview.locator('[aria-label="Cambiar Semáforo del patio"]').click();
  await expect(preview).toContainText('MANUAL · RED');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByText('Programa terminado', { exact: true })).toBeVisible();
  await expect(preview).toContainText('MANUAL · RED');
  await preview.locator('[aria-label="Volver al programa para Semáforo del patio"]').click();
  await expect(preview).toContainText('PROGRAMA · GREEN');
  const saved = await exportProject(page);
  const display = saved.scene.devices.find((device: { kind: string }) => device.kind === 'display');
  expect(display.config.dashboard).toEqual({ enabled: true, deviceIds: ['traffic-light-1'] });
});
