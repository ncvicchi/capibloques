import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import {
  compileWorkspace,
  registerBlocks,
  toolbox,
  workspaceBoardProfiles,
  workspaceDevices,
} from '../lib/blockly-engine.ts';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model.ts';

registerBlocks(Blockly);
const trafficAdded = addDeviceToScene(
  createEmptyScene('Valores legibles', { canvas: { background: 'crossroads' } }),
  'trafficLight',
);
const workspace = new Blockly.Workspace();
workspaceDevices.set(workspace, trafficAdded.scene.devices);
workspaceBoardProfiles.set(workspace, 'wemos-d1-r32');
workspace.getVariableMap().createVariable('Reloj', 'Timer', 'timer-readable');

const start = workspace.newBlock('capi_start');
const timerIf = workspace.newBlock('capi_if');
const timerCompare = workspace.newBlock('capi_timer_compare');
timerCompare.setFieldValue('timer-readable', 'TIMER');
timerCompare.setFieldValue('ELAPSED', 'TIMER_VALUE');
timerCompare.setFieldValue('GTE', 'OPERATOR');
timerCompare.setFieldValue('3', 'VALUE');
start.getInput('DO').connection.connect(timerIf.previousConnection);
timerIf.getInput('CONDITION').connection.connect(timerCompare.outputConnection);

const trafficIf = workspace.newBlock('capi_if');
const trafficIs = workspace.newBlock('capi_traffic_is');
trafficIs.setFieldValue(trafficAdded.device.id, 'DEVICE_ID');
trafficIs.setFieldValue('GREEN', 'COLOR');
timerIf.nextConnection.connect(trafficIf.previousConnection);
trafficIf.getInput('CONDITION').connection.connect(trafficIs.outputConnection);

const program = compileWorkspace(workspace);
assert.ok(program.timers.some(timer => timer.id === 'timer-readable' && timer.name === 'Reloj'));
assert.deepEqual(program.threads[0].nodes[0].condition, {
  kind: 'valueCompare',
  operator: 'GTE',
  left: { kind: 'timerElapsed', timerId: 'timer-readable' },
  right: { kind: 'number', value: 3 },
});
assert.deepEqual(program.threads[0].nodes[1].condition, {
  kind: 'valueCompare',
  operator: 'EQ',
  left: {
    kind: 'componentValue',
    deviceId: trafficAdded.device.id,
    property: 'color',
    valueType: 'text',
    source: 'ordered',
  },
  right: { kind: 'text', value: 'GREEN' },
});

const categories = toolbox.contents;
const blockTypes = (name) => categories
  .find(category => category.name === name)
  ?.contents?.filter(item => item.kind === 'block').map(item => item.type) ?? [];
assert.ok(blockTypes('Temporizadores').includes('capi_timer_compare'));
assert.ok(blockTypes('Condiciones').includes('capi_timer_compare'));
assert.ok(blockTypes('Condiciones').includes('capi_traffic_is'));
assert.ok(blockTypes('Datos').includes('capi_timer_elapsed'));
assert.ok(blockTypes('Datos').includes('capi_timer_remaining'));
assert.ok(blockTypes('Datos').includes('capi_traffic_color'));

console.log('Valores legibles: semáforo y temporizadores accesibles y comparables desde bloques.');
