import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// esptool-js ships extensionless ESM for bundlers. Resolve only those imports
// when exercising the pinned browser adapter in Node; production uses Vite.
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (context.parentURL?.includes('/node_modules/esptool-js/') && specifier.startsWith('.')) return nextResolve(specifier + '.js', context); throw error; }
} });
const { ESPLoader } = await import('esptool-js');
const { createEspDriver } = await import('../lib/usb-esptool.ts');
const original = Object.fromEntries(['main', 'readFlashId', 'writeFlash', 'after'].map(name => [name, ESPLoader.prototype[name]]));
let loader, options, flashId = 0x1640ef;
ESPLoader.prototype.main = async function () { loader = this; await this.transport.connect(115200); this.transport.readLoop(); this.chip = { CHIP_NAME: 'ESP32' }; };
ESPLoader.prototype.readFlashId = async () => flashId;
ESPLoader.prototype.writeFlash = async function (value) { options = value; await this.transport.write(new Uint8Array([0xc0, 0xdb, 1])); value.reportProgress(0, 4, 4); };
ESPLoader.prototype.after = async function () { await this.transport.setRTS(false); };

function fakePort({ failWrite = false, heldOpen = null } = {}) {
  const events = [], port = { readable: null, writable: null, getInfo: () => ({}),
    async open() { if (heldOpen) await heldOpen; events.push('open'); this.readable = new ReadableStream({ start() {} }); this.writable = new WritableStream({ write(data) { events.push(Array.from(data)); if (failWrite) throw new Error('private serial failure'); } }); },
    async close() { assert.equal(this.readable.locked, false); assert.equal(this.writable.locked, false); this.readable = null; this.writable = null; events.push('close'); },
    async setSignals(value) { events.push(value); },
  };
  return { port, events };
}
try {
  const aborter = new AbortController(), { port, events } = fakePort(), driver = await createEspDriver(port, aborter.signal);
  assert.deepEqual(await driver.detect(), { chip: 'ESP32', flashBytes: 4194304 });
  const firmware = { parts: [{ data: new Uint8Array([1, 2, 3, 4]), address: 4096 }], framework: 'arduino', containsWifi: false };
  let percent = 0; await driver.write(firmware, value => percent = value);
  assert.equal(options.fileArray, firmware.parts); assert.equal(options.eraseAll, false); assert.equal(options.compress, true); assert.equal(options.flashSize, 'keep'); assert.equal(options.flashFreq, 'keep'); assert.equal(options.flashMode, 'keep');
  assert.equal(options.calculateMD5Hash(new TextEncoder().encode('abc')), '900150983cd24fb0d6963f7d28e17f72'); assert.equal(percent, 100);
  assert.deepEqual(events[1], [0xc0, 0xdb, 0xdc, 0xdb, 0xdd, 1, 0xc0]); // Actual SLIP framing/escaping.
  let logged = 0; const savedLog = console.log; console.log = () => logged++;
  try { loader.transport.trace('private bytes'); loader.info('private info'); loader.debug('private debug'); } finally { console.log = savedLog; }
  assert.equal(logged, 0); assert.equal(loader.transport.traceLog, '');
  assert.throws(() => loader.transport.appendArray(new Uint8Array(131072), new Uint8Array(1)));
  await driver.reset(); await driver.close(); await driver.close(); assert.equal(events.filter(value => value === 'close').length, 1);
  await assert.rejects(driver.write(firmware, () => {}));
  console.log('USB adapter OK: pinned loader, SHA-checked headers preserved, MD5, SLIP, bounded receive, silent private transport, one close');

  const broken = fakePort({ failWrite: true }), brokenDriver = await createEspDriver(broken.port, new AbortController().signal);
  await brokenDriver.detect(); await assert.rejects(brokenDriver.write(firmware, () => {})); assert.equal(broken.port.writable.locked, false); await brokenDriver.close();
  console.log('USB adapter OK: rejected writer releases lock and idle reader cancellation closes port');

  flashId = 0xffffff;
  const unknown = fakePort(), unknownDriver = await createEspDriver(unknown.port, new AbortController().signal); assert.equal((await unknownDriver.detect()).flashBytes, 0); await unknownDriver.close();
  console.log('USB adapter OK: unknown flash does not use upstream unsafe 4 MB fallback');

  let release; const late = fakePort({ heldOpen: new Promise(resolve => release = resolve) }), cancelled = new AbortController(), lateDriver = await createEspDriver(late.port, cancelled.signal);
  const detecting = lateDriver.detect(); cancelled.abort(); await lateDriver.close(); release(); await assert.rejects(detecting); await lateDriver.close(); assert.deepEqual(late.events, ['open', 'close']);
  console.log('USB adapter OK: late port.open after cancellation is closed, never reused or written');
} finally { for (const [name, value] of Object.entries(original)) ESPLoader.prototype[name] = value; hooks.deregister(); }
