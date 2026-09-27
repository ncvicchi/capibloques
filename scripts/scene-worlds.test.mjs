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
import {
  advanceTrafficWorld,
  createTrafficWorldState,
} from '../lib/traffic-world.ts';

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

const originalTraffic = createTrafficWorldState();
const greenTraffic = advanceTrafficWorld(
  originalTraffic,
  { horizontal: 'GREEN', vertical: 'RED' },
  50,
);
const yellowTraffic = advanceTrafficWorld(
  greenTraffic,
  { horizontal: 'YELLOW', vertical: 'RED' },
  50,
);
assert.equal(greenTraffic.cars.length, 6, 'cars keep stable identities');
assert.ok(greenTraffic.cars[0].progress > originalTraffic.cars[0].progress);
assert.ok(yellowTraffic.cars[0].progress > greenTraffic.cars[0].progress);

let redTraffic = originalTraffic;
for (let frame = 0; frame < 400; frame += 1) {
  redTraffic = advanceTrafficWorld(
    redTraffic,
    { horizontal: 'RED', vertical: 'RED' },
    50,
  );
}
assert.equal(redTraffic.cars.length, 6);
const horizontalQueue = redTraffic.cars
  .filter(car => car.lane === 'horizontal')
  .map(car => car.progress)
  .sort((left, right) => right - left);
assert.deepEqual(horizontalQueue.map(value => Number(value.toFixed(3))), [0.37, 0.315, 0.26]);
assert.ok(
  redTraffic.cars
    .filter(car => car.lane === 'horizontal')
    .every(car => car.waitingForGreen),
  'cars stopped by red remember that they are waiting for green',
);
const yellowAfterRed = advanceTrafficWorld(
  redTraffic,
  { horizontal: 'YELLOW', vertical: 'RED' },
  100,
);
assert.deepEqual(
  yellowAfterRed.cars
    .filter(car => car.lane === 'horizontal')
    .map(car => car.progress),
  redTraffic.cars
    .filter(car => car.lane === 'horizontal')
    .map(car => car.progress),
  'a queue stopped by red must not start on yellow',
);
const greenAfterRed = advanceTrafficWorld(
  yellowAfterRed,
  { horizontal: 'GREEN', vertical: 'RED' },
  100,
);
assert.ok(
  greenAfterRed.cars
    .filter(car => car.lane === 'horizontal')
    .every((car, index) => car.progress > yellowAfterRed.cars.filter(candidate => candidate.lane === 'horizontal')[index].progress),
  'the stopped queue starts on green',
);

const collision = advanceTrafficWorld(
  {
    cars: [
      { id: 'h', lane: 'horizontal', progress: 0.5, crashed: false, waitingForGreen: false },
      { id: 'v', lane: 'vertical', progress: 0.5, crashed: false, waitingForGreen: false },
    ],
    collision: null,
  },
  { horizontal: 'GREEN', vertical: 'YELLOW' },
  0,
);
assert.deepEqual(collision.collision, { horizontalId: 'h', verticalId: 'v' });
assert.ok(collision.cars.every(car => car.crashed));
assert.deepEqual(
  advanceTrafficWorld(collision, { horizontal: 'RED', vertical: 'RED' }, 100),
  collision,
  'a collision stays a collision',
);
console.log('Mundos de escena: plantillas, carriles y límites validados.');
