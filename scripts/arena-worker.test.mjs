import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { examples } from '../lib/capiblocks.ts';
import { registerBlocks, compileWorkspace, workspaceDevices } from '../lib/blockly-engine.ts';
let clock = 0, listener, tick, state;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock } });
globalThis.self = { postMessage: m => { if (m.type === 'SNAPSHOT') state = structuredClone(m.state); }, addEventListener: (_, fn) => { listener = fn; } };
globalThis.setInterval = fn => { tick = fn; return 1; };
await import('../lib/simulator.worker.ts');
const send = data => listener({ data });
const advance = ms => { clock += ms; tick(); };
registerBlocks(Blockly);
for (const exampleId of ['robotArena', 'robotArenaProcedures']) for (const speed of [1, 4]) {
  const e = examples.find(e => e.id === exampleId), workspace = new Blockly.Workspace(); workspaceDevices.set(workspace, e.scene.devices);
  Blockly.serialization.workspaces.load(structuredClone(e.workspace), workspace); const program = compileWorkspace(workspace); workspace.dispose();
  send({ type: 'LOAD', scene: e.scene, program }); send({ type: 'SET_SPEED', speed });
  send({ type: 'SET_INPUT', deviceId: 'arena-distance', value: { property: 'distance', value: 1 } }); assert.notEqual(state.devices['arena-distance'].values.distance, 1);
  send({ type: 'STEP' }); assert.ok(state.now > 0);
  send({ type: 'RESET' }); assert.equal(state.arenaWorld.x, 120); assert.equal(state.arenaWorld.trail.length, 0);
  send({ type: 'RUN' });
  let sawOffPath = false;
  for (let i = 0; i < 4000 / speed && state.status !== 'done'; i++) { advance(20); sawOffPath ||= state.arenaWorld.offPath; }
  assert.equal(state.status, 'done', JSON.stringify({ exampleId, speed, world: state.arenaWorld, log: state.console.slice(-5) }));
  assert.equal(state.arenaWorld.contacts, 0, JSON.stringify({ exampleId, speed, world: state.arenaWorld }));
  assert.deepEqual(state.arenaWorld.visits, { A: 1, B: 1 }); assert.equal(state.arenaWorld.goalReached, true);
  assert.equal(state.devices['arena-light'].brightness, 100);
  assert.ok(state.arenaWorld.trail.length <= 300);
  if (exampleId === 'robotArenaProcedures') assert.equal(sawOffPath, true, 'rodea sin piloto automático');
  send({ type: 'PAUSE' }); const before = structuredClone(state.arenaWorld); advance(200); assert.deepEqual(state.arenaWorld, before);
  send({ type: 'RESET' }); assert.deepEqual(state.arenaWorld.visits, { A: 0, B: 0 }); assert.equal(state.arenaWorld.goalReached, false); assert.equal(state.arenaWorld.contacts, 0);
}
console.log('Pista: ambos workspaces completos a 1×/4×, A/B/meta, desvío, sensores, pausa/paso/reset aprobados.');
