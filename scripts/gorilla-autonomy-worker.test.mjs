import assert from 'node:assert/strict';
import * as B from 'blockly';
import {
  examples,
  validateProgramForScene,
  makeProject,
  decodeProject,
} from '../lib/capiblocks.ts';
import {
  registerBlocks,
  workspaceDevices,
  compileWorkspace,
} from '../lib/blockly-engine.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
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
for (const e of examples.filter((e) => e.id.startsWith('gorillaAutonomy'))) {
  const ws = new B.Workspace();
  workspaceDevices.set(ws, e.scene.devices);
  B.serialization.workspaces.load(structuredClone(e.workspace), ws);
  const program = compileWorkspace(ws);
  ws.dispose();
  assert.deepEqual(
    validateProgramForScene(program, e.scene).filter(
      (d) => d.severity === 'error',
    ),
    [],
  );
  assert.ok(decodeProject(makeProject(e.title, e.scene, e.workspace)).project);
  const checked = structuredClone(e.scene);
  checked.devices.find((d) => d.kind === 'gorilla').config.settings.verified =
    true;
  checked.devices.find((d) => d.kind === 'gorilla').config.kinematics.verified =
    true;
  const rules = createCapiRules(program, checked, 'wemos-d1-r32');
  assert.ok(rules.bytes.length <= 32768);
  assert.ok(rules.requiredCapabilities.includes('gorilla-autonomy'));
  assert.ok(rules.requiredCapabilities.includes('sonar-hcsr04'));
  for (const speed of [1, 4]) {
    for (const scenario of [
      'normal',
      'missing',
      'stale',
      'button',
      'timeout',
    ]) {
      send({ type: 'LOAD', scene: e.scene, program });
      send({ type: 'SET_SPEED', speed });
      send({ type: 'RUN' });
      for (let i = 0; i < 10; i++) advance(20);
      assert.equal(state.gorillaWorld.x, 120);
      if (scenario === 'missing' || scenario === 'stale')
        send({
          type: 'SET_INPUT',
          name: 'gorillaTrial',
          value: { sonarMode: scenario },
        });
      if (scenario === 'timeout')
        send({
          type: 'SET_INPUT',
          name: 'gorillaTrial',
          value: { obstaclesRemoved: true },
        });
      send({ type: 'SET_INPUT', deviceId: 'gorilla-button', value: true });
      for (let i = 0; i < 10; i++) advance(20);
      send({ type: 'SET_INPUT', deviceId: 'gorilla-button', value: false });
      let sent = false,
        max = 120;
      for (let i = 0; i < 10000 / speed && state.status !== 'done'; i++) {
        advance(20);
        max = Math.max(max, state.gorillaWorld.x);
        if (scenario === 'button' && !sent && state.gorillaWorld.x > 121) {
          sent = true;
          send({ type: 'SET_INPUT', deviceId: 'gorilla-button', value: true });
        }
      }
      assert.equal(
        state.status,
        'done',
        JSON.stringify({ id: e.id, scenario, state }),
      );
      assert.equal(
        state.gorillaWorld.contacts,
        0,
        JSON.stringify({ id: e.id, scenario, state }),
      );
      if (['missing', 'stale'].includes(scenario)) {
        assert.equal(max, 120);
        assert.equal(state.variables['auto-fault'], true);
      for(let j=0;j<8;j++)assert.equal(state.devices['gorilla-robot'].values['j'+j],0);
      }
      if (scenario === 'normal') {
        assert.ok(max > 160 && max < 280, max);
        assert.equal(
          state.devices['gorilla-robot'].values.walkOutcome,
          'condición',
        );
      }
      if (scenario === 'button')
        assert.equal(state.variables['auto-manual'], true);
      if (scenario === 'timeout')
        assert.equal(
          state.devices['gorilla-robot'].values.walkOutcome,
          'tiempo máximo',
        );
      send({ type: 'RESET' });
      assert.equal(state.gorillaWorld.x, 120);
      assert.equal(state.gorillaWorld.sonarMode, undefined);
      assert.equal(state.gorillaWorld.contacts, 0);
    }
  }
}
console.log(
  'Gorilla61 worker: ambos workspaces completos a1×/4×, botón, obstáculo, timeout, sensor inválido/vencido, recuperación acotada y RESET aprobados.',
);
