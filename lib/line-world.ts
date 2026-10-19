import type { SceneDefinition, ScenePosition } from './scene-model';
export type LineCircuit = { width: number; strokes: ScenePosition[][] };
export const lineLimits = { strokes: 64, points: 512, perStroke: 256 };
export function validLineCircuit(v: unknown): v is LineCircuit {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as LineCircuit;
  return (
    Object.keys(c).sort().join(',') === 'strokes,width' &&
    Number.isFinite(c.width) &&
    c.width >= 12 &&
    c.width <= 24 &&
    Array.isArray(c.strokes) &&
    c.strokes.length <= lineLimits.strokes &&
    c.strokes.every(
      (s) =>
        Array.isArray(s) &&
        s.length >= 2 &&
        s.length <= lineLimits.perStroke &&
        s.every(
          (p) =>
            !!p &&
            typeof p === 'object' &&
            Object.keys(p).sort().join(',') === 'x,y' &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            p.x >= 45 &&
            p.x <= 915 &&
            p.y >= 75 &&
            p.y <= 485,
        ),
    ) &&
    c.strokes.reduce((n, s) => n + s.length, 0) <= lineLimits.points
  );
}
export const linePresetNames = {
  straight: 'Recta',
  oval: 'Óvalo',
  bends: 'Curvas amplias',
  snake: 'Recorrido en S',
} as const;
export function linePreset(id: keyof typeof linePresetNames): LineCircuit {
  if (id === 'straight')
    return {
      width: 16,
      strokes: [
        [
          { x: 110, y: 390 },
          { x: 840, y: 390 },
        ],
      ],
    };
  if (id === 'snake')
    return {
      width: 16,
      strokes: [
        [
          { x: 110, y: 390 },
          { x: 380, y: 390 },
          ...Array.from({ length: 121 }, (_, i) => ({
            x: 380 + (i * 460) / 120,
            y: 320 + 70 * Math.cos((i * Math.PI) / 60),
          })),
        ],
      ],
    };
  if (id === 'bends')
    return {
      width: 16,
      strokes: [
        [
          { x: 110, y: 390 },
          { x: 380, y: 390 },
          ...Array.from({ length: 61 }, (_, i) => {
            const a = Math.PI / 2 - (i * Math.PI) / 120;
            return { x: 380 + 200 * Math.cos(a), y: 190 + 200 * Math.sin(a) };
          }),
          { x: 580, y: 100 },
        ],
      ],
    };
  const points: ScenePosition[] = [
    { x: 300, y: 390 },
    { x: 640, y: 390 },
  ];
  for (let i = 1; i <= 60; i++) {
    const a = Math.PI / 2 - (i * Math.PI) / 60;
    points.push({ x: 640 + 120 * Math.cos(a), y: 270 + 120 * Math.sin(a) });
  }
  points.push({ x: 300, y: 150 });
  for (let i = 1; i <= 60; i++) {
    const a = -Math.PI / 2 - (i * Math.PI) / 60;
    points.push({ x: 300 + 120 * Math.cos(a), y: 270 + 120 * Math.sin(a) });
  }
  return { width: 16, strokes: [points] };
}
export const defaultLineCircuit = linePreset('oval');
export function segmentDistance(
  p: ScenePosition,
  a: ScenePosition,
  b: ScenePosition,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function lineAt(c: LineCircuit, p: ScenePosition) {
  return c.strokes.some((s) =>
    s.some((b, i) => i > 0 && segmentDistance(p, s[i - 1], b) <= c.width / 2),
  );
}
export function lineSensorPoints(x: number, y: number, angle: number) {
  const a = (angle * Math.PI) / 180;
  return [-14, 0, 14].map((offset) => ({
    x: x + Math.cos(a) * 20 - Math.sin(a) * offset,
    y: y + Math.sin(a) * 20 + Math.cos(a) * offset,
  }));
}
export function lineBindings(s: SceneDefinition) {
  return s.canvas.background === 'lineTrack'
    ? {
        robot: s.devices.find((d) => d.kind === 'robot')?.id,
        sensors: s.devices.find((d) => d.kind === 'lineSensors')?.id,
      }
    : {};
}
export function lineStartAllowed(p: ScenePosition) {
  return p.x >= 42 && p.x <= 918 && p.y >= 72 && p.y <= 488;
}
export interface LineWorldState {
  x: number;
  y: number;
  angle: number;
  left: boolean;
  center: boolean;
  right: boolean;
  contact: boolean;
  contacts: number;
  distance: number;
  offMs: number;
  trail: ScenePosition[];
}
export function createLineWorld(
  p: ScenePosition = { x: 300, y: 390 },
  angle = 0,
): LineWorldState {
  return {
    ...p,
    angle,
    left: false,
    center: false,
    right: false,
    contact: false,
    contacts: 0,
    distance: 0,
    offMs: 0,
    trail: [],
  };
}
export function advanceLineWorld(
  previous: LineWorldState,
  circuit: LineCircuit,
  left: number,
  right: number,
  elapsedMs: number,
): LineWorldState {
  const w = { ...previous, trail: [...previous.trail] };
  left = Math.max(-100, Math.min(100, left));
  right = Math.max(-100, Math.min(100, right));
  let remaining = Math.max(0, Math.min(2000, elapsedMs)),
    contact = false;
  do {
    const ms = Math.min(10, remaining);
    remaining -= ms;
    w.angle = (((w.angle + (left - right) * 0.00075 * ms) % 360) + 360) % 360;
    const a = (w.angle * Math.PI) / 180,
      speed = ((left + right) / 2) * 0.001,
      x = w.x + Math.cos(a) * speed * ms,
      y = w.y + Math.sin(a) * speed * ms;
    if (!lineStartAllowed({ x, y }) && speed !== 0) contact = true;
    else {
      w.distance += Math.hypot(x - w.x, y - w.y);
      w.x = x;
      w.y = y;
    }
    [w.left, w.center, w.right] = lineSensorPoints(w.x, w.y, w.angle).map((p) =>
      lineAt(circuit, p),
    );
    if (!w.left && !w.center && !w.right) w.offMs += ms;
  } while (remaining > 0);
  w.contact = contact;
  if (contact && !previous.contact) w.contacts++;
  if (
    elapsedMs > 0 &&
    (!w.trail.length ||
      Math.hypot(w.x - w.trail.at(-1)!.x, w.y - w.trail.at(-1)!.y) >= 5)
  )
    w.trail = [...w.trail.slice(-299), { x: w.x, y: w.y }];
  return w;
}
