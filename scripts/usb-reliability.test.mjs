import assert from 'node:assert/strict';
import { InterpreterSession, encodeProtocolPacket, ProtocolLines } from '../lib/interpreter-protocol.ts';
import { createCapiRules, CAPI_INTERPRETER_VERSION } from '../lib/capi-rules.ts';
import { createEmptyScene } from '../lib/scene-model.ts';
import { acquireUsbLease } from '../lib/usb-lease.ts';
import { fetchInterpreterFirmware } from '../lib/interpreter-firmware.ts';

const delay = ms => new Promise(resolve => realTimeout(resolve, ms));
const realTimeout = globalThis.setTimeout;
// Exercise production timeout/retry paths without waiting minutes per fault.
globalThis.setTimeout = (fn, ms, ...args) => realTimeout(fn, Math.min(ms, 25), ...args);
const bundle = createCapiRules({ version: 2, variables: [], threads: [{ id: 'main', startBlockId: 's', nodes: [{ op: 'serial', text: 'Prueba USB', blockId: 'say' }] }] }, createEmptyScene('Prueba'), 'wemos-d1-r32');
function board(options = {}) {
  let controller, opened = false, cache, received = [], committed = null;
  const commands = [], effects = {}, dropped = new Set();
  const port = {
    readable: null, writable: null,
    async open() {
      opened = true;
      this.readable = new ReadableStream({ start(c) { controller = c; } });
      this.writable = new WritableStream({ async write(bytes) {
        const request = JSON.parse(new TextDecoder().decode(bytes)); commands.push(request);
        if (options.disconnect === request.type) { controller.close(); return; }
        if (options.hold === request.type) await options.release;
        let response;
        if (cache?.id === request.requestId) response = cache.response;
        else {
          effects[request.type] = (effects[request.type] ?? 0) + 1;
          response = { type: ({ STOP: 'OK', RUN: 'OK', STEP: 'OK', BEGIN: 'READY', CHUNK: 'ACK', VERIFY: 'VERIFIED', COMMIT: 'COMMITTED' })[request.type] ?? 'OK', requestId: request.requestId };
          if (request.type === 'HELLO') response = { type: 'HELLO', requestId: request.requestId, protocol: 'CapiLink', firmware: CAPI_INTERPRETER_VERSION, abi: 1, board: 'wemos-d1-r32', maxRulesBytes: 32768, capabilities: ['core', 'serial', ...(options.legacy ? [] : ['reliable-transfer'])], resources: { pwmChannels: 8 } };
          if (request.type === 'BEGIN') received = [];
          if (request.type === 'CHUNK') { received.push(Buffer.from(request.data, 'base64')); response.sequence = request.sequence; }
          if (request.type === 'COMMIT') committed = Buffer.concat(received);
          if (options.wrongSequence && request.type === 'CHUNK') response.sequence++;
          cache = { id: request.requestId, response };
        }
        if (options.drop?.includes(request.type) && !dropped.has(request.type)) { dropped.add(request.type); return; }
        if (options.bootError && request.type === 'HELLO' && !dropped.has('boot-error')) {
          dropped.add('boot-error'); controller.enqueue(encodeProtocolPacket({ type: 'ERROR', message: 'Comando desconocido.' })); return;
        }
        if (options.silent === request.type) return;
        if (options.noise) controller.enqueue(new TextEncoder().encode('{broken boot log}\n'));
        if (options.stale) controller.enqueue(encodeProtocolPacket({ type: 'ERROR', requestId: 'old-connection', message: 'stale' }));
        controller.enqueue(encodeProtocolPacket(response));
        if (options.duplicate) controller.enqueue(encodeProtocolPacket(response));
        if (request.type === 'CHUNK') controller.enqueue(encodeProtocolPacket({ type: 'TELEMETRY', event: 'program-done' }));
      } });
    },
    async close() { assert.equal(this.readable.locked, false); assert.equal(this.writable.locked, false); opened = false; this.readable = this.writable = null; },
  };
  return { port, commands, effects, get committed() { return committed; }, get opened() { return opened; }, disconnect() { controller.close(); } };
}
async function connect(fake) { const session = new InterpreterSession(); await session.connect(async () => fake.port, 'wemos-d1-r32'); assert.equal(session.state.stage, 'ready', session.state.message); return session; }
try {
  const originalFetch = globalThis.fetch;
  let downloads = 0;
  globalThis.fetch = async () => { downloads++; return new Response(JSON.stringify({ version: '1.9.0' }), { status: 200 }); };
  try { await assert.rejects(fetchInterpreterFirmware('wemos-d1-r32', new AbortController().signal), /ofrece firmware 1.9.0.*necesita 1.14.3/); }
  finally { globalThis.fetch = originalFetch; }
  assert.equal(downloads, 1, 'a stale manifest must not download or flash a bundle');
  console.log('Reliable USB: mismatched published firmware gives an actionable error before downloading/USB');
  const normal = board({ duplicate: true, noise: true, stale: true, drop: ['HELLO', 'STOP', 'BEGIN', 'CHUNK', 'VERIFY', 'COMMIT', 'RUN'] });
  const session = await connect(normal);
  await assert.rejects(session.send({ ...bundle, document: { ...bundle.document, board: 'diymall-esp32-s3-devkitc-v1-n16r8' } }), /no coincide/);
  await assert.rejects(acquireUsbLease({}), /USB/);
  await session.send(bundle);
  assert.deepEqual(normal.committed, Buffer.from(bundle.bytes));
  assert.equal(normal.effects.COMMIT, 1);
  assert.equal(normal.effects.CHUNK, Math.ceil(bundle.bytes.length / 768));
  await session.command('RUN'); assert.equal(normal.effects.RUN, 1);
  assert.equal(session.state.stage, 'running');
  await session.close(); assert.equal(normal.opened, false);
  console.log('Reliable USB: lost ACK at every stage, duplicates, stale errors, boot noise, exact bytes, one commit/RUN and shared USB exclusion');

  for (const stage of ['HELLO', 'STOP', 'BEGIN', 'CHUNK', 'VERIFY', 'COMMIT']) {
    const fake = board({ disconnect: stage }), session = new InterpreterSession();
    await session.connect(async () => fake.port, 'wemos-d1-r32');
    if (stage !== 'HELLO') await assert.rejects(session.send(bundle));
    await delay(5); await session.close();
    assert.equal(fake.opened, false);
    const release = await acquireUsbLease({}); release();
  }
  console.log('Reliable USB: cable loss in every stage releases ownership and never reports success');

  for (const options of [{ silent: 'CHUNK' }, { wrongSequence: true }]) {
    const fake = board(options), session = await connect(fake);
    await assert.rejects(session.send(bundle));
    assert.equal(fake.committed, null); assert.equal(session.state.stage, 'error');
    assert.equal(fake.opened, false);
  }
  console.log('Reliable USB: exhausted retries / wrong fragment ACK do not commit');

  let release;
  const fake = board({ hold: 'CHUNK', release: new Promise(resolve => release = resolve) }), concurrent = await connect(fake);
  const sending = concurrent.send(bundle); await delay(3);
  await assert.rejects(concurrent.send(bundle), /anterior/);
  await assert.rejects(concurrent.command('RUN'), /anterior/);
  release(); await sending; await concurrent.close();
  console.log('Reliable USB: double clicks and control commands cannot interleave a transfer');

  const legacy = board({ legacy: true }), old = new InterpreterSession();
  await old.connect(async () => legacy.port, 'wemos-d1-r32'); assert.equal(old.state.stage, 'incompatible'); await assert.rejects(old.send(bundle)); await old.close();
  const boot = board({ bootError: true }), bootSession = await connect(boot);
  assert.equal(boot.effects.HELLO, 2); await bootSession.close();
  console.log('Reliable USB: untagged unknown-command from buffered startup cannot fail a fresh HELLO');
  let choose;
  const cancelled = new InterpreterSession(), late = board();
  const connecting = cancelled.connect(() => new Promise(resolve => choose = resolve), 'wemos-d1-r32');
  await delay(0); await cancelled.close(); choose(late.port); await connecting;
  assert.equal(late.opened, false);
  const releaseLease = await acquireUsbLease({}); releaseLease();
  console.log('Reliable USB: old firmware blocked; cancelling a chooser cannot open its late result');
  const parser = new ProtocolLines(true);
  assert.equal(parser.push(new TextEncoder().encode('{bad}\n' + JSON.stringify({ type: 'ACK' }) + '\n')).length, 1);
  const locksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
  let held = false;
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { async request(_name, _options, callback) {
    if (held) return callback(null);
    held = true;
    try { return await callback({ name: 'capibloques-usb' }); }
    finally { await delay(2); held = false; }
  } } });
  try {
    const first = await connect(board()); await first.close();
    const second = await connect(board()); await second.close();
    assert.equal(held, false);
  } finally {
    if (locksDescriptor) Object.defineProperty(navigator, 'locks', locksDescriptor);
    else delete navigator.locks;
  }
  console.log('Reliable USB: automatic handoff waits for asynchronous browser Web Lock release');
} finally { globalThis.setTimeout = realTimeout; }
