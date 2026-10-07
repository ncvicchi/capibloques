/** Editor-only geometry, in workspace units (independent of zoom/pan). */
export interface BlockBox { left: number; right: number; top: number; bottom: number }

export function separatedBlockOffset(box: BlockBox, obstacles: readonly BlockBox[], gap = 24): number {
  let offset = 0;
  for (let attempt = 0; attempt <= obstacles.length; attempt++) {
    const collisions = obstacles.filter(other => box.left < other.right + gap && box.right + gap > other.left && box.top + offset < other.bottom + gap && box.bottom + offset + gap > other.top);
    if (!collisions.length) return offset;
    offset = Math.max(...collisions.map(other => other.bottom + gap - box.top));
  }
  return offset;
}

export const trafficColorLabel = (color: string) => ({ RED: 'rojo', YELLOW: 'amarillo', GREEN: 'verde', OFF: 'apagado' })[color] ?? color;
