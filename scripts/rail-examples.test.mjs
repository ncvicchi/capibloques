import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { examples, decodeProject, makeProject, expandProgramRoutines, validateProgramForScene, generateEsp32CodeResult, generateEspIdfCodeResult } from '../lib/capiblocks.ts';
import { registerBlocks, workspaceDevices, compileWorkspace } from '../lib/blockly-engine.ts';
import { normalizeWorkspaceTabs } from '../lib/workspace-tabs.ts';
import { createCapiRules } from '../lib/capi-rules.ts';

registerBlocks(Blockly);
const direct = examples.find(item => item.id === 'railCrossing');
const modular = examples.find(item => item.id === 'railCrossingProcedures');
assert.ok(direct && modular);
assert.deepEqual(modular.scene, direct.scene, 'misma escena y conexiones');
const decoded = decodeProject(JSON.parse(JSON.stringify(makeProject(modular.title, modular.scene, modular.workspace))));
assert.ok(decoded.project);
assert.deepEqual(decoded.project.workspace, modular.workspace, 'JSON conserva tareas y pestañas');
const tabs = normalizeWorkspaceTabs(decoded.project.workspace).tabs;
assert.deepEqual(tabs.map(tab => tab.name), ['Principal', 'Control del cruce', 'Barreras', 'Avisos', 'Detectores']);
const roots = modular.workspace.blocks.blocks;
assert.equal(roots.filter(block => block.type === 'capi_start').length, 1);
assert.deepEqual(tabs.flatMap(tab => tab.rootBlockIds).sort(), roots.map(block => block.id).sort(), 'cada raíz tiene una sola pestaña');
assert.equal(roots.filter(block => block.type === 'capi_procedure_def').length, 9);
assert.ok(tabs.slice(1).every(tab => tab.rootBlockIds.every(id => roots.find(root => root.id === id).type === 'capi_procedure_def')));
const compile = example => {
  const workspace = new Blockly.Workspace();
  workspaceDevices.set(workspace, example.scene.devices);
  Blockly.serialization.workspaces.load(structuredClone(example.workspace), workspace);
  const program = compileWorkspace(workspace);
  workspace.dispose();
  assert.deepEqual(validateProgramForScene(program, example.scene).filter(item => item.severity === 'error'), []);
  return program;
};
const directProgram = compile(direct);
const modularProgram = compile(modular);
assert.equal(directProgram.routines.length, 0, 'el original permanece directo');
assert.equal(modularProgram.routines.length, 9);
for (const name of ['Vía ocupada', 'Vía libre']) {
  const routine = modularProgram.routines.find(item => item.name === name);
  assert.ok(routine && routine.body.every(node => node.op === 'procedureCall'), 'las tareas globales llaman a tareas pequeñas');
}
// Ignorar sólo las marcas de navegación (esperas de 0 ms) y los IDs visuales.
const semantic = value => {
  if (Array.isArray(value)) return value.filter(item => !(item.op === 'wait' && item.ms === 0)).map(semantic);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'blockId').map(([key, item]) => [key, semantic(item)]));
  return value;
};
assert.deepEqual(semantic(expandProgramRoutines(modularProgram).threads[0].nodes), semantic(directProgram.threads[0].nodes), 'misma lógica, orden y tiempos al expandir las tareas');
for (const generated of [generateEsp32CodeResult(modularProgram, modular.title, modular.scene), generateEspIdfCodeResult(modularProgram, modular.title, modular.scene)]) {
  assert.deepEqual(generated.diagnostics.filter(item => item.severity === 'error'), []);
}
assert.ok(createCapiRules(modularProgram, modular.scene, 'wemos-d1-r32').instructionCount > 0);
console.log('Ejemplos del tren: original conservado, 9 tareas anidadas, 5 pestañas, JSON, equivalencia, generadores y reglas aprobados.');
