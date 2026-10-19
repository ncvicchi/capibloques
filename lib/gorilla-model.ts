export const gorillaLegNames = [
  'Delantera izquierda',
  'Delantera derecha',
  'Trasera izquierda',
  'Trasera derecha',
] as const;
export type GorillaSettings = Record<string, number | string | boolean>;
export function gorillaSettings(): GorillaSettings {
  return Object.fromEntries([
    ['address', 64],
    ['verified', false],
    ...Array.from({ length: 8 }, (_, i) => [
      [`channel${i}`, i],
      [`center${i}`, 90],
      [`min${i}`, 70],
      [`max${i}`, 110],
      [`reversed${i}`, false],
    ]).flat(),
  ]);
}
export function validGorillaSettings(v: unknown): v is GorillaSettings {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const s = v as GorillaSettings;
  if (
    Object.keys(s).length !== 42 ||
    typeof s.verified !== 'boolean' ||
    !Number.isInteger(s.address) ||
    Number(s.address) < 64 ||
    Number(s.address) > 119
  )
    return false;
  const channels = new Set<number>();
  for (let i = 0; i < 8; i++) {
    const ch = s[`channel${i}`],
      c = s[`center${i}`],
      a = s[`min${i}`],
      b = s[`max${i}`];
    if (
      !Number.isInteger(ch) ||
      Number(ch) < 0 ||
      Number(ch) > 15 ||
      channels.has(Number(ch)) ||
      typeof s[`reversed${i}`] !== 'boolean'
    )
      return false;
    if (
      ![c, a, b].every((x) => typeof x === 'number' && Number.isInteger(x)) ||
      Number(a) < 50 ||
      Number(b) > 130 ||
      Number(c) < 70 ||
      Number(c) > 110 ||
      Number(a) > Number(c) ||
      Number(b) < Number(c)
    )
      return false;
    channels.add(Number(ch));
  }
  return true;
}
export function gorillaValues() {
  return {
    ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`j${i}`, 0])),
    ready: false,
    moving: false,
    error: false,
  };
}
export interface GorillaMove {
  from: number[];
  to: number[];
  elapsed: number;
  duration: number;
  mask: number;
}
export function gorillaTargets(
  s: GorillaSettings,
  current: number[],
  joint: number,
  a: number,
  b: number,
  pair: boolean,
): number[] | null {
  if (
    !Number.isInteger(joint) ||
    joint < 0 ||
    joint > (pair ? 3 : 7) ||
    ![a, b].every((n) => Number.isFinite(n) && n >= -20 && n <= 20)
  )
    return null;
  const next = [...current],
    indices = pair ? [joint * 2, joint * 2 + 1] : [joint];
  indices.forEach((j, i) => (next[j] = i ? b : a));
  return indices.every((j) => {
    const p =
      Number(s[`center${j}`]) + (s[`reversed${j}`] ? -next[j] : next[j]);
    return p >= Number(s[`min${j}`]) && p <= Number(s[`max${j}`]);
  })
    ? next
    : null;
}
export function gorillaMove(
  from: number[],
  to: number[],
  duration: number,
  mask: number,
): GorillaMove {
  return {
    from: [...from],
    to: [...to],
    elapsed: 0,
    duration: Math.max(
      200,
      Math.min(10000, duration),
      (Math.max(...to.map((v, i) => Math.abs(v - from[i]))) / 30) * 1000,
    ),
    mask,
  };
}
export function advanceGorilla(move: GorillaMove, ms: number) {
  const elapsed = Math.min(move.duration, move.elapsed + Math.max(0, ms)),
    t = elapsed / move.duration;
  return {
    move: { ...move, elapsed },
    angles: move.from.map((v, i) => v + (move.to[i] - v) * t),
    moving: elapsed < move.duration,
  };
}
/** Illustrative five-bar linkage, NOT measured GorillaBot geometry or a physical IK model. */
export function gorillaLegDiagram(a: number, b: number) {
  const rad = Math.PI / 180,
    A = { x: -18, y: 0 },
    B = { x: 18, y: 0 },
    E = {
      x: A.x + 55 * Math.cos((120 + a) * rad),
      y: 55 * Math.sin((120 + a) * rad),
    },
    F = {
      x: B.x + 55 * Math.cos((60 + b) * rad),
      y: 55 * Math.sin((60 + b) * rad),
    };
  const dx = F.x - E.x,
    dy = F.y - E.y,
    d = Math.hypot(dx, dy),
    h = Math.sqrt(Math.max(0, 90 * 90 - (d * d) / 4));
  return {
    A,
    B,
    E,
    F,
    foot: {
      x: (E.x + F.x) / 2 - (dy / d) * h,
      y: (E.y + F.y) / 2 + (dx / d) * h,
    },
  };
}
