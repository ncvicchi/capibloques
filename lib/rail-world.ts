import type { SceneDefinition, ScenePosition } from './scene-model';

export type RailRole = 'northGate' | 'southGate' | 'westDetector' | 'eastDetector';
export const railSlots = [
  { role: 'northGate', kind: 'servo', name: 'Barrera norte', x: 395, y: 185 },
  { role: 'southGate', kind: 'servo', name: 'Barrera sur', x: 565, y: 355 },
  { role: 'westDetector', kind: 'infraredBarrier', name: 'Detector oeste', x: 140, y: 270 },
  { role: 'eastDetector', kind: 'infraredBarrier', name: 'Detector este', x: 820, y: 270 },
] as const;
export function nearestRailSlot(kind: string, position: ScenePosition) {
  return railSlots.filter(slot => slot.kind === kind).reduce<(typeof railSlots)[number] | undefined>((best, slot) =>
    !best || (slot.x - position.x) ** 2 + (slot.y - position.y) ** 2 < (best.x - position.x) ** 2 + (best.y - position.y) ** 2 ? slot : best, undefined);
}
export function railBindings(scene: SceneDefinition): Partial<Record<RailRole, string>> {
  if (scene.canvas.background !== 'railCrossing') return {};
  const bindings: Partial<Record<RailRole, string>> = {};
  for (const device of scene.devices) {
    const slot = nearestRailSlot(device.kind, device.position);
    if (slot) bindings[slot.role] = device.id;
  }
  return bindings;
}
export interface RailCar {
  id: number;
  lane: 'northbound' | 'southbound';
  y: number;
}
export interface RailWorldState {
  train: { id: number; direction: 1 | -1; front: number; length: number } | null;
  nextTrainInMs: number;
  nextTrainId: number;
  randomState: number;
  cars: RailCar[];
  nextCarId: number;
  spawnInMs: { northbound: number; southbound: number };
  gates: { northGate: number; southGate: number };
  detectors: { westDetector: boolean; eastDetector: boolean };
  collision: { trainId: number; carId: number } | null;
}
export function createRailWorldState(northAngle = 90, southAngle = 90): RailWorldState {
  return { train: null, nextTrainInMs: 3500, nextTrainId: 1, randomState: 0x7472656e,
    cars: [], nextCarId: 1, spawnInMs: { northbound: 700, southbound: 0 },
    gates: { northGate: Math.max(0, Math.min(90, northAngle)), southGate: Math.max(0, Math.min(90, southAngle)) },
    detectors: { westDetector: false, eastDetector: false }, collision: null };
}
export function railTrainBounds(train: NonNullable<RailWorldState['train']>) {
  return train.direction === 1 ? { left: train.front - train.length, right: train.front } : { left: train.front, right: train.front + train.length };
}
export function railCarPosition(car: RailCar) { return { x: car.lane === 'southbound' ? 435 : 525, y: car.y }; }

function railFrame(previous: RailWorldState, targets: Partial<Record<'northGate' | 'southGate', number>>, ms: number): RailWorldState {
  if (previous.collision || ms <= 0) return previous;
  const world: RailWorldState = { ...previous, gates: { ...previous.gates }, spawnInMs: { ...previous.spawnInMs }, detectors: { ...previous.detectors }, cars: previous.cars.map(car => ({ ...car })) };
  const random = () => {
    world.randomState = (Math.imul(world.randomState, 1664525) + 1013904223) >>> 0;
    return world.randomState / 0x100000000;
  };
  for (const role of ['northGate', 'southGate'] as const) {
    const target = Math.max(0, Math.min(90, targets[role] ?? 0));
    const difference = target - world.gates[role];
    world.gates[role] += Math.sign(difference) * Math.min(Math.abs(difference), ms * 90 / 1200);
  }
  if (!world.train) {
    world.nextTrainInMs = Math.max(0, world.nextTrainInMs - ms);
    if (!world.nextTrainInMs) {
      const direction = random() < 0.5 ? 1 : -1;
      world.train = { id: world.nextTrainId++, direction, front: direction === 1 ? -30 : 990, length: 170 + Math.round(random() * 80) };
    }
  } else {
    world.train = { ...world.train, front: world.train.front + world.train.direction * ms * 0.085 };
    const bounds = railTrainBounds(world.train);
    if (bounds.left > 1010 || bounds.right < -50) {
      world.train = null;
      world.nextTrainInMs = 6500 + Math.round(random() * 6500);
    }
  }
  const bounds = world.train ? railTrainBounds(world.train) : null;
  world.detectors.westDetector = !!bounds && bounds.left <= 140 && bounds.right >= 140;
  world.detectors.eastDetector = !!bounds && bounds.left <= 820 && bounds.right >= 820;
  for (const lane of ['southbound', 'northbound'] as const) {
    const direction = lane === 'southbound' ? 1 : -1;
    const role = lane === 'southbound' ? 'northGate' : 'southGate';
    const stop = lane === 'southbound' ? 160 : 380;
    const open = (targets[role] ?? 0) >= 90 && world.gates[role] >= 89.999;
    const cars = world.cars.filter(car => car.lane === lane).sort((a, b) => direction * (b.y - a.y));
    let preceding: RailCar | undefined;
    for (const car of cars) {
      let next = car.y + direction * ms * 0.052;
      // La línea se evalúa por centro lógico: pasado el punto no se frena
      // sobre las vías, aunque la barrera empiece a bajar.
      if (!open && direction * (car.y - stop) <= 0) next = direction === 1 ? Math.min(next, stop) : Math.max(next, stop);
      if (preceding) next = direction === 1 ? Math.min(next, preceding.y - 46) : Math.max(next, preceding.y + 46);
      car.y = direction === 1 ? Math.max(car.y, next) : Math.min(car.y, next);
      preceding = car;
    }
    world.spawnInMs[lane] = Math.max(0, world.spawnInMs[lane] - ms);
    const entry = lane === 'southbound' ? -35 : 575;
    if (!world.spawnInMs[lane] && world.cars.length < 12 && !cars.some(car => Math.abs(car.y - entry) < 60)) {
      world.cars.push({ id: world.nextCarId++, lane, y: entry });
      world.spawnInMs[lane] = 1200 + Math.round(random() * 5000);
    }
  }
  world.cars = world.cars.filter(car => car.y > -65 && car.y < 605);
  if (bounds && world.train) {
    const car = world.cars.find(candidate => {
      const at = railCarPosition(candidate);
      return Math.abs(at.y - 270) < 32 && at.x + 16 >= bounds.left && at.x - 16 <= bounds.right;
    });
    if (car) world.collision = { trainId: world.train.id, carId: car.id };
  }
  return world;
}
export function advanceRailWorld(previous: RailWorldState, targets: Partial<Record<'northGate' | 'southGate', number>>, elapsedMs: number) {
  let world = previous;
  let remaining = Number.isFinite(elapsedMs) ? Math.max(0, Math.min(2000, elapsedMs)) : 0;
  while (remaining > 0 && !world.collision) {
    const ms = Math.min(16, remaining);
    world = railFrame(world, targets, ms);
    remaining -= ms;
  }
  return world;
}
