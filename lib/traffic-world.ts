import type { TrafficDirection } from './scene-model.ts';

export type TrafficLane = TrafficDirection;
export type TrafficSignalColor = 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
export const allTrafficLanes: readonly TrafficLane[] = [
  'eastbound',
  'westbound',
  'southbound',
  'northbound',
];

export interface TrafficCarState {
  id: string;
  lane: TrafficLane;
  progress: number;
  crashed: boolean;
  waitingForGreen: boolean;
  clearingIntersection: boolean;
}

export interface TrafficWorldState {
  cars: TrafficCarState[];
  collision: { horizontalId: string; verticalId: string } | null;
  spawnInMs: Record<TrafficLane, number>;
  nextCarId: number;
  randomState: number;
}

export type TrafficSignals = Record<TrafficLane, TrafficSignalColor>;

const SPEED_PER_MS: Record<TrafficLane, number> = {
  eastbound: 1 / 12_000,
  westbound: 1 / 12_000,
  southbound: 1 / 10_500,
  northbound: 1 / 10_500,
};
const STOP_PROGRESS: Record<TrafficLane, number> = {
  eastbound: 0.37,
  westbound: 0.37,
  southbound: 0.3,
  northbound: 0.3,
};
const QUEUE_GAP: Record<TrafficLane, number> = {
  eastbound: 0.055,
  westbound: 0.055,
  southbound: 0.088,
  northbound: 0.088,
};
const ENTRY_GAP: Record<TrafficLane, number> = {
  eastbound: 0.07,
  westbound: 0.07,
  southbound: 0.11,
  northbound: 0.11,
};
const MAX_TRAFFIC_CARS = 12;

export function createTrafficWorldState(): TrafficWorldState {
  return {
    cars: [],
    collision: null,
    spawnInMs: {
      eastbound: 0,
      westbound: 1_100,
      southbound: 650,
      northbound: 1_700,
    },
    nextCarId: 1,
    randomState: 0xc4a1b10c,
  };
}

function nextRandom(state: number) {
  const next = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return { state: next, value: next / 0x1_0000_0000 };
}

function advanceProgress(car: TrafficCarState, distance: number) {
  return { ...car, progress: car.progress + distance };
}

export function trafficCarPosition(car: TrafficCarState) {
  switch (car.lane) {
    case 'eastbound':
      return { x: -45 + car.progress * 1_050, y: 315 };
    case 'westbound':
      return { x: 1_005 - car.progress * 1_050, y: 225 };
    case 'southbound':
      return { x: 435, y: -40 + car.progress * 620 };
    case 'northbound':
      return { x: 525, y: 580 - car.progress * 620 };
  }
}

function advanceLane(
  cars: readonly TrafficCarState[],
  lane: TrafficLane,
  color: TrafficSignalColor,
  elapsedMs: number,
) {
  // Un semáforo apagado no da permiso para arrancar. Para el tránsito se
  // comporta como amarillo: quien ya cruzó libera la intersección y quien
  // todavía no llegó a la línea se detiene.
  const effectiveColor = color === 'OFF' ? 'YELLOW' : color;
  const stop = STOP_PROGRESS[lane];
  const approaching = cars
    .filter(
      car =>
        car.lane === lane &&
        !car.crashed &&
        car.progress <= stop,
    )
    .sort((left, right) => right.progress - left.progress);
  const queueTargets = new Map(
    approaching.map((car, index) => [car.id, stop - index * QUEUE_GAP[lane]]),
  );

  return cars.map(car => {
    if (car.lane !== lane || car.crashed) return car;
    const distance = SPEED_PER_MS[lane] * Math.min(100, Math.max(0, elapsedMs));
    if (effectiveColor === 'GREEN') {
      return advanceProgress(
        { ...car, waitingForGreen: false, clearingIntersection: false },
        distance,
      );
    }
    if (car.clearingIntersection || car.progress > stop) {
      const advanced = advanceProgress(car, distance);
      return {
        ...advanced,
        waitingForGreen: false,
        clearingIntersection: true,
      };
    }
    if (car.progress <= stop) {
      const target = queueTargets.get(car.id) ?? stop;
      const progress =
        car.progress >= target
          ? car.progress
          : Math.min(target, car.progress + distance);
      return {
        ...car,
        progress,
        waitingForGreen:
          (effectiveColor === 'RED' || effectiveColor === 'YELLOW') && progress >= target,
        clearingIntersection: false,
      };
    }
    return car;
  });
}

function spawnCars(
  previous: TrafficWorldState,
  cars: TrafficCarState[],
  elapsedMs: number,
  enabled: ReadonlySet<TrafficLane>,
) {
  const spawnInMs = { ...previous.spawnInMs };
  let nextCarId = previous.nextCarId;
  let randomState = previous.randomState;

  for (const lane of allTrafficLanes) {
    if (!enabled.has(lane)) continue;
    spawnInMs[lane] = Math.max(0, spawnInMs[lane] - elapsedMs);
    if (spawnInMs[lane] > 0 || cars.length >= MAX_TRAFFIC_CARS) continue;
    const entryBusy = cars.some(
      car => car.lane === lane && car.progress < ENTRY_GAP[lane],
    );
    if (entryBusy) continue;

    cars.push({
      id: `traffic-${lane}-${nextCarId}`,
      lane,
      progress: 0,
      crashed: false,
      waitingForGreen: false,
      clearingIntersection: false,
    });
    nextCarId += 1;
    const random = nextRandom(randomState);
    randomState = random.state;
    spawnInMs[lane] = 450 + Math.round(random.value * random.value * 5_550);
  }
  return { cars, spawnInMs, nextCarId, randomState };
}

function inIntersection(car: TrafficCarState) {
  const position = trafficCarPosition(car);
  return (
    position.x >= 430 &&
    position.x <= 535 &&
    position.y >= 220 &&
    position.y <= 325
  );
}

export function advanceTrafficWorld(
  previous: TrafficWorldState,
  signals: TrafficSignals,
  elapsedMs: number,
  enabledLanes: readonly TrafficLane[] = allTrafficLanes,
): TrafficWorldState {
  if (previous.collision) return previous;
  const frameMs = Math.min(100, Math.max(0, elapsedMs));
  const enabled = new Set(enabledLanes);
  let cars = previous.cars.filter(car => enabled.has(car.lane));
  for (const lane of allTrafficLanes) {
    if (!enabled.has(lane)) continue;
    cars = advanceLane(cars, lane, signals[lane], frameMs);
  }
  cars = cars.filter(car => car.progress < 1);
  const spawned = spawnCars(previous, cars, frameMs, enabled);
  cars = spawned.cars;

  const horizontalCars = cars.filter(
    car =>
      (car.lane === 'eastbound' || car.lane === 'westbound') &&
      !car.crashed &&
      inIntersection(car),
  );
  const verticalCars = cars.filter(
    car =>
      (car.lane === 'southbound' || car.lane === 'northbound') &&
      !car.crashed &&
      inIntersection(car),
  );
  const collidingPair = horizontalCars
    .flatMap(horizontal =>
      verticalCars.map(vertical => ({ horizontal, vertical })),
    )
    .find(({ horizontal, vertical }) => {
      const horizontalPosition = trafficCarPosition(horizontal);
      const verticalPosition = trafficCarPosition(vertical);
      return (
        Math.abs(horizontalPosition.x - verticalPosition.x) < 34 &&
        Math.abs(horizontalPosition.y - verticalPosition.y) < 34
      );
    });
  if (!collidingPair)
    return {
      cars,
      collision: null,
      spawnInMs: spawned.spawnInMs,
      nextCarId: spawned.nextCarId,
      randomState: spawned.randomState,
    };

  const collision = {
    horizontalId: collidingPair.horizontal.id,
    verticalId: collidingPair.vertical.id,
  };
  cars = cars.map(car =>
    car.id === collision.horizontalId || car.id === collision.verticalId
      ? { ...car, crashed: true }
      : car,
  );
  return {
    cars,
    collision,
    spawnInMs: spawned.spawnInMs,
    nextCarId: spawned.nextCarId,
    randomState: spawned.randomState,
  };
}
