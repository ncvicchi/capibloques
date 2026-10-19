import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { createGardenWorldState, advanceGardenWorld, defaultGardenEnvironment, validGardenEnvironment, gardenBindings } from '../lib/garden-world.ts';
import { createSceneFromTemplate, createEmptyScene, appendTemplateToScene, isSceneDefinition, validateScene, addDeviceToScene } from '../lib/scene-model.ts';
import { examples, makeProject, decodeProject, generateEsp32CodeResult, generateEspIdfCodeResult, validateProgramForScene } from '../lib/capiblocks.ts';
import { registerBlocks, workspaceDevices, compileWorkspace } from '../lib/blockly-engine.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
import { normalizeWorkspaceTabs } from '../lib/workspace-tabs.ts';
import { findSceneOverlaps } from '../lib/scene-layout.ts';

const run = (state, targets, seconds) => { for (let i = 0; i < seconds; i++) state = advanceGardenWorld(state, targets, 1000); return state; };
const initial = createGardenWorldState();
const dry = run(initial, {}, 90);
assert.ok(dry.outside.moisture < 25 && dry.outside.health < 70 && dry.outside.cause === 'dry');
const wet = run(initial, { outsidePower: 100 }, 35);
assert.equal(wet.outside.cause, 'wet');
assert.ok(wet.outside.moisture > 85 && wet.inside.moisture < initial.inside.moisture, 'un riego no modifica el otro cantero');
const rainy = run(createGardenWorldState({ ...defaultGardenEnvironment, rain: true }), {}, 20);
assert.ok(rainy.outside.moisture > 70 && rainy.inside.moisture < 55, 'la lluvia no atraviesa el techo');
const hot = run(createGardenWorldState({ ...defaultGardenEnvironment, sun: 'strong', outsideTemperature: 30 }), {}, 60);
const ventilated = run(hot, { windowAngle: 90 }, 60);
assert.ok(hot.temperature - ventilated.temperature > 10);
assert.ok(ventilated.temperature >= ventilated.outsideTemperature, 'ventilar no enfría debajo del exterior');
const recovery = createGardenWorldState(); recovery.outside.health = 20;
assert.ok(run(recovery, { outsidePower: 25 }, 70).outside.health >= 70, 'las plantas pueden recuperarse');
let a = createGardenWorldState({ ...defaultGardenEnvironment, changingWeather: true }), b = structuredClone(a);
for (let i = 0; i < 180; i++) { a = advanceGardenWorld(a, {}, 1000); b = advanceGardenWorld(b, {}, 1000); }
assert.deepEqual(a, b);
assert.deepEqual(initial, createGardenWorldState(), 'modelo puro');
assert.equal(advanceGardenWorld(initial, {}, 0), initial);
for (const invalid of [null, {}, { ...defaultGardenEnvironment, sun: 'night' }, { ...defaultGardenEnvironment, rain: 1 }, { ...defaultGardenEnvironment, outsideTemperature: true }, { ...defaultGardenEnvironment, outsideTemperature: 80 }, { ...defaultGardenEnvironment, extra: 1 }]) assert.equal(validGardenEnvironment(invalid), false);

const scene = createSceneFromTemplate('greenhouse');
assert.equal(isSceneDefinition(scene), true);
assert.deepEqual(validateScene(scene).issues.filter(issue => issue.severity === 'error'), []);
assert.deepEqual(findSceneOverlaps(scene), []);
assert.equal(Object.keys(gardenBindings(scene)).length, 7);
assert.throws(() => addDeviceToScene(scene, 'soilMoisture'), /ocupados/);
assert.throws(() => addDeviceToScene(scene, 'servo'), /ocupados/);
assert.equal(appendTemplateToScene(createEmptyScene(), 'greenhouse').addedDeviceIds.length, 8);
assert.equal(appendTemplateToScene(scene, 'greenhouse').addedDeviceIds.length, 0);
registerBlocks(Blockly);
for (const example of examples.filter(item => item.id.startsWith('greenhouse'))) {
  const workspace = new Blockly.Workspace(); workspaceDevices.set(workspace, example.scene.devices);
  Blockly.serialization.workspaces.load(structuredClone(example.workspace), workspace);
  const program = compileWorkspace(workspace); workspace.dispose();
  assert.deepEqual(validateProgramForScene(program, example.scene).filter(issue => issue.severity === 'error'), []);
  assert.deepEqual(decodeProject(JSON.parse(JSON.stringify(makeProject(example.title, example.scene, example.workspace)))).project.workspace, example.workspace);
  assert.equal(program.routines.length, example.id === 'greenhouse' ? 0 : 6);
  const tabs = normalizeWorkspaceTabs(example.workspace).tabs;
  assert.equal(tabs.length, example.id === 'greenhouse' ? 1 : 4);
  assert.deepEqual(tabs.flatMap(tab => tab.rootBlockIds).sort(), example.workspace.blocks.blocks.map(block => block.id).sort());
  for (const result of [generateEsp32CodeResult(program, example.title, example.scene), generateEspIdfCodeResult(program, example.title, example.scene)]) assert.deepEqual(result.diagnostics.filter(issue => issue.severity === 'error'), []);
  assert.ok(createCapiRules(program, example.scene, 'wemos-d1-r32').instructionCount > 0);
}
console.log('Huerta: sequedad, exceso de agua, lluvia, calor, ventilación, recuperación, clima reproducible, slots y dos ejemplos/JSON/reglas aprobados.');
