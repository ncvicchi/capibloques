import assert from 'node:assert/strict';
import { advanceRailWorld, createRailWorldState, railBindings, railSlots, railTrainBounds } from '../lib/rail-world.ts';
import { addDeviceToScene, appendTemplateToScene, constrainSceneItemPosition, createEmptyScene, createSceneFromTemplate, isSceneDefinition, validateScene } from '../lib/scene-model.ts';
import { decodeProject, examples, makeProject } from '../lib/capiblocks.ts';

const rail = createSceneFromTemplate('railCrossing');
assert.equal(isSceneDefinition(rail), true);
assert.equal(validateScene(rail).valid, true);
assert.equal(Object.keys(railBindings(rail)).length, 4);
assert.equal(rail.devices.length, 7);
const workspace = examples.find(example => example.id === 'railCrossing').workspace;
const project = makeProject('Tren', rail, workspace);
assert.deepEqual(JSON.parse(JSON.stringify(decodeProject(JSON.parse(JSON.stringify(project))).project.scene)), JSON.parse(JSON.stringify(rail)));
assert.equal(appendTemplateToScene(createEmptyScene(), 'railCrossing').scene.canvas.background, 'railCrossing');
const retiredScene = createEmptyScene();
retiredScene.retiredDeviceIds = ['servo-1', 'infraredBarrier-1'];
const appended = appendTemplateToScene(retiredScene, 'railCrossing').scene;
assert.deepEqual(appended.retiredDeviceIds, retiredScene.retiredDeviceIds);
assert.ok(appended.devices.every(device => !retiredScene.retiredDeviceIds.includes(device.id)), 'no reusar IDs retirados al agregar aventura');
assert.equal(appendTemplateToScene(createSceneFromTemplate('robot'), 'railCrossing').addedDeviceIds.length, 0, 'no reasignar escena ajena');
for (const kind of ['servo', 'infraredBarrier']) assert.throws(() => addDeviceToScene(rail, kind), /dos barreras/);
for (const slot of railSlots) {
  const item = rail.devices.find(device => device.id === railBindings(rail)[slot.role]);
  assert.deepEqual(constrainSceneItemPosition(rail, item, { x: slot.x + 3, y: slot.y + 3 }), { x: slot.x, y: slot.y });
}
const duplicate = structuredClone(rail);
duplicate.devices[1].position = { ...duplicate.devices[0].position };
assert.equal(validateScene(duplicate).valid, false);
const outside = structuredClone(rail);
outside.devices[0].position.x += 20;
assert.equal(validateScene(outside).valid, false);

const open = { northGate: 90, southGate: 90 }, closed = { northGate: 0, southGate: 0 };
const initial = createRailWorldState();
assert.deepEqual(advanceRailWorld(initial, open, 0), initial);
const moving = advanceRailWorld(initial, closed, 600);
assert.ok(Math.abs(moving.gates.northGate - 45) < 1e-9, 'bajada cooperativa tarda 1,2 s');
assert.equal(initial.gates.northGate, 90, 'no mutar estado previo');
assert.equal(advanceRailWorld(moving, closed, 600).gates.northGate, 0);
const opening = advanceRailWorld(createRailWorldState(0, 0), open, 1190);
assert.ok(opening.gates.northGate < 90);
const near = { ...createRailWorldState(0, 0), cars: [{ id: 1, lane: 'southbound', y: 160 }], nextCarId: 2 };
assert.equal(advanceRailWorld(near, open, 600).cars[0].y, 160, 'no arrancar durante apertura');
assert.ok(advanceRailWorld(near, open, 1300).cars[0].y > 160);
const cleared = { ...initial, cars: [{ id: 1, lane: 'southbound', y: 160.01 }, { id: 2, lane: 'northbound', y: 379.99 }] };
const closing = advanceRailWorld(cleared, closed, 100);
assert.ok(closing.cars[0].y > 160.01 && closing.cars[1].y < 379.99, 'quienes pasaron la línea despejan');
const independent = { ...createRailWorldState(0, 0), cars: [{ id: 1, lane: 'southbound', y: 160 }, { id: 2, lane: 'northbound', y: 380 }] };
const oneOpen = advanceRailWorld(independent, { northGate: 90, southGate: 0 }, 1500);
assert.ok(oneOpen.cars.find(car => car.id === 1).y > 160);
assert.equal(oneOpen.cars.find(car => car.id === 2).y, 380, 'cada barrera gobierna sólo su acceso');
for (const direction of [1, -1]) {
  const x = direction === 1 ? 140 : 820, role = direction === 1 ? 'westDetector' : 'eastDetector';
  let world = { ...createRailWorldState(0, 0), train: { id: 99, direction, front: x, length: 220 } };
  world = advanceRailWorld(world, closed, 16);
  assert.equal(world.detectors[role], true);
  world = advanceRailWorld(world, closed, 2000);
  assert.equal(world.detectors[role], true, 'el detector sigue ocupado por vagones tras pasar locomotora');
  world = advanceRailWorld(world, closed, 1000);
  assert.equal(world.detectors[role], false, 'se libera después del último vagón');
  assert.ok(railTrainBounds(world.train).right > railTrainBounds(world.train).left);
}
let safe = createRailWorldState(0, 0);
const seenTrains = new Set(), directions = new Set();
for (let i = 0; i < 4000; i++) {
  safe = advanceRailWorld(safe, closed, 50);
  assert.equal(safe.collision, null, 'barreras cerradas evitan colisión');
  assert.ok(safe.cars.length <= 12);
  if (safe.train) { seenTrains.add(safe.train.id); directions.add(safe.train.direction); }
}
assert.ok(seenTrains.size >= 3);
assert.equal(directions.size, 2, 'llegadas desde ambos sentidos');
const conflict = advanceRailWorld({ ...initial, train: { id: 9, direction: 1, front: 500, length: 220 }, cars: [{ id: 7, lane: 'southbound', y: 270 }] }, open, 16);
assert.deepEqual(conflict.collision, { trainId: 9, carId: 7 });
assert.deepEqual(advanceRailWorld(conflict, closed, 1000), conflict, 'el choque no desaparece al cerrar barreras');
assert.equal(createRailWorldState().collision, null);
assert.equal(createRailWorldState().cars.length, 0);
const normal = advanceRailWorld(initial, open, 100), fast = advanceRailWorld(initial, open, 400);
assert.equal(initial.nextTrainInMs - fast.nextTrainInMs, 4 * (initial.nextTrainInMs - normal.nextTrainInMs));
assert.deepEqual(advanceRailWorld(initial, open, 500), advanceRailWorld(initial, open, 500), 'azar reproducible');
console.log('Paso a nivel: modelo, sensores, barreras, colisiones, reloj y proyecto portable aprobados.');
