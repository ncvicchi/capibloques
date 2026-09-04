import {
  addCounterValues,
  inferSceneForProgram,
  normalizeCounterValue,
  normalizeCompiledProgram,
  validateProgramForScene,
  type CapiDiagnostic,
  type CompiledProgram,
  type Condition,
  type ProgramNode,
  type ProgramThread,
  type RuntimeDeviceState,
  type SimulatorState,
  // @ts-expect-error Node's type-stripping smoke runner needs the explicit suffix.
} from './capiblocks.ts';
import {
  cloneScene,
  isSceneDefinition,
  type SceneDefinition,
  type SceneDevice,
  // @ts-expect-error Node's type-stripping smoke runner needs the explicit suffix.
} from './scene-model.ts';

type FlatInstruction =
  | Exclude<ProgramNode, { op: 'repeat' } | { op: 'if' }>
  | {
      op: 'repeatStart';
      count: number;
      slot: number;
      end: number;
      blockId: string;
    }
  | { op: 'repeatNext'; slot: number; target: number; blockId: string }
  | { op: 'jumpIfFalse'; condition: Condition; target: number; blockId: string }
  | { op: 'jump'; target: number; yieldAfter?: boolean; blockId: string }
  | { op: 'halt'; blockId: string };

type Pending =
  | { kind: 'wait'; until: number; blockId: string }
  | { kind: 'wifi'; readyAt: number; timeoutAt: number; blockId: string }
  | null;

type ThreadExecution = {
  thread: ProgramThread;
  instructions: FlatInstruction[];
  pc: number;
  loopCounters: number[];
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
let schedulerDebtMs = 0;
let lastRealTime = performance.now();
let lastSnapshotRealTime = 0;
let lastBlockActivityRealTime = Number.NEGATIVE_INFINITY;
let lastSoundRealTime = Number.NEGATIVE_INFINITY;
let pendingBlockActivity: { threadId: string; blockId: string } | null = null;
const pendingSounds = new Map<string, { frequency: number }>();
const inputOverrides = new Map<string, unknown>();
const legacyInputOverrides = new Map<string, unknown>();
let wifiAvailableOverride: boolean | undefined;
let diagnostics: CapiDiagnostic[] = [];
let simulationBlocked = false;

const SNAPSHOT_INTERVAL_MS = 32;
const BLOCK_ACTIVITY_INTERVAL_MS = 40;
const SOUND_INTERVAL_MS = 32;
const GENERATED_LOOP_BUDGET = 32;
const SCHEDULER_QUANTUM_MS = 16;
const HARDWARE_ONLY_ERROR_CODES = new Set([
  'scene-missing-pin',
  'scene-unsupported-pin',
  'scene-pin-conflict',
  'scene-pwm-channel-limit',
  'scene-passive-buzzer-limit',
  'scene-button-pullup-unavailable',
  'scene-button-external-bias-required',
  'raw-pin-not-output',
  'raw-pin-conflict',
]);

function refreshDiagnostics(extra: CapiDiagnostic[] = []) {
  diagnostics = [...validateProgramForScene(program, scene), ...extra];
  simulationBlocked = diagnostics.some(
    (item) =>
      item.severity === 'error' && !HARDWARE_ONLY_ERROR_CODES.has(item.code),
  );
  postDiagnostics();
}

function postDiagnostics() {
  scope.postMessage({
    type: 'DIAGNOSTICS',
    diagnostics: diagnostics.map((item) => ({ ...item })),
    simulationBlocked,
  });
}

function percentPosition(value: number, extent: number, fallback: number) {
  if (!Number.isFinite(value) || !Number.isFinite(extent) || extent <= 0) {
    return fallback;
  }
  return Math.max(0, Math.min(100, (value / extent) * 100));
}

function finiteDegrees(value: number) {
  if (!Number.isFinite(value)) return 0;
  const normalized = value % 360;
  return normalized > 180
    ? normalized - 360
    : normalized <= -180
      ? normalized + 360
      : normalized;
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
        // `angle` is the absolute visual and physical heading. Rotation places
        // the robot in the scene; heading is an optional relative offset.
        angle: finiteDegrees(
          (Number.isFinite(device.rotation) ? device.rotation : 0) +
            (Number.isFinite(device.config.heading)
              ? device.config.heading
              : 0),
        ),
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

function flattenProgram(nodes: ProgramNode[]) {
  const instructions: FlatInstruction[] = [];
  let loopSlot = 0;
  const visit = (items: ProgramNode[]) => {
    for (const node of items) {
      if (node.op === 'repeat') {
        if (node.count < 0) {
          const start = instructions.length;
          visit(node.body);
          instructions.push({
            op: 'jump',
            target: start,
            yieldAfter: true,
            blockId: node.blockId,
          });
        } else {
          const slot = loopSlot++;
          const startIndex = instructions.length;
          instructions.push({
            op: 'repeatStart',
            count: Math.max(0, Math.floor(node.count)),
            slot,
            end: -1,
            blockId: node.blockId,
          });
          const bodyStart = instructions.length;
          visit(node.body);
          instructions.push({
            op: 'repeatNext',
            slot,
            target: bodyStart,
            blockId: node.blockId,
          });
          const start = instructions[startIndex];
          if (start.op === 'repeatStart') start.end = instructions.length;
        }
      } else if (node.op === 'if') {
        const conditionIndex = instructions.length;
        instructions.push({
          op: 'jumpIfFalse',
          condition: node.condition,
          target: -1,
          blockId: node.blockId,
        });
        visit(node.consequent);
        const jumpIndex = instructions.length;
        instructions.push({ op: 'jump', target: -1, blockId: node.blockId });
        const condition = instructions[conditionIndex];
        if (condition.op === 'jumpIfFalse') {
          condition.target = instructions.length;
        }
        visit(node.otherwise);
        const jump = instructions[jumpIndex];
        if (jump.op === 'jump') jump.target = instructions.length;
      } else {
        instructions.push(node);
      }
    }
  };
  visit(nodes);
  instructions.push({ op: 'halt', blockId: 'program-end' });
  return { instructions, loopSlots: Math.max(1, loopSlot) };
}

function createExecutions(): ThreadExecution[] {
  return program.threads.map((thread) => {
    const flattened = flattenProgram(thread.nodes);
    return {
      thread,
      instructions: flattened.instructions,
      pc: 0,
      loopCounters: Array.from({ length: flattened.loopSlots }, () => -1),
      pending: null,
      done: false,
    };
  });
}

function applyInputValue(deviceId: string, value: unknown) {
  const device = state.devices[deviceId];
  if (device?.kind === 'button') {
    device.pressed = Boolean(value);
    return;
  }
  if (device?.kind === 'lightSensor' || device?.kind === 'potentiometer') {
    const numeric = Number(value);
    device.value = Number.isFinite(numeric)
      ? Math.max(0, Math.min(4095, numeric))
      : 0;
  }
}

function applyInputOverrides() {
  if (wifiAvailableOverride !== undefined) {
    state.wifiAvailable = wifiAvailableOverride;
  }
  const legacyKinds = {
    button: 'button',
    light: 'lightSensor',
    potentiometer: 'potentiometer',
  } as const;
  for (const [name, kind] of Object.entries(legacyKinds)) {
    if (!legacyInputOverrides.has(name)) continue;
    const entry = Object.entries(state.devices).find(
      ([, device]) => device.kind === kind,
    );
    if (entry) applyInputValue(entry[0], legacyInputOverrides.get(name));
  }
  // A device-specific control is more precise than the legacy "first sensor"
  // projection and therefore wins when both have been used.
  for (const [deviceId, value] of inputOverrides) {
    applyInputValue(deviceId, value);
  }
}

function resetExecution(status: SimulatorState['status'] = 'idle') {
  stopSounds();
  state = freshState();
  applyInputOverrides();
  state.status = status;
  virtualNow = 0;
  schedulerDebtMs = 0;
  executions = createExecutions();
  schedulerCursor = 0;
  running = false;
  doneEmitted = false;
  lastRealTime = performance.now();
  lastSnapshotRealTime = 0;
  lastBlockActivityRealTime = Number.NEGATIVE_INFINITY;
  lastSoundRealTime = Number.NEGATIVE_INFINITY;
  pendingBlockActivity = null;
  pendingSounds.clear();
  clearBlockActivity();
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

function markBlockActive(threadId: string, blockId: string) {
  state.activeBlockIds[threadId] = blockId;
  pendingBlockActivity = { threadId, blockId };
}

function flushBlockActivity(force = false) {
  if (!pendingBlockActivity) return;
  const now = performance.now();
  if (!force && now - lastBlockActivityRealTime < BLOCK_ACTIVITY_INTERVAL_MS) {
    return;
  }
  scope.postMessage({ type: 'BLOCK_ACTIVE', ...pendingBlockActivity });
  pendingBlockActivity = null;
  lastBlockActivityRealTime = now;
}

function clearBlockActivity() {
  pendingBlockActivity = null;
  scope.postMessage({ type: 'BLOCK_ACTIVE', blockId: null });
}

function stopSounds(deviceId?: string) {
  if (deviceId) pendingSounds.delete(deviceId);
  else pendingSounds.clear();
  scope.postMessage({ type: 'SOUND_STOP', deviceId });
}

function queueActiveSounds() {
  for (const [deviceId, device] of Object.entries(state.devices)) {
    if (
      (device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer') &&
      device.playing &&
      device.stopAt > virtualNow
    ) {
      pendingSounds.set(deviceId, { frequency: device.frequency });
    }
  }
}

function flushSounds(force = false) {
  if (!pendingSounds.size || (!force && !running && state.status !== 'done')) {
    return;
  }
  const now = performance.now();
  if (!force && now - lastSoundRealTime < SOUND_INTERVAL_MS) return;
  for (const [deviceId, sound] of pendingSounds) {
    const device = state.devices[deviceId];
    if (device?.kind !== 'activeBuzzer' && device?.kind !== 'passiveBuzzer') {
      continue;
    }
    const remainingVirtualMs = Math.max(0, device.stopAt - virtualNow);
    if (!device.playing || remainingVirtualMs <= 0) continue;
    scope.postMessage({
      type: 'SOUND',
      deviceId,
      frequency: sound.frequency,
      // Keep the protocol in virtual milliseconds. The audio client applies
      // the selected simulator speed when scheduling the oscillator.
      durationMs: remainingVirtualMs,
    });
  }
  pendingSounds.clear();
  lastSoundRealTime = now;
}

function resolvePending(
  execution: ThreadExecution,
): 'none' | 'waiting' | 'advanced' {
  const pending = execution.pending;
  if (!pending) return 'none';
  if (pending.kind === 'wait') {
    if (virtualNow < pending.until) return 'waiting';
    execution.pending = null;
    execution.pc += 1;
    return 'advanced';
  }
  if (state.wifiAvailable && virtualNow >= pending.readyAt) {
    state.wifi = 'connected';
    appendConsole('Wi-Fi conectado (simulación)');
    execution.pending = null;
    execution.pc += 1;
    return 'advanced';
  }
  if (virtualNow >= pending.timeoutAt) {
    state.wifi = 'error';
    appendConsole('Tiempo de conexión agotado');
    execution.pending = null;
    execution.pc += 1;
    return 'advanced';
  }
  return 'waiting';
}

function setBuzzer(deviceId: string, frequency: number, durationMs: number) {
  const device = state.devices[deviceId];
  if (device?.kind !== 'activeBuzzer' && device?.kind !== 'passiveBuzzer') {
    return;
  }
  device.playing = true;
  device.frequency = Math.max(20, frequency);
  device.stopAt = virtualNow + Math.max(0, durationMs);
  pendingSounds.set(deviceId, { frequency: device.frequency });
}

function executeOne(
  execution: ThreadExecution,
): 'action' | 'continue' | 'wait' | 'yield' | 'done' {
  if (execution.done) return 'done';
  const pendingResult = resolvePending(execution);
  if (pendingResult === 'waiting') return 'wait';
  if (pendingResult === 'advanced') return 'continue';

  const node = execution.instructions[execution.pc];
  if (!node) {
    execution.done = true;
    delete state.activeBlockIds[execution.thread.id];
    return 'done';
  }
  markBlockActive(execution.thread.id, node.blockId);

  if (node.op === 'repeatStart') {
    if (execution.loopCounters[node.slot] < 0) {
      execution.loopCounters[node.slot] = node.count;
    }
    if (execution.loopCounters[node.slot] === 0) {
      execution.loopCounters[node.slot] = -1;
      execution.pc = node.end;
    } else {
      execution.pc += 1;
    }
    return 'continue';
  }
  if (node.op === 'repeatNext') {
    execution.loopCounters[node.slot] -= 1;
    if (execution.loopCounters[node.slot] > 0) execution.pc = node.target;
    else {
      execution.loopCounters[node.slot] = -1;
      execution.pc += 1;
    }
    return 'yield';
  }
  if (node.op === 'jumpIfFalse') {
    execution.pc = evaluate(node.condition) ? execution.pc + 1 : node.target;
    return 'continue';
  }
  if (node.op === 'jump') {
    execution.pc = node.target;
    return node.yieldAfter ? 'yield' : 'continue';
  }
  if (node.op === 'halt') {
    execution.done = true;
    execution.pending = null;
    delete state.activeBlockIds[execution.thread.id];
    return 'done';
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

  execution.pc += 1;
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
      state.counter = normalizeCounterValue(node.value);
      appendConsole(`Contador = ${state.counter}`);
      break;
    case 'counterChange':
      state.counter = addCounterValues(state.counter, node.delta);
      appendConsole(`Contador = ${state.counter}`);
      break;
    case 'serial':
      appendConsole(node.text);
      break;
  }
  return 'action';
}

function updatePhysics(deltaMs: number) {
  for (const [deviceId, device] of Object.entries(state.devices)) {
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
      stopSounds(deviceId);
    }
  }
}

function finishProgramIfDone() {
  if (!executions.length || executions.every((execution) => execution.done)) {
    running = false;
    state.status = 'done';
    state.activeBlockIds = {};
    clearBlockActivity();
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
    if (device.kind === 'robot') return device.left !== 0 || device.right !== 0;
    return (
      (device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer') &&
      device.playing
    );
  });
}

function runScheduler() {
  if (!executions.length) {
    finishProgramIfDone();
    return;
  }
  const threadBudget = Math.max(
    1,
    Math.floor(GENERATED_LOOP_BUDGET / executions.length),
  );
  let visited = 0;
  while (visited < executions.length) {
    const execution = executions[schedulerCursor % executions.length];
    schedulerCursor = (schedulerCursor + 1) % executions.length;
    visited += 1;
    for (let budget = 0; budget < threadBudget; budget += 1) {
      const result = executeOne(execution);
      // These operations map to a `return` in the generated thread function.
      if (result === 'wait' || result === 'yield' || result === 'done') break;
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
  if (running) {
    let remaining = logicalDelta;
    while (remaining > 0) {
      const slice = Math.min(remaining, SCHEDULER_QUANTUM_MS - schedulerDebtMs);
      virtualNow += slice;
      updatePhysics(slice);
      schedulerDebtMs += slice;
      remaining -= slice;
      if (schedulerDebtMs + Number.EPSILON >= SCHEDULER_QUANTUM_MS) {
        schedulerDebtMs = Math.max(0, schedulerDebtMs - SCHEDULER_QUANTUM_MS);
        runScheduler();
        if (!running) {
          virtualNow += remaining;
          updatePhysics(remaining);
          remaining = 0;
        }
      }
    }
  } else {
    virtualNow += logicalDelta;
    updatePhysics(logicalDelta);
  }
  flushBlockActivity();
  flushSounds();
  const justFinished = previousStatus !== 'done' && state.status === 'done';
  if (justFinished || now - lastSnapshotRealTime >= SNAPSHOT_INTERVAL_MS) {
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
    if (result === 'continue') {
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
  inputOverrides.set(deviceId, value);
  applyInputValue(deviceId, value);
}

function setLegacyInput(name: unknown, value: unknown) {
  if (name === 'wifiAvailable') {
    wifiAvailableOverride = Boolean(value);
    state.wifiAvailable = wifiAvailableOverride;
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
  legacyInputOverrides.set(String(name), value);
  const entry = Object.entries(state.devices).find(
    ([, device]) => device.kind === kind,
  );
  if (entry) applyInputValue(entry[0], value);
}

scope.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.type) {
    case 'LOAD': {
      const invalidScene =
        message.scene !== undefined && !isSceneDefinition(message.scene);
      try {
        scene = isSceneDefinition(message.scene)
          ? cloneScene(message.scene)
          : inferSceneForProgram(message.program);
        program = normalizeCompiledProgram(message.program, scene);
        resetExecution();
        refreshDiagnostics(
          invalidScene
            ? [
                {
                  severity: 'error',
                  code: 'invalid-scene-payload',
                  message:
                    'La escena recibida no tiene un formato válido y no puede simularse.',
                },
              ]
            : [],
        );
      } catch {
        program = { version: 2, threads: [] };
        scene = inferSceneForProgram(program);
        resetExecution();
        refreshDiagnostics([
          {
            severity: 'error',
            code: 'simulator-load-failed',
            message:
              'No pudimos preparar este proyecto para la simulación. Revisá los bloques importados.',
          },
        ]);
      }
      break;
    }
    case 'RUN':
      if (simulationBlocked) {
        running = false;
        postDiagnostics();
        emit();
        break;
      }
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
      queueActiveSounds();
      flushSounds(true);
      emit();
      break;
    case 'PAUSE':
      if (!running) break;
      running = false;
      state.status = 'paused';
      stopSounds();
      emit();
      break;
    case 'STOP':
      running = false;
      state.status = 'stopped';
      stopSounds();
      stopOutputs();
      state.activeBlockIds = {};
      clearBlockActivity();
      emit();
      break;
    case 'RESET':
      resetExecution();
      break;
    case 'STEP':
      if (simulationBlocked) {
        postDiagnostics();
        emit();
        break;
      }
      if (state.status === 'done' || state.status === 'stopped') {
        resetExecution('paused');
      }
      running = false;
      state.status = 'paused';
      stopSounds();
      stepOnce();
      flushBlockActivity(true);
      flushSounds(true);
      emit();
      break;
    case 'SET_SPEED': {
      const wasAudible = running && hasDynamicOutput();
      if (wasAudible) stopSounds();
      speed = Math.max(0.25, Math.min(4, Number(message.speed) || 1));
      if (wasAudible) {
        queueActiveSounds();
        flushSounds(true);
      }
      break;
    }
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
