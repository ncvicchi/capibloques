import type { PedestrianDisplayValue } from './traffic-displays.ts';

export const crossingIds = ['north', 'east', 'south', 'west'] as const;
export type CrossingId = (typeof crossingIds)[number];
/** Ausente: no hay cartel ni peatones. OFF: hay cartel, pero no habilita. */
export type PedestrianSignals = Partial<Record<CrossingId, PedestrianDisplayValue>>;
export const crossingNames: Record<CrossingId, string> = {
  north: 'Paso norte', east: 'Paso este', south: 'Paso sur', west: 'Paso oeste',
};
export const crossingPaths: Record<CrossingId, { from: { x: number; y: number }; to: { x: number; y: number } }> = {
  north: { from: { x: 380, y: 165 }, to: { x: 580, y: 165 } },
  east: { from: { x: 585, y: 170 }, to: { x: 585, y: 370 } },
  south: { from: { x: 380, y: 375 }, to: { x: 580, y: 375 } },
  west: { from: { x: 375, y: 170 }, to: { x: 375, y: 370 } },
};

export interface PedestrianState {
  id: string;
  crossing: CrossingId;
  direction: 1 | -1;
  progress: number;
  started: boolean;
}
export interface PedestrianWorldState {
  people: PedestrianState[];
  spawnInMs: Record<CrossingId, number>;
  nextId: number;
  nextDirection: Record<CrossingId, 1 | -1>;
  randomState: number;
}
export function createPedestrianWorldState(): PedestrianWorldState {
  return { people: [], spawnInMs: { north: 300, east: 700, south: 1100, west: 1500 }, nextId: 1, nextDirection: { north: 1, east: 1, south: 1, west: 1 }, randomState: 0x70656174 };
}
export function pedestrianPosition(person: PedestrianState, queueIndex = 0) {
  const path = crossingPaths[person.crossing];
  const from = person.direction === 1 ? path.from : path.to;
  const to = person.direction === 1 ? path.to : path.from;
  const progress = person.started ? person.progress : -0.045 - queueIndex * 0.065;
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
}
export function advancePedestrians(previous: PedestrianWorldState, signals: PedestrianSignals, elapsedMs: number): PedestrianWorldState {
  const ms = Math.min(100, Math.max(0, elapsedMs));
  if (!ms) return previous;
  const people = previous.people
    .filter(person => signals[person.crossing] !== undefined || person.started)
    .map(person => {
      if (!person.started && signals[person.crossing] !== 'WALK') return person;
      return { ...person, started: true, progress: person.progress + ms / 5500 };
    }).filter(person => person.progress < 1);
  const spawnInMs = { ...previous.spawnInMs };
  const nextDirection = { ...previous.nextDirection };
  let { nextId, randomState } = previous;
  for (const crossing of crossingIds) {
    if (signals[crossing] === undefined) continue;
    spawnInMs[crossing] = Math.max(0, spawnInMs[crossing] - ms);
    if (spawnInMs[crossing] || people.length >= 16 || people.filter(person => person.crossing === crossing).length >= 4) continue;
    people.push({ id: `pedestrian-${nextId}`, crossing, direction: nextDirection[crossing], progress: 0, started: false });
    nextDirection[crossing] = nextDirection[crossing] === 1 ? -1 : 1;
    nextId += 1;
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    spawnInMs[crossing] = 1800 + Math.round(randomState / 0x100000000 * 5000);
  }
  return { people, spawnInMs, nextId, nextDirection, randomState };
}
