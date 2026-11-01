// @ts-expect-error Node strip-types runner.
import { boardProfile, type BoardProfileId } from './board-profiles.ts';
// @ts-expect-error Node strip-types runner.
import { wemosTop, wemosBottom } from './wemos-board.ts';
// @ts-expect-error Node strip-types runner.
import { s3Left, s3Right } from './s3-board.ts';

export type TrafficPins = { red: number | null; yellow: number | null; green: number | null; common?: number | null };

// GND, R, Y, G in module order. Wemos groups account for the module's tabs,
// confirmed by the owner. Reversing a module reverses all four contacts.
export const directTrafficGroups: Record<BoardProfileId, readonly (readonly number[])[]> = {
  'wemos-d1-r32': [[26, 25, 17, 16], [5, 23, 19, 18]],
  'diymall-esp32-s3-devkitc-v1-n16r8': [[4, 5, 6, 7], [15, 16, 17, 18]],
  'waveshare-esp32-s3-touch-lcd-5-28117': [],
};

export function validDirectTraffic(pins: TrafficPins, board: BoardProfileId) {
  return trafficOrientation(pins, board) !== null;
}

export function trafficOrientation(pins: TrafficPins, board: BoardProfileId): 'normal' | 'inverted' | null {
  const values = [pins.common, pins.red, pins.yellow, pins.green];
  for (const group of directTrafficGroups[board]) {
    if (values.every((pin, index) => pin === group[index])) return 'normal';
    if (values.every((pin, index) => pin === [...group].reverse()[index])) return 'inverted';
  }
  return null;
}

export function invertTrafficPins(pins: TrafficPins): TrafficPins {
  const [common, red, yellow, green] = [pins.common ?? null, pins.red, pins.yellow, pins.green].reverse();
  return { common, red, yellow, green };
}

/** Physical adjacency, never GPIO-number adjacency. Does not claim wired == direct. */
export function planTrafficWiring(board: BoardProfileId, count: number, occupied: ReadonlySet<number>): TrafficPins[] {
  const used = new Set(occupied);
  const direct = count <= 2 ? directTrafficGroups[board] : [];
  const rows = board === 'wemos-d1-r32' ? [wemosTop, wemosBottom] : [s3Left, s3Right];
  const candidates = boardProfile(board).safeOutputPins;
  const triples = rows.flatMap(row => row.slice(0, -2).map((_, index) => row.slice(index, index + 3).map(pin => pin.gpio)));
  const result: TrafficPins[] = [];
  for (let index = 0; index < count; index++) {
    const group = direct.find(pins => pins.every(pin => !used.has(pin)));
    if (group) {
      const [common, red, yellow, green] = group;
      group.forEach(pin => used.add(pin));
      result.push({ common, red, yellow, green });
      continue;
    }
    const triple = triples.find(pins => pins.every((pin): pin is number => pin !== undefined && candidates.includes(pin) && !used.has(pin)));
    const pins = triple ? triple as number[] : candidates.filter(pin => !used.has(pin)).slice(0, 3);
    pins.forEach(pin => used.add(pin));
    result.push({ common: null, red: pins[0] ?? null, yellow: pins[1] ?? null, green: pins[2] ?? null });
  }
  return result;
}
