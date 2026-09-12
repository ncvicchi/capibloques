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

async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible({
    timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 10000,
  });
}
function sample(profile: DisplayProfile = 'ssd1306') {
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
    { config, name: 'Mi pantalla', position: { x: 480, y: 270 } },
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
  });
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
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
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
    name: 'Arma tu mundo',
    exact: true,
  });
  await editor
    .getByRole('button', { name: /^Agregar Pantalla de mensajes/ })
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
    name: 'Arma tu mundo',
    exact: true,
  });
  await editor
    .getByRole('button', { name: 'Mover Mi pantalla', exact: true })
    .click();
  await expect(
    editor.getByRole('button', { name: /^Agregar Pantalla de mensajes/ }),
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
    name: 'Arma tu mundo',
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
  await expect(editor.getByRole('alert')).toContainText('superponerse');
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

test('pantalla: los cinco modelos se importan, simulan y exportan sin cambiar el destino', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  for (const profile of Object.keys(displayProfiles) as DisplayProfile[]) {
    await importProject(page, profile, profile !== 'lcd1602');
    await page
      .getByRole('combobox', { name: 'Modo de ejecución' })
      .selectOption('guided');
    await page.getByRole('button', { name: 'Paso', exact: true }).click();
    await expect(
      page.locator('.simulator-panel .display-preview'),
    ).toContainText('Hola mundo');
    const saved = await exportProject(page);
    expect(saved.scene.devices[0].config.profile).toBe(profile);
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
    name: 'Arma tu mundo',
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
