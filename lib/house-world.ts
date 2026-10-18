import type { SceneDefinition, ScenePosition } from './scene-model';

export type HouseVisitorKind = 'known' | 'unknown' | 'none';
export interface HouseEnvironment { night: boolean; automaticDay: boolean; automaticArrivals: boolean; nextVisitor: HouseVisitorKind }
export const defaultHouseEnvironment: HouseEnvironment = { night: false, automaticDay: false, automaticArrivals: true, nextVisitor: 'known' };
export function validHouseEnvironment(value: unknown): value is HouseEnvironment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 4 && typeof v.night === 'boolean' && typeof v.automaticDay === 'boolean' && typeof v.automaticArrivals === 'boolean' && ['known', 'unknown', 'none'].includes(String(v.nextVisitor)) && typeof v.nextVisitor === 'string';
}
export const houseSlots = [
  { role: 'door', kind: 'servo', name: 'Puerta de la casa', x: 450, y: 280 },
  { role: 'bell', kind: 'button', name: 'Timbre', x: 300, y: 230 },
  { role: 'exitButton', kind: 'button', name: 'Pedir salir', x: 570, y: 230 },
  { role: 'outsideMotion', kind: 'pirSensor', name: 'Presencia exterior', x: 175, y: 230 },
  { role: 'insideMotion', kind: 'pirSensor', name: 'Presencia interior', x: 755, y: 150 },
  { role: 'passage', kind: 'infraredBarrier', name: 'Paso de la puerta', x: 450, y: 380 },
  { role: 'insideLux', kind: 'lightSensor', name: 'Luminosidad interior', x: 650, y: 150 },
  { role: 'outsideLux', kind: 'lightSensor', name: 'Luminosidad exterior', x: 65, y: 130 },
  { role: 'outsideLight', kind: 'led', name: 'Luz de entrada', x: 175, y: 130 },
  { role: 'insideLight', kind: 'led', name: 'Luz de la habitación', x: 860, y: 130 },
  { role: 'reader', kind: 'cardReader', name: 'Tarjeta de entrada', x: 340, y: 150 },
] as const;
export type HouseRole = typeof houseSlots[number]['role'];
export const houseFreeRoles = ['bell', 'exitButton', 'outsideLight', 'insideLight'] as const;
export type HouseFreeRole = typeof houseFreeRoles[number];
export const houseInputRoles = ['bell', 'exitButton', 'outsideMotion', 'insideMotion', 'passage', 'insideLux', 'outsideLux', 'reader'] as const;
export function nearestHouseSlot(kind: string, position: ScenePosition) {
  return houseSlots.filter(slot => slot.kind === kind && slot.kind !== 'led' && slot.kind !== 'button').reduce<typeof houseSlots[number] | undefined>((best, slot) => !best || Math.hypot(slot.x - position.x, slot.y - position.y) < Math.hypot(best.x - position.x, best.y - position.y) ? slot : best, undefined);
}
export function houseBindings(scene: SceneDefinition): Partial<Record<HouseRole, string>> {
  if (scene.canvas.background !== 'smartHouse') return {};
  const bindings = Object.fromEntries(scene.devices.flatMap(device => { const slot = nearestHouseSlot(device.kind, device.position); return slot ? [[slot.role, device.id]] : []; }));
  for (const role of houseFreeRoles) {
    const slot = houseSlots.find(slot => slot.role === role)!;
    const id = scene.canvas.houseAssignments?.[role] ?? (scene.canvas.houseAssignments ? undefined : scene.devices.find(d => d.kind === slot.kind && d.position.x === slot.x && d.position.y === slot.y)?.id);
    if (id && scene.devices.some(d => d.id === id && d.kind === slot.kind)) bindings[role] = id;
  }
  return bindings;
}
export interface HousePerson { id: number; card: 'azul' | 'roja' | 'ninguna'; phase: 'arriving' | 'waiting' | 'entering' | 'inside' | 'exitWaiting' | 'exiting' | 'departing'; x: number; dwellMs: number; waitMs: number }
export interface HouseWorldState {
  environment: HouseEnvironment; people: HousePerson[]; doorAngle: number; outsideLight: number; insideLight: number;
  outsideLux: number; insideLux: number; passage: boolean; bellMs: number; exitPressed: boolean; card: string; cardPresent: boolean;
  outsidePresence: boolean; insidePresence: boolean; nextArrivalMs: number; dayInMs: number; pendingVisitor: HouseVisitorKind | null;
  nextId: number; randomState: number; entries: Record<'azul' | 'roja' | 'ninguna', number>; exits: number; abandoned: number;
  closeWarnings: number; closingWarned: boolean;
}
export function createHouseWorldState(environment: HouseEnvironment = defaultHouseEnvironment, angle = 0): HouseWorldState {
  const lux = environment.night ? 300 : 3500;
  return { environment: { ...environment }, people: [], doorAngle: Math.max(0, Math.min(90, angle)), outsideLight: 0, insideLight: 0, outsideLux: lux, insideLux: lux,
    passage: false, bellMs: 0, exitPressed: false, card: 'ninguna', cardPresent: false, outsidePresence: false, insidePresence: false,
    nextArrivalMs: 1500, dayInMs: 45000, pendingVisitor: null, nextId: 1, randomState: 0x63617361, entries: { azul: 0, roja: 0, ninguna: 0 }, exits: 0, abandoned: 0, closeWarnings: 0, closingWarned: false };
}
export function advanceHouseWorld(previous: HouseWorldState, targets: { doorAngle?: number; outsideLight?: number; insideLight?: number }, elapsedMs: number): HouseWorldState {
  let remaining = Math.max(0, Math.min(2000, elapsedMs));
  if (!remaining) return previous;
  const w: HouseWorldState = { ...previous, environment: { ...previous.environment }, people: previous.people.map(p => ({ ...p })), entries: { ...previous.entries } };
  const random = () => { w.randomState = (Math.imul(w.randomState, 1664525) + 1013904223) >>> 0; return w.randomState / 0x100000000; };
  w.outsideLight = Math.max(0, Math.min(100, targets.outsideLight ?? 0)); w.insideLight = Math.max(0, Math.min(100, targets.insideLight ?? 0));
  while (remaining > 0) {
    const ms = Math.min(20, remaining), step = ms * 0.08; remaining -= ms;
    if (w.environment.automaticDay) { w.dayInMs -= ms; if (w.dayInMs <= 0) { w.environment.night = !w.environment.night; w.dayInMs = 45000; } }
    w.outsideLux = w.environment.night ? 300 : 3500;
    w.insideLux = Math.min(4095, w.outsideLux + w.insideLight * 30);
    const target = Math.max(0, Math.min(90, targets.doorAngle ?? 0));
    if (target < 90 && w.passage && !w.closingWarned) { w.closeWarnings++; w.closingWarned = true; }
    if (!w.passage) w.closingWarned = false;
    w.doorAngle += Math.sign(target - w.doorAngle) * Math.min(Math.abs(target - w.doorAngle), ms * 90 / 1200);
    w.bellMs = Math.max(0, w.bellMs - ms);
    w.nextArrivalMs = Math.max(0, w.nextArrivalMs - ms);
    const accessBusy = w.people.some(p => p.phase !== 'inside');
    const wantsExit = w.people.find(p => p.phase === 'inside' && p.dwellMs <= 0);
    if (!accessBusy && wantsExit) { wantsExit.phase = 'exitWaiting'; wantsExit.x = 525; }
    else if (!accessBusy && w.people.length < 3 && (w.pendingVisitor || (w.environment.automaticArrivals && !w.nextArrivalMs))) {
      const kind = w.pendingVisitor ?? (['known', 'unknown', 'none'] as const)[Math.floor(random() * 3)];
      w.people.push({ id: w.nextId++, card: kind === 'known' ? 'azul' : kind === 'unknown' ? 'roja' : 'ninguna', phase: 'arriving', x: 20, dwellMs: 0, waitMs: 0 });
      w.pendingVisitor = null; w.nextArrivalMs = 12000 + random() * 10000;
    }
    for (const p of w.people) {
      if (p.phase === 'arriving') { p.x = Math.min(375, p.x + step); if (p.x === 375) { p.phase = 'waiting'; w.bellMs = 2000; } }
      else if (p.phase === 'waiting') {
        p.waitMs += ms;
        if (target >= 90 && w.doorAngle >= 90) p.phase = 'entering';
        else if (p.waitMs >= 20000) { p.phase = 'departing'; w.abandoned++; }
      } else if (p.phase === 'entering') {
        p.x = Math.min(650, p.x + step);
        if (p.x === 650) { p.phase = 'inside'; p.dwellMs = 15000 + random() * 15000; w.entries[p.card]++; }
      } else if (p.phase === 'inside') p.dwellMs = Math.max(0, p.dwellMs - ms);
      else if (p.phase === 'exitWaiting') { if (target >= 90 && w.doorAngle >= 90) p.phase = 'exiting'; }
      else if (p.phase === 'exiting' || p.phase === 'departing') p.x -= step;
    }
    w.exits += w.people.filter(p => p.phase === 'exiting' && p.x < -20).length;
    w.people = w.people.filter(p => p.x >= -20);
    w.passage = w.people.some(p => ['entering', 'exiting'].includes(p.phase) && Math.abs(p.x - 450) <= 25);
    w.exitPressed = w.people.some(p => p.phase === 'exitWaiting');
    w.outsidePresence = w.people.some(p => p.x < 450);
    w.insidePresence = w.people.some(p => p.x >= 450);
    const visitor = w.people.find(p => p.phase === 'waiting');
    w.card = visitor?.card ?? 'ninguna'; w.cardPresent = !!visitor && visitor.card !== 'ninguna';
  }
  return w;
}
