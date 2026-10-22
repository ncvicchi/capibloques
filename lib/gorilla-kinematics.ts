import type { GorillaSettings } from './gorilla-model';

/** Pivot centres measured from supplied STL, not the older assembly viewer. Millimetres. */
export const GORILLA_GEOMETRY = {
  profile: 'gorilla-v3-50-100-46',
  spacing: 46,
  upper: 50,
  lower: 100,
} as const;
export interface GorillaKinematics {
  profile: typeof GORILLA_GEOMETRY.profile;
  zeroAngles: number[];
  pulseMinUs: number;
  pulseMaxUs: number;
  verified: boolean;
}
export interface GorillaPoint {
  forward: number;
  up: number;
  ms: number;
}
export interface GorillaTrajectory {
  id: string;
  name: string;
  leg: number;
  points: GorillaPoint[];
}
export type FootPoint = { x: number; y: number };
export const defaultGorillaKinematics = (): GorillaKinematics => ({
  profile: GORILLA_GEOMETRY.profile,
  zeroAngles: Array(8).fill(90),
  pulseMinUs: 1000,
  pulseMaxUs: 2000,
  verified: false,
});
export function validGorillaKinematics(v: unknown): v is GorillaKinematics {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const k = v as GorillaKinematics;
  return (
    Object.keys(k).sort().join(',') ===
      'profile,pulseMaxUs,pulseMinUs,verified,zeroAngles' &&
    k.profile === GORILLA_GEOMETRY.profile &&
    typeof k.verified === 'boolean' &&
    Array.isArray(k.zeroAngles) &&
    k.zeroAngles.length === 8 &&
    k.zeroAngles.every((a) => Number.isInteger(a) && a >= 45 && a <= 135) &&
    Number.isInteger(k.pulseMinUs) &&
    Number.isInteger(k.pulseMaxUs) &&
    k.pulseMinUs >= 500 &&
    k.pulseMinUs <= 1200 &&
    k.pulseMaxUs >= 1800 &&
    k.pulseMaxUs <= 3000
  );
}
const rad = Math.PI / 180,
  dist = (a: FootPoint, b: FootPoint) => Math.hypot(a.x - b.x, a.y - b.y);
/** x = robot forward, y = down; A is the front/outer-calf motor. Fixed lower branch. */
export function gorillaForward(
  k: GorillaKinematics,
  leg: number,
  a: number,
  b: number,
) {
  const A = { x: 23, y: 0 },
    B = { x: -23, y: 0 },
    qa = (k.zeroAngles[2 * leg] + a) * rad,
    qb = (k.zeroAngles[2 * leg + 1] + b) * rad;
  const E = { x: A.x + 50 * Math.cos(qa), y: 50 * Math.sin(qa) },
    F = { x: B.x + 50 * Math.cos(qb), y: 50 * Math.sin(qb) },
    d = dist(E, F);
  if (
    ![qa, qb, d].every(Number.isFinite) ||
    E.x - F.x < 4 ||
    E.y < 5 ||
    F.y < 5 ||
    d < 4 ||
    d >= 198
  )
    return null;
  const h = Math.sqrt(10000 - (d * d) / 4),
    foot = {
      x: (E.x + F.x) / 2 + ((F.y - E.y) * h) / d,
      y: (E.y + F.y) / 2 - ((F.x - E.x) * h) / d,
    };
  const cross = (p: FootPoint, q: FootPoint, r: FootPoint) =>
    Math.abs((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x)) / 5000;
  if (
    foot.y <= Math.max(E.y, F.y) ||
    cross(A, E, foot) < 0.12 ||
    cross(B, F, foot) < 0.12
  )
    return null;
  return { A, B, E, F, foot };
}
export function gorillaInverse(
  k: GorillaKinematics,
  s: GorillaSettings,
  leg: number,
  foot: FootPoint,
): [number, number] | null {
  if (
    !Number.isInteger(leg) ||
    leg < 0 ||
    leg > 3 ||
    !Number.isFinite(foot.x) ||
    !Number.isFinite(foot.y) ||
    foot.y <= 0
  )
    return null;
  const out: number[] = [];
  for (let j = 0; j < 2; j++) {
    const dx = foot.x - (j ? -23 : 23),
      r = Math.hypot(dx, foot.y),
      c = (r * r + 2500 - 10000) / (100 * r);
    if (!Number.isFinite(c) || Math.abs(c) >= 0.995) return null;
    const q = (Math.atan2(foot.y, dx) + (j ? 1 : -1) * Math.acos(c)) / rad,
      angle = q - k.zeroAngles[leg * 2 + j],
      i = leg * 2 + j;
    const physical =
      Number(s['center' + i]) + (s['reversed' + i] ? -angle : angle);
    if (
      angle < -20 ||
      angle > 20 ||
      physical < Number(s['min' + i]) ||
      physical > Number(s['max' + i])
    )
      return null;
    out.push(angle);
  }
  const fk = gorillaForward(k, leg, out[0], out[1]);
  return fk && dist(fk.foot, foot) < 0.001 ? (out as [number, number]) : null;
}
export function validGorillaPoints(v: unknown): v is GorillaPoint[] {
  return (
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= 16 &&
    v.every(
      (p) =>
        p &&
        typeof p === 'object' &&
        Object.keys(p).sort().join(',') === 'forward,ms,up' &&
        typeof p.forward === 'number' &&
        Number.isFinite(p.forward) &&
        Math.abs(p.forward) <= 50 &&
        typeof p.up === 'number' &&
        Number.isFinite(p.up) &&
        Math.abs(p.up) <= 30 &&
        Number.isInteger(p.ms) &&
        p.ms >= 200 &&
        p.ms <= 10000,
    ) &&
    v.reduce((n, p) => n + p.ms, 0) <= 120000
  );
}
export interface GorillaCartesianMove {
  leg: number;
  segments: { from: FootPoint; to: FootPoint; duration: number }[];
  duration: number;
  elapsed: number;
  k: GorillaKinematics;
  settings: GorillaSettings;
  initial: number[];
}
/** All segments including the entry are checked before moving. Rate limited at <=0.25mm samples. */
export function planGorillaPath(
  k: GorillaKinematics,
  s: GorillaSettings,
  leg: number,
  points: GorillaPoint[],
  current: number[],
): { move?: GorillaCartesianMove; error?: string } {
  if (
    !validGorillaKinematics(k) ||
    !validGorillaPoints(points) ||
    current.length !== 8 ||
    current.some((v) => !Number.isFinite(v)) ||
    !Number.isInteger(leg) ||
    leg < 0 ||
    leg > 3
  )
    return { error: 'Configuración o puntos inválidos.' };
  const home = gorillaForward(k, leg, 0, 0),
    start = gorillaForward(k, leg, current[leg * 2], current[leg * 2 + 1]);
  if (!home || !start)
    return {
      error:
        'La posición de entrada no pertenece a la rama de montaje admitida.',
    };
  const initialPair=gorillaInverse(k,s,leg,start.foot);
  if(!initialPair||initialPair.some((v,j)=>Math.abs(v-current[leg*2+j])>.001))return {error:'La posición actual pertenece a otra rama de articulación. Volvé a una referencia validada.'};
  let from = start.foot;
  const segments: GorillaCartesianMove['segments'] = [];
  for (let segment = 0; segment < points.length; segment++) {
    const p = points[segment],
      to = { x: home.foot.x + p.forward, y: home.foot.y - p.up },
      steps = Math.max(16, Math.ceil(dist(from, to) / 0.25));
    if (steps > 256) return { error: `Tramo ${segment + 1}: demasiado largo.` };
    let previous = gorillaInverse(k, s, leg, from),
      rate = 0;
    if (!previous)
      return { error: 'Entrada fuera de límites o rama incompatible.' };
    for (let n = 1; n <= steps; n++) {
      const t = n / steps,
        next = gorillaInverse(k, s, leg, {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        });
      if (!next)
        return {
          error: `Tramo ${segment + 1}: fuera de alcance, límite o margen de singularidad.`,
        };
      rate = Math.max(
        rate,
        ...next.map((v, j) => (Math.abs(v - previous![j]) * steps * 1000) / 30),
      );
      previous = next;
    }
    // 5% margin over sampled angular rate. This does not certify mechanical collisions.
    const duration = Math.max(p.ms, Math.ceil(rate * 1.05));
    if (duration > 30000)
      return { error: `Tramo ${segment + 1}: requiere más de 30 segundos.` };
    segments.push({ from: { ...from }, to, duration });
    from = to;
  }
  const duration = segments.reduce((n, p) => n + p.duration, 0);
  if (duration > 180000)
    return { error: 'La duración efectiva supera tres minutos.' };
  return {
    move: {
      leg,
      segments,
      duration,
      elapsed: 0,
      k,
      settings: s,
      initial: [...current],
    },
  };
}
export function advanceGorillaPath(move: GorillaCartesianMove, ms: number) {
  const elapsed = Math.min(move.duration, move.elapsed + Math.max(0, ms));
  let remaining = elapsed,
    seg = move.segments[0];
  for (const next of move.segments) {
    seg = next;
    if (remaining <= seg.duration) break;
    remaining -= seg.duration;
  }
  const t = Math.min(1, remaining / seg.duration),
    foot = {
      x: seg.from.x + (seg.to.x - seg.from.x) * t,
      y: seg.from.y + (seg.to.y - seg.from.y) * t,
    },
    pair = gorillaInverse(move.k, move.settings, move.leg, foot);
  const angles = [...move.initial];
  if (pair) {
    angles[move.leg * 2] = pair[0];
    angles[move.leg * 2 + 1] = pair[1];
  }
  return {
    move: { ...move, elapsed },
    angles,
    moving: elapsed < move.duration && !!pair,
    error: !pair,
    foot,
  };
}
export function validGorillaTrajectories(
  v: unknown,
  k: GorillaKinematics,
  s: GorillaSettings,
): v is GorillaTrajectory[] {
  if (!Array.isArray(v) || v.length > 8) return false;
  const ids = new Set<string>(),
    names = new Set<string>();
  return v.every((p) => {
    if (
      !p ||
      typeof p !== 'object' ||
      Object.keys(p).sort().join(',') !== 'id,leg,name,points' ||
      typeof p.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,48}$/.test(p.id) ||
      ids.has(p.id) ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.name !== p.name.trim() ||
      p.name.length > 40 ||
      names.has(p.name.toLocaleLowerCase('es')) ||
      !planGorillaPath(k, s, p.leg, p.points, Array(8).fill(0)).move
    )
      return false;
    ids.add(p.id);
    names.add(p.name.toLocaleLowerCase('es'));
    return true;
  });
}
export function gorillaPathPreset(
  kind: 'lift' | 'rectangle' | 'arc',
): GorillaPoint[] {
  const p = (forward: number, up: number): GorillaPoint => ({
    forward,
    up,
    ms: 1000,
  });
  if (kind === 'lift') return [p(0, 0), p(0, 4), p(0, 0)];
  if (kind === 'rectangle')
    return [p(0, 0), p(0, 3), p(6, 3), p(6, 1), p(0, 1), p(0, 0)];
  return [
    p(0, 0),
    ...Array.from({ length: 9 }, (_, i) => {
      const t = (i / 8) * Math.PI;
      return p(-4 * Math.cos(t), 3 * Math.sin(t) + 1);
    }),
    p(0, 0),
  ];
}
