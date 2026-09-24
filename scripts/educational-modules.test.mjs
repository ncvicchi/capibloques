import assert from 'node:assert/strict';
import { componentValueCapabilities } from '../lib/component-capabilities.ts';
import { educationalModuleKinds, educationalModuleSpecs } from '../lib/educational-modules.ts';
import { decodeProject, generateEsp32CodeResult, generateEspIdfCodeResult, makeProject, normalizeCompiledProgram, validateProgramForScene } from '../lib/capiblocks.ts';
import { addDeviceToScene, assignSafePins, createEmptyScene, isSceneDefinition, validateScene } from '../lib/scene-model.ts';

let scene = createEmptyScene('Laboratorio de módulos');
for (const kind of educationalModuleKinds) {
  const result = addDeviceToScene(scene, kind);
  scene = result.scene;
  const spec = educationalModuleSpecs[kind];
  assert.equal(result.device.kind, kind);
  assert.equal(componentValueCapabilities(result.device).length, spec.values.length);
  assert.deepEqual(Object.keys(result.device.config.values), spec.values.map(value => value.key));
  assert.equal(isSceneDefinition(JSON.parse(JSON.stringify(scene))), true, `JSON inválido al agregar ${kind}`);
}
assert.equal(validateScene(scene).valid, true);
const decoded = decodeProject(JSON.parse(JSON.stringify(makeProject('Módulos', scene, { blocks: { languageVersion: 0, blocks: [] } }))));
assert.ok(decoded.project, JSON.stringify(decoded.diagnostics));
assert.equal(decoded.project.scene.devices.length, educationalModuleKinds.length);

for (const phase of [38, 39, 40, 41]) {
  let phaseScene = createEmptyScene(`Fase ${phase}`);
  const representative = educationalModuleKinds.find(item => educationalModuleSpecs[item].phase === phase);
  phaseScene = addDeviceToScene(phaseScene, representative).scene;
  phaseScene = assignSafePins(phaseScene).scene;
  const device = phaseScene.devices[0];
  const capability = componentValueCapabilities(device)[0];
  const literal = capability.type === 'text' ? {kind:'text',value:''} : capability.type === 'boolean' ? {kind:'boolean',value:false} : {kind:'number',value:0};
  const actions = device.kind === 'stepper' ? [{op:'stepper',deviceId:device.id,steps:120,speed:300,blockId:'move'}] : [];
  const program = normalizeCompiledProgram({ version:2, threads:[{ id:'main', startBlockId:'start', nodes:[...actions,{ op:'if', blockId:'compare', condition:{ kind:'valueCompare', operator:'EQ', left:{ kind:'componentValue', deviceId:device.id, property:capability.key, valueType:capability.type, source:capability.source }, right:literal }, consequent:[], otherwise:[] }] }] }, phaseScene);
  assert.deepEqual(validateProgramForScene(program, phaseScene).filter(item => item.severity === 'error'), []);
  for (const generated of [generateEsp32CodeResult(program, `Fase ${phase}`, phaseScene), generateEspIdfCodeResult(program, `Fase ${phase}`, phaseScene)]) {
    assert.deepEqual(generated.diagnostics.filter(item => item.severity === 'error'), []);
    assert.match(generated.code, /STATE_/);
    if (device.kind === 'stepper') assert.match(generated.code, /capiStepperMove_/);
  }
}
console.log('Fases 38–41: catálogo, escena, JSON, valores y generadores OK.');
