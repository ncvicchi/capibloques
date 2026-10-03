import type { SceneDefinition, SceneDevice, ScenePosition, SceneWidget } from './scene-model';

export type SceneLayoutItem = SceneDevice | SceneWidget;
export type SceneBounds = ScenePosition & { width: number; height: number; left: number; right: number; top: number; bottom: number };

const deviceSizes: Partial<Record<SceneDevice['kind'], readonly [number, number]>> = {
  trafficLight: [126, 112], robot: [96, 104], otto: [100, 122], display: [190, 122],
  ledMatrix: [190, 104], messages: [132, 94], smartLights: [128, 92], wifiNode: [112, 92],
};

export function sceneLayoutItems(scene: SceneDefinition): SceneLayoutItem[] {
  return [...scene.devices, ...scene.widgets];
}

export function sceneItemSize(item: SceneLayoutItem) {
  if (item.kind === 'counter') return { width: 104, height: 82 };
  const [width, height] = deviceSizes[item.kind] ?? [88, 88];
  return { width, height };
}

export function sceneItemBounds(item: SceneLayoutItem): SceneBounds {
  const { width, height } = sceneItemSize(item);
  return { ...item.position, width, height, left: item.position.x - width / 2, right: item.position.x + width / 2, top: item.position.y - height / 2, bottom: item.position.y + height / 2 };
}

export function orderedSceneItemIds(scene: SceneDefinition) {
  const ids = sceneLayoutItems(scene).map(item => item.id);
  const available = new Set(ids);
  const stored = (scene.canvas.itemOrder ?? []).filter((id, index, values) => available.has(id) && values.indexOf(id) === index);
  const known = new Set(stored);
  return [...stored, ...ids.filter(id => !known.has(id))];
}

export function sceneItemLayer(scene: SceneDefinition, itemId: string) {
  const index = orderedSceneItemIds(scene).indexOf(itemId);
  return index < 0 ? 2 : index + 2;
}

export type SceneLabelSide = 'bottom' | 'top' | 'left' | 'right';

/** Deterministic label anchors keep nearby names apart without moving objects. */
export function sceneItemLabelSide(scene: SceneDefinition, itemId: string): SceneLabelSide {
  const items = sceneLayoutItems(scene);
  const item = items.find(candidate => candidate.id === itemId);
  if (!item) return 'bottom';
  const nearby = items.filter(candidate =>
    Math.abs(candidate.position.x - item.position.x) < 150 &&
    Math.abs(candidate.position.y - item.position.y) < 105,
  );
  if (nearby.length < 2) return 'bottom';
  const sides: SceneLabelSide[] = ['bottom', 'top', 'right', 'left'];
  return sides[Math.max(0, nearby.findIndex(candidate => candidate.id === itemId)) % sides.length];
}

export function moveSceneItemsLayer(source: SceneDefinition, itemIds: readonly string[], direction: 'front' | 'back') {
  const scene = structuredClone(source);
  const selected = new Set(itemIds);
  const order = orderedSceneItemIds(scene);
  const moving = order.filter(id => selected.has(id));
  const resting = order.filter(id => !selected.has(id));
  scene.canvas.itemOrder = direction === 'front' ? [...resting, ...moving] : [...moving, ...resting];
  return scene;
}

export type SceneOverlap = { firstId: string; secondId: string; overlapArea: number };

export function findSceneOverlaps(scene: SceneDefinition): SceneOverlap[] {
  const items = sceneLayoutItems(scene);
  const overlaps: SceneOverlap[] = [];
  for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
    const first = sceneItemBounds(items[firstIndex]);
    for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
      const second = sceneItemBounds(items[secondIndex]);
      const width = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const height = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      if (width <= 0 || height <= 0) continue;
      const area = width * height;
      const smallerArea = Math.min(first.width * first.height, second.width * second.height);
      if (area / smallerArea < 0.12) continue;
      overlaps.push({ firstId: items[firstIndex].id, secondId: items[secondIndex].id, overlapArea: Math.round(area) });
    }
  }
  return overlaps;
}

export type SceneAlignment = 'left' | 'horizontal-center' | 'right' | 'top' | 'vertical-center' | 'bottom' | 'distribute-horizontal' | 'distribute-vertical';

export function alignSceneItems(source: SceneDefinition, itemIds: readonly string[], alignment: SceneAlignment) {
  const scene = structuredClone(source);
  const selected = new Set(itemIds);
  const items = sceneLayoutItems(scene).filter(item => selected.has(item.id));
  if (items.length < 2) return scene;
  const boxes = items.map(sceneItemBounds);
  const minLeft = Math.min(...boxes.map(box => box.left));
  const maxRight = Math.max(...boxes.map(box => box.right));
  const minTop = Math.min(...boxes.map(box => box.top));
  const maxBottom = Math.max(...boxes.map(box => box.bottom));
  const centerX = (minLeft + maxRight) / 2;
  const centerY = (minTop + maxBottom) / 2;
  const positions = new Map<string, ScenePosition>();
  if (alignment.startsWith('distribute-')) {
    const horizontal = alignment === 'distribute-horizontal';
    const sorted = [...items].sort((a, b) => horizontal ? a.position.x - b.position.x : a.position.y - b.position.y);
    const first = horizontal ? sorted[0].position.x : sorted[0].position.y;
    const last = horizontal ? sorted.at(-1)!.position.x : sorted.at(-1)!.position.y;
    const step = (last - first) / Math.max(1, sorted.length - 1);
    sorted.forEach((item, index) => positions.set(item.id, { x: horizontal ? first + step * index : item.position.x, y: horizontal ? item.position.y : first + step * index }));
  } else {
    items.forEach(item => {
      const box = sceneItemBounds(item);
      positions.set(item.id, {
        x: alignment === 'left' ? minLeft + box.width / 2 : alignment === 'right' ? maxRight - box.width / 2 : alignment === 'horizontal-center' ? centerX : item.position.x,
        y: alignment === 'top' ? minTop + box.height / 2 : alignment === 'bottom' ? maxBottom - box.height / 2 : alignment === 'vertical-center' ? centerY : item.position.y,
      });
    });
  }
  scene.devices = scene.devices.map(device => positions.has(device.id) ? { ...device, position: positions.get(device.id)! } : device);
  scene.widgets = scene.widgets.map(widget => positions.has(widget.id) ? { ...widget, position: positions.get(widget.id)! } : widget);
  return scene;
}
