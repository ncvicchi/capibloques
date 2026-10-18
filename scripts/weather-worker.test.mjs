import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { examples } from '../lib/capiblocks.ts';
import { registerBlocks, compileWorkspace, workspaceDevices } from '../lib/blockly-engine.ts';
let clock = 0, listener, tick, state;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock } });
globalThis.self = { postMessage: m => { if (m.type === 'SNAPSHOT') state = structuredClone(m.state); }, addEventListener: (_, fn) => { listener = fn; } };
globalThis.setInterval = fn => { tick = fn; return 1; };
await import('../lib/simulator.worker.ts');
const send = data => listener({ data }), advance = ms => { clock += ms; tick(); };
registerBlocks(Blockly);
for (const exampleId of ['weatherLab', 'weatherLabProcedures']) for (const speed of [1, 4]) {
  const e = examples.find(e => e.id === exampleId), scene = structuredClone(e.scene); scene.canvas.weatherEnvironment.automatic = false;
  const ws = new Blockly.Workspace(); workspaceDevices.set(ws, scene.devices); Blockly.serialization.workspaces.load(structuredClone(e.workspace), ws); const program = compileWorkspace(ws); ws.dispose();
  send({ type: 'LOAD', scene, program }); send({ type: 'SET_SPEED', speed });
  send({ type: 'SET_INPUT', deviceId: 'weather-rain', value: { property: 'level', value: 99 } }); assert.equal(state.devices['weather-rain'].values.level, 0);
  send({ type: 'SET_INPUT', name: 'weatherEnvironment', value: { condition: 'heavyRain', night: true, automatic: false } });
  send({ type: 'LOAD', scene, program, preserveWorldTrials: true }); assert.equal(state.weatherWorld.environment.condition, 'heavyRain');
  assert.equal(state.weatherWorld.environment.night, true);
  send({ type: 'RUN' });
  let alarms = 0, wasPlaying = false;
  const run = seconds => { for (let i = 0; i < seconds * 50 / speed; i++) { advance(20); const playing = state.devices['weather-buzzer'].playing; if (playing && !wasPlaying) alarms++; wasPlaying = playing; assert.equal(state.status, 'running'); } };
  run(60);
  assert.equal(state.devices['weather-rain'].values.level, 100); assert.equal(state.devices['weather-rain'].values.wet, true);
  assert.equal(state.devices['weather-night-light'].brightness, 80);
  assert.ok(state.devices['weather-climate'].values.humidity > 85);
  assert.equal(alarms, exampleId === 'weatherLab' ? 0 : 1, 'no alarma en cada vuelta');
  assert.equal(state.weatherWorld.roofAngle, exampleId === 'weatherLab' ? 90 : 0);
  if (exampleId === 'weatherLab') assert.equal(state.weatherWorld.tableWater, 100); else assert.ok(state.weatherWorld.tableWater < 40);
  send({ type: 'PAUSE' }); const before = structuredClone(state.weatherWorld); advance(200); assert.deepEqual(state.weatherWorld, before); send({ type: 'RUN' });
  send({ type: 'SET_INPUT', name: 'weatherEnvironment', value: { condition: 'sunny', night: false, automatic: false } });
  assert.equal(state.weatherWorld.detectorWater, 100, 'no se seca por cambiar un botón');
  run(50); assert.equal(state.weatherWorld.detectorWater, 0); assert.equal(state.weatherWorld.roofAngle, 90); assert.equal(state.devices['weather-night-light'].brightness, 0);
  send({ type: 'SET_INPUT', name: 'weatherEnvironment', value: { condition: 'heavyRain', night: false, automatic: false } }); run(20);
  assert.equal(alarms, exampleId === 'weatherLab' ? 0 : 2, 'nuevo episodio sí vuelve a avisar');
  send({ type: 'RESET' }); assert.equal(state.weatherWorld.timeMs, 0); assert.equal(state.weatherWorld.detectorWater, 0); assert.equal(state.weatherWorld.tableWater, 0); assert.equal(state.weatherWorld.environment.condition, 'sunny');
  send({ type: 'STEP' }); assert.ok(state.weatherWorld.timeMs > 0); send({ type: 'STOP' });
}
{
  const e = examples.find(e => e.id === 'weatherLabProcedures'), ws = new Blockly.Workspace(); workspaceDevices.set(ws, e.scene.devices); Blockly.serialization.workspaces.load(structuredClone(e.workspace), ws); const program = compileWorkspace(ws); ws.dispose();
  send({ type: 'LOAD', scene: e.scene, program }); send({ type: 'SET_SPEED', speed: 4 }); send({ type: 'RUN' });
  const seen = new Set(); let alarms = 0, previous = false;
  for (let i = 0; i < 3000; i++) { advance(20); seen.add(state.weatherWorld.environment.condition); const playing = state.devices['weather-buzzer'].playing; if (playing && !previous) alarms++; previous = playing; }
  assert.equal(seen.size, 4); assert.equal(alarms, 2, 'dos ciclos reproducibles, dos episodios húmedos');
}
console.log('Meteorología: ambos workspaces a 1×/4×, protección realimentada, luz, alarma por episodio, clima automático y pausa/paso/reset aprobados.');
