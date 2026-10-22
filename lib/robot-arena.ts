import type { SceneDefinition, ScenePosition } from './scene-model';

export interface ArenaObstacle { x: number; y: number; radius: number }
export interface ArenaEnvironment { obstacles: ArenaObstacle[]; guides: boolean }
export const arenaStations = [{ id: 'A', x: 400, y: 420, color: 'red' }, { id: 'B', x: 400, y: 180, color: 'blue' }] as const;
export const arenaGoal = { x: 800, y: 180 };
export const defaultArenaEnvironment: ArenaEnvironment = { obstacles: [], guides: true };
export const obstacleArenaEnvironment: ArenaEnvironment = { obstacles: [{ x: 260, y: 420, radius: 28 }], guides: true };
export const arenaKinds = ['robot', 'distanceSensor', 'colorSensor', 'infraredBarrier'] as const;
export function validArenaEnvironment(value: unknown): value is ArenaEnvironment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 2 || typeof v.guides !== 'boolean' || !Array.isArray(v.obstacles) || v.obstacles.length > 4) return false;
  const items = v.obstacles as ArenaObstacle[];
  return items.every((p, i) => !!p && typeof p === 'object' && !Array.isArray(p) && Object.keys(p).sort().join(',') === 'radius,x,y' &&
    [p.x, p.y, p.radius].every(n => typeof n === 'number' && Number.isFinite(n)) && p.radius >= 20 && p.radius <= 40 && p.x >= 210 && p.x <= 850 && p.y >= 100 && p.y <= 460 &&
    [...arenaStations, arenaGoal].every(s => Math.hypot(s.x - p.x, s.y - p.y) >= p.radius + 75) &&
    items.slice(0, i).every(q => Math.hypot(q.x - p.x, q.y - p.y) >= q.radius + p.radius + 15));
}
export function arenaBindings(scene: SceneDefinition) {
  return scene.canvas.background !== 'robotArena' ? {} : Object.fromEntries(arenaKinds.map(kind => [kind, scene.devices.find(d => d.kind === kind)?.id])) as Partial<Record<typeof arenaKinds[number], string>>;
}
export function arenaStartAllowed(p: ScenePosition, env: ArenaEnvironment) {
  return p.x >= 45 && p.x <= 915 && p.y >= 75 && p.y <= 485 && env.obstacles.every(o => Math.hypot(o.x - p.x, o.y - p.y) > o.radius + 24);
}
export interface ArenaWorldState {
  x: number; y: number; angle: number; distance: number; floor: 'red' | 'blue' | 'green' | 'ground';
  contact: boolean; contacts: number; offPath: boolean; goalBeam: boolean; goalReached: boolean;
  visits: Record<'A' | 'B', number>; dwell: Record<'A' | 'B', number>; latched: Record<'A' | 'B', boolean>;
  trail: ScenePosition[];
}
export function createArenaWorldState(p: ScenePosition = { x: 120, y: 420 }, angle = 0): ArenaWorldState {
  return { ...p, angle, distance: 500, floor: 'ground', contact: false, contacts: 0, offPath: false, goalBeam: false, goalReached: false, visits: { A: 0, B: 0 }, dwell: { A: 0, B: 0 }, latched: { A: false, B: false }, trail: [] };
}
export function arenaPose(scene: SceneDefinition) {
  const robot = scene.devices.find(d => d.kind === 'robot');
  return { position: robot?.position ?? { x: 120, y: 420 }, angle: robot ? robot.rotation + (robot.kind === 'robot' ? robot.config.heading : 0) : 0 };
}
export function advanceArenaWorld(previous: ArenaWorldState, env: ArenaEnvironment, left: number, right: number, elapsedMs: number, maxDistance = 400): ArenaWorldState {
  const w = { ...previous, visits: { ...previous.visits }, dwell: { ...previous.dwell }, latched: { ...previous.latched }, trail: [...previous.trail] };
  left = Math.max(-100, Math.min(100, left)); right = Math.max(-100, Math.min(100, right));
  let remaining = Math.max(0, Math.min(2000, elapsedMs)), contacted = false;
  do {
    const ms = Math.min(10, remaining); remaining -= ms;
    w.angle = ((w.angle + (left - right) * 0.00075 * ms) % 360 + 360) % 360;
    const radians = w.angle * Math.PI / 180, speed = (left + right) / 2 * 0.001;
    const x = w.x + Math.cos(radians) * speed * ms, y = w.y + Math.sin(radians) * speed * ms;
    const blocked = x < 42 || x > 918 || y < 72 || y > 488 || env.obstacles.some(o => Math.hypot(x - o.x, y - o.y) < o.radius + 22);
    if (blocked && speed !== 0) contacted = true;
    else { w.x = x; w.y = y; }
    for (const station of arenaStations) {
      const inside = Math.hypot(w.x - station.x, w.y - station.y) <= 43;
      if (!inside) { w.dwell[station.id] = 0; w.latched[station.id] = false; }
      else if (left === 0 && right === 0) { w.dwell[station.id] += ms; if (w.dwell[station.id] >= 600 && !w.latched[station.id]) { w.visits[station.id]++; w.latched[station.id] = true; } }
      else w.dwell[station.id] = 0;
    }
    w.goalBeam = Math.abs(w.x - 800) <= 22 && Math.abs(w.y - 180) <= 60;
    w.goalReached ||= w.goalBeam;
  } while (remaining > 0);
  if (contacted && !previous.contact) w.contacts++;
  w.contact = contacted;
  const horizontalBottom = w.x >= 90 && w.x <= 440 && Math.abs(w.y - 420) <= 55;
  const vertical = Math.abs(w.x - 400) <= 55 && w.y >= 140 && w.y <= 460;
  const horizontalTop = w.x >= 360 && w.x <= 860 && Math.abs(w.y - 180) <= 55;
  w.offPath = !horizontalBottom && !vertical && !horizontalTop;
  w.floor = Math.hypot(w.x - 400, w.y - 420) <= 43 ? 'red' : Math.hypot(w.x - 400, w.y - 180) <= 43 ? 'blue' : Math.abs(w.x - 800) <= 35 && Math.abs(w.y - 180) <= 60 ? 'green' : 'ground';
  // Idealized narrow frontal beam, 1 scene unit = 1 simulated cm.
  const a = w.angle * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), ox = w.x + dx * 22, oy = w.y + dy * 22;
  let distance = Math.max(1, Math.min(500, maxDistance));
  for (const wall of [dx > 0 ? (940 - ox) / dx : dx < 0 ? (20 - ox) / dx : Infinity, dy > 0 ? (510 - oy) / dy : dy < 0 ? (50 - oy) / dy : Infinity]) if (wall >= 0) distance = Math.min(distance, wall);
  for (const o of env.obstacles) { const px = o.x - ox, py = o.y - oy, projection = px * dx + py * dy, lateral2 = px * px + py * py - projection * projection; if (projection > 0 && lateral2 <= o.radius * o.radius) distance = Math.min(distance, Math.max(0, projection - Math.sqrt(Math.max(0, o.radius * o.radius - lateral2)))); }
  w.distance = Math.round(distance * 10) / 10;
  const last = w.trail.at(-1);
  if (elapsedMs > 0 && (!last || Math.hypot(last.x - w.x, last.y - w.y) >= 5)) w.trail = [...w.trail.slice(-299), { x: w.x, y: w.y }];
  return w;
}
