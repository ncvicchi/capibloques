import assert from 'node:assert/strict';
import * as B from 'blockly';
import {
  linePreset,
  validLineCircuit,
  lineAt,
  lineSensorPoints,
  createLineWorld,
  advanceLineWorld,
} from '../lib/line-world.ts';
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
  isSceneDefinition,
  validateScene,
} from '../lib/scene-model.ts';
import {
  registerBlocks,
  workspaceDevices,
  compileWorkspace,
} from '../lib/blockly-engine.ts';
import { createCapiRules, parseCapiRules } from '../lib/capi-rules.ts';
for (const id of ['straight', 'oval', 'bends', 'snake'])
  assert.ok(validLineCircuit(linePreset(id)), id);
const oval = linePreset('oval');
assert.ok(lineAt(oval, { x: 400, y: 390 }));
assert.ok(!lineAt(oval, { x: 400, y: 300 }));
assert.deepEqual(lineSensorPoints(100, 100, 0), [
  { x: 120, y: 86 },
  { x: 120, y: 100 },
  { x: 120, y: 114 },
]);
const straight = linePreset('straight'),
  w = createLineWorld({ x: 300, y: 390 });
assert.equal(Math.round(advanceLineWorld(w, straight, 40, 40, 1000).x), 340);
assert.equal(Math.round(advanceLineWorld(w, straight, -40, -40, 1000).x), 260);
assert.ok(advanceLineWorld(w, straight, -40, 40, 1000).angle > 250);
assert.ok(
  !advanceLineWorld(w, { width: 16, strokes: [] }, 0, 0, 0).center,
  'no lectura conservada sin línea',
);
const edge = advanceLineWorld(
  createLineWorld({ x: 918, y: 390 }),
  straight,
  40,
  40,
  100,
);
assert.equal(edge.x, 918);
assert.ok(edge.contact);
const back = advanceLineWorld(edge, straight, -40, -40, 100);
assert.ok(back.x < 918 && !back.contact);
assert.equal(advanceLineWorld(w, oval, 40, 40, 0).x, w.x);
assert.deepEqual(
  advanceLineWorld(w, oval, 12, 44, 1000),
  advanceLineWorld(w, oval, 12, 44, 1000),
);
for (const bad of [
  { width: 11, strokes: [] },
  {
    width: 16,
    strokes: [
      [
        { x: 20, y: 30 },
        { x: 80, y: 90 },
      ],
    ],
  },
  { width: 16, strokes: [], extra: 1 },
])
  assert.equal(validLineCircuit(bad), false);
registerBlocks(B);
for (const e of examples.filter((e) => e.id.startsWith('lineTrack'))) {
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
  assert.ok(rules.requiredCapabilities.includes('robot-wheels'));
  assert.ok(rules.requiredCapabilities.includes('line-sensors'));
  assert.ok(
    parseCapiRules(rules.bytes).requiredCapabilities.includes('line-sensors'),
  );
  for (const out of [
    generateEsp32CodeResult(p, e.title, e.scene),
    generateEspIdfCodeResult(p, e.title, e.scene),
  ]) {
    assert.deepEqual(
      out.diagnostics.filter((i) => i.severity === 'error'),
      [],
    );
    assert.match(out.code, /driveRobot/);
    assert.ok(
      /(?:digitalRead|capiDigitalRead)\(PIN_.*LEFT/.test(out.code),
      'falta lectura reflectiva izquierda',
    );
  }
}
console.log(
  'Línea: geometría única, 3 sensores, contacto, JSON, dos ejemplos, generadores y reglas aprobados.',
);
