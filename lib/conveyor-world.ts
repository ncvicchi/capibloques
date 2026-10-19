import type { SceneDefinition, ScenePosition } from './scene-model';

export type PackageColor = 'red' | 'blue' | 'green';
export interface ConveyorEnvironment { automaticArrivals: boolean; color: PackageColor; weight: number }
export const defaultConveyorEnvironment: ConveyorEnvironment = { automaticArrivals: true, color: 'red', weight: 300 };
export function validConveyorEnvironment(v: unknown): v is ConveyorEnvironment {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return Object.keys(o).length === 3 && typeof o.automaticArrivals === 'boolean' && ['red', 'blue', 'green'].includes(String(o.color)) && typeof o.color === 'string' && typeof o.weight === 'number' && Number.isFinite(o.weight) && o.weight >= 100 && o.weight <= 1000;
}
export const conveyorSlots = [
  { role: 'motor', kind: 'motor', name: 'Motor de la cinta', x: 160, y: 360 },
  { role: 'presence', kind: 'infraredBarrier', name: 'Paquete en lectura', x: 325, y: 270 },
  { role: 'color', kind: 'colorSensor', name: 'Color del paquete', x: 325, y: 170 },
  { role: 'scale', kind: 'scale', name: 'Peso del paquete', x: 435, y: 360 },
  { role: 'gate', kind: 'servo', name: 'Desviador', x: 640, y: 270 },
  { role: 'outputA', kind: 'infraredBarrier', name: 'Entrega en A', x: 785, y: 185 },
  { role: 'outputB', kind: 'infraredBarrier', name: 'Entrega en B', x: 785, y: 355 },
] as const;
export type ConveyorRole = typeof conveyorSlots[number]['role'];
export const conveyorInputRoles = ['presence', 'color', 'scale', 'outputA', 'outputB'] as const;
export function nearestConveyorSlot(kind: string, p: ScenePosition) {
  return conveyorSlots.filter(s => s.kind === kind).reduce<typeof conveyorSlots[number] | undefined>((a, s) => !a || Math.hypot(s.x - p.x, s.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? s : a, undefined);
}
export function conveyorBindings(scene: SceneDefinition): Partial<Record<ConveyorRole, string>> {
  return scene.canvas.background !== 'conveyor' ? {} : Object.fromEntries(scene.devices.flatMap(d => { const s = nearestConveyorSlot(d.kind, d.position); return s ? [[s.role, d.id]] : []; }));
}
export interface ConveyorPackage { id: number; color: PackageColor; weight: number; x: number; route: 'A' | 'B' | null; stableMs: number }
export interface ConveyorWorldState {
  environment: ConveyorEnvironment; packages: ConveyorPackage[]; pendingPackage: { color: PackageColor; weight: number } | null;
  nextId: number; randomState: number; nextArrivalMs: number; angle: number; power: number; jammed: boolean; entryBusy: boolean; reverseRequested: boolean;
  presence: boolean; readingValid: boolean; color: PackageColor | null; weight: number; outputA: boolean; outputB: boolean; deliveredA: number; deliveredB: number;
}
export function createConveyorWorldState(environment: ConveyorEnvironment = defaultConveyorEnvironment, angle = 0): ConveyorWorldState {
  return { environment: { ...environment }, packages: [], pendingPackage: null, nextId: 1, randomState: 0x74616c6c, nextArrivalMs: 1200, angle: Math.max(0, Math.min(90, angle)), power: 0, jammed: false, entryBusy: false, reverseRequested: false, presence: false, readingValid: false, color: null, weight: 0, outputA: false, outputB: false, deliveredA: 0, deliveredB: 0 };
}
export function advanceConveyorWorld(previous: ConveyorWorldState, targets: { power?: number; angle?: number }, elapsedMs: number): ConveyorWorldState {
  const w = { ...previous, environment: { ...previous.environment }, packages: previous.packages.map(p => ({ ...p })) };
  const random = () => { w.randomState = (Math.imul(w.randomState, 1664525) + 1013904223) >>> 0; return w.randomState / 4294967296; };
  let remaining = Math.max(0, Math.min(2000, elapsedMs));
  w.reverseRequested = (targets.power ?? 0) < 0;
  w.power = w.jammed ? 0 : Math.max(0, Math.min(100, targets.power ?? 0));
  do {
    const ms = Math.min(20, remaining); remaining -= ms;
    const target = Math.max(0, Math.min(90, targets.angle ?? 0));
    w.angle += Math.sign(target - w.angle) * Math.min(Math.abs(target - w.angle), ms * 90 / 1200);
    w.nextArrivalMs = Math.max(0, w.nextArrivalMs - ms);
    w.entryBusy = w.packages.some(p => p.x < 95);
    if (!w.jammed && !w.entryBusy && w.packages.length < 10 && (w.pendingPackage || (w.environment.automaticArrivals && w.nextArrivalMs === 0))) {
      const p = w.pendingPackage ?? { color: (['red', 'blue', 'green'] as const)[Math.floor(random() * 3)], weight: 100 + Math.floor(random() * 901) };
      w.packages.push({ ...p, id: w.nextId++, x: 40, route: null, stableMs: 0 }); w.pendingPackage = null; w.nextArrivalMs = 20000 + random() * 10000;
    }
    // Front to back: packages never overlap, including a stopped queue.
    for (let i = 0; i < w.packages.length; i++) {
      const p = w.packages[i], before = w.packages[i - 1];
      let next = p.x + (w.jammed ? 0 : w.power * 0.001 * ms);
      if (before && (!p.route || !before.route || p.route === before.route)) next = Math.min(next, before.x - 66);
      if (!p.route && next >= 640) {
        if (w.angle > 0.01 && w.angle < 89.99) { w.jammed = true; w.power = 0; next = 640; }
        else p.route = w.angle >= 89.99 ? 'B' : 'A';
      }
      p.x = Math.max(p.x, next);
      p.stableMs = p.x >= 300 && p.x <= 355 && w.power === 0 ? p.stableMs + ms : 0;
    }
    for (const p of w.packages.filter(p => p.x > 900)) { if (p.route === 'A') w.deliveredA++; else if (p.route === 'B') w.deliveredB++; }
    w.packages = w.packages.filter(p => p.x <= 900);
    const reading = w.packages.find(p => p.x >= 300 && p.x <= 355);
    w.presence = !!reading; w.color = reading?.color ?? null; w.readingValid = !!reading && reading.stableMs >= 600;
    w.weight = w.readingValid ? reading!.weight : 0;
    w.outputA = w.packages.some(p => p.route === 'A' && Math.abs(p.x - 785) <= 27);
    w.outputB = w.packages.some(p => p.route === 'B' && Math.abs(p.x - 785) <= 27);
    w.entryBusy = w.packages.some(p => p.x < 95);
  } while (remaining > 0);
  return w;
}
