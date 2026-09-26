import assert from 'node:assert/strict';
import { createCapiRules, parseCapiRules, CAPI_RULES_MAX_BYTES } from '../lib/capi-rules.ts';
import { createEmptyScene } from '../lib/scene-model.ts';
import { createPairCredentials, pairSsid, ProtocolLines, encodeProtocolPacket } from '../lib/interpreter-protocol.ts';

const scene = createEmptyScene('Prueba de reglas');
const program = { version: 2, variables: [{ id: 'score', name: 'Puntos', type: 'number' }], threads: [{ id: 'main', startBlockId: 'start', nodes: [
  { op: 'counterSet', value: 1, blockId: 'set' },
  { op: 'repeat', count: 3, body: [{ op: 'wait', ms: 25, blockId: 'wait' }, { op: 'counterChange', delta: 1, blockId: 'add' }], blockId: 'repeat' },
  { op: 'serial', text: 'Listo', blockId: 'say' },
] }] };

const first = createCapiRules(program, scene, 'wemos-d1-r32');
const second = createCapiRules(program, scene, 'wemos-d1-r32');
assert.deepEqual(first.bytes, second.bytes, 'same project must create deterministic rules');
assert.ok(first.bytes.length < CAPI_RULES_MAX_BYTES);
assert.deepEqual(first.requiredCapabilities, ['core', 'counter', 'serial']);
assert.deepEqual(first.resourceRequirements, { pwmChannels: 0 });
assert.equal(parseCapiRules(first.bytes, 'wemos-d1-r32').instructionCount, first.instructionCount);
assert.throws(() => parseCapiRules(first.bytes, 'diymall-esp32-s3-devkitc-v1-n16r8'), /placa/);
const damaged = first.bytes.slice(); damaged[damaged.length - 1] ^= 1;
assert.throws(() => parseCapiRules(damaged), /dañadas/);

const lines = new ProtocolLines();
const packet = encodeProtocolPacket({ type: 'HELLO', abi: 1 });
assert.deepEqual(lines.push(packet.subarray(0, 4)), []);
assert.deepEqual(lines.push(packet.subarray(4)), [{ type: 'HELLO', abi: 1 }]);
assert.equal(pairSsid('A1B2C33FA21C'), 'WS3FA21C');
assert.throws(() => pairSsid('123'));
const pair = createPairCredentials({ protocol: 'CapiLink', firmware: '1.5.3', abi: 1, board: 'waveshare-esp32-s3-touch-lcd-5-28117', hardwareId: 'A1B2C33FA21C', maxRulesBytes: 32768, capabilities: ['pairing'], resources: { pwmChannels: 8 } });
assert.equal(pair.ssid, 'WS3FA21C'); assert.equal(pair.password.length, 20); assert.match(pair.pairingKey, /^[a-f0-9]{32}$/); assert.equal(pair.screenHardwareId, 'A1B2C33FA21C');
const emojiLines = new ProtocolLines(), emojiPacket = encodeProtocolPacket({ type: 'TELEMETRY', message: 'capibara 🐹' });
const emojiAt = emojiPacket.indexOf(0xf0);
assert.deepEqual(emojiLines.push(emojiPacket.subarray(0, emojiAt + 2)), []);
assert.equal(emojiLines.push(emojiPacket.subarray(emojiAt + 2))[0].message, 'capibara 🐹');
assert.throws(() => lines.push(new TextEncoder().encode('{mal}\n')), /inválido/);
console.log('CapiRules y CapiLink: OK');
