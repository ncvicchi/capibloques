import type { SceneDefinition } from './scene-model';
import {
  defaultArenaEnvironment,
  type ArenaEnvironment,
  // @ts-expect-error Node strip-types runner.
} from './robot-arena.ts';
export const gorillaStations = [
  { id: 'base' as const, x: 120, y: 355 },
  { id: 'A' as const, x: 248, y: 355 },
  { id: 'B' as const, x: 680, y: 190 },
];
export interface GorillaTrackState {
  x: number;
  y: number;
  angle: number;
  swing: number;
  contact: boolean;
  contacts: number;
  visited: string[];
  dwell: number;
  station: string;
  trail: { x: number; y: number }[];
}
export function validGorillaEnvironment(v: unknown): v is ArenaEnvironment {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const g = v as ArenaEnvironment;
  return (
    Object.keys(g).sort().join(',') === 'guides,obstacles' &&
    typeof g.guides === 'boolean' &&
    Array.isArray(g.obstacles) &&
    g.obstacles.length <= 4 &&
    g.obstacles.every(
      (o, i) =>
        o &&
        Object.keys(o).sort().join(',') === 'radius,x,y' &&
        [o.x, o.y, o.radius].every(
          (n) => typeof n === 'number' && Number.isFinite(n),
        ) &&
        o.x >= 210 &&
        o.x <= 850 &&
        o.y >= 100 &&
        o.y <= 460 &&
        o.radius >= 20 &&
        o.radius <= 40 &&
        g.obstacles
          .slice(0, i)
          .every(
            (p) => Math.hypot(p.x - o.x, p.y - o.y) >= p.radius + o.radius + 15,
          ),
    )
  );
}
export function createGorillaTrack(scene: SceneDefinition): GorillaTrackState {
  const robot = scene.devices.find((d) => d.kind === 'gorilla');
  return {
    x: robot?.position.x ?? 120,
    y: robot?.position.y ?? 355,
    angle: robot?.rotation ?? 0,
    swing: -1,
    contact: false,
    contacts: 0,
    visited: [],
    dwell: 0,
    station: '',
    trail: [],
  };
}
/** Conservative disk around the illustrated chassis, not a CAD collision model. */
export function gorillaTrackAllowed(
  scene: SceneDefinition,
  x: number,
  y: number,
) {
  const obstacles = (scene.canvas.arenaEnvironment ?? defaultArenaEnvironment)
    .obstacles;
  return (
    x >= 65 &&
    x <= 895 &&
    y >= 100 &&
    y <= 460 &&
    obstacles.every((o) => Math.hypot(x - o.x, y - o.y) > 42 + o.radius)
  );
}
export function advanceGorillaTrack(
  w: GorillaTrackState,
  scene: SceneDefinition,
  travel: number,
  yaw: number,
  swing: number,
  ms: number,
  moving: boolean,
): GorillaTrackState {
  const out = { ...w, visited: [...w.visited], trail: [...w.trail] };
  if (travel || yaw) {
    const steps = Math.max(1, Math.ceil((Math.abs(travel) * 4) / 2));
    let blocked = false;
    for (let i = 0; i < steps; i++) {
      const angle = out.angle + yaw / steps,
        x = out.x + (Math.cos((angle * Math.PI) / 180) * travel * 4) / steps,
        y = out.y + (Math.sin((angle * Math.PI) / 180) * travel * 4) / steps;
      if (gorillaTrackAllowed(scene, x, y)) {
        out.x = x;
        out.y = y;
        out.angle = angle;
      } else {
        blocked = true;
        break;
      }
    }
    if (blocked && !out.contact) out.contacts++;
    out.contact = blocked;
    out.trail.push({ x: out.x, y: out.y });
    out.trail = out.trail.slice(-300);
  }
  if (moving) out.swing = swing;
  else out.swing = -1;
  const target =
    gorillaStations.find((s) => Math.hypot(out.x - s.x, out.y - s.y) < 24)
      ?.id ?? '';
  if (moving || !target) {
    out.dwell = 0;
    out.station = '';
  } else {
    out.dwell = out.station === target ? out.dwell + ms : ms;
    out.station = target;
    if (out.dwell >= 500 && out.visited.at(-1) !== target)
      out.visited.push(target);
  }
  out.visited = out.visited.slice(-32);
  return out;
}
