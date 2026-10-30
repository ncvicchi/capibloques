import { expect, test } from '@playwright/test';
import { mockEditorSession, student } from './editor-fixture';
import { makeProject } from '../lib/capiblocks';
import { createEmptyScene } from '../lib/scene-model';
import { CAPI_INTERPRETER_VERSION } from '../lib/capi-rules';

test.beforeEach(async ({ page }) => {
  await mockEditorSession(page);
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user: student } }));
  // Only the installation UI test uses these two doubles. Real ESPLoader and
  // firmware are exercised separately by usb-hardware.test.mjs on the board.
  await page.route(/\/lib\/interpreter-firmware\.ts(?:\?|$)/, route => route.fulfill({ contentType: 'text/javascript', body: 'export async function fetchInterpreterFirmware(){return {chip:"ESP32",flashBytes:4194304,parts:[{address:4096,data:new Uint8Array([1,2,3])}]};}' }));
  await page.route(/\/lib\/usb-esptool\.ts(?:\?|$)/, route => route.fulfill({ contentType: 'text/javascript', body: 'export async function createEspDriver(port){return {async detect(){await port.open();return {chip:"ESP32",flashBytes:4194304}},async write(f,p){p(100)},async reset(){},async close(){await port.close()}};}' }));
  await page.addInitScript(version => {
    const probe = { selected: 0, opened: 0, closed: 0, commands: [] as string[], disconnectNext: false, bootErrorNext: false };
    Object.assign(window, { usbProbe: probe });
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const port = {
      readable: null as ReadableStream<Uint8Array> | null,
      writable: null as WritableStream<Uint8Array> | null,
      async open() {
        probe.opened++;
        this.readable = new ReadableStream({ start(value) { controller = value; } });
        this.writable = new WritableStream({ async write(bytes: Uint8Array) {
          const request = JSON.parse(new TextDecoder().decode(bytes)); probe.commands.push(request.type);
          if (request.type === 'HELLO' && probe.bootErrorNext) {
            probe.bootErrorNext = false; controller.enqueue(new TextEncoder().encode('{"type":"ERROR","message":"Comando desconocido."}\n')); return;
          }
          if (request.type === 'CHUNK' && probe.disconnectNext) { probe.disconnectNext = false; controller.close(); return; }
          const answer = request.type === 'HELLO' ? { protocol: 'CapiLink', firmware: version, abi: 1, board: 'wemos-d1-r32', maxRulesBytes: 32768, capabilities: ['core', 'reliable-transfer'], resources: { pwmChannels: 8 } } : {};
          const type = ({ HELLO: 'HELLO', BEGIN: 'READY', CHUNK: 'ACK', VERIFY: 'VERIFIED', COMMIT: 'COMMITTED' } as Record<string, string>)[request.type] ?? 'OK';
          // Let React process the sending state before the confirmation.
          await new Promise(resolve => setTimeout(resolve, 20));
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ ...answer, type, requestId: request.requestId, sequence: request.sequence }) + '\n'));
        } });
      },
      async close() { probe.closed++; this.readable = this.writable = null; },
    };
    Object.defineProperty(navigator, 'serial', { configurable: true, value: Object.assign(new EventTarget(), { async requestPort() { probe.selected++; return port; } }) });
  }, CAPI_INTERPRETER_VERSION);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  const project = makeProject('Prueba USB', createEmptyScene('Banco USB'), { blocks: { languageVersion: 0, blocks: [{ type: 'capi_start', id: 'start', x: 40, y: 40, inputs: { DO: { block: { type: 'capi_wait', id: 'wait', fields: { SECONDS: 1 } } } } }] } });
  await page.locator('input[type="file"]').setInputFiles({ name: 'usb.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  const replacement = page.getByRole('alertdialog', { name: 'Antes de reemplazar el editor' });
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' }).or(replacement)).toBeVisible();
  if (await replacement.isVisible()) await replacement.getByRole('button', { name: 'Conservar copia local y abrir' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue('Prueba USB');
  await page.getByRole('button', { name: 'Usar en placa', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Conectar mi placa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Enviar el programa' })).toBeVisible();
});

test('envía, controla y vuelve a enviar sin recrear el asistente ni elegir otro USB', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', { name: 'Enviar y ejecutar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Detalles de placa', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Detalles de placa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '⚡ Usar mi placa' });
  await dialog.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Enviar cambios otra vez', exact: true }).click();
  await dialog.getByRole('button', { name: 'Volver a enviar y ejecutar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Detalles de placa', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { usbProbe: { selected: number } }).usbProbe.selected)).toBe(1);
  expect(errors).toEqual([]);
});

test('un cable cortado al enviar ofrece reconectar y permite completar el siguiente intento', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => { (window as unknown as { usbProbe: { disconnectNext: boolean } }).usbProbe.disconnectNext = true; });
  await page.getByRole('button', { name: 'Enviar y ejecutar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Volver a conectar la placa', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar y ejecutar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Volver a conectar la placa', exact: true }).click();
  await page.getByRole('button', { name: 'Conectar mi placa', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar y ejecutar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Detalles de placa', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('la instalación continúa a las reglas sin selector adicional, recarga ni reconexión manual', async ({ page }) => {
  await page.getByRole('button', { name: 'Atrás', exact: true }).click();
  await page.getByRole('button', { name: 'Todavía no tiene CapiBloques', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Es la placa correcta.' }).check();
  await page.getByRole('checkbox', { name: 'Motores y actuadores están desconectados.' }).check();
  await page.getByRole('checkbox', { name: 'Podemos reemplazar el programa actual.' }).check();
  await page.evaluate(() => { (window as unknown as { usbProbe: { bootErrorNext: boolean } }).usbProbe.bootErrorNext = true; });
  await page.getByRole('button', { name: 'Instalar CapiBloques', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { usbProbe: { opened: number } }).usbProbe.opened)).toBe(3);
  await expect(page.getByRole('heading', { name: 'Enviar el programa' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { usbProbe: { selected: number } }).usbProbe.selected)).toBe(2);
  await page.getByRole('button', { name: 'Enviar y ejecutar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Detalles de placa', exact: true })).toBeVisible();
});
