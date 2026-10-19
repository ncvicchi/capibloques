import assert from 'node:assert/strict';
import * as B from 'blockly';
import {
  advancePondWorld,
  createPondWorld,
  defaultPondEnvironment,
  validPondEnvironment,
  waterDistance,
} from '../lib/pond-world.ts';
import {
  examples,
  makeProject,
  decodeProject,
  validateProgramForScene,
  generateEsp32CodeResult,
  generateEspIdfCodeResult,
} from '../lib/capiblocks.ts';
import {
  registerBlocks,
  workspaceDevices,
  compileWorkspace,
} from '../lib/blockly-engine.ts';
import {
  isSceneDefinition,
  validateScene,
  addDeviceToScene,
  constrainSceneItemPosition,
  removeDeviceFromScene,
} from '../lib/scene-model.ts';
import { normalizeWorkspaceTabs } from '../lib/workspace-tabs.ts';
import { createCapiRules, parseCapiRules } from '../lib/capi-rules.ts';
assert.ok(validPondEnvironment(defaultPondEnvironment));
for (const bad of [
  { ...defaultPondEnvironment, rain: 5 },
  { ...defaultPondEnvironment, lagoon: NaN },
  { ...defaultPondEnvironment, reserve: true },
  { ...defaultPondEnvironment, extra: 0 },
])
  assert.ok(!validPondEnvironment(bad));
const env = { lagoon: 35, reserve: 240, evaporation: 0, leak: 0, rain: 0 };
const start = createPondWorld(env),
  end = advancePondWorld(start, 100, 0, 2000);
assert.equal(end.lagoon.toFixed(4), '39.0000');
assert.equal(end.reserve.toFixed(4), '236.0000');
assert.equal(start.lagoon, 35);
assert.equal(waterDistance(40, 100), 80);
assert.equal(waterDistance(70, 100), 50);
assert.deepEqual(
  advancePondWorld(start, 100, 0, 1000),
  advancePondWorld(start, 100, 0, 1000),
);
let w = createPondWorld({ ...env, lagoon: 99, reserve: 1 });
w = advancePondWorld(w, 100, 0, 2000);
assert.ok(w.dryPump);
assert.equal(w.transferred.toFixed(4), '1.0000');
assert.ok(w.reserve >= 0);
w = createPondWorld({ ...env, lagoon: 99, rain: 4 });
w = advancePondWorld(w, 0, 0, 1000);
assert.ok(w.spilled > 2.9 && w.wetness === 100);
assert.equal(w.lagoon, 100);
w.environment.rain = 0;
for (let i = 0; i < 8; i++) w = advancePondWorld(w, 0, 0, 2000);
assert.equal(w.wetness, 0);
w = createPondWorld({ ...env, lagoon: 2, leak: 4 });
w = advancePondWorld(w, 0, 90, 2000);
assert.ok(w.lagoon >= 0);
assert.equal(w.gateAngle, 90);
assert.ok(
  Math.abs(2 - w.lagoon - w.drained - w.leaked - w.evaporated - w.spilled) <
    1e-8,
);
w = createPondWorld({ ...env, rain: 3, leak: 1, evaporation: 0.1 });
for (let i = 0; i < 80; i++) w = advancePondWorld(w, 100, 45, 1000);
assert.ok(
  Math.abs(
    275 +
      w.rainfall +
      w.recharged -
      w.reserve -
      w.lagoon -
      w.drained -
      w.leaked -
      w.evaporated -
      w.spilled,
  ) < 1e-7,
);
w.pendingRefill = true;
const old = w.reserve;
w = advancePondWorld(w, 0, 0, 100);
assert.ok(Math.abs(w.recharged - (300 - old)) < 1e-7);
assert.equal(w.reserve, 300);
registerBlocks(B);
for (const e of examples.filter((e) => e.id.startsWith('pondLab'))) {
  assert.deepEqual(normalizeWorkspaceTabs(e.workspace), e.workspace.capiTabs);
  for(const v of e.workspace.variables??[])assert.ok(v.name.length<=32);

  assert.ok(isSceneDefinition(e.scene));
  assert.deepEqual(
    validateScene(e.scene).issues.filter((i) => i.severity === 'error'),
    [],
  );
  const ws = new B.Workspace();
  workspaceDevices.set(ws, e.scene.devices);
  B.serialization.workspaces.load(structuredClone(e.workspace), ws);
  const p = compileWorkspace(ws);
  ws.dispose();
  assert.deepEqual(
    validateProgramForScene(p, e.scene).filter((i) => i.severity === 'error'),
    [],
  );
  assert.deepEqual(
    decodeProject(
      JSON.parse(JSON.stringify(makeProject(e.title, e.scene, e.workspace))),
    ).project.scene,
    e.scene,
  );
  const rules = createCapiRules(p, e.scene, 'wemos-d1-r32');
  assert.ok(parseCapiRules(rules.bytes));
  for (const result of [
    generateEsp32CodeResult(p, e.title, e.scene),
    generateEspIdfCodeResult(p, e.title, e.scene),
  ])
    assert.deepEqual(
      result.diagnostics.filter((i) => i.severity === 'error'),
      [],
    );
  assert.throws(() => addDeviceToScene(e.scene, 'distanceSensor'));
  const swapped = constrainSceneItemPosition(
    e.scene,
    { id: 'pond-lagoonSensor', kind: 'distanceSensor' },
    { x: 210, y: 145 },
  );
  assert.deepEqual(swapped, { x: 640, y: 185 });
  const missing = removeDeviceFromScene(e.scene, 'pond-reserveSensor');
  assert.ok(!missing.devices.some((d) => d.id === 'pond-reserveSensor'));
  assert.ok(
    validateScene(missing).issues.some(
      (i) => i.code === 'pond-layout' && i.severity === 'warning',
    ),
  );
  const extra = structuredClone(e.scene);
  extra.canvas.pondEnvironment.extra = 1;
  assert.ok(!isSceneDefinition(extra));
}
console.log(
  'Laguna: balance, límites, secado, recarga, slots, JSON, ejemplos, reglas y generadores aprobados.',
);
