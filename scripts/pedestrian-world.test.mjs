import assert from 'node:assert/strict';
import { advanceTrafficWorld, createTrafficWorldState, trafficCarPosition } from '../lib/traffic-world.ts';
import { advancePedestrians, createPedestrianWorldState, crossingIds, crossingPaths, pedestrianPosition } from '../lib/pedestrian-world.ts';

const red = { eastbound: 'RED', westbound: 'RED', southbound: 'RED', northbound: 'RED' };
const green = { eastbound: 'GREEN', westbound: 'GREEN', southbound: 'GREEN', northbound: 'GREEN' };
const person = (crossing = 'west', direction = 1) => ({ id: 'p', crossing, direction, progress: 0, started: false });
const isolated = people => ({ ...createPedestrianWorldState(), people, spawnInMs: { north: 1e6, east: 1e6, south: 1e6, west: 1e6 } });
for (const signal of ['OFF', 'DONT_WALK']) {
  const waiting = isolated([person()]);
  assert.deepEqual(advancePedestrians(waiting, { west: signal }, 100).people, waiting.people);
}
for (const crossing of crossingIds) {
  for (const direction of [1, -1]) {
    const original = isolated([person(crossing, direction)]);
    const started = advancePedestrians(original, { [crossing]: 'WALK' }, 100);
    assert.equal(started.people[0].started, true);
    assert.ok(started.people[0].progress > 0);
    assert.deepEqual(original.people[0], person(crossing, direction), 'no mutar el estado previo');
    const closed = advancePedestrians(started, { [crossing]: 'DONT_WALK' }, 100);
    assert.ok(closed.people[0].progress > started.people[0].progress, 'quien cruzó continúa tras cierre');
    const path = crossingPaths[crossing];
    assert.deepEqual(pedestrianPosition({ ...person(crossing, direction), started: true }), direction === 1 ? path.from : path.to);
    let finish = closed;
    for (let i = 0; i < 60; i++) finish = advancePedestrians(finish, {}, 100);
    assert.equal(finish.people.length, 0, 'se destruye al salir, incluso si se retira el cartel');
  }
}
const off = isolated([person('north'), { ...person('west'), id: 'w' }]);
const specific = advancePedestrians(off, { north: 'WALK', west: 'OFF' }, 100);
assert.equal(specific.people[0].started, true);
assert.equal(specific.people[1].started, false, 'no habilitar otro paso por rebote');
assert.deepEqual(advancePedestrians(off, { north: 'WALK' }, 0), off, 'pausa exacta');
let bounded = createPedestrianWorldState();
for (let i = 0; i < 5000; i++) bounded = advancePedestrians(bounded, { north: 'OFF', east: 'OFF', south: 'OFF', west: 'OFF' }, 100);
assert.equal(bounded.people.length, 16);
assert.ok(crossingIds.every(crossing => bounded.people.filter(p => p.crossing === crossing).length === 4));
assert.ok(crossingIds.every(crossing => new Set(bounded.people.filter(p => p.crossing === crossing).map(p => p.direction)).size === 2), 'cada paso recibe peatones desde ambas veredas');
assert.equal(advancePedestrians(createPedestrianWorldState(), {}, 100).people.length, 0, 'sin cartel no hay población');
assert.deepEqual(advancePedestrians(createPedestrianWorldState(), { west: 'WALK' }, 100), advancePedestrians(createPedestrianWorldState(), { west: 'WALK' }, 100), 'azar reproducible');

const fixed = () => ({ ...createTrafficWorldState(), spawnInMs: { eastbound: 1e6, westbound: 1e6, northbound: 1e6, southbound: 1e6 }, pedestrians: isolated([person()]) });
const regular = advanceTrafficWorld(fixed(), red, 100, [], { west: 'WALK' });
const fast = advanceTrafficWorld(fixed(), red, 400, [], { west: 'WALK' });
assert.equal(fast.pedestrians.people[0].progress, regular.pedestrians.people[0].progress * 4, 'velocidad compartida y subpasos');
const waitingForCarGreen = advanceTrafficWorld(fixed(), green, 100, [], { west: 'OFF' });
assert.equal(waitingForCarGreen.pedestrians.people[0].started, false, 'verde vehicular no habilita peatones');
const hit = fixed();
hit.pedestrians.people[0] = { ...person(), started: true, progress: (315 - 170) / 200 };
hit.cars = [{ id: 'car', lane: 'eastbound', progress: (375 + 45) / 1050, crashed: false, waitingForGreen: false, clearingIntersection: true }];
assert.deepEqual(trafficCarPosition(hit.cars[0]), { x: 375, y: 315 });
const conflict = advanceTrafficWorld(hit, red, 0, ['eastbound'], { west: 'DONT_WALK' });
assert.deepEqual(conflict.pedestrianCollision, { carId: 'car', pedestrianId: 'p', crossing: 'west' });
assert.equal(conflict.cars[0].crashed, true);
assert.deepEqual(advanceTrafficWorld(conflict, red, 100), conflict, 'conflicto persiste hasta reiniciar');
const safe = fixed();
safe.cars = hit.cars;
assert.equal(advanceTrafficWorld(safe, red, 0, ['eastbound'], { west: 'OFF' }).pedestrianCollision, null, 'peatón en vereda no provoca conflicto');
for (const [lane, progress, crossing, pedestrianProgress] of [
  ['eastbound', 0.37, 'west', (315 - 170) / 200],
  ['westbound', 0.37, 'east', (225 - 170) / 200],
  ['southbound', 0.3, 'north', (435 - 380) / 200],
  ['northbound', 0.3, 'south', (525 - 380) / 200],
]) {
  const stopped = fixed();
  stopped.cars = [{ ...hit.cars[0], lane, progress, clearingIntersection: false }];
  stopped.pedestrians = isolated([{ ...person(crossing), started: true, progress: pedestrianProgress }]);
  assert.equal(advanceTrafficWorld(stopped, red, 0, [lane], { [crossing]: 'WALK' }).pedestrianCollision, null, `${lane}: auto en línea roja no invade senda`);
}
assert.equal(createTrafficWorldState().pedestrianCollision, null);
assert.equal(createTrafficWorldState().pedestrians.people.length, 0, 'reinicio limpia actores y conflictos');
console.log('Peatones: cuatro pasos, permisos, despeje, reloj, límites y conflictos validados.');
