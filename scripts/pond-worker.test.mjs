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
for (const e of examples.filter((e) => e.id.startsWith('pondLab'))) {
  const ws = new B.Workspace();
  workspaceDevices.set(ws, e.scene.devices);
  B.serialization.workspaces.load(structuredClone(e.workspace), ws);
  const program = compileWorkspace(ws);
  ws.dispose();
  const run = (scene = e.scene) => {
    send({ type: 'LOAD', scene, program });
    send({ type: 'RUN' });
  };
  for (const speed of [1, 4]) {
    run();
    send({ type: 'SET_SPEED', speed });
    let maximum = 0;
    for (let i = 0; i < 10000 / speed; i++) {
      advance(20);
      maximum = Math.max(maximum, state.pondWorld.lagoon);
      assert.equal(state.status, 'running');
    }
    assert.ok(
      maximum >= 70 && maximum < 72,
      JSON.stringify({ example: e.id, maximum, log: state.console.slice(-4) }),
    );
    assert.ok(state.pondWorld.spilled === 0);
    assert.ok(state.pondWorld.transferred > 30);
    assert.ok(
      Math.abs(
        state.devices['pond-lagoonSensor'].values.distance -
          (120 - state.pondWorld.lagoon),
      ) < 0.011,
    );
    send({ type: 'PAUSE' });
    const paused = structuredClone(state.pondWorld);
    advance(1000);
    assert.deepEqual(state.pondWorld, paused);
    send({
      type: 'SET_INPUT',
      deviceId: 'pond-lagoonSensor',
      property: 'distance',
      value: 0,
    });
    assert.ok(state.devices['pond-lagoonSensor'].values.distance > 0);
    send({ type: 'RESET' });
    assert.equal(state.pondWorld.lagoon, 35);
    assert.equal(state.pondWorld.reserve, 240);
    assert.equal(state.pondWorld.spilled, 0);
  }
  const empty = structuredClone(e.scene);
  empty.canvas.pondEnvironment.reserve = 0;
  run(empty);
  send({ type: 'SET_SPEED', speed: 4 });
  for (let i = 0; i < 100; i++) advance(20);
  if (e.id === 'pondLabProcedures') {
    assert.equal(state.devices['pond-pump'].values.power, 0);
    assert.equal(state.devices['pond-alert'].brightness, 100);
  } else {
    assert.equal(state.devices['pond-pump'].values.power, 100);
    assert.ok(state.pondWorld.dryPump);
  }
  send({ type: 'SET_INPUT', name: 'pondRefill', value: true });
  for (let i = 0; i < 80; i++) advance(20);
  assert.ok(state.pondWorld.reserve > 250);
  assert.ok(state.pondWorld.transferred > 0);
  if (e.id === 'pondLabProcedures') {
    const rain = structuredClone(e.scene);
    rain.canvas.pondEnvironment = {
      lagoon: 95,
      reserve: 240,
      evaporation: 0,
      leak: 0,
      rain: 2,
    };
    run(rain);
    for (let i = 0; i < 500; i++) advance(20);
    assert.ok(state.pondWorld.gateAngle > 0 || state.pondWorld.lagoon < 90);
    assert.ok(state.pondWorld.drained > 0);
    const leak = structuredClone(e.scene);
    leak.canvas.pondEnvironment.leak = 3;
    run(leak);
    for (let i = 0; i < 500; i++) advance(20);
    assert.equal(state.devices['pond-pump'].values.power, 0);
    assert.equal(state.devices['pond-alert'].brightness, 100);
  }
  send({ type: 'LOAD', scene: e.scene, program });
  const trial = { ...e.scene.canvas.pondEnvironment, rain: 3, leak: 1 };
  send({ type: 'SET_INPUT', name: 'pondEnvironment', value: trial });
  send({ type: 'SET_INPUT', name: 'pondRefill', value: true });
  send({ type: 'LOAD', scene: e.scene, program, preserveWorldTrials: true });
  assert.deepEqual(state.pondWorld.environment, trial);
  assert.equal(state.pondWorld.pendingRefill, true);
  send({ type: 'RESET' });
  assert.deepEqual(state.pondWorld.environment, e.scene.canvas.pondEnvironment);
  assert.equal(state.pondWorld.pendingRefill, false);
}
console.log(
  'Laguna worker: dos programas reales, velocidades, regulación, reserva, desagüe, timeout, pausa/reset y ensayos aprobados.',
);
