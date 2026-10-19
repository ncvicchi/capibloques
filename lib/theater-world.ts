import type { SceneDefinition } from './scene-model';
export interface TheaterEnvironment {
  automaticArrivals: boolean;
  count: number;
  distance: number;
  staySeconds: number;
}
export const defaultTheaterEnvironment: TheaterEnvironment = {
  automaticArrivals: true,
  count: 3,
  distance: 35,
  staySeconds: 24,
};
export function validTheaterEnvironment(v: unknown): v is TheaterEnvironment {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    Object.keys(o).length === 4 &&
    typeof o.automaticArrivals === 'boolean' &&
    typeof o.count === 'number' &&
    Number.isInteger(o.count) &&
    o.count >= 1 &&
    o.count <= 4 &&
    typeof o.distance === 'number' &&
    Number.isFinite(o.distance) &&
    o.distance >= 20 &&
    o.distance <= 100 &&
    typeof o.staySeconds === 'number' &&
    Number.isFinite(o.staySeconds) &&
    o.staySeconds >= 12 &&
    o.staySeconds <= 40
  );
}
export const theaterSlots = [
  { role: 'otto', kind: 'otto', name: 'Otto artista', x: 480, y: 210 },
  { role: 'request', kind: 'button', name: 'Pedir actuación', x: 760, y: 360 },
] as const;
export function theaterBindings(
  scene: SceneDefinition,
): Partial<Record<'otto' | 'request', string>> {
  return scene.canvas.background !== 'ottoTheater'
    ? {}
    : Object.fromEntries(
        theaterSlots.flatMap((s) => {
          const d = scene.devices.find((d) => d.kind === s.kind);
          return d ? [[s.role, d.id]] : [];
        }),
      );
}
export function theaterHasDistance(scene: SceneDefinition) {
  const d = scene.devices.find((d) => d.id === theaterBindings(scene).otto);
  return (
    d?.kind === 'otto' &&
    ['biped4-explorer', 'biped4-expressive', 'humanoid6-expressive'].includes(
      d.config.profile,
    )
  );
}
export interface TheaterWorldState {
  environment: TheaterEnvironment;
  phase: 'empty' | 'approaching' | 'watching' | 'leaving';
  count: number;
  distance: number;
  groupDistance: number;
  groupStayMs: number;
  remainingMs: number;
  nextArrivalMs: number;
  requestMs: number;
  requestInMs: number;
  requested: boolean;
  groups: number;
  pendingArrival: boolean;
  pendingDeparture: boolean;
  pendingRequest: boolean;
  randomState: number;
}
export function createTheaterWorldState(
  environment: TheaterEnvironment = defaultTheaterEnvironment,
): TheaterWorldState {
  return {
    environment: { ...environment },
    phase: 'empty',
    count: 0,
    distance: 400,
    groupDistance: environment.distance,
    groupStayMs: environment.staySeconds * 1000,
    remainingMs: 0,
    nextArrivalMs: 1200,
    requestMs: 0,
    requestInMs: 0,
    requested: false,
    groups: 0,
    pendingArrival: false,
    pendingDeparture: false,
    pendingRequest: false,
    randomState: 0x6f74746f,
  };
}
export function advanceTheaterWorld(
  previous: TheaterWorldState,
  elapsedMs: number,
): TheaterWorldState {
  const w = { ...previous, environment: { ...previous.environment } };
  let remaining = Math.max(0, Math.min(2000, elapsedMs));
  const random = () => {
    w.randomState = (Math.imul(w.randomState, 1664525) + 1013904223) >>> 0;
    return w.randomState / 4294967296;
  };
  while (remaining > 0) {
    const ms = Math.min(50, remaining);
    remaining -= ms;
    w.requestMs = Math.max(0, w.requestMs - ms);
    if (w.pendingDeparture && w.phase !== 'empty') {
      w.phase = 'leaving';
      w.requestMs = 0;
      w.pendingRequest = false;
    }
    w.pendingDeparture = false;
    if (w.phase === 'empty') {
      w.nextArrivalMs = Math.max(0, w.nextArrivalMs - ms);
      if (
        w.pendingArrival ||
        (w.environment.automaticArrivals && w.nextArrivalMs === 0)
      ) {
        w.count = w.pendingArrival
          ? w.environment.count
          : 1 + Math.floor(random() * 4);
        w.pendingArrival = false;
        w.groupDistance = w.environment.distance;
        w.groupStayMs = w.environment.staySeconds * 1000;
        w.distance = 180;
        w.phase = 'approaching';
        w.requested = false;
        w.groups++;
      }
    } else if (w.phase === 'approaching') {
      w.distance = Math.max(w.groupDistance, w.distance - ms * 0.04);
      if (w.distance === w.groupDistance) {
        w.phase = 'watching';
        w.remainingMs = w.groupStayMs;
        w.requestInMs = 4500;
      }
    } else if (w.phase === 'watching') {
      w.remainingMs -= ms;
      w.requestInMs = Math.max(0, w.requestInMs - ms);
      if (
        w.pendingRequest ||
        (w.environment.automaticArrivals && !w.requested && w.requestInMs === 0)
      ) {
        w.requestMs = 2000;
        w.pendingRequest = false;
        w.requested = true;
      }
      if (w.remainingMs <= 0) {
        w.phase = 'leaving';
        w.requestMs = 0;
        w.pendingRequest = false;
      }
    } else {
      w.distance += ms * 0.05;
      if (w.distance >= 220) {
        w.phase = 'empty';
        w.count = 0;
        w.distance = 400;
        w.nextArrivalMs = 4000 + random() * 4000;
      }
    }
  }
  return w;
}
