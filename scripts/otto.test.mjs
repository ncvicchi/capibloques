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
assert.deepEqual(decoded.project.scene.devices[0].config.centers, [90, 90, 90, 90, 90, 90]);

const legacyProject = JSON.parse(JSON.stringify(project));
const legacyOtto = legacyProject.scene.devices[0];
for (const pin of ['leftArm', 'rightArm', 'buzzer', 'trigger', 'echo', 'matrixDin', 'matrixClk', 'matrixCs']) delete legacyOtto.pins[pin];
legacyOtto.config.centers = legacyOtto.config.centers.slice(0, 4);
legacyOtto.config.reversed = legacyOtto.config.reversed.slice(0, 4);
delete legacyOtto.config.matrixBrightness;
const migrated = decodeProject(legacyProject);
assert.ok(migrated.project);
assert.deepEqual(migrated.project.scene.devices[0].config.centers, [90, 90, 90, 90, 90, 90]);
assert.equal(migrated.project.scene.devices[0].pins.buzzer, null);

const full = structuredClone(added.scene);
const expressive = full.devices[0];
expressive.config.profile = 'humanoid6-expressive';
Object.assign(expressive.pins, { leftLeg: 4, rightLeg: 13, leftFoot: 14, rightFoot: 16, leftArm: 17, rightArm: 18, buzzer: 19, trigger: 23, echo: 34, matrixDin: 25, matrixClk: 26, matrixCs: 27 });
assert.equal(getPinRequirements(expressive).length, 12);
const fullProgram = { version: 2, variables: [{ id: 'distance', name: 'distancia', type: 'number' }], threads: [{ id: 'start', startBlockId: 'start', nodes: [
  { op: 'otto', deviceId: expressive.id, action: 'MOONWALK_LEFT', speed: 80, repetitions: 2, blockId: 'dance' },
  { op: 'ottoSound', deviceId: expressive.id, sound: 'HAPPY', blockId: 'sound' },
  { op: 'ottoExpression', deviceId: expressive.id, expression: 'LOVE', blockId: 'face' },
  { op: 'ottoArms', deviceId: expressive.id, pose: 'UP', blockId: 'arms' },
  { op: 'variableSet', variableId: 'distance', value: { kind: 'ottoDistance', deviceId: expressive.id }, blockId: 'read' },
] }] };
assert.deepEqual(validateProgramForScene(fullProgram, full).filter(item => item.severity === 'error'), []);
for (const generated of [generateEsp32CodeResult(fullProgram, 'Otto completo', full), generateEspIdfCodeResult(fullProgram, 'Otto completo', full)]) {
  assert.equal(generated.diagnostics.some(item => item.severity === 'error'), false);
  assert.match(generated.code, /void ottoService/);
  assert.match(generated.code, /void ottoExpression/);
  assert.match(generated.code, /void ottoArms/);
  assert.match(generated.code, /distanceCm/);
}
console.log('Familia Otto: cinco perfiles, movimientos, sonido, distancia, expresiones, brazos, JSON y ambos generadores pasaron.');
