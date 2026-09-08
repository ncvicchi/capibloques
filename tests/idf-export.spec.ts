import { expect, test, type Page, type Download } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mockEditorSession } from './editor-fixture';
import { mockReview, reviewPath } from './project-review-fixture';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene, addDeviceToScene } from '../lib/scene-model';
import { displayConfig, displayProfiles, displayTargets, type DisplayProfile } from '../lib/display-model';

function readArchive(bytes: Buffer) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files: Record<string, string> = {};
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    expect(view.getUint16(offset + 8, true)).toBe(0);
    const length = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extra;
    files[name] = bytes.subarray(start, start + length).toString();
    offset = start + length;
  }
  const manifest = JSON.parse(files['capibloques/manifest.json']);
  expect(manifest.framework).toBe('esp-idf');
  expect(manifest.frameworkVersion).toBe('5.5.5');
  for (const [name, hash] of Object.entries(manifest.sources)) expect(createHash('sha256').update(files[`capibloques/${name}`]).digest('hex')).toBe(hash);
  expect(files['capibloques/main/main.cpp']).not.toContain('#include <Arduino.h>');
  return files;
}
async function zip(download: Download) {
  expect(download.suggestedFilename()).toMatch(/-esp-idf.zip$/);
  return readArchive(readFileSync((await download.path())!));
}
async function open(page: Page) {
  await mockEditorSession(page); await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible({ timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 10000 });
}
async function menu(page: Page, framework = 'ESP-IDF') {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await page.getByRole('menuitem', { name: framework === 'ESP-IDF' ? 'Proyecto ESP-IDF .zip' : 'Código Arduino .ino', exact: true }).click();
}
async function acknowledge(page: Page) {
  const guide = page.getByRole('dialog', { name: 'Conectar la Wemos sin adivinar', exact: true });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('checkbox').first()).toBeVisible();
  const confirm = guide.getByRole('button', { name: 'Conexiones revisadas', exact: true });
  await expect(confirm).toBeDisabled();
  for (const checkbox of await guide.getByRole('checkbox').all()) await checkbox.check();
  await confirm.click(); await expect(guide).toBeHidden();
}

test('ESP-IDF: descarga ZIP completo con cableado confirmado, conserva Arduino y selector de código', async ({ page }, info) => {
  await open(page);
  await menu(page); await acknowledge(page);
  const pending = page.waitForEvent('download'); await menu(page);
  const files = await zip(await pending);
  expect(files['capibloques/main/main.cpp']).toContain('setTraffic');
  expect(files['capibloques/README.md']).toContain('fuentes, no un binario');
  const arduino = page.waitForEvent('download'); await menu(page, 'Arduino');
  expect(readFileSync((await (await arduino).path())!, 'utf8')).toContain('#include <Arduino.h>');
  await page.getByRole('button', { name: 'Ver código ESP32', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Código para WEMOS D1 R32', exact: true });
  await dialog.getByRole('combobox', { name: 'Formato de código' }).selectOption('esp-idf');
  await expect(dialog.locator('pre')).toContainText('extern "C" void app_main');
  await expect(dialog).toContainText('necesitás el ZIP completo');
  await page.screenshot({ path: info.outputPath('idf-code-preview.png'), fullPage: true });
  await dialog.getByRole('combobox', { name: 'Formato de código' }).selectOption('arduino');
  await expect(dialog.locator('pre')).toContainText('#include <Arduino.h>');
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.getByRole('combobox', { name: 'Formato de código' }).selectOption('esp-idf');
  await expect(dialog.getByRole('button', { name: 'Descargar ESP-IDF .zip', exact: true })).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('idf-code-mobile.png'), fullPage: true });
});

function screenProject(profile: DisplayProfile, valid = true) {
  const { scene, device } = addDeviceToScene(createEmptyScene('Pantalla IDF'), 'display', { config: displayConfig(profile) });
  if (device.kind !== 'display') throw new Error('Expected display fixture');
  if (!valid) device.pins.sda = null;
  return makeProject(`IDF ${profile}`, scene, { blocks: { languageVersion: 0, blocks: [{ type: 'capi_start', id: 'start', x: 30, y: 30, inputs: { DO: { block: { type: 'capi_display_write', id: 'message', fields: { DEVICE_ID: device.id, AREA_ID: displayTargets(device.config)[0].id, TEXT: 'Hola ESP32' } } } } }] } });
}
async function importScreen(page: Page, profile: DisplayProfile, replace: boolean, valid = true) {
  await page.locator('input[type=file]').setInputFiles({ name: 'pantalla.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(screenProject(profile, valid))) });
  if (replace) await page.getByRole('button', { name: 'Conservar copia local y abrir', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(`IDF ${profile}`);
}
test('ESP-IDF: los cinco perfiles generan ZIP nativo; cambiar perfil exige revisar conexiones otra vez', async ({ page }) => {
  await open(page); let replace = false;
  for (const profile of Object.keys(displayProfiles) as DisplayProfile[]) {
    await importScreen(page, profile, replace); replace = true;
    await menu(page); await acknowledge(page);
    const pending = page.waitForEvent('download'); await menu(page);
    const files = await zip(await pending), code = files['capibloques/main/main.cpp'];
    expect(code).toContain('capiDisplayWrite(0, 0');
    expect(code).toContain(profile.startsWith('ili') ? 'driver/spi_master.h' : 'driver/i2c_master.h');
  }
});
test('ESP-IDF: no descarga código con pines pendientes', async ({ page }) => {
  await open(page); await importScreen(page, 'ssd1306', false, false);
  const downloads: Download[] = []; page.on('download', download => downloads.push(download));
  await menu(page);
  await expect(page.locator('output.notice')).toContainText('antes de descargar');
  await expect(page.getByRole('dialog', { name: 'Conectar la Wemos sin adivinar' })).toHaveCount(0);
  expect(downloads).toHaveLength(0);
});
test('ESP-IDF docente: exporta la revisión autorizada con la misma guarda de cableado', async ({ page }) => {
  const state = await mockReview(page); await page.goto(reviewPath);
  const button = page.getByRole('button', { name: 'Descargar ESP-IDF de versión 1', exact: true });
  await expect(button).toBeDisabled();
  await page.getByRole('button', { name: 'Revisar cableado de esta versión', exact: true }).click(); await acknowledge(page);
  await expect(button).toBeEnabled();
  const pending = page.waitForEvent('download'); await button.click(); const download = await pending;
  expect(download.suggestedFilename()).toMatch(/-v1-esp-idf.zip$/);
  await zip(download); expect(state.copies).toBe(0);
});
test('ESP-IDF docente: revocación durante preparación impide la descarga', async ({ page }) => {
  const state = await mockReview(page); await page.goto(reviewPath);
  await page.getByRole('button', { name: 'Revisar cableado de esta versión', exact: true }).click(); await acknowledge(page);
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    const control = window as unknown as { zipHashStarted: boolean; releaseZipHash: () => void };
    crypto.subtle.digest = async (...args) => {
      control.zipHashStarted = true;
      await new Promise<void>(resolve => { control.releaseZipHash = resolve; });
      crypto.subtle.digest = original;
      return original(...args);
    };
  });
  const downloads: Download[] = []; page.on('download', download => downloads.push(download));
  await page.getByRole('button', { name: 'Descargar ESP-IDF de versión 1', exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { zipHashStarted: boolean }).zipHashStarted);
  state.denied = true;
  await page.evaluate(() => (window as unknown as { releaseZipHash: () => void }).releaseZipHash());
  await expect(page.getByRole('button', { name: 'Descargar ESP-IDF de versión 1', exact: true })).toHaveCount(0);
  expect(downloads).toHaveLength(0);
});
