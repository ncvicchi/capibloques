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
  advance = (n = 20) => {
    clock += n;
    tick();
  },
  input = (value) => send({ type: 'SET_INPUT', name: 'gorillaRemote', value });
registerBlocks(B);
for (const e of examples.filter((e) => e.id.startsWith('gorillaRemote'))) {
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
  const checked = structuredClone(e.scene),
    g = checked.devices.find((d) => d.kind === 'gorilla');
  g.config.settings.verified = g.config.kinematics.verified = true;
  const rules = createCapiRules(program, checked, 'wemos-d1-r32');
  assert.ok(rules.bytes.length <= 32768);
  assert.ok(rules.requiredCapabilities.includes('gorilla-remote'));
  for (const speed of [1, 4]) {
    send({ type: 'LOAD', scene: e.scene, program });
    send({ type: 'SET_SPEED', speed });
    send({ type: 'RUN' });
    for (let i = 0; i < 10; i++) advance();
    const values = () => state.devices['gorilla-robot'].values;
    const intent = (extra = {}) =>
      input({
        sequence: Number(values().remoteSequence) + 1,
        ticket: Number(values().remoteTicket),
        direction: 0,
        rhythm: 100,
        mode: 0,
        mission: 0,
        arm: false,
        stop: false,
        ...extra,
      });
    assert.equal(state.gorillaWorld.x, 120);
    input({ claim: true });
    advance();
    intent({ arm: true });
    advance();
    assert.ok(values().remoteArmed);
    for (let i = 0; i < 100; i++) {
      if (i % 4 === 0) intent({ direction: 1 });
      advance();
    }
    assert.ok(values().moving);
    const x = state.gorillaWorld.x;
    for (let i = 0; i < 180; i++) {
      if (i % 4 === 0) intent();
      advance();
    }
    assert.equal(values().moving, false);
    assert.ok(
      Math.abs(state.gorillaWorld.x - x) < 2,
      'soltar no debe empujar el cuerpo',
    );
    for (let i = 0; i < 100; i++) {
      if (i % 4 === 0) intent({ direction: 1 });
      advance();
    }
    const seq = values().remoteSequence;
    advance(501);
    assert.equal(values().remoteConnected, false);
    intent({ direction: 1 });
    advance();
    assert.equal(values().remoteSequence, seq, 'no revive sesión vencida');
    for (let i = 0; i < 200; i++) advance();
    assert.equal(values().moving, false);
    input({ claim: true });
    advance();
    intent({ arm: true });
    advance();
    intent({ stop: true });
    advance();
    assert.equal(values().moving, false);
    assert.ok(values().remoteStopped);
    intent({ direction: 1 });
    advance();
    assert.equal(values().remoteArmed, false);
    if (e.id.endsWith('Missions')) {
      send({ type: 'RESET' });
      send({ type: 'RUN' });
      for (let i = 0; i < 10; i++) advance();
      input({ claim: true });
      advance();
      intent({ mode: 1 });
      advance();
      intent({ mode: 1, arm: true });
      advance();
      let done = false;
      for (let i = 0; i < 8000; i++) {
        if (i % 4 === 0) intent({ mode: 1, mission: 1 });
        advance();
        if (i > 20 && !values().moving && values().walkOutcome !== 'ninguno') {
          done = true;
          break;
        }
      }
      assert.ok(done, 'misión completa debe terminar ante obstáculo');
      assert.ok(state.gorillaWorld.x > 120);
      assert.equal(state.gorillaWorld.contacts, 0);
      const end = state.gorillaWorld.x;
      for (let i = 0; i < 200; i++) {
        if (i % 4 === 0) intent({ mode: 1, mission: 1 });
        advance();
      }
      assert.equal(state.gorillaWorld.x, end, 'no repetir misión mantenida');
    }
  }
  console.log(
    e.title +
      ': JSON, reglas y worker a 1×/4× aprobados (' +
      rules.bytes.length +
      ' bytes).',
  );
}
