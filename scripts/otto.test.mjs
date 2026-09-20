import assert from 'node:assert/strict';
import { decodeProject, generateEsp32CodeResult, generateEspIdfCodeResult, makeProject, validateProgramForScene } from '../lib/capiblocks.ts';
import { addDeviceToScene, createEmptyScene, getPinRequirements, validateScene } from '../lib/scene-model.ts';

const added = addDeviceToScene(createEmptyScene('Otto básico'), 'otto');
const otto = added.scene.devices[0];
assert.equal(otto.kind, 'otto');
Object.assign(otto.pins, { leftLeg: 13, rightLeg: 14, leftFoot: 16, rightFoot: 17 });
assert.equal(getPinRequirements(otto).length, 4);
assert.equal(validateScene(added.scene).valid, true);

const program = { version: 2, variables: [], threads: [{ id: 'start', startBlockId: 'start', nodes: [
  { op: 'otto', deviceId: otto.id, action: 'WALK_FORWARD', speed: 60, repetitions: 2, blockId: 'walk' },
  { op: 'otto', deviceId: otto.id, action: 'HOME', speed: 0, repetitions: 1, blockId: 'home' },
] }] };
assert.deepEqual(validateProgramForScene(program, added.scene).filter(item => item.severity === 'error'), []);

for (const generated of [
  generateEsp32CodeResult(program, 'Otto', added.scene),
  generateEspIdfCodeResult(program, 'Otto', added.scene),
]) {
  assert.equal(generated.diagnostics.some(item => item.severity === 'error'), false);
  assert.match(generated.code, /struct OttoDevice/);
  assert.match(generated.code, /void ottoMove/);
  assert.match(generated.code, /ottoHome\(DEV_/);
  assert.match(generated.code, /owner != 0/);
}

const project = makeProject('Otto básico', added.scene, { blocks: { languageVersion: 0, blocks: [] } });
const decoded = decodeProject(JSON.parse(JSON.stringify(project)));
assert.ok(decoded.project);
assert.equal(decoded.project.scene.devices[0].kind, 'otto');
assert.deepEqual(decoded.project.scene.devices[0].config.centers, [90, 90, 90, 90]);
console.log('Otto básico: escena, calibración, JSON y ambos generadores pasaron.');
