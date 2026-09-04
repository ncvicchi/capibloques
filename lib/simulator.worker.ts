import {
  inferSceneForProgram,
  normalizeCompiledProgram,
  validateProgramForScene,
  type CompiledProgram,
  type Condition,
  type ProgramNode,
  type ProgramThread,
  type RuntimeDeviceState,
  type SimulatorState,
} from './capiblocks';
import {
  cloneScene,
  isSceneDefinition,
  type SceneDefinition,
  type SceneDevice,
} from './scene-model';

type Frame = {
  nodes: ProgramNode[];
  index: number;
  remaining?: number;
};

type Pending =
  | { kind: 'wait'; until: number; blockId: string }
  | { kind: 'wifi'; readyAt: number; timeoutAt: number; blockId: string }
  | null;

type ThreadExecution = {
  thread: ProgramThread;
  stack: Frame[];
  pending: Pending;
  done: boolean;
};

type BuzzerRuntimeState = Extract<RuntimeDeviceState, { playing: boolean }>;
type SensorRuntimeState = Extract<RuntimeDeviceState, { value: number }>;

type WorkerInboundMessage =
  | { type: 'LOAD'; program: unknown; scene?: unknown }
  | { type: 'RUN' | 'PAUSE' | 'STOP' | 'RESET' | 'STEP' }
  | { type: 'SET_SPEED'; speed: unknown }
  | {
      type: 'SET_INPUT';
      deviceId?: unknown;
      name?: unknown;
      value: unknown;
    };

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<WorkerInboundMessage>) => void,
  ): void;
};

let program: CompiledProgram = { version: 2, threads: [] };
let scene: SceneDefinition = inferSceneForProgram(program);
let executions: ThreadExecution[] = [];
let schedulerCursor = 0;
let running = false;
let doneEmitted = false;
let speed = 1;
let virtualNow = 0;
let lastRealTime = performance.now();
let lastSnapshotRealTime = 0;

function percentPosition(value: number, extent: number, fallback: number) {
  if (!Number.isFinite(value) || !Number.isFinite(extent) || extent <= 0) {
    return fallback;
  }
  return Math.max(0, Math.min(100, (value / extent) * 100));
}

function runtimeForDevice(device: SceneDevice): RuntimeDeviceState {
  switch (device.kind) {
    case 'trafficLight':
      return { kind: 'trafficLight', color: 'OFF' };
    case 'led':
      return {
        kind: 'led',
        brightness: Math.max(0, Math.min(100, device.config.brightness)),
      };
    case 'robot':
      return {
        kind: 'robot',
        x: percentPosition(device.position.x, scene.canvas.width, 50),
        y: percentPosition(device.position.y, scene.canvas.height, 50),
        angle: Number.isFinite(device.config.heading)
          ? device.config.heading
          : device.rotation,
        left: 0,
        right: 0,
      };
    case 'motor':
      return { kind: 'motor', power: 0 };
    case 'servo':
      return {
        kind: 'servo',
        angle: Math.max(0, Math.min(180, device.config.angle)),
      };
    case 'activeBuzzer':
      return {
        kind: 'activeBuzzer',
        playing: false,
        frequency: 880,
        stopAt: 0,
      };
    case 'passiveBuzzer':
      return {
        kind: 'passiveBuzzer',
        playing: false,
        frequency: Math.max(20, device.config.frequency),
        stopAt: 0,
      };
    case 'button':
      return { kind: 'button', pressed: device.config.pressed };
    case 'lightSensor':
      return {
        kind: 'lightSensor',
        value: Math.max(0, Math.min(4095, device.config.value)),
      };
    case 'potentiometer':
      return {
        kind: 'potentiometer',
        value: Math.max(0, Math.min(4095, device.config.value)),
      };
    case 'wifiNode':
      return {
        kind: 'wifiNode',
        status:
          device.config.status === 'idle'
            ? 'disconnected'
            : device.config.status,
      };
  }
}

function createDeviceState() {
  return Object.fromEntries(
    scene.devices.map((device) => [device.id, runtimeForDevice(device)]),
  ) as Record<string, RuntimeDeviceState>;
}

function defaultRobot() {
  return { x: 50, y: 72, angle: -90, left: 0, right: 0 };
}

function freshState(): SimulatorState {
  return {
    now: 0,
    status: 'idle',
    devices: createDeviceState(),
    wifi: 'disconnected',
    wifiAvailable: true,
    counter: 0,
    pins: {},
    console: [],
    activeBlockIds: {},
    traffic: 'OFF',
    ledBrightness: 0,
    servoAngle: 90,
    buzzer: 'off',
    robot: defaultRobot(),
    inputs: {
      button: false,
      light: 2500,
      potentiometer: 2000,
      wifiAvailable: true,
    },
  };
}

let state = freshState();

function syncCompatibilityProjection() {
  const devices = Object.values(state.devices);
  const traffic = devices.find((device) => device.kind === 'trafficLight');
  const led = devices.find((device) => device.kind === 'led');
  const servo = devices.find((device) => device.kind === 'servo');
  const activeBuzzer = devices.find(
    (device): device is BuzzerRuntimeState => device.kind === 'activeBuzzer',
  );
  const passiveBuzzer = devices.find(
    (device): device is BuzzerRuntimeState => device.kind === 'passiveBuzzer',
  );
  const robot = devices.find((device) => device.kind === 'robot');
  const button = devices.find((device) => device.kind === 'button');
  const light = devices.find(
    (device): device is SensorRuntimeState => device.kind === 'lightSensor',
  );
  const potentiometer = devices.find(
    (device): device is SensorRuntimeState => device.kind === 'potentiometer',
  );
  state.traffic = traffic?.color ?? 'OFF';
  state.ledBrightness = led?.brightness ?? 0;
  state.servoAngle = servo?.angle ?? 90;
  state.buzzer = activeBuzzer?.playing
    ? 'active'
    : passiveBuzzer?.playing
      ? 'passive'
      : 'off';
  state.robot = robot
    ? {
        x: robot.x,
        y: robot.y,
        angle: robot.angle,
        left: robot.left,
        right: robot.right,
      }
    : defaultRobot();
  state.inputs = {
    button: button?.pressed ?? false,
    light: light?.value ?? 2500,
    potentiometer: potentiometer?.value ?? 2000,
    wifiAvailable: state.wifiAvailable,
  };
  state.activeBlockId = Object.values(state.activeBlockIds).find(Boolean);
  for (const device of Object.values(state.devices)) {
    if (device.kind === 'wifiNode') device.status = state.wifi;
  }
}

function emit(type = 'SNAPSHOT') {
  state.now = Math.round(virtualNow);
  syncCompatibilityProjection();
  scope.postMessage({
    type,
    state: {
      ...state,
      console: [...state.console],
      activeBlockIds: { ...state.activeBlockIds },
    },
  });
}

function createExecutions(): ThreadExecution[] {
  return program.threads.map((thread) => ({
    thread,
    stack: [{ nodes: thread.nodes, index: 0 }],
    pending: null,
    done: false,
  }));
}

function preservedInputs() {
  const values = new Map<string, boolean | number>();
  for (const [id, device] of Object.entries(state.devices)) {
    if (device.kind === 'button') values.set(id, device.pressed);
    if (device.kind === 'lightSensor' || device.kind === 'potentiometer') {
      values.set(id, device.value);
    }
  }
  return { values, wifiAvailable: state.wifiAvailable };
}

function restoreInputs(inputs: ReturnType<typeof preservedInputs>) {
  state.wifiAvailable = inputs.wifiAvailable;
  for (const [id, value] of inputs.values) {
    const device = state.devices[id];
    if (device?.kind === 'button' && typeof value === 'boolean') {
      device.pressed = value;
    }
    if (
      (device?.kind === 'lightSensor' || device?.kind === 'potentiometer') &&
      typeof value === 'number'
    ) {
      device.value = value;
    }
  }
}

function resetExecution(status: SimulatorState['status'] = 'idle') {
  const inputs = preservedInputs();
  state = freshState();
  restoreInputs(inputs);
  state.status = status;
  virtualNow = 0;
  executions = createExecutions();
  schedulerCursor = 0;
  running = false;
  doneEmitted = false;
  lastRealTime = performance.now();
  lastSnapshotRealTime = 0;
  emit();
}

const numberOperators = {
  EQ: (a: number, b: number) => a === b,
  NEQ: (a: number, b: number) => a !== b,
  LT: (a: number, b: number) => a < b,
  LTE: (a: number, b: number) => a <= b,
  GT: (a: number, b: number) => a > b,
  GTE: (a: number, b: number) => a >= b,
};

function evaluate(condition: Condition) {
  if (condition.kind === 'boolean') return condition.value;
  if (condition.kind === 'wifiConnected') return state.wifi === 'connected';
  if (condition.kind === 'buttonPressed') {
    const device = state.devices[condition.deviceId];
    return device?.kind === 'button' && device.pressed;
  }
  if (condition.kind === 'counter') {
    return numberOperators[condition.operator](state.counter, condition.value);
  }
  if (condition.kind === 'sensor') {
    const device = state.devices[condition.deviceId];
    const value =
      device?.kind === 'lightSensor' || device?.kind === 'potentiometer'
        ? device.value
        : 0;
    return numberOperators[condition.operator](value, condition.value);
  }
  return numberOperators[condition.operator](condition.left, condition.right);
}

function appendConsole(text: string) {
  state.console = [
    ...state.console.slice(-19),
    `${(virtualNow / 1000).toFixed(1)} s · ${text}`,
  ];
}

function deviceName(deviceId: string) {
  return (
    scene.devices.find((device) => device.id === deviceId)?.name ?? deviceId
  );
}

function finishFrame(execution: ThreadExecution) {
  const frame = execution.stack.at(-1);
  if (!frame || frame.index < frame.nodes.length) return false;
  if (frame.remaining === Number.POSITIVE_INFINITY) {
    frame.index = 0;
    return true;
  }
  if (typeof frame.remaining === 'number' && frame.remaining > 1) {
    frame.remaining -= 1;
    frame.index = 0;
    return true;
  }
  execution.stack.pop();
  return false;
}

function resolvePending(execution: ThreadExecution) {
  const pending = execution.pending;
  if (!pending) return true;
  if (pending.kind === 'wait') {
    if (virtualNow < pending.until) return false;
    execution.pending = null;
    const frame = execution.stack.at(-1);
    if (frame) frame.index += 1;
    return true;
  }
  if (state.wifiAvailable && virtualNow >= pending.readyAt) {
    state.wifi = 'connected';
    appendConsole('Wi-Fi conectado (simulación)');
    execution.pending = null;
    const frame = execution.stack.at(-1);
    if (frame) frame.index += 1;
    return true;
  }
  if (virtualNow >= pending.timeoutAt) {
    state.wifi = 'error';
    appendConsole('Tiempo de conexión agotado');
    execution.pending = null;
    const frame = execution.stack.at(-1);
    if (frame) frame.index += 1;
    return true;
  }
  return false;
}

function setBuzzer(deviceId: string, frequency: number, durationMs: number) {
  const device = state.devices[deviceId];
  if (device?.kind !== 'activeBuzzer' && device?.kind !== 'passiveBuzzer') {
    return;
  }
  device.playing = true;
  device.frequency = Math.max(20, frequency);
  device.stopAt = virtualNow + Math.max(0, durationMs);
  scope.postMessage({
    type: 'SOUND',
    deviceId,
    frequency: device.frequency,
    durationMs,
  });
}

function executeOne(
  execution: ThreadExecution,
): 'action' | 'control' | 'wait' | 'yield' | 'done' {
  if (execution.done) return 'done';
  if (!resolvePending(execution)) return 'wait';

  while (execution.stack.length) {
    if (finishFrame(execution)) return 'yield';
    const frame = execution.stack.at(-1);
    if (!frame) break;
    if (frame.index >= frame.nodes.length) continue;
    const node = frame.nodes[frame.index];
    state.activeBlockIds[execution.thread.id] = node.blockId;
    scope.postMessage({
      type: 'BLOCK_ACTIVE',
      threadId: execution.thread.id,
      blockId: node.blockId,
    });

    if (node.op === 'repeat') {
      frame.index += 1;
      if (node.count === 0) return 'control';
      execution.stack.push({
        nodes: node.body,
        index: 0,
        remaining:
          node.count < 0
            ? Number.POSITIVE_INFINITY
            : Math.max(0, Math.floor(node.count)),
      });
      return 'control';
    }
    if (node.op === 'if') {
      frame.index += 1;
      execution.stack.push({
        nodes: evaluate(node.condition) ? node.consequent : node.otherwise,
        index: 0,
      });
      return 'control';
    }
    if (node.op === 'wait') {
      execution.pending = {
        kind: 'wait',
        until: virtualNow + Math.max(0, node.ms),
        blockId: node.blockId,
      };
      return 'wait';
    }
    if (node.op === 'wifi') {
      state.wifi = 'connecting';
      appendConsole('Buscando red Wi-Fi…');
      execution.pending = {
        kind: 'wifi',
        readyAt: virtualNow + 1200,
        timeoutAt: virtualNow + Math.max(1000, node.timeoutMs),
        blockId: node.blockId,
      };
      return 'wait';
    }

    frame.index += 1;
    switch (node.op) {
      case 'traffic': {
        const device = state.devices[node.deviceId];
        if (device?.kind === 'trafficLight') {
          device.color = node.color;
          appendConsole(
            `${deviceName(node.deviceId)}: ${node.color.toLowerCase()}`,
          );
        }
        break;
      }
      case 'led': {
        const device = state.devices[node.deviceId];
        if (device?.kind === 'led') {
          device.brightness = Math.max(0, Math.min(100, node.brightness));
          appendConsole(
            `${deviceName(node.deviceId)}: ${Math.round(device.brightness)}%`,
          );
        }
        break;
      }
      case 'pin':
        state.pins = { ...state.pins, [node.pin]: node.value };
        appendConsole(
          `GPIO ${node.pin}: ${node.value ? 'encendido' : 'apagado'}`,
        );
        break;
      case 'robot': {
        const device = state.devices[node.deviceId];
        if (device?.kind === 'robot') {
          const value = Math.max(0, Math.min(100, node.speed));
          const speeds = {
            FORWARD: [value, value],
            BACKWARD: [-value, -value],
            LEFT: [-value, value],
            RIGHT: [value, -value],
            STOP: [0, 0],
          } as const;
          [device.left, device.right] = speeds[node.action];
          appendConsole(
            `${deviceName(node.deviceId)}: ${node.action.toLowerCase()} al ${value}%`,
          );
        }
        break;
      }
      case 'motor': {
        const device = state.devices[node.deviceId];
        if (device?.kind === 'motor') {
          const power = Math.max(0, Math.min(100, node.power));
          device.power =
            node.direction === 'BACKWARD'
              ? -power
              : node.direction === 'STOP'
                ? 0
                : power;
          appendConsole(
            `${deviceName(node.deviceId)}: potencia ${Math.round(device.power)}%`,
          );
        }
        break;
      }
      case 'servo': {
        const device = state.devices[node.deviceId];
        if (device?.kind === 'servo') {
          device.angle = Math.max(0, Math.min(180, node.angle));
          appendConsole(
            `${deviceName(node.deviceId)}: ${Math.round(device.angle)}°`,
          );
        }
        break;
      }
      case 'buzzer':
        setBuzzer(
          node.deviceId,
          node.kind === 'ACTIVE' ? 880 : node.frequency,
          node.durationMs,
        );
        break;
      case 'tone':
        setBuzzer(node.deviceId, node.frequency, node.durationMs);
        break;
      case 'counterSet':
        state.counter = Math.trunc(node.value);
        appendConsole(`Contador = ${state.counter}`);
        break;
      case 'counterChange':
        state.counter += Math.trunc(node.delta);
        appendConsole(`Contador = ${state.counter}`);
        break;
      case 'serial':
        appendConsole(node.text);
        break;
    }
    return 'action';
  }

  execution.done = true;
  execution.pending = null;
  delete state.activeBlockIds[execution.thread.id];
  return 'done';
}

function updatePhysics(deltaMs: number) {
  for (const device of Object.values(state.devices)) {
    if (device.kind === 'robot') {
      const average = (device.left + device.right) / 2;
      const turn = (device.right - device.left) * 0.0012 * deltaMs;
      device.angle += turn;
      const radians = (device.angle * Math.PI) / 180;
      device.x += Math.cos(radians) * average * 0.00055 * deltaMs;
      device.y += Math.sin(radians) * average * 0.00055 * deltaMs;
      if (device.x < 5 || device.x > 95) {
        device.x = Math.max(5, Math.min(95, device.x));
        device.angle = 180 - device.angle;
      }
      if (device.y < 8 || device.y > 92) {
        device.y = Math.max(8, Math.min(92, device.y));
        device.angle = -device.angle;
      }
    }
    if (
      (device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer') &&
      device.playing &&
      virtualNow >= device.stopAt
    ) {
      device.playing = false;
      device.stopAt = 0;
    }
  }
}

function finishProgramIfDone() {
  if (!executions.length || executions.every((execution) => execution.done)) {
    running = false;
    state.status = 'done';
    state.activeBlockIds = {};
    if (!doneEmitted) {
      doneEmitted = true;
      scope.postMessage({ type: 'DONE' });
    }
    return true;
  }
  return false;
}

function hasDynamicOutput() {
  return Object.values(state.devices).some((device) => {
    if (device.kind === 'robot')
      return device.left !== 0 || device.right !== 0;
    return (
      (device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer') &&
      device.playing
    );
  });
}

function runScheduler(operationBudget = 80, timeBudgetMs = 4) {
  if (!executions.length) {
    finishProgramIfDone();
    return;
  }
  const started = performance.now();
  let unavailableInARow = 0;
  for (
    let budget = 0;
    budget < operationBudget && performance.now() - started < timeBudgetMs;
    budget += 1
  ) {
    const execution = executions[schedulerCursor % executions.length];
    schedulerCursor = (schedulerCursor + 1) % executions.length;
    const result = executeOne(execution);
    if (result === 'action' || result === 'control') {
      unavailableInARow = 0;
    } else {
      unavailableInARow += 1;
      if (unavailableInARow >= executions.length) break;
    }
  }
  finishProgramIfDone();
}

function tick() {
  const now = performance.now();
  const realDelta = Math.min(100, now - lastRealTime);
  lastRealTime = now;
  const continueFinishedPhysics = state.status === 'done' && hasDynamicOutput();
  if (!running && !continueFinishedPhysics) return;
  const previousStatus = state.status;
  const logicalDelta = realDelta * speed;
  virtualNow += logicalDelta;
  updatePhysics(logicalDelta);
  if (running) runScheduler();
  const justFinished =
    previousStatus !== 'done' && state.status === 'done';
  if (justFinished || now - lastSnapshotRealTime >= 32) {
    lastSnapshotRealTime = now;
    emit();
  }
}

function nextPendingTime() {
  const times = executions.flatMap((execution) => {
    if (!execution.pending) return [];
    if (execution.pending.kind === 'wait') return [execution.pending.until];
    return [
      state.wifiAvailable
        ? execution.pending.readyAt
        : execution.pending.timeoutAt,
    ];
  });
  return times.length ? Math.min(...times) : null;
}

function stepOnce() {
  if (!executions.length) {
    finishProgramIfDone();
    return;
  }
  let unavailableInARow = 0;
  for (let budget = 0; budget < 80; budget += 1) {
    const execution = executions[schedulerCursor % executions.length];
    schedulerCursor = (schedulerCursor + 1) % executions.length;
    const result = executeOne(execution);
    if (result === 'action' || result === 'yield') break;
    if (result === 'control') {
      unavailableInARow = 0;
      continue;
    }
    unavailableInARow += 1;
    if (unavailableInARow >= executions.length) {
      const nextTime = nextPendingTime();
      if (nextTime !== null && nextTime > virtualNow) {
        const delta = nextTime - virtualNow;
        virtualNow = nextTime;
        updatePhysics(delta);
      }
      break;
    }
  }
  finishProgramIfDone();
}

function stopOutputs() {
  for (const device of Object.values(state.devices)) {
    if (device.kind === 'robot') {
      device.left = 0;
      device.right = 0;
    }
    if (device.kind === 'motor') device.power = 0;
    if (device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer') {
      device.playing = false;
      device.stopAt = 0;
    }
  }
}

function setInputById(deviceId: string, value: unknown) {
  const device = state.devices[deviceId];
  if (device?.kind === 'button') device.pressed = Boolean(value);
  if (device?.kind === 'lightSensor' || device?.kind === 'potentiometer') {
    device.value = Math.max(0, Math.min(4095, Number(value) || 0));
  }
}

function setLegacyInput(name: unknown, value: unknown) {
  if (name === 'wifiAvailable') {
    state.wifiAvailable = Boolean(value);
    return;
  }
  const kind =
    name === 'button'
      ? 'button'
      : name === 'light'
        ? 'lightSensor'
        : name === 'potentiometer'
          ? 'potentiometer'
          : null;
  if (!kind) return;
  const entry = Object.entries(state.devices).find(
    ([, device]) => device.kind === kind,
  );
  if (entry) setInputById(entry[0], value);
}

scope.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.type) {
    case 'LOAD': {
      scene = isSceneDefinition(message.scene)
        ? cloneScene(message.scene)
        : inferSceneForProgram(message.program);
      program = normalizeCompiledProgram(message.program, scene);
      state = freshState();
      executions = createExecutions();
      resetExecution();
      scope.postMessage({
        type: 'DIAGNOSTICS',
        diagnostics: validateProgramForScene(program, scene),
      });
      break;
    }
    case 'RUN':
      if (
        state.status === 'done' ||
        state.status === 'stopped' ||
        !executions.length
      ) {
        resetExecution();
      }
      running = true;
      doneEmitted = false;
      state.status = 'running';
      lastRealTime = performance.now();
      emit();
      break;
    case 'PAUSE':
      running = false;
      state.status = 'paused';
      emit();
      break;
    case 'STOP':
      running = false;
      state.status = 'stopped';
      stopOutputs();
      state.activeBlockIds = {};
      emit();
      break;
    case 'RESET':
      resetExecution();
      break;
    case 'STEP':
      running = false;
      state.status = 'paused';
      stepOnce();
      emit();
      break;
    case 'SET_SPEED':
      speed = Math.max(0.25, Math.min(4, Number(message.speed) || 1));
      break;
    case 'SET_INPUT':
      if (typeof message.deviceId === 'string') {
        setInputById(message.deviceId, message.value);
      } else {
        setLegacyInput(message.name, message.value);
      }
      emit();
      break;
  }
});

setInterval(tick, 16);

export {};
