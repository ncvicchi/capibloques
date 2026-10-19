import type { SceneDefinition, ScenePosition } from './scene-model';

export interface PondEnvironment {
  lagoon: number;
  reserve: number;
  evaporation: number;
  leak: number;
  rain: number;
}
export const defaultPondEnvironment: PondEnvironment = {
  lagoon: 35,
  reserve: 240,
  evaporation: 0.05,
  leak: 0,
  rain: 0,
};
export function validPondEnvironment(value: unknown): value is PondEnvironment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    Object.keys(v).length === 5 &&
    Object.entries({
      lagoon: 100,
      reserve: 300,
      evaporation: 0.5,
      leak: 4,
      rain: 4,
    }).every(
      ([k, max]) =>
        typeof v[k] === 'number' &&
        Number.isFinite(v[k]) &&
        (v[k] as number) >= 0 &&
        (v[k] as number) <= max,
    )
  );
}
export const pondSlots = [
  {
    role: 'reserveSensor',
    kind: 'distanceSensor',
    name: 'Distancia a la reserva',
    x: 210,
    y: 145,
  },
  {
    role: 'lagoonSensor',
    kind: 'distanceSensor',
    name: 'Distancia a la laguna',
    x: 640,
    y: 185,
  },
  {
    role: 'pump',
    kind: 'powerSwitch',
    name: 'Bomba de llenado',
    x: 410,
    y: 340,
  },
  {
    role: 'drain',
    kind: 'servo',
    name: 'Compuerta de desagüe',
    x: 835,
    y: 375,
  },
  {
    role: 'spillSensor',
    kind: 'waterSensor',
    name: 'Detector de derrame',
    x: 640,
    y: 445,
  },
] as const;
export type PondRole = (typeof pondSlots)[number]['role'];
export function nearestPondSlot(kind: string, position: ScenePosition) {
  return pondSlots
    .filter((s) => s.kind === kind)
    .reduce<(typeof pondSlots)[number] | undefined>(
      (best, s) =>
        !best ||
        Math.hypot(s.x - position.x, s.y - position.y) <
          Math.hypot(best.x - position.x, best.y - position.y)
          ? s
          : best,
      undefined,
    );
}
export function pondBindings(
  scene: SceneDefinition,
): Partial<Record<PondRole, string>> {
  return scene.canvas.background !== 'pondLab'
    ? {}
    : Object.fromEntries(
        scene.devices.flatMap((d) => {
          const s = nearestPondSlot(d.kind, d.position);
          return s ? [[s.role, d.id]] : [];
        }),
      );
}
export interface PondWorldState {
  environment: PondEnvironment;
  lagoon: number;
  reserve: number;
  gateAngle: number;
  wetness: number;
  spilled: number;
  drained: number;
  evaporated: number;
  leaked: number;
  rainfall: number;
  transferred: number;
  recharged: number;
  pumpFlow: number;
  drainFlow: number;
  dryPump: boolean;
  timeMs: number;
  pendingRefill: boolean;
}
export function createPondWorld(
  environment: PondEnvironment = defaultPondEnvironment,
  gateAngle = 0,
): PondWorldState {
  return {
    environment: { ...environment },
    lagoon: environment.lagoon,
    reserve: environment.reserve,
    gateAngle: Math.max(0, Math.min(90, gateAngle)),
    wetness: 0,
    spilled: 0,
    drained: 0,
    evaporated: 0,
    leaked: 0,
    rainfall: 0,
    transferred: 0,
    recharged: 0,
    pumpFlow: 0,
    drainFlow: 0,
    dryPump: false,
    timeMs: 0,
    pendingRefill: false,
  };
}
export const waterDistance = (volume: number, capacity: number) =>
  120 - (100 * volume) / capacity;
export function advancePondWorld(
  previous: PondWorldState,
  power: number,
  gateTarget: number,
  elapsedMs: number,
): PondWorldState {
  const w = { ...previous, environment: { ...previous.environment } };
  let remaining = Math.max(0, Math.min(2000, elapsedMs));
  if (w.pendingRefill && remaining > 0) {
    w.recharged += 300 - w.reserve;
    w.reserve = 300;
    w.pendingRefill = false;
  }
  const duty = Math.max(0, Math.min(100, power)) / 100;
  w.pumpFlow = 0;
  w.drainFlow = 0;
  while (remaining > 0) {
    const ms = Math.min(20, remaining),
      dt = ms / 1000;
    remaining -= ms;
    w.timeMs += ms;
    const target = Math.max(0, Math.min(90, gateTarget));
    w.gateAngle +=
      Math.sign(target - w.gateAngle) *
      Math.min(Math.abs(target - w.gateAngle), 75 * dt);
    const transfer = Math.min(w.reserve, 2 * duty * dt);
    w.reserve -= transfer;
    w.lagoon += transfer;
    w.transferred += transfer;
    w.pumpFlow = transfer / dt;
    const rain = w.environment.rain * dt;
    w.lagoon += rain;
    w.rainfall += rain;
    const drain = Math.min(w.lagoon, ((3 * w.gateAngle) / 90) * dt);
    w.lagoon -= drain;
    w.drained += drain;
    w.drainFlow = drain / dt;
    const leak = Math.min(w.lagoon, w.environment.leak * dt);
    w.lagoon -= leak;
    w.leaked += leak;
    const evaporation = Math.min(w.lagoon, w.environment.evaporation * dt);
    w.lagoon -= evaporation;
    w.evaporated += evaporation;
    const spill = Math.max(0, w.lagoon - 100);
    w.lagoon -= spill;
    w.spilled += spill;
    // A fresh spill wets the tray; afterwards residual water dries over 15 s.
    w.wetness = spill > 0 ? 100 : Math.max(0, w.wetness - (100 / 15) * dt);
  }
  w.dryPump = duty > 0 && w.reserve <= 1e-9;
  return w;
}
