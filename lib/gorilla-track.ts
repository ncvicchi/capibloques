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
  sonarMode?: 'normal'|'missing'|'stale';
  obstaclesRemoved?:boolean;
  buttonPulseMs?:number;
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
      if (gorillaTrackAllowed(w.obstaclesRemoved?{...scene,canvas:{...scene.canvas,arenaEnvironment:{guides:true,obstacles:[]}}}:scene, x, y)) {
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

export function gorillaBindings(scene:SceneDefinition){
  if(scene.canvas.background!=='gorillaTrack'||!scene.devices.some(d=>d.kind==='gorilla'))return {};
  const sensors=scene.devices.filter(d=>d.kind==='distanceSensor'),buttons=scene.devices.filter(d=>d.kind==='button');
  return {sensor:sensors.length===1&&sensors[0].config.profile==='HC-SR04'?sensors[0].id:undefined,button:buttons.length===1?buttons[0].id:undefined};
}
export function gorillaDistance(w:GorillaTrackState,scene:SceneDefinition){
  const dx=Math.cos(w.angle*Math.PI/180),dy=Math.sin(w.angle*Math.PI/180),sx=w.x+dx*42,sy=w.y+dy*42;
  let nearest=16000;
  for(const [p,d,low,high] of [[sx,dx,22,938],[sy,dy,65,503]]){
    if(Math.abs(d)>.0001){const t=((d>0?high:low)-p)/d;if(t>=0)nearest=Math.min(nearest,t);}
  }
  for(const o of w.obstaclesRemoved?[]:scene.canvas.arenaEnvironment?.obstacles??[]){
    const x=o.x-sx,y=o.y-sy,projection=x*dx+y*dy,offset=x*x+y*y-projection*projection;
    if(projection>=0&&offset<=o.radius*o.radius)nearest=Math.min(nearest,Math.max(0,projection-Math.sqrt(o.radius*o.radius-offset)));
  }
  // Same didactic translation scale as phase60: 40 scene units per centimetre.
  const distance=Math.round(nearest/40);
  return {distance,valid:(w.sonarMode??'normal')==='normal'&&distance>=2&&distance<=400};
}
