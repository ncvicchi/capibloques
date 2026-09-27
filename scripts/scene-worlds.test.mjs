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

const car = (id, lane, progress) => ({
  id,
  lane,
  progress,
  crashed: false,
  waitingForGreen: false,
  clearingIntersection: false,
});
const fixedWorld = cars => ({
  ...createTrafficWorldState(),
  cars,
  spawnInMs: { horizontal: 1_000_000, vertical: 1_000_000 },
});

let generatedTraffic = {
  ...createTrafficWorldState(),
  spawnInMs: { horizontal: 0, vertical: 1_000_000 },
};
const generatedIds = new Set();
const populationSizes = new Set();
let previousIds = new Set();
let destroyedCar = false;
for (let frame = 0; frame < 1_500; frame += 1) {
  generatedTraffic = advanceTrafficWorld(
    generatedTraffic,
    { horizontal: 'GREEN', vertical: 'RED' },
    50,
  );
  const currentIds = new Set(generatedTraffic.cars.map(item => item.id));
  if ([...previousIds].some(id => !currentIds.has(id))) destroyedCar = true;
  for (const id of currentIds) generatedIds.add(id);
  populationSizes.add(generatedTraffic.cars.length);
  previousIds = currentIds;
}
assert.ok(generatedIds.size > 10, 'traffic creates independent cars over time');
assert.ok(destroyedCar, 'cars are destroyed after leaving the scene');
assert.ok(populationSizes.size >= 3, 'traffic population changes over time');
assert.ok(Math.max(...populationSizes) <= 12, 'traffic population stays bounded');

let yellowTransition = fixedWorld([
  car('before-crossing', 'horizontal', 0.35),
  car('past-stop-line', 'horizontal', 0.371),
]);
for (let frame = 0; frame < 20; frame += 1) {
  yellowTransition = advanceTrafficWorld(
    yellowTransition,
    { horizontal: 'YELLOW', vertical: 'RED' },
    50,
  );
}
assert.equal(
  Number(yellowTransition.cars[0].progress.toFixed(3)),
  0.37,
  'a car that had not entered the crossing stops on yellow',
);
assert.ok(
  yellowTransition.cars[1].progress > 0.371,
  'a car that passed the red stop line clears the crossing on yellow',
);

const redAfterStopLine = advanceTrafficWorld(
  fixedWorld([
    car('at-line', 'horizontal', 0.37),
    car('past-line', 'horizontal', 0.371),
  ]),
  { horizontal: 'RED', vertical: 'RED' },
  50,
);
assert.equal(redAfterStopLine.cars[0].progress, 0.37);
assert.ok(
  redAfterStopLine.cars[1].progress > 0.371,
  'red cannot stop a car after it passed the stop line',
);

const normalSpeed = advanceTrafficWorld(
  fixedWorld([car('speed', 'horizontal', 0.05)]),
  { horizontal: 'GREEN', vertical: 'RED' },
  25,
);
const quadrupleSpeed = advanceTrafficWorld(
  fixedWorld([car('speed', 'horizontal', 0.05)]),
  { horizontal: 'GREEN', vertical: 'RED' },
  100,
);
assert.equal(
  Number((quadrupleSpeed.cars[0].progress - 0.05).toFixed(6)),
  Number(((normalSpeed.cars[0].progress - 0.05) * 4).toFixed(6)),
  'world movement scales with simulator time',
);

let redTraffic = fixedWorld([
  car('queue-1', 'horizontal', 0.05),
  car('queue-2', 'horizontal', 0.15),
  car('queue-3', 'horizontal', 0.25),
]);
for (let frame = 0; frame < 400; frame += 1) {
  redTraffic = advanceTrafficWorld(
    redTraffic,
    { horizontal: 'RED', vertical: 'RED' },
    50,
  );
}
assert.equal(redTraffic.cars.length, 3);
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
  fixedWorld([
    car('h', 'horizontal', 0.5),
    car('v', 'vertical', 0.5),
  ]),
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
