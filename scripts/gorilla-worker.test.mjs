import assert from 'node:assert/strict';
import * as B from 'blockly';
import { examples } from '../lib/capiblocks.ts';
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
for (const e of examples.filter((e) => e.id.startsWith('gorillaBench'))) {
  const ws = new B.Workspace();
  workspaceDevices.set(ws, e.scene.devices);
  B.serialization.workspaces.load(structuredClone(e.workspace), ws);
  const program = compileWorkspace(ws);
  ws.dispose();
  for (const speed of [1, 4]) {
    send({ type: 'LOAD', scene: e.scene, program });
    send({ type: 'SET_SPEED', speed });
    send({ type: 'RUN' });
    let positive = false,
      negative = false;
    for (let i = 0; i < 1300 / speed; i++) {
      advance(20);
      const v = state.devices['gorilla-robot'].values;
      positive ||= v.j0 > 5;
      negative ||= v.j0 < -5;
      for (let j = 2; j < 8; j++) assert.equal(v[`j${j}`], 0);
      if (e.id === 'gorillaBench') assert.equal(v.j1, 0);
    }
    assert.ok(
      positive && negative,
      JSON.stringify({ id: e.id, state, log: state.console.slice(-5) }),
    );
    assert.equal(state.status, 'done');
    assert.equal(state.devices['gorilla-robot'].values.j0, 0);
    send({ type: 'RESET' });
    assert.equal(state.devices['gorilla-robot'].values.ready, false);
    assert.equal(state.devices['gorilla-robot'].values.moving, false);
  }
  const action = {
    op: 'gorilla',
    deviceId: 'gorilla-robot',
    action: 'joint',
    index: 0,
    a: 10,
    b: 0,
    durationMs: 1000,
    blockId: 'test-move',
  };
  const custom = (nodes) => ({
    version: 2,
    threads: [{ id: 'main', startBlockId: 's', nodes }],
  });
  send({ type: 'LOAD', scene: e.scene, program: custom([action]) });
  send({ type: 'RUN' });
  for (let i = 0; i < 20; i++) advance(20);
  assert.equal(state.devices['gorilla-robot'].values.error, true);
  assert.equal(state.devices['gorilla-robot'].values.j0, 0);
  send({
    type: 'LOAD',
    scene: e.scene,
    program: custom([{ ...action, action: 'prepare' }, action]),
  });
  send({ type: 'SET_SPEED', speed: 1 });
  send({ type: 'RUN' });
  for (let i = 0; i < 20; i++) advance(20);
  assert.ok(state.devices['gorilla-robot'].values.j0 > 0);
  send({ type: 'PAUSE' });
  const before = structuredClone(state.devices['gorilla-robot']);
  advance(1000);
  assert.deepEqual(state.devices['gorilla-robot'], before);
  send({
    type: 'SET_INPUT',
    deviceId: 'gorilla-robot',
    property: 'j0',
    value: 20,
  });
  assert.deepEqual(state.devices['gorilla-robot'], before);
  send({ type: 'STEP' });
  assert.ok(state.now > 0);
  send({ type: 'RESET' });
  assert.equal(state.devices['gorilla-robot'].values.j0, 0);
  // Other branches continue while a joint travels.
  send({
    type: 'LOAD',
    scene: e.scene,
    program: custom([
      { ...action, action: 'prepare' },
      {
        op: 'parallel',
        blockId: 'parallel',
        branches: [
          [{ ...action, durationMs: 5000 }],
          [
            { op: 'wait', ms: 200, blockId: 'w' },
            { op: 'counterSet', value: 7, blockId: 'c' },
          ],
        ],
      },
    ]),
  });
  send({ type: 'RUN' });
  for (let i = 0; i < 40; i++) advance(20);
  assert.equal(state.counter, 7);
  assert.equal(state.devices['gorilla-robot'].values.moving, true);
  send({type:'STOP'});const held=state.devices['gorilla-robot'].values.j0;advance(2000);assert.equal(state.devices['gorilla-robot'].values.moving,false);assert.equal(state.devices['gorilla-robot'].values.j0,held);
}
console.log(
  'GorillaBot worker: ejemplos 1×/4×, pares, sólo canales elegidos, preparación, pausa/paso/reset y cooperación aprobados.',
);
