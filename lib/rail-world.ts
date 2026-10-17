import type { SceneDefinition, ScenePosition } from './scene-model';

export type RailRole = 'northGate' | 'southGate' | 'westDetector' | 'eastDetector' | `westDetector${number}` | `eastDetector${number}`;
export type RailTrackCount = 1 | 2 | 4;
export function railTrackCount(scene: SceneDefinition): RailTrackCount { return scene.canvas.railTracks ?? 1; }
export function railTrackY(count: RailTrackCount, track: number) { return count === 1 ? 270 : count === 2 ? 230 + track * 80 : 180 + track * 60; }
export function railGateY(count: RailTrackCount, north: boolean) { return count === 1 ? (north ? 185 : 355) : count === 2 ? (north ? 145 : 395) : (north ? 105 : 435); }
export function railDetectorRole(track: number, west: boolean): RailRole { return `${west ? 'west' : 'east'}Detector${track ? track + 1 : ''}` as RailRole; }
export function railSlotsFor(count: RailTrackCount) {
  return [
    { role: 'northGate' as RailRole, kind: 'servo' as const, name: 'Barrera norte', x: 395, y: railGateY(count, true) },
    { role: 'southGate' as RailRole, kind: 'servo' as const, name: 'Barrera sur', x: 565, y: railGateY(count, false) },
    ...Array.from({ length: count }, (_, track) => [true, false].map(west => ({ role: railDetectorRole(track, west), kind: 'infraredBarrier' as const, name: `Detector ${west ? 'oeste' : 'este'}${count === 1 ? '' : ` vía ${track + 1}`}`, x: west ? 140 : 820, y: railTrackY(count, track) }))).flat(),
  ];
}
export const railSlots = [
  { role: 'northGate', kind: 'servo', name: 'Barrera norte', x: 395, y: 185 },
  { role: 'southGate', kind: 'servo', name: 'Barrera sur', x: 565, y: 355 },
  { role: 'westDetector', kind: 'infraredBarrier', name: 'Detector oeste', x: 140, y: 270 },
  { role: 'eastDetector', kind: 'infraredBarrier', name: 'Detector este', x: 820, y: 270 },
] as const;
export function nearestRailSlot(kind: string, position: ScenePosition, count: RailTrackCount = 1) {
  return railSlotsFor(count).filter(slot => slot.kind === kind).reduce<ReturnType<typeof railSlotsFor>[number] | undefined>((best, slot) =>
    !best || (slot.x - position.x) ** 2 + (slot.y - position.y) ** 2 < (best.x - position.x) ** 2 + (best.y - position.y) ** 2 ? slot : best, undefined);
}
export function railBindings(scene: SceneDefinition): Partial<Record<RailRole, string>> {
  if (scene.canvas.background !== 'railCrossing') return {};
  const bindings: Partial<Record<RailRole, string>> = {};
  for (const device of scene.devices) {
    const slot = nearestRailSlot(device.kind, device.position, railTrackCount(scene));
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
  trackCount: RailTrackCount;
  trains: Array<{ id: number; direction: 1 | -1; front: number; length: number; track: number }>;
  trackTimers: number[];
  train: { id: number; direction: 1 | -1; front: number; length: number } | null;
  nextTrainInMs: number;
  nextTrainId: number;
  randomState: number;
  cars: RailCar[];
  nextCarId: number;
  spawnInMs: { northbound: number; southbound: number };
  gates: { northGate: number; southGate: number };
  detectors: Partial<Record<RailRole, boolean>>;
  collision: { trainId: number; carId: number } | null;
}
export function createRailWorldState(northAngle = 90, southAngle = 90, trackCount: RailTrackCount = 1): RailWorldState {
  return { trackCount, trains: [], trackTimers: Array.from({length: trackCount}, (_, i) => 3500 + i * 700), train: null, nextTrainInMs: 3500, nextTrainId: 1, randomState: 0x7472656e,
    cars: [], nextCarId: 1, spawnInMs: { northbound: 700, southbound: 0 },
    gates: { northGate: Math.max(0, Math.min(90, northAngle)), southGate: Math.max(0, Math.min(90, southAngle)) },
    detectors: Object.fromEntries(railSlotsFor(trackCount).filter(slot => slot.kind === 'infraredBarrier').map(slot => [slot.role, false])), collision: null };
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
  if (world.trackCount > 1) {
    world.trackTimers = [...previous.trackTimers];
    world.trains = previous.trains.map(train => ({ ...train, front: train.front + train.direction * ms * 0.045 }));
    for (let track = 0; track < world.trackCount; track++) {
      const train = world.trains.find(item => item.track === track);
      if (train) {
        const bounds = railTrainBounds(train);
        if (bounds.left > 1010 || bounds.right < -50) {
          world.trains = world.trains.filter(item => item.id !== train.id);
          world.trackTimers[track] = 6500 + Math.round(random() * 11000);
        }
      } else {
        world.trackTimers[track] = Math.max(0, world.trackTimers[track] - ms);
        if (!world.trackTimers[track]) {
          const direction = track % 2 === 0 ? 1 : -1;
          world.trains.push({ id: world.nextTrainId++, track, direction, front: direction === 1 ? -30 : 990, length: 170 + Math.round(random() * 80) });
        }
      }
    }
    world.train = world.trains[0] ?? null;
    world.nextTrainInMs = world.trackTimers[0];
  } else if (!world.train) {
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
  if (world.trackCount === 1) world.trains = world.train ? [{ ...world.train, track: 0 }] : [];
  for (let track = 0; track < world.trackCount; track++) {
    const train = world.trains.find(item => item.track === track);
    const bounds = train ? railTrainBounds(train) : null;
    world.detectors[railDetectorRole(track, true)] = !!bounds && bounds.left <= 140 && bounds.right >= 140;
    world.detectors[railDetectorRole(track, false)] = !!bounds && bounds.left <= 820 && bounds.right >= 820;
  }
  for (const lane of ['southbound', 'northbound'] as const) {
    const direction = lane === 'southbound' ? 1 : -1;
    const role = lane === 'southbound' ? 'northGate' : 'southGate';
    const stop = railGateY(world.trackCount, lane === 'southbound') + (lane === 'southbound' ? -25 : 25);
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
  for (const train of world.trains) {
    const bounds = railTrainBounds(train);
    const car = world.cars.find(candidate => {
      const at = railCarPosition(candidate);
      return Math.abs(at.y - railTrackY(world.trackCount, train.track)) < 32 && at.x + 16 >= bounds.left && at.x - 16 <= bounds.right;
    });
    if (car) { world.collision = { trainId: train.id, carId: car.id }; break; }
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
