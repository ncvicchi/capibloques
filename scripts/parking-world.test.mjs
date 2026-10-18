import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { advanceParkingWorld, createParkingWorldState, parkingBindings, parkingSlots, parkingSpacePosition } from '../lib/parking-world.ts';
import { createSceneFromTemplate, createEmptyScene, appendTemplateToScene, addDeviceToScene, constrainSceneItemPosition, isSceneDefinition, validateScene } from '../lib/scene-model.ts';
import { examples, makeProject, decodeProject, expandProgramRoutines, validateProgramForScene, generateEsp32CodeResult, generateEspIdfCodeResult } from '../lib/capiblocks.ts';
import { registerBlocks, workspaceDevices, compileWorkspace } from '../lib/blockly-engine.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
import { normalizeWorkspaceTabs } from '../lib/workspace-tabs.ts';
import { findSceneOverlaps } from '../lib/scene-layout.ts';

const scene = createSceneFromTemplate('parking');
assert.equal(isSceneDefinition(scene), true);
assert.deepEqual(validateScene(scene).issues.filter(issue => issue.severity === 'error'), []);
assert.equal(Object.keys(parkingBindings(scene)).length, 6);
assert.deepEqual(findSceneOverlaps(scene), [], 'los lugares previstos no producen falsos avisos de superposición');
assert.throws(() => addDeviceToScene(scene, 'servo'), /dos lugares/);
assert.throws(() => addDeviceToScene(scene, 'infraredBarrier'), /cuatro/);
const gate = scene.devices[0];
assert.deepEqual(constrainSceneItemPosition(scene, gate, { x: 855, y: 430 }), gate.position, 'no sobrescribir un slot ocupado');
const appended = appendTemplateToScene(createEmptyScene(), 'parking');
assert.equal(appended.addedDeviceIds.length, 7);
assert.equal(appendTemplateToScene(scene, 'parking').addedDeviceIds.length, 0);
for (const invalid of [0, 6, 16, true, '8', null]) {
  const copy = structuredClone(scene); copy.canvas.parkingCapacity = invalid;
  assert.equal(isSceneDefinition(copy), false);
}
for (const capacity of [4, 8, 12]) {
  const copy = structuredClone(scene); copy.canvas.parkingCapacity = capacity;
  assert.equal(isSceneDefinition(copy), true);
  assert.equal(new Set(Array.from({ length: capacity }, (_, i) => JSON.stringify(parkingSpacePosition(capacity, i)))).size, capacity);
  let closed = createParkingWorldState(capacity);
  for (let i = 0; i < 90; i++) closed = advanceParkingWorld(closed, {}, 1000);
  assert.equal(closed.entries, 0);
  assert.ok(closed.cars.length <= 5 && closed.cars.every(car => car.y >= 455));
  assert.equal(closed.detectors.entryArrival, true, 'un auto detenido se detecta');
  // Deliberately bad program: entrance open, exit shut. No hidden capacity gate.
  let full = createParkingWorldState(capacity);
  for (let i = 0; i < 180; i++) full = advanceParkingWorld(full, { entryGate: 90 }, 1000);
  assert.equal(full.jammed, true, 'admitir sin lugar genera atasco');
  assert.ok(full.entries > capacity && full.cars.length <= capacity + 7);
  const admitted = full.entries;
  for (let i = 0; i < 100; i++) full = advanceParkingWorld(full, { entryGate: 0, exitGate: 90 }, 1000);
  assert.ok(full.exits > 0 && full.entries >= admitted, 'el atasco no congela salidas ni borra autos');
  assert.equal(full.jammed, false, 'liberar una plaza permite recuperarse');
}
const initial = createParkingWorldState();
assert.equal(advanceParkingWorld(initial, {}, 0), initial);
let a = initial, b = initial;
for (let i = 0; i < 300; i++) { a = advanceParkingWorld(a, { entryGate: 90, exitGate: 90 }, 16); b = advanceParkingWorld(b, { entryGate: 90, exitGate: 90 }, 16); }
assert.deepEqual(a, b, 'azar reproducible');
assert.deepEqual(initial, createParkingWorldState(), 'sin mutar el estado anterior');

registerBlocks(Blockly);
const programs = [];
for (const example of examples.filter(item => ['parking', 'parkingProcedures'].includes(item.id))) {
  const workspace = new Blockly.Workspace();
  workspaceDevices.set(workspace, example.scene.devices);
  Blockly.serialization.workspaces.load(structuredClone(example.workspace), workspace);
  const program = compileWorkspace(workspace); workspace.dispose();
  programs.push(program);
  assert.deepEqual(validateProgramForScene(program, example.scene).filter(issue => issue.severity === 'error'), []);
  assert.deepEqual(decodeProject(JSON.parse(JSON.stringify(makeProject(example.title, example.scene, example.workspace)))).project.workspace, example.workspace);
  const tabs = normalizeWorkspaceTabs(example.workspace).tabs;
  assert.equal(tabs.length, example.id === 'parking' ? 1 : 4);
  const roots = example.workspace.blocks.blocks.map(block => block.id);
  assert.deepEqual(tabs.flatMap(tab => tab.rootBlockIds).sort(), roots.sort());
  assert.equal(program.routines.length, example.id === 'parking' ? 0 : 5);
  for (const result of [generateEsp32CodeResult(program, example.title, example.scene), generateEspIdfCodeResult(program, example.title, example.scene)]) assert.deepEqual(result.diagnostics.filter(issue => issue.severity === 'error'), []);
  assert.ok(createCapiRules(program, example.scene, 'wemos-d1-r32').instructionCount > 0);
}
const semantic = value => {
  if (Array.isArray(value)) return value.filter(item => !(item?.op === 'wait' && item.ms === 0)).map(semantic);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'blockId').map(([key, item]) => [key, semantic(item)]));
  return value;
};
assert.deepEqual(semantic(expandProgramRoutines(programs[1]).threads[0].nodes), semantic(programs[0].threads[0].nodes), 'ambos ejemplos resuelven exactamente la misma lógica');
assert.equal(parkingSlots.length, 6);
console.log('Estacionamiento: slots, 4/8/12 plazas, colas, atasco/recuperación, determinismo, dos ejemplos completos, pestañas, JSON y generadores aprobados.');
