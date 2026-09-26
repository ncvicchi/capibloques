import assert from 'node:assert/strict';
import {
  addDeviceToScene,
  closestCrossroadsTrafficSlot,
  constrainSceneItemPosition,
  createSceneFromTemplate,
  isSceneDefinition,
  sceneTemplates,
  validateScene,
} from '../lib/scene-model.ts';

for (const id of [
  'intersection',
  'robotCourse',
  'smartGarden',
  'securityGate',
  'weatherStation',
]) {
  const scene = createSceneFromTemplate(id);
  assert.ok(isSceneDefinition(scene), `${id} must round-trip as scene JSON`);
  assert.equal(validateScene(scene, 'wemos-d1-r32').valid, true);
  assert.notEqual(scene.canvas.background, 'blank');
}

const intersection = createSceneFromTemplate('intersection');
assert.equal(intersection.devices.filter(device => device.kind === 'trafficLight').length, 2);
for (const light of intersection.devices.filter(device => device.kind === 'trafficLight')) {
  const slot = closestCrossroadsTrafficSlot(light.position);
  assert.deepEqual(light.position, { x: slot.x, y: slot.y });
}

const moved = constrainSceneItemPosition(
  intersection,
  intersection.devices[0],
  { x: 940, y: 520 },
);
assert.deepEqual(moved, { x: 655, y: 330 });

let full = intersection;
full = addDeviceToScene(full, 'trafficLight').scene;
full = addDeviceToScene(full, 'trafficLight').scene;
assert.throws(
  () => addDeviceToScene(full, 'trafficLight'),
  /cuatro lugares seguros/,
);

assert.equal(sceneTemplates.robotCourse.canvas.background, 'robotTrack');
console.log('Mundos de escena: plantillas, carriles y límites validados.');
