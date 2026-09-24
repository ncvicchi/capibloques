import assert from 'node:assert/strict';
import { generateEsp32CodeResult, generateEspIdfCodeResult, normalizeCompiledProgram, validateProgramForScene } from '../lib/capiblocks.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
import { componentValueCapabilities } from '../lib/component-capabilities.ts';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model.ts';

const trafficAdded = addDeviceToScene(createEmptyScene('Estados'), 'trafficLight');
const motorAdded = addDeviceToScene(trafficAdded.scene, 'motor');
const traffic = trafficAdded.device;
const motor = motorAdded.device;
assert.deepEqual(componentValueCapabilities(traffic).map(item => [item.key, item.type, item.source]), [['color', 'text', 'ordered']]);
assert.deepEqual(componentValueCapabilities(motor).map(item => [item.key, item.type, item.source]), [['power', 'number', 'ordered']]);

const color = { kind: 'componentValue', deviceId: traffic.id, property: 'color', valueType: 'text', source: 'ordered' };
const power = { kind: 'componentValue', deviceId: motor.id, property: 'power', valueType: 'number', source: 'ordered' };
const program = normalizeCompiledProgram({ version: 2, threads: [{ id: 'main', startBlockId: 'start', nodes: [
  { op: 'traffic', deviceId: traffic.id, color: 'GREEN', blockId: 'green' },
  { op: 'motor', deviceId: motor.id, direction: 'BACKWARD', power: 35, blockId: 'motor' },
  { op: 'if', condition: { kind: 'valueCompare', operator: 'EQ', left: color, right: { kind: 'text', value: 'GREEN' } }, consequent: [
    { op: 'serial', text: '', expression: { kind: 'join', parts: [{ kind: 'text', value: 'Potencia: ' }, power] }, blockId: 'report' },
  ], otherwise: [], blockId: 'check' },
] }] }, motorAdded.scene);

assert.deepEqual(validateProgramForScene(program, motorAdded.scene).filter(item => item.severity === 'error'), []);
for (const result of [generateEsp32CodeResult(program, 'Estados', motorAdded.scene), generateEspIdfCodeResult(program, 'Estados', motorAdded.scene)]) {
  assert.deepEqual(result.diagnostics.filter(item => item.severity === 'error'), []);
  assert.match(result.code, /STATE_[A-Z0-9_]+_COLOR/);
  assert.match(result.code, /STATE_[A-Z0-9_]+POWER[A-Z0-9_]* = -35/);
  assert.match(result.code, /capiAssignText\(STATE_[A-Z0-9_]+COLOR[A-Z0-9_]*, "GREEN"\)/);
}
const rules = createCapiRules(program, motorAdded.scene, 'wemos-d1-r32');
assert.ok(rules.requiredCapabilities.includes('component-state'));

const removed = structuredClone(motorAdded.scene);
removed.devices = removed.devices.filter(device => device.id !== motor.id);
assert.ok(validateProgramForScene(program, removed).some(item => item.code === 'component-value-missing'));
const stale = structuredClone(program);
stale.threads[0].nodes[2].condition.left.source = 'measured';
assert.ok(validateProgramForScene(stale, motorAdded.scene).some(item => item.code === 'component-value-stale'));

console.log('Estados y valores comunes de componentes: OK');
