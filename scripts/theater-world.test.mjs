import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import {
  createTheaterWorldState,
  advanceTheaterWorld,
  defaultTheaterEnvironment,
  validTheaterEnvironment,
  theaterHasDistance,
} from '../lib/theater-world.ts';
import {
  examples,
  makeProject,
  decodeProject,
  validateProgramForScene,
  generateEsp32CodeResult,
  generateEspIdfCodeResult,
} from '../lib/capiblocks.ts';
import {
  createSceneFromTemplate,
  createEmptyScene,
  appendTemplateToScene,
  addDeviceToScene,
  validateScene,
  isSceneDefinition,
} from '../lib/scene-model.ts';
import {
  registerBlocks,
  workspaceDevices,
  compileWorkspace,
} from '../lib/blockly-engine.ts';
import { normalizeWorkspaceTabs } from '../lib/workspace-tabs.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
const run = (w, seconds) => {
  for (let i = 0; i < seconds * 10; i++) w = advanceTheaterWorld(w, 100);
  return w;
};
const initial = createTheaterWorldState(),
  copy = structuredClone(initial);
let w = run(initial, 10);
assert.equal(w.phase, 'watching');
assert.ok(w.count >= 1 && w.count <= 4);
assert.equal(w.distance, 35);
w = run(w, 50);
assert.ok(w.groups >= 2);
assert.deepEqual(initial, copy);
assert.deepEqual(run(initial, 300), run(initial, 300));
let manual = createTheaterWorldState({
  ...defaultTheaterEnvironment,
  automaticArrivals: false,
});
manual.pendingArrival = true;
manual = run(manual, 8);
assert.equal(manual.phase, 'watching');
assert.equal(manual.requestMs, 0);
manual.pendingRequest = true;
manual = advanceTheaterWorld(manual, 100);
assert.ok(manual.requestMs > 0);
manual = run(manual, 2);
assert.equal(manual.requestMs, 0);
manual.pendingDeparture = true;
manual = run(manual, 6);
assert.equal(manual.phase, 'empty');
assert.equal(manual.distance, 400);
for (const bad of [
  null,
  {},
  { ...defaultTheaterEnvironment, count: 5 },
  { ...defaultTheaterEnvironment, count: 1.5 },
  { ...defaultTheaterEnvironment, distance: NaN },
  { ...defaultTheaterEnvironment, staySeconds: 1 },
  { ...defaultTheaterEnvironment, extra: 1 },
])
  assert.equal(validTheaterEnvironment(bad), false);
let nextGroup = createTheaterWorldState({
  ...defaultTheaterEnvironment,
  automaticArrivals: false,
});
nextGroup.pendingArrival = true;
nextGroup = run(nextGroup, 1);
nextGroup.environment.distance = 90;
nextGroup.environment.staySeconds = 12;
nextGroup = run(nextGroup, 4);
assert.equal(
  nextGroup.distance,
  35,
  'configurar el próximo grupo no mueve al actual',
);
assert.ok(nextGroup.remainingMs > 20000, 'el actual conserva su permanencia');
const scene = createSceneFromTemplate('ottoTheater');
assert.equal(isSceneDefinition(scene), true);
assert.deepEqual(
  validateScene(scene).issues.filter((i) => i.severity === 'error'),
  [],
);
assert.throws(() => addDeviceToScene(scene, 'otto'));
assert.equal(
  isSceneDefinition(
    appendTemplateToScene(createEmptyScene(), 'ottoTheater').scene,
  ),
  true,
);
assert.equal(theaterHasDistance(scene), true);
const plain = structuredClone(scene);
plain.devices[0].config.profile = 'biped4';
assert.equal(theaterHasDistance(plain), false);
registerBlocks(Blockly);
for (const e of examples.filter((e) => e.id.startsWith('ottoTheater'))) {
  const ws = new Blockly.Workspace();
  workspaceDevices.set(ws, e.scene.devices);
  Blockly.serialization.workspaces.load(structuredClone(e.workspace), ws);
  const p = compileWorkspace(ws);
  ws.dispose();
  assert.deepEqual(
    validateProgramForScene(p, e.scene).filter((i) => i.severity === 'error'),
    [],
  );
  assert.equal(
    normalizeWorkspaceTabs(e.workspace).tabs.length,
    e.id === 'ottoTheater' ? 1 : 4,
  );
  assert.deepEqual(
    decodeProject(
      JSON.parse(JSON.stringify(makeProject(e.title, e.scene, e.workspace))),
    ).project.workspace,
    e.workspace,
  );
  for (const r of [
    generateEsp32CodeResult(p, e.title, e.scene),
    generateEspIdfCodeResult(p, e.title, e.scene),
  ]) {
    assert.deepEqual(
      r.diagnostics.filter((i) => i.severity === 'error'),
      [],
    );
    assert.match(r.code, /turns.try_acquire/);
  }
  assert.ok(createCapiRules(p, e.scene, 'wemos-d1-r32').instructionCount > 0);
}
console.log(
  'Teatro: público acotado, peticiones, retirada, perfiles, JSON, dos workspaces/generadores/reglas aprobados.',
);

await import('node:child_process').then(({ execFileSync }) =>
  execFileSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/theater-worker.test.mjs'],
    { stdio: 'inherit' },
  ),
);
