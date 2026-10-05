export const MAX_FRAME_ANIMATIONS = 4;
export const MAX_ANIMATION_FRAMES = 16;
export type FrameAnimation = { id: string; name: string; frameMs: number; frames: number[][] };

export function validFrameAnimations(value: unknown, width: number): value is FrameAnimation[] {
  if (!Array.isArray(value) || value.length > MAX_FRAME_ANIMATIONS) return false;
  const ids = new Set<string>(), names = new Set<string>();
  return value.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).sort().join(',') !== 'frameMs,frames,id,name') return false;
    if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(item.id) || ids.has(item.id)) return false;
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 30 || Array.from(item.name as string).some(character => character.charCodeAt(0) < 32) || names.has(item.name.trim().toLocaleLowerCase('es'))) return false;
    if (!Number.isInteger(item.frameMs) || item.frameMs < 40 || item.frameMs > 2000 || !Array.isArray(item.frames) || !item.frames.length || item.frames.length > MAX_ANIMATION_FRAMES) return false;
    if (!item.frames.every((rows: unknown) => Array.isArray(rows) && rows.length === 8 && rows.every(row => Number.isInteger(row) && row >= 0 && row <= 2 ** width - 1))) return false;
    ids.add(item.id); names.add(item.name.trim().toLocaleLowerCase('es')); return true;
  });
}

/** Finite animations hold their last frame; endless ones wrap at frame zero. */
export function animationFrame(animation: FrameAnimation, elapsedMs: number, repeatCount: number) {
  const step = Math.floor(Math.max(0, elapsedMs) / animation.frameMs);
  const done = repeatCount !== 0 && step >= animation.frames.length * repeatCount;
  return { rows: animation.frames[done ? animation.frames.length - 1 : step % animation.frames.length], done };
}
