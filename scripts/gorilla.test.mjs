import assert from 'node:assert/strict';
import * as B from 'blockly';
import {
  gorillaSettings,
  validGorillaSettings,
  gorillaTargets,
  gorillaMove,
  advanceGorilla,
  validGorillaPostures,
  referencePosture,
  gorillaPostureTargets,
} from '../lib/gorilla-model.ts';
import {
  examples,
  makeProject,
  decodeProject,
  validateProgramForScene,
  generateEsp32CodeResult,
  generateEspIdfCodeResult,
  compileTaskGraph,
} from '../lib/capiblocks.ts';
import {
  registerBlocks,
  workspaceDevices,
  compileWorkspace,
} from '../lib/blockly-engine.ts';
import {
  validateScene,
  isSceneDefinition,
  addDeviceToScene,
} from '../lib/scene-model.ts';
import { createCapiRules, parseCapiRules } from '../lib/capi-rules.ts';
import { normalizeWorkspaceTabs } from '../lib/workspace-tabs.ts';
const s = gorillaSettings();
assert.ok(validGorillaSettings(s));
for (const bad of [
  { ...s, channel1: 0 },
  { ...s, center0: 200 },
  { ...s, min0: 95 },
  { ...s, max0: 80 },
  { ...s, reversed0: 1 },
  { ...s, extra: 0 },
  { ...s, address: true },
])
  assert.ok(!validGorillaSettings(bad));
const zero = Array(8).fill(0);
assert.deepEqual(
  gorillaTargets(s, zero, 0, 10, -10, true),
  [10, -10, 0, 0, 0, 0, 0, 0],
);
assert.equal(gorillaTargets(s, zero, 8, 0, 0, false), null);
assert.equal(gorillaTargets({ ...s, min0: 85 }, zero, 0, -10, 0, false), null);
assert.equal(
  gorillaTargets({ ...s, max0: 95, reversed0: true }, zero, 0, -10, 0, false),
  null,
);
const job = gorillaMove(zero, [20, 0, 0, 0, 0, 0, 0, 0], 200, 1);
assert.ok(job.duration >= 666);
assert.equal(advanceGorilla(job, job.duration).angles[0], 20);
assert.deepEqual(advanceGorilla(job, 0).angles, zero);
assert.ok(validGorillaPostures([referencePosture()], s));
for (const bad of [
  [{ ...referencePosture(), angles: [0] }],
  [referencePosture(), referencePosture()],
  [{ ...referencePosture(), name: '' }],
  [{ ...referencePosture(), angles: [0, 0, 0, 0, 0, 0, 0, 21] }],
  [{ ...referencePosture(), extra: true }],
])
  assert.ok(!validGorillaPostures(bad, s));
assert.equal(
  gorillaPostureTargets({ ...s, min7: 85 }, [0, 0, 0, 0, 0, 0, 0, -10]),
  null,
);
registerBlocks(B);
for (const e of examples.filter((e) => e.id.startsWith('gorilla'))) {
  assert.ok(isSceneDefinition(e.scene));
  assert.equal(validateScene(e.scene).valid, true);
  assert.deepEqual(normalizeWorkspaceTabs(e.workspace), e.workspace.capiTabs);
  const ws = new B.Workspace();
  workspaceDevices.set(ws, e.scene.devices);
  B.serialization.workspaces.load(structuredClone(e.workspace), ws);
  const p = compileWorkspace(ws);
  ws.dispose();
  assert.deepEqual(
    validateProgramForScene(p, e.scene).filter((i) => i.severity === 'error'),
    [],
  );
  assert.ok(
    compileTaskGraph(p).some((t) => t.output.some((n) => n.op === 'gorilla')),
  );
  assert.ok(
    decodeProject(
      JSON.parse(JSON.stringify(makeProject(e.title, e.scene, e.workspace))),
    ).project,
  );
  assert.throws(
    () => createCapiRules(p, e.scene, 'wemos-d1-r32'),
    /calibración/,
  );
  assert.throws(() => addDeviceToScene(e.scene, 'gorilla'));
  const scene = structuredClone(e.scene);
  scene.devices[0].config.settings.verified = true;
  if(scene.devices[0].config.kinematics)scene.devices[0].config.kinematics.verified=true;
  const rules = createCapiRules(p, scene, 'wemos-d1-r32');
  if(e.id.startsWith('gorillaTrajectories'))assert.ok(rules.requiredCapabilities.includes('gorilla-kinematics-v3'));
  assert.ok(rules.requiredCapabilities.includes('gorilla-bench'));
  assert.ok(
    parseCapiRules(rules.bytes).requiredCapabilities.includes('gorilla-bench'),
  );
  assert.equal(rules.resourceRequirements.pwmChannels, 0);
  for (const result of [
    generateEsp32CodeResult(p, e.title, scene),
    generateEspIdfCodeResult(p, e.title, scene),
  ]) {
    assert.deepEqual(
      result.diagnostics.filter((i) => i.severity === 'error'),
      [],
    );
    assert.match(result.code, /capiGorillaPrepare/);
    assert.match(result.code, /CAPI_GORILLA.start/);
    if (e.id.startsWith('gorillaPostures'))
      assert.match(result.code, /CAPI_GORILLA.posture/);
  }
  for (const result of [
    generateEsp32CodeResult(p, e.title, e.scene),
    generateEspIdfCodeResult(p, e.title, e.scene),
  ])
    assert.ok(result.diagnostics.some((i) => i.code === 'gorilla-calibration'));
  if (e.id.startsWith('gorillaPostures')) {
    assert.ok(rules.requiredCapabilities.includes('gorilla-postures'));
    const removed = structuredClone(scene);
    removed.devices[0].config.postures = [];
    assert.ok(
      validateProgramForScene(p, removed).some(
        (d) => d.code === 'gorilla-posture',
      ),
    );
    assert.throws(() => createCapiRules(p, removed, 'wemos-d1-r32'), /postura/);
  }
  const invalid = structuredClone(scene);
  invalid.devices[0].config.settings.channel2 = 0;
  assert.ok(!isSceneDefinition(invalid));
}
console.log(
  'GorillaBot: calibración estricta, límites, movimientos, dos workspaces, tabs, JSON, reglas y generadores aprobados.',
);
