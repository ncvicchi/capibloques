import type { SceneDefinition, ScenePosition } from './scene-model';

export type ParkingCapacity = 4 | 8 | 12;
export const parkingSlots = [
  { role: 'entryGate', kind: 'servo', name: 'Barrera de entrada', x: 105, y: 430 },
  { role: 'exitGate', kind: 'servo', name: 'Barrera de salida', x: 855, y: 430 },
  { role: 'entryArrival', kind: 'infraredBarrier', name: 'Auto en entrada', x: 160, y: 480 },
  { role: 'entryPassed', kind: 'infraredBarrier', name: 'Paso de entrada', x: 160, y: 375 },
  { role: 'exitArrival', kind: 'infraredBarrier', name: 'Auto en salida', x: 800, y: 390 },
  { role: 'exitPassed', kind: 'infraredBarrier', name: 'Paso de salida', x: 800, y: 485 },
] as const;
export type ParkingRole = typeof parkingSlots[number]['role'];
type Gate = 'entryGate' | 'exitGate';
type Detector = Exclude<ParkingRole, Gate>;
export function parkingCapacity(scene: SceneDefinition): ParkingCapacity { return scene.canvas.parkingCapacity ?? 8; }
export function nearestParkingSlot(kind: string, position: ScenePosition) {
  return parkingSlots.filter(slot => slot.kind === kind).reduce<typeof parkingSlots[number] | undefined>((best, slot) =>
    !best || Math.hypot(slot.x - position.x, slot.y - position.y) < Math.hypot(best.x - position.x, best.y - position.y) ? slot : best, undefined);
}
export function parkingBindings(scene: SceneDefinition): Partial<Record<ParkingRole, string>> {
  if (scene.canvas.background !== 'parking') return {};
  return Object.fromEntries(scene.devices.flatMap(device => {
    const slot = nearestParkingSlot(device.kind, device.position);
    return slot ? [[slot.role, device.id]] : [];
  }));
}
export function parkingSpacePosition(capacity: ParkingCapacity, space: number) {
  const columns = capacity / 2;
  return { x: 480 + (space % columns - (columns - 1) / 2) * 76, y: space < columns ? 130 : 320 };
}
export interface ParkingCar {
  id: number;
  phase: 'arriving' | 'entering' | 'parking' | 'parked' | 'leaving' | 'exiting' | 'jammed';
  x: number;
  y: number;
  angle: number;
  space: number | null;
  dwellMs: number;
  admitted: boolean;
}
export interface ParkingWorldState {
  capacity: ParkingCapacity;
  cars: ParkingCar[];
  gates: Record<Gate, number>;
  detectors: Record<Detector, boolean>;
  nextArrivalMs: number;
  nextId: number;
  randomState: number;
  entries: number;
  exits: number;
  jammed: boolean;
}
export function createParkingWorldState(capacity: ParkingCapacity = 8, entryAngle = 0, exitAngle = 0): ParkingWorldState {
  return { capacity, cars: [], gates: { entryGate: Math.max(0, Math.min(90, entryAngle)), exitGate: Math.max(0, Math.min(90, exitAngle)) },
    detectors: { entryArrival: false, entryPassed: false, exitArrival: false, exitPassed: false },
    nextArrivalMs: 800, nextId: 1, randomState: 0x7061726b, entries: 0, exits: 0, jammed: false };
}
function parkingFrame(previous: ParkingWorldState, targets: Partial<Record<Gate, number>>, ms: number): ParkingWorldState {
  const world = { ...previous, cars: previous.cars.map(car => ({ ...car })), gates: { ...previous.gates }, detectors: { ...previous.detectors } };
  const random = () => { world.randomState = (Math.imul(world.randomState, 1664525) + 1013904223) >>> 0; return world.randomState / 0x100000000; };
  const open = (role: Gate) => (targets[role] ?? 0) >= 90 && world.gates[role] >= 90;
  for (const role of ['entryGate', 'exitGate'] as const) {
    const difference = Math.max(0, Math.min(90, targets[role] ?? 0)) - world.gates[role];
    world.gates[role] += Math.sign(difference) * Math.min(Math.abs(difference), ms * 90 / 1200);
  }
  const move = (car: ParkingCar, x: number, y: number) => {
    const distance = Math.hypot(x - car.x, y - car.y), step = ms * 0.065;
    if (distance > 0) car.angle = Math.atan2(y - car.y, x - car.x) * 180 / Math.PI + 90;
    if (distance <= step) { car.x = x; car.y = y; return true; }
    car.x += (x - car.x) / distance * step; car.y += (y - car.y) / distance * step; return false;
  };
  const freeSpace = () => Array.from({ length: world.capacity }, (_, i) => i).find(i => !world.cars.some(car => car.space === i));
  world.nextArrivalMs = Math.max(0, world.nextArrivalMs - ms);
  // A bounded queue backs up outside the scene. It never deletes an admitted car.
  if (!world.nextArrivalMs && world.cars.filter(car => car.phase === 'arriving').length < 5 && !world.cars.some(car => car.phase === 'arriving' && car.y > 530)) {
    world.cars.push({ id: world.nextId++, phase: 'arriving', x: 160, y: 575, angle: 0, space: null, dwellMs: 0, admitted: false });
    world.nextArrivalMs = 1800 + random() * 5500;
  }
  for (const car of world.cars) {
    if (car.phase === 'arriving' || car.phase === 'entering') {
      const ahead = world.cars.filter(other => other.id !== car.id && ['arriving', 'entering', 'jammed'].includes(other.phase) && other.y < car.y).sort((a, b) => b.y - a.y)[0];
      let limit = ahead ? ahead.y + 145 : -100;
      if (!car.admitted && !open('entryGate')) limit = Math.max(limit, 455);
      car.y = Math.max(limit, car.y - ms * 0.065);
      if (car.y < 455) car.admitted = true;
      if (car.phase === 'arriving' && car.y <= 350) {
        car.phase = 'entering'; world.entries++;
        const space = freeSpace();
        if (space === undefined) car.phase = 'jammed';
        else car.space = space;
      }
      if (car.phase === 'entering' && car.y <= 230) { car.y = 230; car.phase = 'parking'; }
    } else if (car.phase === 'jammed') {
      const space = freeSpace();
      if (space !== undefined) { car.space = space; car.phase = 'entering'; }
    } else if (car.phase === 'parking') {
      const destination = parkingSpacePosition(world.capacity, car.space!);
      if (car.x !== destination.x) move(car, destination.x, 230);
      else if (move(car, destination.x, destination.y)) { car.phase = 'parked'; car.dwellMs = 12000 + random() * 24000; }
    } else if (car.phase === 'parked') {
      car.dwellMs = Math.max(0, car.dwellMs - ms);
      if (!car.dwellMs && !world.cars.some(other => other.phase === 'leaving')) car.phase = 'leaving';
    } else if (car.phase === 'leaving') {
      if (car.y !== 270) move(car, car.x, 270);
      else {
        // The exit queue has room for every space; don't overlap a waiting car.
        const ahead = world.cars.find(other => other.phase === 'exiting' && other.y < 270 + 145);
        if (!ahead && move(car, 800, 270)) { car.phase = 'exiting'; car.space = null; car.admitted = false; }
      }
    } else if (car.phase === 'exiting') {
      car.angle = 180;
      const ahead = world.cars.filter(other => other.phase === 'exiting' && other.y > car.y).sort((a, b) => a.y - b.y)[0];
      let limit = ahead ? ahead.y - 145 : 600;
      if (!car.admitted && !open('exitGate')) limit = Math.min(limit, 405);
      const previousY = car.y;
      car.y = Math.min(limit, car.y + ms * 0.065);
      if (car.y > 405) car.admitted = true;
      if (previousY <= 510 && car.y > 510) world.exits++;
    }
  }
  world.cars = world.cars.filter(car => car.phase !== 'exiting' || car.y < 600);
  for (const slot of parkingSlots) if (slot.kind === 'infraredBarrier') {
    world.detectors[slot.role] = world.cars.some(car => Math.abs(car.x - slot.x) < 20 && Math.abs(car.y - slot.y) <= 25);
  }
  world.jammed = world.cars.some(car => car.phase === 'jammed');
  return world;
}
/** Pure, bounded steps on the simulator clock: pause/step/speed/reset are shared. */
export function advanceParkingWorld(previous: ParkingWorldState, targets: Partial<Record<Gate, number>>, elapsedMs: number): ParkingWorldState {
  let world = previous;
  let remaining = Math.max(0, Math.min(2000, elapsedMs));
  while (remaining > 0) { const step = Math.min(16, remaining); world = parkingFrame(world, targets, step); remaining -= step; }
  return world;
}
