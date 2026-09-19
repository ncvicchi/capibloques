import assert from 'node:assert/strict';
import { addDeviceToScene, createEmptyScene, getPinRequirements, validateScene } from '../lib/scene-model.ts';
import { compileTaskGraph, generateEsp32CodeResult, generateEspIdfCodeResult, validateProgramForScene } from '../lib/capiblocks.ts';
import { decodeMessagePacket, encodeMessagePacket } from '../lib/messages-protocol.ts';

const encoded = encodeMessagePacket('AVANZAR');
assert.equal(decodeMessagePacket(encoded).ok, true);
const corrupted = encoded.slice();
corrupted[5] ^= 1;
assert.deepEqual(decodeMessagePacket(corrupted), { ok: false, reason: 'checksum' });

const added = addDeviceToScene(createEmptyScene('Mensajes'), 'messages', {
  config: { mode: 'both', baudRate: 9600, messages: ['AVANZAR', 'DETENER'] },
});
const scene = added.scene;
const device = scene.devices.find(item => item.kind === 'messages');
assert(device && device.kind === 'messages');
assert.equal(getPinRequirements(device).length, 2);
assert.equal(validateScene(scene).valid, true);

const program = {
  version: 2,
  threads: [{
    id: 'main', startBlockId: 'start', nodes: [
      { op: 'messageSend', deviceId: device.id, text: 'AVANZAR', blockId: 'send' },
      {
        op: 'messageReceive', deviceId: device.id, expected: 'DETENER', timeoutMs: 5000, blockId: 'receive',
        equal: [{ op: 'serial', text: 'igual', blockId: 'equal' }],
        different: [{ op: 'serial', text: 'distinto', blockId: 'different' }],
        timeout: [{ op: 'serial', text: 'sin mensaje', blockId: 'timeout' }],
      },
    ],
  }],
};
assert.deepEqual(validateProgramForScene(program, scene).filter(item => item.severity === 'error'), []);
const graph = compileTaskGraph(program);
const receive = graph[0].output.find(item => item.op === 'messageReceiveWait');
assert(receive && receive.op === 'messageReceiveWait');
assert(receive.equalTarget !== receive.differentTarget && receive.differentTarget !== receive.timeoutTarget);

const arduino = generateEsp32CodeResult(program, 'Mensajes', scene);
const idf = generateEspIdfCodeResult(program, 'Mensajes', scene);
for (const generated of [arduino, idf]) {
  assert.equal(generated.diagnostics.some(item => item.severity === 'error'), false);
  assert.match(generated.code, /capiMessageSend/);
  assert.match(generated.code, /capiMessagePoll/);
  assert.match(generated.code, /0x43, 0x42, 1/);
  assert.doesNotMatch(generated.code, /delay\s*\(/);
}
assert.ok(arduino.code.indexOf('struct CapiMessageParser') < arduino.code.indexOf('void capiMessageReset(CapiMessageParser& parser);'));

console.log('Messages component smoke tests passed.');
