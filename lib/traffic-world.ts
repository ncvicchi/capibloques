export type TrafficLane = 'horizontal' | 'vertical';
export type TrafficSignalColor = 'RED' | 'YELLOW' | 'GREEN' | 'OFF';

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

export interface TrafficSignals {
  horizontal: TrafficSignalColor;
  vertical: TrafficSignalColor;
}

const SPEED_PER_MS: Record<TrafficLane, number> = {
  horizontal: 1 / 12_000,
  vertical: 1 / 10_500,
};
const STOP_PROGRESS: Record<TrafficLane, number> = {
  horizontal: 0.37,
  vertical: 0.3,
};
const QUEUE_GAP: Record<TrafficLane, number> = {
  horizontal: 0.055,
  vertical: 0.088,
};
const ENTRY_GAP: Record<TrafficLane, number> = {
  horizontal: 0.07,
  vertical: 0.11,
};
const MAX_TRAFFIC_CARS = 12;

export function createTrafficWorldState(): TrafficWorldState {
  return {
    cars: [],
    collision: null,
    spawnInMs: { horizontal: 0, vertical: 650 },
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
  return car.lane === 'horizontal'
    ? { x: -45 + car.progress * 1_050, y: 282 }
    : { x: 505, y: -40 + car.progress * 620 };
}

function advanceLane(
  cars: readonly TrafficCarState[],
  lane: TrafficLane,
  color: TrafficSignalColor,
  elapsedMs: number,
) {
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
    if (color === 'GREEN') {
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
          (color === 'RED' || color === 'YELLOW') && progress >= target,
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
) {
  const spawnInMs = { ...previous.spawnInMs };
  let nextCarId = previous.nextCarId;
  let randomState = previous.randomState;

  for (const lane of ['horizontal', 'vertical'] as const) {
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
): TrafficWorldState {
  if (previous.collision) return previous;
  const frameMs = Math.min(100, Math.max(0, elapsedMs));
  let cars = advanceLane(
    previous.cars,
    'horizontal',
    signals.horizontal,
    frameMs,
  );
  cars = advanceLane(cars, 'vertical', signals.vertical, frameMs).filter(
    car => car.progress < 1,
  );
  const spawned = spawnCars(previous, cars, frameMs);
  cars = spawned.cars;

  const horizontal = cars.find(
    car => car.lane === 'horizontal' && !car.crashed && inIntersection(car),
  );
  const vertical = cars.find(
    car => car.lane === 'vertical' && !car.crashed && inIntersection(car),
  );
  if (!horizontal || !vertical)
    return {
      cars,
      collision: null,
      spawnInMs: spawned.spawnInMs,
      nextCarId: spawned.nextCarId,
      randomState: spawned.randomState,
    };

  const collision = {
    horizontalId: horizontal.id,
    verticalId: vertical.id,
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
