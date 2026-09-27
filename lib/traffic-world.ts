export type TrafficLane = 'horizontal' | 'vertical';
export type TrafficSignalColor = 'RED' | 'YELLOW' | 'GREEN' | 'OFF';

export interface TrafficCarState {
  id: string;
  lane: TrafficLane;
  progress: number;
  crashed: boolean;
  waitingForGreen: boolean;
}

export interface TrafficWorldState {
  cars: TrafficCarState[];
  collision: { horizontalId: string; verticalId: string } | null;
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

export function createTrafficWorldState(): TrafficWorldState {
  return {
    cars: [
      { id: 'car-h-1', lane: 'horizontal', progress: 0.05, crashed: false, waitingForGreen: false },
      { id: 'car-h-2', lane: 'horizontal', progress: 0.23, crashed: false, waitingForGreen: false },
      { id: 'car-h-3', lane: 'horizontal', progress: 0.72, crashed: false, waitingForGreen: false },
      { id: 'car-v-1', lane: 'vertical', progress: 0.03, crashed: false, waitingForGreen: false },
      { id: 'car-v-2', lane: 'vertical', progress: 0.48, crashed: false, waitingForGreen: false },
      { id: 'car-v-3', lane: 'vertical', progress: 0.78, crashed: false, waitingForGreen: false },
    ],
    collision: null,
  };
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
    .filter(car => car.lane === lane && !car.crashed && car.progress <= stop)
    .sort((left, right) => right.progress - left.progress);
  const queueTargets = new Map(
    approaching.map((car, index) => [car.id, stop - index * QUEUE_GAP[lane]]),
  );

  return cars.map(car => {
    if (car.lane !== lane || car.crashed) return car;
    const distance = SPEED_PER_MS[lane] * Math.min(100, Math.max(0, elapsedMs));
    if (color === 'GREEN') {
      const progress = car.progress + distance;
      return {
        ...car,
        waitingForGreen: false,
        progress: progress >= 1 ? progress - 1 : progress,
      };
    }
    if (color === 'YELLOW') {
      if (car.waitingForGreen) return car;
      const progress = car.progress + distance;
      return { ...car, progress: progress >= 1 ? progress - 1 : progress };
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
        waitingForGreen: color === 'RED' && progress >= target,
      };
    }
    const progress = car.progress + distance;
    return { ...car, progress: progress >= 1 ? progress - 1 : progress };
  });
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
  let cars = advanceLane(
    previous.cars,
    'horizontal',
    signals.horizontal,
    elapsedMs,
  );
  cars = advanceLane(cars, 'vertical', signals.vertical, elapsedMs);

  const horizontal = cars.find(
    car => car.lane === 'horizontal' && !car.crashed && inIntersection(car),
  );
  const vertical = cars.find(
    car => car.lane === 'vertical' && !car.crashed && inIntersection(car),
  );
  if (!horizontal || !vertical) return { cars, collision: null };

  const collision = {
    horizontalId: horizontal.id,
    verticalId: vertical.id,
  };
  cars = cars.map(car =>
    car.id === collision.horizontalId || car.id === collision.verticalId
      ? { ...car, crashed: true }
      : car,
  );
  return { cars, collision };
}
