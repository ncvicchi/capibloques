import assert from 'node:assert/strict';
import { generateEsp32CodeResult, generateEspIdfCodeResult, normalizeCompiledProgram, validateProgramForScene } from '../lib/capiblocks.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
import { addDeviceToScene, createEmptyScene, migrateSceneDefinition } from '../lib/scene-model.ts';
import { decodeWifiMessage, encodeWifiMessage } from '../lib/wifi-messages.ts';

const packet = encodeWifiMessage({ sequence: 42, sender: 'cliente-1', target: 'central', text: 'AVANZAR' });
assert.deepEqual(decodeWifiMessage(packet), { sequence: 42, sender: 'cliente-1', target: 'central', text: 'AVANZAR' });
const damaged = packet.slice(); damaged[damaged.length - 3] ^= 1; assert.equal(decodeWifiMessage(damaged), null);
assert.throws(() => encodeWifiMessage({ sequence: 1, sender: 'mal nombre', target: '*', text: 'HOLA' }));

const added = addDeviceToScene(createEmptyScene('Red'), 'wifiNode');
const wifi = added.device;
wifi.config = { ...wifi.config, role: 'create', boardName: 'central', peers: ['cliente-1', 'cliente-2'], messages: ['HOLA', 'AVANZAR', 'DETENER'] };
const program = normalizeCompiledProgram({ version: 2, threads: [{ id: 'main', startBlockId: 'start', nodes: [
  { op: 'wifi', timeoutMs: 5000, blockId: 'connect' },
  { op: 'wifiMessageSend', deviceId: wifi.id, target: 'cliente-1', text: 'HOLA', blockId: 'send' },
  { op: 'wifiMessageReceive', deviceId: wifi.id, sender: 'cliente-1', expected: 'AVANZAR', timeoutMs: 3000,
    equal: [{ op: 'serial', text: 'igual', blockId: 'equal' }], different: [{ op: 'serial', text: 'distinto', blockId: 'different' }], timeout: [{ op: 'serial', text: 'tiempo', blockId: 'timeout' }], blockId: 'receive' },
] }] }, added.scene);
assert.deepEqual(validateProgramForScene(program, added.scene).filter(item => item.severity === 'error'), []);
for (const result of [generateEsp32CodeResult(program, 'Red', added.scene), generateEspIdfCodeResult(program, 'Red', added.scene)]) {
  assert.deepEqual(result.diagnostics.filter(item => item.severity === 'error'), []);
  assert.match(result.code, /capiWifiMessageSend\("cliente-1", "HOLA"\)/);
  assert.match(result.code, /capiWifiMessagePoll\("cliente-1", received, sender\)/);
  assert.match(result.code, /0x43,0x42,0x57,1/);
}
assert.ok(createCapiRules(program, added.scene, 'wemos-d1-r32').requiredCapabilities.includes('wifi-messages'));

const legacy = structuredClone(added.scene); legacy.devices[0].config = { status: 'idle', ssid: 'CapiRed' };
const migrated = migrateSceneDefinition(legacy);
assert.equal(migrated.migrated, true); assert.equal(migrated.scene.devices[0].config.role, 'join');

console.log('Mensajes Wi-Fi AP/cliente: protocolo, migración y generadores OK');
