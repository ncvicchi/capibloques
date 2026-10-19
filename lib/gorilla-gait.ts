import type { GorillaSettings } from './gorilla-model';
import {
  planGorillaPath,
  gorillaForward,
  gorillaInverse,
  type GorillaKinematics,
  type FootPoint,
  // @ts-expect-error Node strip-types runner.
} from './gorilla-kinematics.ts';

export interface GorillaGait {
  stride: number;
  height: number;
  phaseMs: number;
  turnsVerified: boolean;
}
export const defaultGorillaGait: GorillaGait = {
  stride: 4,
  height: 2,
  phaseMs: 500,
  turnsVerified: false,
};
export function validGorillaGait(v: unknown): v is GorillaGait {
  if (!v || typeof v !== 'object') return false;
  const g = v as GorillaGait;
  return (
    Object.keys(g).sort().join(',') === 'height,phaseMs,stride,turnsVerified' &&
    typeof g.turnsVerified === 'boolean' &&
    Number.isInteger(g.stride) &&
    g.stride >= 1 &&
    g.stride <= 12 &&
    Number.isInteger(g.height) &&
    g.height >= 1 &&
    g.height <= 8 &&
    Number.isInteger(g.phaseMs) &&
    g.phaseMs >= 200 &&
    g.phaseMs <= 2000
  );
}
export interface GorillaGaitMove {
  frames: {
    feet: FootPoint[];
    duration: number;
    swing: number;
    travel: number;
    yaw: number;
  }[];
  initialFeet: FootPoint[];
  k: GorillaKinematics;
  settings: GorillaSettings;
  duration: number;
  elapsed: number;
  lastAngles: number[];
}
/** Four-beat crawl. All feet return to x=0, up=4. No force/contact feedback. */
export function planGorillaGait(
  k: GorillaKinematics,
  s: GorillaSettings,
  mode: number,
  g: GorillaGait,
  current: number[],
): { move?: GorillaGaitMove; error?: string } {
  if (!validGorillaGait(g) || !Number.isInteger(mode) || mode < 0 || mode > 4)
    return { error: 'Marcha inválida.' };
  const coordinates = Array.from({ length: 4 }, () => ({ forward: 0, up: 4 }));
  const raw: {
    points: typeof coordinates;
    swing: number;
    travel: number;
    yaw: number;
  }[] = [];
  const add = (swing = -1, travel = 0, yaw = 0) =>
    raw.push({ points: structuredClone(coordinates), swing, travel, yaw });
  add();
  if (mode !== 4) {
    const stride = (leg: number) =>
      mode < 2
        ? (mode === 0 ? 1 : -1) * g.stride
        : ((leg % 2 === 0 ? -1 : 1) * (mode === 2 ? 1 : -1) * g.stride) / 2;
    for (const leg of [2, 0, 3, 1]) {
      coordinates[leg].up = 4 + g.height;
      add(leg);
      coordinates[leg].forward += stride(leg);
      add(leg);
      coordinates[leg].up = 4;
      add();
      coordinates.forEach((p, i) => (p.forward -= stride(i) / 4));
      add(
        -1,
        mode < 2 ? ((mode === 0 ? 1 : -1) * g.stride) / 4 : 0,
        mode >= 2 ? ((mode === 2 ? -1 : 1) * g.stride) / 4 : 0,
      );
    }
  }
  const initialFeet: FootPoint[] = [],
    frames: GorillaGaitMove['frames'] = [];
  let positions = [...current];
  for (const frame of raw) {
    const feet: FootPoint[] = [];
    let duration = g.phaseMs;
    const next = [...positions];
    for (let leg = 0; leg < 4; leg++) {
      const plan = planGorillaPath(
        k,
        s,
        leg,
        [{ ...frame.points[leg], ms: g.phaseMs }],
        positions,
      );
      if (!plan.move)
        return {
          error: `${['Delantera izquierda', 'Delantera derecha', 'Trasera izquierda', 'Trasera derecha'][leg]}: ${plan.error}`,
        };
      const seg = plan.move.segments[0];
      feet.push(seg.to);
      duration = Math.max(duration, seg.duration);
      if (frames.length === 0) initialFeet.push(seg.from);
      const angles = gorillaInverse(k, s, leg, seg.to)!;
      next[2 * leg] = angles[0];
      next[2 * leg + 1] = angles[1];
    }
    frames.push({
      feet,
      duration,
      swing: frame.swing,
      travel: frame.travel,
      yaw: frame.yaw,
    });
    positions = next;
  }
  const duration = frames.reduce((n, f) => n + f.duration, 0);
  if (duration > 180000)
    return { error: 'El ciclo requiere más de tres minutos.' };
  return {
    move: { frames, initialFeet, k, settings: s, duration, elapsed: 0, lastAngles: [...current] },
  };
}
export function advanceGorillaGait(move: GorillaGaitMove, ms: number) {
  const elapsed = Math.min(move.duration, move.elapsed + Math.max(0, ms));
  const evaluate = (time: number) => {
    let left = time,
      from = move.initialFeet,
      travel = 0,
      yaw = 0;
    for (let i = 0; i < move.frames.length; i++) {
      const f = move.frames[i],
        t = Math.min(1, left / f.duration);
      if (left <= f.duration || i === move.frames.length - 1) {
        const angles: number[] = [];
        for (let leg = 0; leg < 4; leg++) {
          const pair = gorillaInverse(move.k, move.settings, leg, {
            x: from[leg].x + (f.feet[leg].x - from[leg].x) * t,
            y: from[leg].y + (f.feet[leg].y - from[leg].y) * t,
          });
          if (!pair) return null;
          angles.push(...pair);
        }
        return {
          angles,
          swing: f.swing,
          travel: travel + f.travel * t,
          yaw: yaw + f.yaw * t,
        };
      }
      left -= f.duration;
      travel += f.travel;
      yaw += f.yaw;
      from = f.feet;
    }
    return null;
  };
  const now = evaluate(elapsed),
    before = evaluate(move.elapsed);
  return {
    move: { ...move, elapsed, lastAngles: now?.angles ?? move.lastAngles },
    angles: now?.angles ?? move.lastAngles,
    moving: elapsed < move.duration && !!now,
    error: !now,
    swing: now?.swing ?? -1,
    travel: now && before ? now.travel - before.travel : 0,
    yaw: now && before ? now.yaw - before.yaw : 0,
  };
}

export function gaitReference(k: GorillaKinematics, leg: number) {
  return gorillaForward(k, leg, 0, 0)?.foot;
}
