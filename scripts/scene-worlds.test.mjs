import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addDeviceToScene,
  closestCrossroadsTrafficSlot,
  constrainSceneItemPosition,
  crossroadsTrafficSlots,
  createSceneFromTemplate,
  enabledTrafficDirections,
  isSceneDefinition,
  migrateSceneDefinition,
  removeDeviceFromScene,
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
for (const slot of crossroadsTrafficSlots) {
  assert.ok(
    (slot.x < 390 || slot.x > 570) && (slot.y < 180 || slot.y > 360),
    `${slot.id} traffic light must stand on the garden, outside both roads`,
  );
}
assert.deepEqual(
  Object.fromEntries(crossroadsTrafficSlots.map(slot => [slot.id, slot.direction])),
  {
    north: 'northbound',
    east: 'eastbound',
    south: 'southbound',
    west: 'westbound',
  },
  'cada esquina debe gobernar el carril que avanza hacia ella',
);
const selectedDirections = structuredClone(intersection);
selectedDirections.canvas.trafficDirections = ['eastbound', 'northbound'];
assert.ok(isSceneDefinition(selectedDirections));
assert.deepEqual(enabledTrafficDirections(selectedDirections), [
  'eastbound',
  'northbound',
]);

const moved = constrainSceneItemPosition(
  intersection,
  intersection.devices[0],
  { x: 940, y: 520 },
);
assert.deepEqual(moved, { x: 620, y: 405 });
const oldIntersection = structuredClone(intersection);
oldIntersection.devices.find(device => device.id === 'traffic-light-1').position = {
  x: 305,
  y: 210,
};
const migratedIntersection = migrateSceneDefinition(oldIntersection);
assert.equal(migratedIntersection.migrated, true);
assert.deepEqual(
  migratedIntersection.scene.devices.find(
    device => device.id === 'traffic-light-1',
  ).position,
  { x: 340, y: 135 },
);

let full = intersection;
full = addDeviceToScene(full, 'trafficLight').scene;
full = addDeviceToScene(full, 'trafficLight').scene;
assert.deepEqual(
  full.devices
    .filter(device => device.kind === 'trafficLight')
    .map(device => device.name),
  ['Semáforo 1', 'Semáforo 2', 'Semáforo 3', 'Semáforo 4'],
);
assert.throws(
  () => addDeviceToScene(full, 'trafficLight'),
  /cuatro lugares seguros/,
);
const withoutSecondLight = removeDeviceFromScene(full, 'traffic-light-2');
const reusedTrafficNumber = addDeviceToScene(
  withoutSecondLight,
  'trafficLight',
);
assert.equal(reusedTrafficNumber.device.name, 'Semáforo 2');
assert.equal(
  new Set(
    reusedTrafficNumber.scene.devices
      .filter(device => device.kind === 'trafficLight')
      .map(device => closestCrossroadsTrafficSlot(device.position).id),
  ).size,
  4,
);
assert.throws(
  () => addDeviceToScene(createSceneFromTemplate('robotCourse'), 'trafficLight'),
  /sólo se pueden agregar en la escena Cruce/,
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
  spawnInMs: {
    eastbound: 1_000_000,
    westbound: 1_000_000,
    southbound: 1_000_000,
    northbound: 1_000_000,
  },
});
const signals = (
  eastbound = 'RED',
  westbound = 'RED',
  southbound = 'RED',
  northbound = 'RED',
) => ({ eastbound, westbound, southbound, northbound });

let generatedTraffic = {
  ...createTrafficWorldState(),
  spawnInMs: {
    eastbound: 0,
    westbound: 1_000_000,
    southbound: 1_000_000,
    northbound: 1_000_000,
  },
};
const generatedIds = new Set();
const populationSizes = new Set();
let previousIds = new Set();
let destroyedCar = false;
for (let frame = 0; frame < 1_500; frame += 1) {
  generatedTraffic = advanceTrafficWorld(
    generatedTraffic,
    signals('GREEN'),
    50,
    ['eastbound'],
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

let fourWayTraffic = createTrafficWorldState();
for (let frame = 0; frame < 80; frame += 1) {
  fourWayTraffic = advanceTrafficWorld(
    fourWayTraffic,
    signals(),
    50,
  );
}
assert.deepEqual(
  [...new Set(fourWayTraffic.cars.map(item => item.lane))].sort(),
  ['eastbound', 'northbound', 'southbound', 'westbound'],
  'double-way streets can generate traffic in all four directions',
);

let noTraffic = createTrafficWorldState();
for (let frame = 0; frame < 100; frame += 1) {
  noTraffic = advanceTrafficWorld(noTraffic, signals('GREEN'), 50, []);
}
assert.equal(noTraffic.cars.length, 0, 'the scene can disable every traffic direction');

let yellowTransition = fixedWorld([
  car('before-crossing', 'eastbound', 0.35),
  car('past-stop-line', 'eastbound', 0.371),
]);
for (let frame = 0; frame < 20; frame += 1) {
  yellowTransition = advanceTrafficWorld(
    yellowTransition,
    signals('YELLOW'),
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

let offTransition = fixedWorld([
  car('off-before-crossing', 'eastbound', 0.35),
  car('off-past-stop-line', 'eastbound', 0.371),
]);
for (let frame = 0; frame < 20; frame += 1) {
  offTransition = advanceTrafficWorld(offTransition, signals('OFF'), 50);
}
assert.equal(
  Number(offTransition.cars[0].progress.toFixed(3)),
  0.37,
  'an off traffic light stops cars that have not crossed, like yellow',
);
assert.ok(
  offTransition.cars[1].progress > 0.371,
  'an off traffic light lets cars already past the stop line clear the crossing',
);

const redAfterStopLine = advanceTrafficWorld(
  fixedWorld([
    car('at-line', 'eastbound', 0.37),
    car('past-line', 'eastbound', 0.371),
  ]),
  signals(),
  50,
);
assert.equal(redAfterStopLine.cars[0].progress, 0.37);
assert.ok(
  redAfterStopLine.cars[1].progress > 0.371,
  'red cannot stop a car after it passed the stop line',
);

const normalSpeed = advanceTrafficWorld(
  fixedWorld([car('speed', 'eastbound', 0.05)]),
  signals('GREEN'),
  25,
);
const quadrupleSpeed = advanceTrafficWorld(
  fixedWorld([car('speed', 'eastbound', 0.05)]),
  signals('GREEN'),
  100,
);
assert.equal(
  Number((quadrupleSpeed.cars[0].progress - 0.05).toFixed(6)),
  Number(((normalSpeed.cars[0].progress - 0.05) * 4).toFixed(6)),
  'world movement scales with simulator time',
);

let redTraffic = fixedWorld([
  car('queue-1', 'eastbound', 0.05),
  car('queue-2', 'eastbound', 0.15),
  car('queue-3', 'eastbound', 0.25),
]);
for (let frame = 0; frame < 400; frame += 1) {
  redTraffic = advanceTrafficWorld(
    redTraffic,
    signals(),
    50,
  );
}
assert.equal(redTraffic.cars.length, 3);
const horizontalQueue = redTraffic.cars
  .filter(car => car.lane === 'eastbound')
  .map(car => car.progress)
  .sort((left, right) => right - left);
assert.deepEqual(horizontalQueue.map(value => Number(value.toFixed(3))), [0.37, 0.315, 0.26]);
assert.ok(
  redTraffic.cars
    .filter(car => car.lane === 'eastbound')
    .every(car => car.waitingForGreen),
  'cars stopped by red remember that they are waiting for green',
);
const yellowAfterRed = advanceTrafficWorld(
  redTraffic,
  signals('YELLOW'),
  100,
);
assert.deepEqual(
  yellowAfterRed.cars
    .filter(car => car.lane === 'eastbound')
    .map(car => car.progress),
  redTraffic.cars
    .filter(car => car.lane === 'eastbound')
    .map(car => car.progress),
  'a queue stopped by red must not start on yellow',
);
const greenAfterRed = advanceTrafficWorld(
  yellowAfterRed,
  signals('GREEN'),
  100,
);
assert.ok(
  greenAfterRed.cars
    .filter(car => car.lane === 'eastbound')
    .every((car, index) => car.progress > yellowAfterRed.cars.filter(candidate => candidate.lane === 'eastbound')[index].progress),
  'the stopped queue starts on green',
);

const collision = advanceTrafficWorld(
  fixedWorld([
    car('h', 'eastbound', 480 / 1_050),
    car('v', 'southbound', 355 / 620),
  ]),
  signals('GREEN', 'RED', 'YELLOW'),
  0,
);
assert.deepEqual(collision.collision, { horizontalId: 'h', verticalId: 'v' });
assert.ok(collision.cars.every(car => car.crashed));
assert.deepEqual(
  advanceTrafficWorld(collision, signals(), 100),
  collision,
  'a collision stays a collision',
);

const stageSource = readFileSync(new URL('../components/scene-stage.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../components/capiblocks-app.tsx', import.meta.url), 'utf8');
const reviewSource = readFileSync(new URL('../components/review-simulation.tsx', import.meta.url), 'utf8');
assert.match(stageSource, /key={`scene-world:\$\{scene\.id}:\$\{simulationEpoch}`}/);
assert.match(appSource, /setSimulationEpoch\(\(current\) => current \+ 1\)/);
assert.match(reviewSource, /type === 'RESET'.*setSimulationEpoch/);
console.log('Mundos de escena: plantillas, carriles y límites validados.');
