export type PixelTool =
  | 'pencil'
  | 'eraser'
  | 'line'
  | 'curve'
  | 'rectangle'
  | 'filled-rectangle'
  | 'ellipse'
  | 'fill';

export type PixelPoint = { x: number; y: number };

export function pixelIsOn(rows: readonly number[], width: number, x: number, y: number) {
  if (x < 0 || x >= width || y < 0 || y >= rows.length) return false;
  const bit = 2 ** (width - 1 - x);
  return (rows[y] ?? 0) % (bit * 2) >= bit;
}

export function setPixel(rows: readonly number[], width: number, point: PixelPoint, enabled: boolean) {
  if (point.x < 0 || point.x >= width || point.y < 0 || point.y >= rows.length) return [...rows];
  const next = [...rows];
  const bit = 2 ** (width - 1 - point.x);
  const on = pixelIsOn(next, width, point.x, point.y);
  if (enabled !== on) next[point.y] += enabled ? bit : -bit;
  return next;
}

function linePoints(from: PixelPoint, to: PixelPoint) {
  const points: PixelPoint[] = [];
  let x = from.x, y = from.y;
  const dx = Math.abs(to.x - from.x), sx = from.x < to.x ? 1 : -1;
  const dy = -Math.abs(to.y - from.y), sy = from.y < to.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ x, y });
    if (x === to.x && y === to.y) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return points;
}

export function drawPixelShape(rows: readonly number[], width: number, tool: PixelTool, from: PixelPoint, to: PixelPoint) {
  let next = [...rows];
  const paint = (point: PixelPoint, enabled = true) => { next = setPixel(next, width, point, enabled); };
  if (tool === 'pencil' || tool === 'eraser') {
    for (const point of linePoints(from, to)) paint(point, tool === 'pencil');
    return next;
  }
  if (tool === 'fill') {
    const wanted = !pixelIsOn(next, width, from.x, from.y);
    const previous = !wanted;
    const pending = [from];
    const visited = new Set<string>();
    while (pending.length) {
      const point = pending.pop()!;
      const key = `${point.x}:${point.y}`;
      if (visited.has(key) || point.x < 0 || point.x >= width || point.y < 0 || point.y >= next.length || pixelIsOn(next, width, point.x, point.y) !== previous) continue;
      visited.add(key); paint(point, wanted);
      pending.push({ x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y }, { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 });
    }
    return next;
  }
  if (tool === 'line') {
    for (const point of linePoints(from, to)) paint(point);
    return next;
  }
  const left = Math.min(from.x, to.x), right = Math.max(from.x, to.x);
  const top = Math.min(from.y, to.y), bottom = Math.max(from.y, to.y);
  if (tool === 'rectangle' || tool === 'filled-rectangle') {
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1)
      if (tool === 'filled-rectangle' || x === left || x === right || y === top || y === bottom) paint({ x, y });
    return next;
  }
  if (tool === 'ellipse') {
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    const rx = Math.max(0.5, (right - left) / 2), ry = Math.max(0.5, (bottom - top) / 2);
    const steps = Math.max(12, Math.ceil(2 * Math.PI * Math.max(rx, ry) * 2));
    for (let index = 0; index < steps; index += 1) {
      const angle = index * 2 * Math.PI / steps;
      paint({ x: Math.round(cx + rx * Math.cos(angle)), y: Math.round(cy + ry * Math.sin(angle)) });
    }
    return next;
  }
  // Curva cuadrática simple: el control se eleva de forma visible y siempre
  // se rasteriza a la cuadrícula real, sin prometer precisión vectorial.
  const control = { x: (from.x + to.x) / 2, y: Math.max(0, Math.min(from.y, to.y) - Math.max(2, Math.abs(to.x - from.x) / 3)) };
  let previous = from;
  for (let index = 1; index <= 32; index += 1) {
    const t = index / 32, inverse = 1 - t;
    const point = {
      x: Math.round(inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x),
      y: Math.round(inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y),
    };
    for (const item of linePoints(previous, point)) paint(item);
    previous = point;
  }
  return next;
}

export function transformPixelRows(rows: readonly number[], width: number, action: 'left' | 'right' | 'up' | 'down' | 'flip-horizontal' | 'flip-vertical' | 'invert') {
  if (action === 'invert') return rows.map(row => (2 ** width - 1) - row);
  if (action === 'flip-vertical') return [...rows].reverse();
  let next = Array.from({ length: rows.length }, () => 0);
  for (let y = 0; y < rows.length; y += 1) for (let x = 0; x < width; x += 1) {
    if (!pixelIsOn(rows, width, x, y)) continue;
    const target = { x, y };
    if (action === 'left') target.x = (x + width - 1) % width;
    if (action === 'right') target.x = (x + 1) % width;
    if (action === 'up') target.y = (y + rows.length - 1) % rows.length;
    if (action === 'down') target.y = (y + 1) % rows.length;
    if (action === 'flip-horizontal') target.x = width - 1 - x;
    next = setPixel(next, width, target, true);
  }
  return next;
}
