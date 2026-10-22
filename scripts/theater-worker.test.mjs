import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { examples } from '../lib/capiblocks.ts';
import { createSceneFromTemplate } from '../lib/scene-model.ts';
import {
  registerBlocks,
  compileWorkspace,
  workspaceDevices,
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
  addEventListener: (_, fn) => {
    listener = fn;
  },
};
globalThis.setInterval = (fn) => {
  tick = fn;
  return 1;
};
await import('../lib/simulator.worker.ts');
const send = (data) => listener({ data }),
  advance = (ms) => {
    clock += ms;
    tick();
  };
registerBlocks(Blockly);
for (const exampleId of ['ottoTheater', 'ottoTheaterProcedures'])
  for (const speed of [1, 4]) {
    const e = examples.find((e) => e.id === exampleId),
      ws = new Blockly.Workspace();
    workspaceDevices.set(ws, e.scene.devices);
    Blockly.serialization.workspaces.load(structuredClone(e.workspace), ws);
    const program = compileWorkspace(ws);
    ws.dispose();
    send({ type: 'LOAD', scene: e.scene, program });
    send({ type: 'SET_SPEED', speed });
    send({ type: 'SET_INPUT', deviceId: 'theater-request', value: true });
    assert.equal(state.devices['theater-request'].pressed, false);
    send({ type: 'RUN' });
    let acts = 0,
      lastCounter = 0,
      lightStates = new Set(),
      lightDuringMotion = false;
    for (let i = 0; i < 6000 / speed; i++) {
      advance(20);
      if (state.counter > lastCounter) acts++;
      lastCounter = state.counter;
      lightStates.add(state.devices['theater-light-1'].brightness);
      lightDuringMotion ||=
        state.devices['theater-otto'].motion !== 'HOME' &&
        state.devices['theater-light-1'].brightness > 20;
      assert.ok(state.theaterWorld.count <= 4);
      assert.equal(state.status, 'running');
    }
    assert.ok(
      acts >= 2,
      JSON.stringify({
        exampleId,
        speed,
        world: state.theaterWorld,
        console: state.console.slice(-10),
      }),
    );
    assert.ok(
      state.counter <= state.theaterWorld.groups,
      'una actuación por grupo',
    );
    if (exampleId.endsWith('Procedures')) {
      assert.ok(lightStates.size >= 2);
      assert.ok(lightDuringMotion);
    }
    send({ type: 'PAUSE' });
    const before = structuredClone(state.theaterWorld);
    advance(200);
    assert.deepEqual(state.theaterWorld, before);
    send({ type: 'RESET' });
    assert.equal(state.theaterWorld.phase, 'empty');
    assert.equal(state.theaterWorld.requestMs, 0);
    assert.equal(state.counter, 0);
    assert.equal(state.devices['theater-otto'].motion, 'HOME');
    send({
      type: 'SET_INPUT',
      name: 'theaterEnvironment',
      value: {
        automaticArrivals: false,
        count: 2,
        distance: 35,
        staySeconds: 24,
      },
    });
    send({ type: 'SET_INPUT', name: 'theaterAction', value: 'arrive' });
    send({ type: 'LOAD', scene: e.scene, program, preserveWorldTrials: true });
    assert.equal(state.theaterWorld.pendingArrival, true);
    send({ type: 'RUN' });
    for (let i = 0; i < 500 / speed; i++) advance(20);
    assert.equal(state.theaterWorld.phase, 'watching');
    assert.equal(state.counter, 0, 'no actuación por simple proximidad');
    send({ type: 'SET_INPUT', name: 'theaterAction', value: 'request' });
    for (let i = 0; i < 600 / speed; i++) advance(20);
    assert.equal(state.counter, 1);
    send({ type: 'SET_INPUT', name: 'theaterAction', value: 'request' });
    for (let i = 0; i < 100 / speed; i++) advance(20);
    assert.equal(state.counter, 1, 'sin repetición para el mismo grupo');
    send({ type: 'SET_INPUT', name: 'theaterAction', value: 'leave' });
    for (let i = 0; i < 300 / speed; i++) advance(20);
    assert.equal(state.theaterWorld.phase, 'empty');
    send({ type: 'STOP' });
  }
// Three bodily commands plus independent face/light, in arrival order.
{
  const scene = createSceneFromTemplate('ottoTheater');
  scene.canvas.theaterEnvironment.automaticArrivals = false;
  const move = (action, id) => ({
    op: 'otto',
    deviceId: 'theater-otto',
    action,
    speed: 60,
    repetitions: 1,
    blockId: id,
  });
  send({
    type: 'LOAD',
    scene,
    program: {
      version: 2,
      variables: [],
      threads: [
        {
          id: 'main',
          startBlockId: 'start',
          nodes: [
            {
              op: 'parallel',
              blockId: 'parallel',
              branches: [
                [move('DANCE', 'dance'), move('JUMP', 'jump')],
                [move('SWING', 'swing'), move('HOME', 'home')],
                [
                  { op: 'wait', ms: 100, blockId: 'delay' },
                  {
                    op: 'ottoExpression',
                    deviceId: 'theater-otto',
                    expression: 'LOVE',
                    blockId: 'face',
                  },
                  {
                    op: 'led',
                    deviceId: 'theater-light-1',
                    brightness: 100,
                    blockId: 'light',
                  },
                ],
              ],
            },
          ],
        },
      ],
    },
  });
  send({ type: 'SET_SPEED', speed: 1 });
  send({ type: 'RUN' });
  const seen = [];
  let previous = 'HOME',
    firstStart = 0;
  let faceDuringMotion = false,
    queuedVisible = false;
  for (let i = 0; i < 350; i++) {
    advance(20);
    const motion = state.devices['theater-otto'].motion;
    if (motion !== previous && motion !== 'HOME') {
      seen.push(motion);
      if (!firstStart) firstStart = state.now;
    }
    previous = motion;
    faceDuringMotion ||=
      motion === 'DANCE' &&
      state.devices['theater-otto'].expression === 'LOVE' &&
      state.devices['theater-light-1'].brightness === 100;
    queuedVisible ||= Object.values(state.execution?.tasks ?? {}).some((t) =>
      t.detail?.includes('turno'),
    );
  }
  assert.deepEqual(seen, ['DANCE', 'SWING', 'JUMP']);
  assert.ok(faceDuringMotion);
  assert.ok(queuedVisible);
  assert.equal(state.status, 'done');
  assert.ok(state.now - firstStart >= 3600);
  send({ type: 'RESET' });
  send({ type: 'RUN' });
  for (let i = 0; i < 350; i++) advance(20);
  assert.equal(state.status, 'done', 'reset limpia la cola');
}
console.log(
  'Teatro: dos ejemplos a 1×/4×, público/manual/automático, una actuación por grupo, luces, pausa/reset y cola FIFO sin preempción aprobados.',
);
