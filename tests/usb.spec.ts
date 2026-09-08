import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession, student, token } from './editor-fixture';
import { usbFixture } from './fixtures/usb-firmware.mjs';

async function setup(page: Page, options: { unsupported?: boolean; denied?: boolean; chip?: string; flashBytes?: number; fail?: boolean; hold?: boolean; framework?: string; corrupt?: boolean; revoked?: boolean } = {}) {
  await mockEditorSession(page);
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user: student, csrfToken: token } }));
  const { job, bytes } = usbFixture(options.framework ?? 'arduino');
  let downloads = 0, authorizations = 0;
  await page.route('**/api/builds/**', route => {
    expect(route.request().headers()['x-capi-account']).toBe(student.id);
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/download/')) { downloads++; return route.fulfill({ body: options.corrupt ? Buffer.from('wrong firmware') : bytes, contentType: 'application/zip' }); }
    if (path === '/api/builds/') return route.fulfill({ json: { jobs: [job], settings: { available: true, concurrency: 1, paused: false }, csrfToken: token } });
    authorizations++;
    return options.revoked ? route.fulfill({ status: 403, json: { error: 'Acceso retirado' } }) : route.fulfill({ json: { job } });
  });
  await page.addInitScript(options => {
    const events: string[] = [];
    let incoming: ReadableStreamDefaultController<Uint8Array>;
    const port = Object.assign(new EventTarget(), {
      readable: null as ReadableStream<Uint8Array> | null, writable: null as WritableStream<Uint8Array> | null,
      async open() { events.push('open'); this.readable = new ReadableStream({ start(controller) { incoming = controller; } }); this.writable = new WritableStream({ write() { events.push('serial-write'); } }); },
      async close() { if (this.readable?.locked || this.writable?.locked) throw new Error('Port still locked'); events.push('close'); this.readable = null; this.writable = null; },
      getInfo() { return { usbVendorId: 0x10c4, usbProductId: 0xea60 }; },
      async setSignals() { events.push('signals'); },
    });
    const serial = Object.assign(new EventTarget(), { async requestPort() { events.push('choose'); if (options.denied) throw new DOMException('Permission cancelled', 'NotFoundError'); return port; } });
    Object.defineProperty(navigator, 'serial', { configurable: true, value: options.unsupported ? undefined : serial });
    Object.assign(window, { usbFixture: { options, events, port, emit: (text: string) => incoming.enqueue(new TextEncoder().encode(text)) } });
  }, options);
  // Test-only module replacement over the browser network, never a runtime
  // backdoor in the product. Protocol/checksum transport is tested separately.
  await page.route('**/lib/usb-esptool.ts*', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const createEspDriver = async (port, signal) => {
      const { events, options } = window.usbFixture;
      let closed = false;
      return {
        async detect() { events.push('detect'); await port.open(); return { chip: options.chip || 'ESP32', flashBytes: options.flashBytes ?? 4194304 }; },
        async write(firmware, progress) { events.push('write:' + firmware.framework); progress(47); if (options.hold) await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); if (options.fail) throw new Error('PRIVATE DEVICE ERROR'); progress(100); },
        async reset() { events.push('reset'); },
        async close() { if (!closed) { closed = true; if (port.readable) await port.close(); } },
      };
    };
  ` }));
  await page.goto('/'); await expect(page.locator('.blocklySvg')).toBeVisible();
  return { counts: () => ({ downloads, authorizations }), job };
}
async function openUsb(page: Page, compiled = false) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await page.getByRole('menuitem', { name: compiled ? 'Compilar y descargar firmware' : 'USB y monitor Serial', exact: true }).click();
  if (compiled) await page.getByRole('button', { name: 'Programar mi Wemos', exact: true }).click();
  return page.getByRole('dialog', { name: 'USB y monitor Serial' });
}
async function acknowledge(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'USB y monitor Serial' });
  for (const checkbox of await dialog.locator('.usb-checks input').all()) await checkbox.check();
}
const events = (page: Page) => page.evaluate(() => (window as unknown as { usbFixture: { events: string[] } }).usbFixture.events);

test('USB: unavailable browser remains usable, with fallback and no additional editor headers', async ({ page }) => {
  await setup(page, { unsupported: true }); const dialog = await openUsb(page);
  await expect(dialog).toContainText('no permite Web Serial'); await expect(dialog.getByRole('button', { name: 'Elegir puerto y abrir monitor' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cerrar y seguir programando' }).click(); await expect(page.locator('.blocklySvg')).toBeVisible(); expect(await events(page)).toEqual([]);
});

test('USB: explicit confirmations, denied chooser and retry keep the project intact', async ({ page }) => {
  const { counts } = await setup(page, { denied: true }); const dialog = await openUsb(page, true);
  await expect(dialog.getByRole('button', { name: 'Elegir Wemos y grabar' })).toBeDisabled(); await acknowledge(page);
  await dialog.getByRole('button', { name: 'Elegir Wemos y grabar' }).click(); await expect(dialog).toContainText('No elegiste un puerto');
  await expect(dialog.getByRole('button', { name: 'Elegir Wemos y grabar' })).toBeEnabled(); expect(counts()).toEqual({ downloads: 0, authorizations: 0 }); expect(await events(page)).toEqual(['choose']);
});

for (const framework of ['arduino', 'esp-idf']) test(`USB: ${framework} verified bundle → chip → fresh authorization → flash; mobile layout`, async ({ page }, info) => {
  const { counts } = await setup(page, { framework }); const dialog = await openUsb(page, true); await acknowledge(page);
  await expect(dialog).toContainText('no corresponde a los cambios actuales'); await dialog.getByRole('button', { name: 'Elegir Wemos y grabar' }).click();
  await expect(dialog).toContainText('Firmware grabado y verificado'); await expect(dialog.getByRole('progressbar')).toHaveAttribute('value', '100');
  expect(counts()).toEqual({ downloads: 1, authorizations: 1 }); expect(await events(page)).toEqual(['choose', 'detect', 'open', `write:${framework}`, 'reset', 'close']);
  await page.setViewportSize({ width: 390, height: 844 }); expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath(`usb-${framework}-mobile.png`), fullPage: true });
});

for (const problem of ['chip', 'corrupt', 'revoked', 'verify'] as const) test(`USB: ${problem} blocks unsafe writes or false success`, async ({ page }) => {
  await setup(page, { chip: problem === 'chip' ? 'ESP32-S3' : undefined, corrupt: problem === 'corrupt', revoked: problem === 'revoked', fail: problem === 'verify' });
  const dialog = await openUsb(page, true); await acknowledge(page); await dialog.getByRole('button', { name: 'Elegir Wemos y grabar' }).click();
  await expect(dialog.locator('.usb-status[role=alert]')).toBeVisible(); const steps = await events(page); expect(steps).not.toContain('reset');
  if (problem !== 'verify') expect(steps).not.toContain('write:arduino');
  await expect(dialog).not.toContainText('PRIVATE DEVICE ERROR'); await expect(dialog).not.toContainText('Firmware grabado y verificado');
});

test('USB: interruption explains incomplete firmware, awaits close and allows retry', async ({ page }) => {
  await setup(page, { hold: true }); const dialog = await openUsb(page, true); await acknowledge(page);
  await dialog.getByRole('button', { name: 'Elegir Wemos y grabar' }).click(); await expect(dialog.getByRole('progressbar')).toHaveAttribute('value', '47');
  await expect(dialog.getByRole('button', { name: 'Cerrar y seguir programando' })).toBeDisabled(); await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  page.once('dialog', popup => popup.accept()); await dialog.getByRole('button', { name: 'Interrumpir grabación…' }).click(); await expect(dialog).toContainText('firmware puede estar incompleto');
  expect(await events(page)).toContain('close'); expect(await events(page)).not.toContain('reset'); await expect(dialog.getByRole('button', { name: 'Elegir Wemos y grabar' })).toBeEnabled();
});

test('USB: real-monitor path reads bounded plain text, clears, closes idle reader and reopens', async ({ page }) => {
  await setup(page); const dialog = await openUsb(page); await acknowledge(page); await dialog.getByRole('button', { name: 'Elegir puerto y abrir monitor' }).click();
  await expect(dialog).toContainText('Monitor Serial real');
  await page.evaluate(() => (window as unknown as { usbFixture: { emit: (text: string) => void } }).usbFixture.emit('Pingüino 🐧\n<img src=x onerror=alert(1)>'));
  await expect(dialog.getByLabel('Mensajes Serial de la placa')).toContainText('Pingüino'); expect(await dialog.locator('.usb-monitor img').count()).toBe(0);
  await dialog.getByRole('button', { name: 'Limpiar mensajes' }).click(); await expect(dialog.getByLabel('Mensajes Serial de la placa')).not.toContainText('Pingüino');
  await dialog.getByRole('button', { name: 'Cerrar monitor y liberar USB' }).click(); await expect(dialog.getByRole('button', { name: 'Elegir puerto y abrir monitor' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Elegir puerto y abrir monitor' }).click(); await expect(dialog).toContainText('Monitor Serial real');
  await dialog.getByRole('button', { name: 'Cerrar monitor y liberar USB' }).click(); await expect.poll(() => events(page)).toEqual(['choose', 'open', 'close', 'choose', 'open', 'close']);
});

test('USB: session invalidation closes idle monitor and discards private messages', async ({ page }) => {
  await setup(page); const dialog = await openUsb(page); await acknowledge(page); await dialog.getByRole('button', { name: 'Elegir puerto y abrir monitor' }).click(); await expect(dialog).toContainText('Monitor Serial real');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('capibloques-account-session', { detail: { changing: true } })));
  await expect.poll(async () => (await events(page)).includes('close')).toBe(true);
});
