import assert from 'node:assert/strict';
import { generateEsp32CodeResult, generateEspIdfCodeResult, makeProject, decodeProject, validateProgramForScene, valueExpressionType } from '../lib/capiblocks.ts';
import { addDeviceToScene, createEmptyScene, getPinRequirements, validateScene } from '../lib/scene-model.ts';

const added = addDeviceToScene(createEmptyScene('Barrera'), 'infraredBarrier');
const barrier = added.device;
assert.equal(barrier.kind, 'infraredBarrier');
assert.equal(barrier.config.interrupted, false);
assert.equal(barrier.config.interruptedLevel, 'LOW');
assert.equal(getPinRequirements(barrier)[0].capability, 'digitalInput');
assert.equal(validateScene(added.scene).valid, true);

const expression = { kind: 'barrierValue', deviceId: barrier.id, expected: 'INTERRUPTED' };
assert.equal(valueExpressionType(expression), 'boolean');
const program = { version: 2, variables: [], threads: [{ id: 'start', startBlockId: 'start', nodes: [{
  op: 'if', condition: { kind: 'value', expression },
  consequent: [{ op: 'serial', text: 'Haz interrumpido', blockId: 'blocked' }],
  otherwise: [{ op: 'serial', text: 'Haz libre', blockId: 'clear' }],
  blockId: 'if-barrier',
}] }] };
assert.deepEqual(validateProgramForScene(program, added.scene).filter(item => item.severity === 'error'), []);

const arduino = generateEsp32CodeResult(program, 'Barrera', added.scene);
assert.equal(arduino.diagnostics.some(item => item.severity === 'error'), false);
assert.match(arduino.code, /pinMode\(PIN_[A-Z0-9_]+, INPUT\);/);
assert.match(arduino.code, /digitalRead\(PIN_[A-Z0-9_]+\) == LOW/);

const highScene = structuredClone(added.scene);
highScene.devices[0].config.interruptedLevel = 'HIGH';
const idf = generateEspIdfCodeResult(program, 'Barrera alta', highScene);
assert.equal(idf.diagnostics.some(item => item.severity === 'error'), false);
assert.match(idf.code, /capiInput\([^,]+, false\);/);
assert.match(idf.code, /capiDigitalRead\(PIN_[A-Z0-9_]+\) == 1/);

const project = makeProject('Barrera', added.scene, { blocks: { languageVersion: 0, blocks: [] } });
const decoded = decodeProject(JSON.parse(JSON.stringify(project)));
assert.ok(decoded.project);
assert.equal(decoded.project.scene.devices[0].kind, 'infraredBarrier');
assert.equal(decoded.project.scene.devices[0].config.interruptedLevel, 'LOW');

console.log('Infrared barrier: scene, typed value, JSON and both generators passed.');
