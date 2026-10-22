import assert from 'node:assert/strict';
import * as B from 'blockly';
import {
  examples,
  compileTaskGraph,
  validateProgramForScene,
} from '../lib/capiblocks.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
import {
  registerBlocks,
  workspaceDevices,
  compileWorkspace,
} from '../lib/blockly-engine.ts';
let clock = 0,
  listener,
  tick,
  state;
Object.defineProperty(globalThis, 'performance', {
  configurable: true,
  value: { now: () => clock },
});
globalThis.self = {
  postMessage: (m) => {
    if (m.type === 'SNAPSHOT') state = structuredClone(m.state);
  },
  addEventListener: (_, f) => (listener = f),
};
globalThis.setInterval = (f) => {
  tick = f;
  return 1;
};
await import('../lib/simulator.worker.ts');
const send = (data) => listener({ data }),
  advance = (ms) => {
    clock += ms;
    tick();
  };
registerBlocks(B);
const programs = [];
for (const e of examples.filter((e) => e.id.startsWith('gorillaTrack'))) {
  const ws = new B.Workspace();
  workspaceDevices.set(ws, e.scene.devices);
  B.serialization.workspaces.load(structuredClone(e.workspace), ws);
  const program = compileWorkspace(ws);
  ws.dispose();
  programs.push(program);
  assert.deepEqual(
    validateProgramForScene(program, e.scene).filter(
      (d) => d.severity === 'error',
    ),
    [],
  );
  const checked = structuredClone(e.scene);
  checked.devices[0].config.settings.verified = true;
  checked.devices[0].config.kinematics.verified = true;
  assert.ok(
    createCapiRules(
      program,
      checked,
      'wemos-d1-r32',
    ).requiredCapabilities.includes('gorilla-gait'),
  );
  for (const speed of [1, 4]) {
    send({ type: 'LOAD', scene: e.scene, program });
    send({ type: 'SET_SPEED', speed });
    send({ type: 'RUN' });
    for (let n = 0; n < 200; n++) advance(20);
    send({ type: 'PAUSE' });
    const paused = state.gorillaWorld.x;
    for (let n = 0; n < 20; n++) advance(20);
    assert.equal(state.gorillaWorld.x, paused);
    send({ type: 'RUN' });
    let max = state.gorillaWorld.x;
    for (let n = 0; n < 16000 / speed && state.status !== 'done'; n++) {
      advance(20);
      max = Math.max(max, state.gorillaWorld.x);
    }
    assert.equal(state.status, 'done', JSON.stringify(state.console));
    assert.ok(max > 247 && max < 249, max);
    assert.ok(Math.abs(state.gorillaWorld.x - 120) < 0.01);
    assert.deepEqual(state.gorillaWorld.visited, ['base', 'A', 'base']);
    assert.ok(!state.devices['gorilla-robot'].values.error);
    send({ type: 'RESET' });
    assert.equal(state.gorillaWorld.x, 120);
    assert.deepEqual(state.gorillaWorld.visited, []);
    assert.equal(state.gorillaWorld.contacts, 0);
    send({ type: 'RUN' });
    for (let n = 0; n < 200; n++) advance(20);
    send({ type: 'STOP' });
    const held = structuredClone(state.gorillaWorld);
    for (let n = 0; n < 20; n++) advance(20);
    assert.equal(state.gorillaWorld.x, held.x);
  }
}
const clean = (program) =>
  compileTaskGraph(program)
    .filter((t) => t.initial)
    .flatMap((t) => t.output)
    .filter(
      (i) => !['jump', 'repeatStart', 'repeatNext', 'halt'].includes(i.op),
    )
    .map(({ blockId, ...i }) => i);
// Both examples are additionally executed end-to-end, not compared only by structure.
assert.equal(programs.length, 2);
const e = examples.find((e) => e.id === 'gorillaTrack'),
  scene = structuredClone(e.scene);
scene.devices[0].config.settings.verified = true;
scene.devices[0].config.kinematics.verified = true;
const turn = {
  version: 2,
  threads: [
    {
      id: 'main',
      startBlockId: 's',
      nodes: [
        {
          op: 'gorilla',
          deviceId: 'gorilla-robot',
          action: 'gait',
          index: 2,
          a: 4,
          b: 2,
          durationMs: 500,
          blockId: 'turn',
        },
      ],
    },
  ],
};
assert.throws(
  () => createCapiRules(turn, scene, 'wemos-d1-r32'),
  /giro físico/,
);
scene.devices[0].config.gait.turnsVerified = true;
assert.ok(createCapiRules(turn, scene, 'wemos-d1-r32'));
assert.ok(clean(programs[0]).length > 0);
console.log(
  'Gorilla60 worker: dos workspaces completos, 1×/4×, pausa, ida/estación/regreso, STOP/RESET y guardas de giro aprobados.',
);
