import assert from 'node:assert/strict';
import { createCapiRules } from '../lib/capi-rules.ts';
import { generateEsp32CodeResult, normalizeCompiledProgram, validateProgramForScene } from '../lib/capiblocks.ts';
import { assignSafePins, addDeviceToScene, constrainSceneItemPosition, createEmptyScene, migrateSceneDefinition } from '../lib/scene-model.ts';
import { trafficDisplayRows } from '../lib/traffic-displays.ts';

let { scene, device } = addDeviceToScene(
  createEmptyScene('Cruce con carteles', { canvas: { background: 'crossroads' } }),
  'trafficLight',
);
device.config.vehicleDisplay = true;
device.config.pedestrianDisplay = true;
device.config.matrixBrightness = 7;
scene = assignSafePins(scene, { boardProfile: 'wemos-d1-r32', reassignAll: true }).scene;
device = scene.devices.find(item => item.id === device.id);
assert.ok(device.pins.matrixDin !== null && device.pins.matrixClk !== null && device.pins.matrixCs !== null);

const program = normalizeCompiledProgram({ version: 2, threads: [{ id: 'main', startBlockId: 'start', nodes: [
  { op: 'trafficVehicleDisplay', deviceId: device.id, value: '7', blockId: 'vehicle-number' },
  { op: 'trafficVehicleDisplay', deviceId: device.id, value: 'STOP', blockId: 'vehicle-stop' },
  { op: 'trafficVehicleDisplay', deviceId: device.id, value: 'GO', blockId: 'vehicle-go' },
  { op: 'trafficPedestrianDisplay', deviceId: device.id, value: 'WALK', blockId: 'pedestrian-walk' },
  { op: 'trafficPedestrianDisplay', deviceId: device.id, value: 'DONT_WALK', blockId: 'pedestrian-stop' },
] }] }, scene);
assert.equal(validateProgramForScene(program, scene, 'wemos-d1-r32').filter(item => item.severity === 'error').length, 0);
const rules = createCapiRules(program, scene, 'wemos-d1-r32');
assert.ok(rules.requiredCapabilities.includes('traffic-display'));
for (const framework of ['arduino', 'esp-idf']) {
  const generated = generateEsp32CodeResult(program, 'Carteles de tránsito', scene, framework, 'wemos-d1-r32');
  assert.equal(generated.diagnostics.filter(item => item.severity === 'error').length, 0, framework);
  assert.match(generated.code, /capiTrafficMatrixBegin/);
  assert.match(generated.code, /TRAFFIC_GLYPH_STOP/);
  assert.match(generated.code, /TRAFFIC_GLYPH_DONT_WALK/);
}
assert.equal(trafficDisplayRows('7').length, 8);
assert.ok(trafficDisplayRows('STOP').some(Boolean));
assert.ok(trafficDisplayRows('WALK').some(Boolean));

const disabled = structuredClone(scene);
const disabledLight = disabled.devices.find(item => item.id === device.id);
disabledLight.config.vehicleDisplay = false;
assert.ok(validateProgramForScene(program, disabled, 'wemos-d1-r32').some(item => item.code === 'traffic-display-missing'));

const oldScene = structuredClone(scene);
const oldLight = oldScene.devices.find(item => item.id === device.id);
delete oldLight.pins.matrixDin; delete oldLight.pins.matrixClk; delete oldLight.pins.matrixCs;
delete oldLight.config.vehicleDisplay; delete oldLight.config.pedestrianDisplay; delete oldLight.config.matrixBrightness;
const migrated = migrateSceneDefinition(oldScene);
assert.equal(migrated.migrated, true);
assert.equal(migrated.scene.devices[0].config.vehicleDisplay, false);

const occupied = addDeviceToScene(scene, 'trafficLight').scene;
const first = occupied.devices[0], second = occupied.devices[1];
const blockedMove = constrainSceneItemPosition(occupied, first, second.position);
assert.deepEqual(blockedMove, first.position, 'un semáforo no puede ocupar el lugar de otro');

console.log('Carteles matriciales de semáforo: modelo, reglas, orientación y generadores OK');
