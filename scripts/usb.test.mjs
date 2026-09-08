import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { parseUsbFirmware, authorizeUsbFirmware, fetchUsbFirmware } from '../lib/usb-firmware.ts';
import { UsbSession, UsbError, appendSerialText } from '../lib/usb-session.ts';
import { usbFixture, digest } from '../tests/fixtures/usb-firmware.mjs';

let checks = 0;
const check = async (name, body) => { await body(); checks++; console.log(`USB OK: ${name}`); };
const waitFor = async predicate => { for (let i = 0; i < 100 && !predicate(); i++) await delay(5); assert.ok(predicate()); };
const firmware = () => ({ framework: 'arduino', containsWifi: false, parts: [{ address: 0x1000, data: new Uint8Array([1, 2, 3, 4]) }] });

await check('bundles Arduino/IDF and cached aliases with a different original buildId', async () => {
  for (const framework of ['arduino', 'esp-idf']) {
    const { bytes, job } = usbFixture(framework), parsed = await parseUsbFirmware(bytes, job);
    assert.equal(parsed.parts.length, framework === 'arduino' ? 4 : 3);
    assert.equal(parsed.parts[0].address, 4096);
  }
});
await check('wrong board, chip, framework, Wi-Fi, offsets, overlap, parts, size, hash and recipe are rejected', async () => {
  for (const mutate of [m => m.board = 'other', m => m.chip = 'esp32-s3', m => m.framework = 'esp-idf', m => m.containsWifiCredentials = true, m => m.flashMode = 'qio', m => m.flashSize = '8MB', m => m.parts[1].offset = 4096, m => m.parts.pop(), m => m.parts[0].size++, m => m.parts[0].sha256 = '0'.repeat(64), m => m.recipe = '', m => m.parts[0].path = '../evil.bin']) {
    const { bytes, job } = usbFixture('arduino', mutate); await assert.rejects(parseUsbFirmware(bytes, job));
  }
  const { bytes, job } = usbFixture(); await assert.rejects(parseUsbFirmware(bytes, { ...job, bytes: 1 })); await assert.rejects(parseUsbFirmware(bytes, { ...job, sha256: '0'.repeat(64) }));
});
await check('malformed ZIP, CRC, duplicates, traversal, compression, oversize and truncation fail closed', async () => {
  for (const change of [e => e.push(e[0]), e => e.push(['../outside', 'x']), e => e[0][1][0] = 99]) {
    const { bytes, job } = usbFixture('arduino', () => {}, change); await assert.rejects(parseUsbFirmware(bytes, job));
  }
  for (const modify of [b => b[40] ^= 1, b => b[8] = 8, b => b[b.length - 2] = 1, b => b.writeUInt32LE(0xffffffff, b.length - 6)]) {
    const { bytes, job } = usbFixture(); modify(bytes); await assert.rejects(parseUsbFirmware(bytes, { ...job, sha256: digest(bytes) }));
  }
  const { bytes, job } = usbFixture(); const small = bytes.subarray(0, bytes.length - 5); await assert.rejects(parseUsbFirmware(small, { ...job, bytes: small.length, sha256: digest(small) }));
  await assert.rejects(parseUsbFirmware(new Uint8Array(5_000_001), job));
});
await check('fresh authorization after download; revoked, withdrawn or replaced results are blocked', async () => {
  const { bytes, job } = usbFixture(), original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(bytes);
    assert.equal((await fetchUsbFirmware(job, 'owner', new AbortController().signal, () => true)).parts.length, 4);
    await assert.rejects(fetchUsbFirmware(job, 'owner', new AbortController().signal, () => false));
    for (const updated of [{ ...job, state: 'expired' }, { ...job, projectId: 'another' }, { ...job, sha256: '0'.repeat(64) }]) {
      globalThis.fetch = async () => Response.json({ job: updated }); await assert.rejects(authorizeUsbFirmware(job, 'owner', new AbortController().signal, () => true));
    }
    globalThis.fetch = async () => Response.json({ job }); await authorizeUsbFirmware(job, 'owner', new AbortController().signal, () => true);
    await assert.rejects(authorizeUsbFirmware(job, 'owner', new AbortController().signal, () => false));
    globalThis.fetch = async () => new Response('', { status: 403 }); await assert.rejects(authorizeUsbFirmware(job, 'owner', new AbortController().signal, () => true));
  } finally { globalThis.fetch = original; }
});

function fakeDriver(options = {}) {
  const events = [];
  return { events, async factory() { return {
    async detect() { events.push('detect'); return { chip: options.chip ?? 'ESP32', flashBytes: options.flashBytes ?? 4194304 }; },
    async write(data, progress) { events.push('write'); options.data = data; progress(45); if (options.write) await options.write(); if (options.fail) throw new Error('private device payload MUST NOT LEAK'); progress(100); },
    async reset() { events.push('reset'); }, async close() { events.push('close'); if (options.close) await options.close(); },
  }; } };
}
await check('detect → fresh authorization → write/verify → reset → close; private bytes cleared', async () => {
  const options = {}, driver = fakeDriver(options), session = new UsbSession(driver.factory);
  session.flash(async () => ({}), async () => firmware(), async () => driver.events.push('authorize'));
  await session.settled(); assert.deepEqual(driver.events, ['detect', 'authorize', 'write', 'reset', 'close']); assert.equal(session.state.stage, 'done'); assert.equal(session.state.progress, 100); assert.ok(options.data.parts[0].data.every(byte => byte === 0));
});
await check('wrong chip and unknown/small flash never write or reset', async () => {
  for (const options of [{ chip: 'ESP32-S3' }, { flashBytes: 0 }, { flashBytes: 2097152 }]) {
    const driver = fakeDriver(options), session = new UsbSession(driver.factory); session.flash(async () => ({}), async () => firmware(), async () => {}); await session.settled(); assert.equal(session.state.stage, 'error'); assert.deepEqual(driver.events, ['detect', 'close']);
  }
});
await check('authorization lost after chip detection; no writes', async () => {
  const driver = fakeDriver(), session = new UsbSession(driver.factory); session.flash(async () => ({}), async () => firmware(), async () => { throw new UsbError('Acceso retirado'); }); await session.settled(); assert.deepEqual(driver.events, ['detect', 'close']); assert.match(session.state.message, /Acceso retirado/);
});
await check('verification failure never reports success or resets; private errors are not surfaced', async () => {
  const driver = fakeDriver({ fail: true }), session = new UsbSession(driver.factory); session.flash(async () => ({}), async () => firmware(), async () => {}); await session.settled(); assert.equal(session.state.stage, 'error'); assert.ok(!driver.events.includes('reset')); assert.ok(!session.state.message.includes('private device')); assert.match(session.state.message, /incompleta/);
});
await check('cancel waits for in-flight write/cleanup; second connection cannot race old operation', async () => {
  let release; const driver = fakeDriver({ write: () => new Promise(resolve => release = resolve) }), session = new UsbSession(driver.factory);
  session.flash(async () => ({}), async () => firmware(), async () => {}); await waitFor(() => release);
  session.cancel(); const next = new UsbSession(fakeDriver().factory); let selections = 0; next.monitor(async () => { selections++; return {}; }); assert.equal(selections, 0);
  release(); await session.settled(); assert.equal(session.state.stage, 'error'); assert.ok(!driver.events.includes('reset'));
  next.flash(async () => ({}), async () => firmware(), async () => {}); await next.settled(); assert.equal(next.state.stage, 'done');
});
await check('cancel a pending chooser; its late resolution never opens the port', async () => {
  let select; const driver = fakeDriver(), session = new UsbSession(driver.factory); session.flash(() => new Promise(resolve => select = resolve), async () => firmware(), async () => {}); session.cancel(); select({}); await session.settled(); assert.deepEqual(driver.events, []);
});
await check('idle monitor cancellation releases the reader and closes the port', async () => {
  let closed = 0; const stream = new ReadableStream({ start() {} });
  const session = new UsbSession(fakeDriver().factory), port = { open: async () => {}, close: async () => { assert.equal(stream.locked, false); closed++; }, readable: stream };
  session.monitor(async () => port); await waitFor(() => session.state.stage === 'monitor'); session.cancel(); await session.settled(); assert.equal(closed, 1); assert.equal(stream.locked, false);
});
await check('serial UTF-8 fragmentation, bounded lines/text, clear while batched, and disposal privacy', async () => {
  let controller; const stream = new ReadableStream({ start(c) { controller = c; } }), session = new UsbSession(fakeDriver().factory);
  const port = { open: async () => {}, close: async () => {}, readable: stream };
  session.monitor(async () => port); await waitFor(() => session.state.stage === 'monitor'); const text = new TextEncoder().encode('pingüino 🐧\n'); controller.enqueue(text.slice(0, 5)); controller.enqueue(text.slice(5)); await delay(120); assert.match(session.state.text, /pingüino 🐧/);
  controller.enqueue(new TextEncoder().encode('secreto anterior')); await delay(10); session.clearText(); await delay(120); assert.equal(session.state.text, '');
  controller.enqueue(new TextEncoder().encode('nuevo')); await delay(120); assert.equal(session.state.text, 'nuevo');
  session.dispose(); await session.settled(); assert.equal(session.state.text, '');
  assert.ok(appendSerialText('', 'x'.repeat(100_000)).length <= 32768); assert.ok(appendSerialText('', 'line\n'.repeat(500)).split('\n').length <= 200); assert.equal(appendSerialText('', '\x1b[31mHola\x00\r\n'), 'Hola\n');
});
await check('rejected permission does not acquire or open a device', async () => {
  const driver = fakeDriver(), session = new UsbSession(driver.factory); session.monitor(async () => { throw new DOMException('cancelled', 'NotFoundError'); }); await session.settled(); assert.match(session.state.message, /No elegiste/); assert.deepEqual(driver.events, []);
});
console.log(`${checks} USB test groups passed. Doubles do not demonstrate physical ESP32 behavior.`);
