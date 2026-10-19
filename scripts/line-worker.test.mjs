import assert from 'node:assert/strict';
import * as B from 'blockly';
import { examples } from '../lib/capiblocks.ts';
import {
  registerBlocks,
  workspaceDevices,
  compileWorkspace,
} from '../lib/blockly-engine.ts';
import { linePreset } from '../lib/line-world.ts';
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
for (const e of examples.filter((e) => e.id.startsWith('lineTrack')))
  for (const speed of [1, 4]) {
    const ws = new B.Workspace();
    workspaceDevices.set(ws, e.scene.devices);
    B.serialization.workspaces.load(structuredClone(e.workspace), ws);
    const program = compileWorkspace(ws);
    ws.dispose();
    send({ type: 'LOAD', scene: e.scene, program });
    send({ type: 'SET_SPEED', speed });
    send({ type: 'RUN' });
    let patterns = new Set();
    for (let i = 0; i < 8000 / speed; i++) {
      advance(20);
      assert.ok(
        Math.abs(state.devices['line-robot'].x * 9.6 - state.lineWorld.x) <
          0.001,
        'mundo y componente deben tener la misma posición',
      );
      patterns.add(
        [
          state.lineWorld.left,
          state.lineWorld.center,
          state.lineWorld.right,
        ].join(','),
      );
      assert.equal(state.status, 'running');
    }
    assert.ok(
      state.lineWorld.distance > 2300,
      JSON.stringify({
        example: e.id,
        speed,
        world: state.lineWorld,
        log: state.console.slice(-5),
      }),
    );
    assert.ok(patterns.size >= 3);
    assert.equal(state.lineWorld.contacts, 0);
    send({ type: 'PAUSE' });
    const paused = structuredClone(state.lineWorld);
    advance(1000);
    assert.deepEqual(state.lineWorld, paused);
    send({ type: 'STEP' });
    assert.ok(state.now > 0);
    send({ type: 'RESET' });
    assert.equal(state.lineWorld.distance, 0);
    assert.equal(state.lineWorld.x, 300);
    // A circuit without any line must not drive by hidden autopilot.
    const scene = structuredClone(e.scene);
    scene.canvas.lineCircuit = { width: 16, strokes: [] };
    send({ type: 'LOAD', scene, program });
    send({ type: 'SET_SPEED', speed });
    send({ type: 'RUN' });
    for (let i = 0; i < 300 / speed; i++) advance(20);
    assert.equal(state.devices['line-robot'].left, 0);
    assert.equal(state.devices['line-robot'].right, 0);
    assert.equal(state.devices['line-alert'].brightness, 100);
    assert.equal(state.lineWorld.distance, 0);
    send({
      type: 'SET_INPUT',
      deviceId: 'line-sensors',
      property: 'center',
      value: true,
    });
    assert.equal(state.devices['line-sensors'].values.center, false);
    if (e.id === 'lineTrackProcedures') {
      const rotated = structuredClone(e.scene);
      rotated.devices.find((d) => d.kind === 'robot').rotation = 90;
      send({ type: 'LOAD', scene: rotated, program });
      send({ type: 'SET_SPEED', speed });
      send({ type: 'RUN' });
      let searched = false,
        recovered = false;
      for (let i = 0; i < 1000 / speed; i++) {
        advance(20);
        const d = state.devices['line-robot'];
        searched ||=
          d.left < 0 &&
          d.right > 0 &&
          state.devices['line-alert'].brightness === 100;
        recovered ||=
          searched &&
          state.devices['line-alert'].brightness === 0 &&
          state.lineWorld.distance > 50;
      }
      assert.ok(
        searched && recovered,
        'la búsqueda debe poder recuperar una salida girada',
      );
      assert.ok(state.lineWorld.distance > 300);
    }
    for (const preset of ['straight', 'bends', 'snake']) {
      const scene = structuredClone(e.scene);
      scene.canvas.lineCircuit = linePreset(preset);
      send({ type: 'LOAD', scene, program });
      send({ type: 'SET_SPEED', speed });
      send({ type: 'RUN' });
      for (let i = 0; i < 3000 / speed; i++) advance(20);
      assert.ok(state.lineWorld.distance > 300, `${e.id} no recorre ${preset}`);
      assert.equal(state.lineWorld.contacts, 0);
    }
    send({ type: 'STOP' });
  }
console.log(
  'Línea: dos workspaces a 1×/4×, óvalo, pérdida/búsqueda limitada, pausa/paso/reset y sin controles competidores aprobados.',
);
