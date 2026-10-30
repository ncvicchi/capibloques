// Real serial hardware; production ESPLoader adapter + production CapiLink.
// Explicit --flash required to replace firmware. Rules tests replace stored rules.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { InterpreterSession, ProtocolLines, encodeProtocolPacket } from '../lib/interpreter-protocol.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
import { createEmptyScene } from '../lib/scene-model.ts';

const { values } = parseArgs({ options: { port: { type: 'string' }, python: { type: 'string' }, build: { type: 'string' }, flash: { type: 'boolean' }, cycles: { type: 'string', default: '10' } } });
assert.ok(values.port && values.python, 'Explicit --port and --python required');
const cycles = Number(values.cycles); assert.ok(Number.isInteger(cycles) && cycles > 0 && cycles <= 100);
const child = spawn(values.python, [fileURLToPath(new URL('./usb-hardware-bridge.py', import.meta.url)), '--port', values.port], { stdio: ['pipe', 'pipe', 'inherit'] });
let sequence = 0, controller, pending = new Map();
child.on('exit', () => { for (const item of pending.values()) item.reject(new Error('Serial bridge exited')); pending.clear(); });
createInterface({ input: child.stdout }).on('line', line => {
  const message = JSON.parse(line);
  if (message.data) { controller?.enqueue(new Uint8Array(Buffer.from(message.data, 'base64'))); return; }
  if (message.lost) { controller?.error(new DOMException('Disconnected', 'NetworkError')); return; }
  const item = pending.get(message.id); if (!item) return;
  pending.delete(message.id); clearTimeout(item.timer); message.ok ? item.resolve() : item.reject(new Error(`Serial bridge: ${message.error}`));
});
function rpc(op, args = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Serial bridge timed out: ${op}`)); }, 10000);
    pending.set(id, { resolve, reject, timer }); child.stdin.write(JSON.stringify({ id, op, ...args }) + '\n');
  });
}
const port = {
  readable: null, writable: null, getInfo: () => ({}),
  async open(options) {
    this.readable = new ReadableStream({ start(c) { controller = c; }, cancel() { controller = null; } });
    this.writable = new WritableStream({ write(bytes) { return rpc('write', { data: Buffer.from(bytes).toString('base64') }); } });
    await rpc('open', { baud: options.baudRate });
  },
  async close() { assert.equal(this.readable?.locked, false); assert.equal(this.writable?.locked, false); await rpc('close'); controller = null; this.readable = this.writable = null; },
  setSignals(value) { return rpc('signals', { value }); },
};
const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.includes('/node_modules/esptool-js/') && url.endsWith('.json')) {
    const data = JSON.parse(readFileSync(new URL(url), 'utf8'));
    // Match Vite's named JSON exports, used by esptool-js dynamic import.
    return { format: 'module', source: Object.entries(data).map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join('\n'), shortCircuit: true };
  }
  return nextLoad(url, context);
}, resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (context.parentURL?.includes('/node_modules/esptool-js/') && specifier.startsWith('.')) return nextResolve(specifier + '.js', context); throw error; }
} });
let session, driver;
try {
  if (values.flash) {
    assert.ok(values.build, '--build required with --flash');
    const build = resolve(values.build), recipe = JSON.parse(await readFile(join(build, 'flasher_args.json'), 'utf8'));
    const parts = await Promise.all(Object.entries(recipe.flash_files).map(async ([address, file]) => ({ address: Number(address), data: new Uint8Array(await readFile(join(build, file))) })));
    const { createEspDriver } = await import('../lib/usb-esptool.ts');
    driver = await createEspDriver(port, new AbortController().signal);
    const detected = await driver.detect(); assert.equal(detected.chip, 'ESP32'); assert.equal(detected.flashBytes, 4194304);
    let printed = -1;
    await driver.write({ chip: 'ESP32', flashBytes: 4194304, parts }, value => { const percent = Math.floor(value / 25) * 25; if (percent > printed) { printed = percent; console.log(`FLASH ${percent}%`); } });
    await driver.reset(); await driver.close(); driver = null;
    console.log('FLASH OK: production esptool-js, segment MD5 verified, reset and port closed');
  }
  const bundle = createCapiRules({ version: 2, variables: [], threads: [{ id: 'main', startBlockId: 's', nodes: [{ op: 'serial', text: 'Prueba de enlace USB', blockId: 'say' }, { op: 'wait', ms: 100, blockId: 'wait' }] }] }, createEmptyScene('Prueba USB sin actuadores'), 'wemos-d1-r32');
  // Large rules exercise many chunks; restore the small fixture before RUN.
  const large = createCapiRules({ version: 2, variables: [], threads: [{ id: 'large', startBlockId: 'ls', nodes: Array.from({ length: 150 }, (_, index) => ({ op: 'serial', text: 'x'.repeat(120), blockId: `text-${index}` })) }] }, createEmptyScene('Prueba USB grande sin actuadores'), 'wemos-d1-r32');
  session = new InterpreterSession(); await session.connect(async () => port, 'wemos-d1-r32');
  assert.equal(session.state.stage, 'ready', session.state.message); await session.send(large);
  await session.send(bundle); await session.close(); session = null;
  console.log(`LARGE RULES OK: ${large.bytes.length} bytes, ${Math.ceil(large.bytes.length / 768)} confirmed chunks, small fixture restored before running`);
  for (let index = 0; index < cycles; index++) {
    session = new InterpreterSession();
    await session.connect(async () => port, 'wemos-d1-r32'); assert.equal(session.state.stage, 'ready', session.state.message);
    await session.send(bundle); assert.equal(session.state.progress, 100);
    await session.command('RUN'); await session.command('PAUSE'); await session.command('RESUME'); await session.command('STOP');
    await session.close(); session = null;
    console.log(`CYCLE ${index + 1}/${cycles} OK: connect, rules, commit, RUN/PAUSE/RESUME/STOP, close`);
  }
  // Real firmware replay must return identical replies and never append twice.
  await port.open({ baudRate: 115200 });
  const reader = port.readable.getReader(), writer = port.writable.getWriter(), lines = new ProtocolLines(true), seen = [];
  async function exchange(packet) {
    await writer.write(encodeProtocolPacket(packet));
    const timer = setTimeout(() => { void reader.cancel(); }, 6000);
    try {
      for (;;) {
        const { value, done } = await reader.read(); assert.equal(done, false, 'hardware reply timeout');
        const packets = lines.push(value); seen.push(...packets.filter(item => item.type === 'TELEMETRY'));
        const answer = packets.find(item => item.requestId === packet.requestId); if (answer) return answer;
      }
    } finally { clearTimeout(timer); }
  }
  try {
    const prefix = crypto.randomUUID();
    await exchange({ type: 'STOP', requestId: prefix + ':s' });
    assert.equal((await exchange({ type: 'BEGIN', bytes: bundle.bytes.length, checksum: bundle.checksum, format: 1, abi: 1, requestId: prefix + ':b' })).type, 'READY');
    for (let offset = 0, seq = 0; offset < bundle.bytes.length; offset += 768, seq++) {
      const packet = { type: 'CHUNK', sequence: seq, data: Buffer.from(bundle.bytes.subarray(offset, offset + 768)).toString('base64'), requestId: prefix + ':' + seq };
      assert.equal((await exchange(packet)).sequence, seq); assert.equal((await exchange(packet)).sequence, seq);
    }
    assert.equal((await exchange({ type: 'VERIFY', requestId: prefix + ':v' })).type, 'VERIFIED');
    const commit = { type: 'COMMIT', requestId: prefix + ':c' };
    assert.equal((await exchange(commit)).type, 'COMMITTED'); assert.equal((await exchange(commit)).type, 'COMMITTED');
    console.log('HARDWARE replay OK: duplicate chunks/commit, exact verification succeeds');
    const begin = { type: 'BEGIN', bytes: bundle.bytes.length, checksum: bundle.checksum, format: 1, abi: 1 };
    assert.equal((await exchange({ ...begin, requestId: prefix + ':bad-b' })).type, 'READY');
    assert.equal((await exchange({ type: 'RUN', requestId: prefix + ':bad-run' })).type, 'ERROR');
    assert.equal((await exchange({ type: 'CHUNK', sequence: 1, data: 'AAAA', requestId: prefix + ':bad-s' })).type, 'ERROR');
    assert.equal((await exchange({ type: 'COMMIT', requestId: prefix + ':bad-c' })).type, 'ERROR');
    const damaged = bundle.bytes.slice(); damaged[damaged.length - 1] ^= 1;
    for (let offset = 0, seq = 0; offset < damaged.length; offset += 768, seq++) {
      assert.equal((await exchange({ type: 'CHUNK', sequence: seq, data: Buffer.from(damaged.subarray(offset, offset + 768)).toString('base64'), requestId: prefix + ':bad-' + seq })).type, 'ACK');
    }
    assert.equal((await exchange({ type: 'VERIFY', requestId: prefix + ':bad-v' })).type, 'ERROR');
    assert.equal((await exchange({ type: 'COMMIT', requestId: prefix + ':bad-c2' })).type, 'ERROR');
    // Reset in the middle of a different transfer: the old valid bank must boot.
    assert.equal((await exchange({ ...begin, requestId: prefix + ':partial' })).type, 'READY');
    assert.equal((await exchange({ type: 'CHUNK', sequence: 0, data: Buffer.from(bundle.bytes.subarray(0, 64)).toString('base64'), requestId: prefix + ':part0' })).type, 'ACK');
    await port.setSignals({ dataTerminalReady: false }); await port.setSignals({ requestToSend: true });
    await new Promise(resolve => setTimeout(resolve, 100)); await port.setSignals({ requestToSend: false });
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal((await exchange({ type: 'HELLO', requestId: prefix + ':boot' })).type, 'HELLO');
    assert.ok(seen.some(item => item.event === 'message' && item.message === 'Prueba de enlace USB'), 'old committed rules must execute after reset during partial transfer');
    await exchange({ type: 'STOP', requestId: prefix + ':final-stop' });
    console.log('HARDWARE recovery OK: wrong sequence, COMMIT before VERIFY, damaged CRC and reset during upload preserve last valid rules');
  } finally { await reader.cancel(); reader.releaseLock(); writer.releaseLock(); await port.close(); }
  console.log('RESULT: PHYSICAL USB TEST PASSED. Test program remains stopped on the board.');
} finally {
  await session?.close().catch(() => {}); await driver?.close().catch(() => {});
  child.stdin.end(); setTimeout(() => child.kill(), 1000).unref(); hooks.deregister();
}
