import {
  addCounterValues,
  compileTaskGraph,
  type FlatInstruction,
  inferSceneForProgram,
  normalizeCounterValue,
  normalizeCompiledProgram,
  validateProgramForScene,
  type CapiDiagnostic,
  type CompiledProgram,
  type Condition,
  type ExecutionEvent,
  type ExecutionTaskState,
  type ProgramThread,
  type RuntimeDeviceState,
  type SimulatorState,
  type ValueExpression,
  // @ts-expect-error Node's type-stripping smoke runner needs the explicit suffix.
} from './capiblocks.ts';
// @ts-expect-error Node strip-types tests import the source extension.
import { isEducationalModuleKind } from './educational-modules.ts';
import {
  cloneScene,
  dashboardDeviceIds,
  isSceneDefinition,
  type SceneDefinition,
  type SceneDevice,
  type EducationalModuleDevice,
  // @ts-expect-error Node's type-stripping smoke runner needs the explicit suffix.
} from './scene-model.ts';
// @ts-expect-error Node strip-types tests import the source extension.
import { matrixPixel, matrixScrollRows, matrixScrollSteps } from './led-matrix.ts';
// @ts-expect-error Node's type-stripping smoke runner needs the explicit suffix.
import { isBoardProfileId, type BoardProfileId } from './board-profiles.ts';

type Pending =
  | { kind: 'wait'; startedAt: number; until: number; blockId: string }
  | { kind: 'otto'; startedAt: number; until: number; stepMs: number; deviceId: string; action: string; speed: number; blockId: string }
  | { kind: 'wifi'; startedAt: number; readyAt: number; timeoutAt: number; blockId: string }
  | { kind: 'message'; startedAt: number; timeoutAt: number; deviceId: string; expected: string; equalTarget: number; differentTarget: number; timeoutTarget: number; blockId: string }
  | { kind: 'wifiMessage'; startedAt: number; timeoutAt: number; deviceId: string; expected: string; sender: string; equalTarget: number; differentTarget: number; timeoutTarget: number; blockId: string }
  | { kind: 'visual'; startedAt: number; deviceId: string; blockId: string }
  | { kind: 'timer'; startedAt: number; timerId: string; blockId: string }
  | null;

type VisualAnimation =
  | { kind: 'matrix'; startedAt: number; until: number; cycleMs: number; deviceId: string; text: string; speedMs: number }
  | { kind: 'displayText'; startedAt: number; until: number; cycleMs: number; deviceId: string; areaId: string; text: string; effect: 'type' | 'scroll' | 'blink'; speedMs: number }
  | { kind: 'displayArtwork'; startedAt: number; until: number; cycleMs: number; deviceId: string; rows: number[]; effect: 'slide' | 'blink'; speedMs: number }
  | { kind: 'smartLights'; startedAt: number; until: number; cycleMs: number; deviceId: string; effect: 'RAINBOW' | 'CHASE' | 'BLINK' | 'PULSE'; color: string; speedMs: number };

type ThreadExecution = {
  thread: ProgramThread;
  label: string;
  instructions: FlatInstruction[];
  pc: number;
  loopCounters: number[];
  loopTotals: number[];
  pending: Pending;
  done: boolean;
  started: boolean;
  launch: { blockId: string; count: number } | null;
};

type BuzzerRuntimeState = Extract<RuntimeDeviceState, { playing: boolean }>;
type SensorRuntimeState = Extract<RuntimeDeviceState, { value: number }>;

type WorkerInboundMessage =
  | { type: 'LOAD'; program: unknown; scene?: unknown; boardProfile?: unknown }
  | { type: 'SYNC_SCENE'; scene: unknown; boardProfile?: unknown }
  | { type: 'RUN' | 'PAUSE' | 'STOP' | 'RESET' | 'STEP' }
  | { type: 'SET_SPEED'; speed: unknown }
  | { type: 'SET_MODE'; mode: 'normal' | 'guided' }
  | { type: 'FRAME_SHOWN'; seq: number }
  | { type: 'SET_DASHBOARD'; deviceId: unknown; action: unknown }
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
let currentBoardProfile: BoardProfileId = 'wemos-d1-r32';
let executions: ThreadExecution[] = [];
let schedulerCursor = 0;
let schedulerBudgetUsed = 0;
let quantumOpen = false;
let mode: 'normal' | 'guided' = 'normal';
let awaitingFrame: number | null = null;
let guidedNextAt = 0;
let eventSequence = 0;
let trace: ExecutionEvent[] = [];
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
const dashboardManual = new Set<string>();
const dashboardProgramStates = new Map<string, RuntimeDeviceState>();
const legacyInputOverrides = new Map<string, unknown>();
const messageQueues = new Map<string, string[]>();
const wifiMessageQueues = new Map<string, Array<{ sender: string; text: string; sequence: number }>>();
let wifiMessageSequence = 0;
const lastReceivedMessages = new Map<string, string>();
const visualAnimations = new Map<string, VisualAnimation>();
const ottoOwners = new Map<string, string>();
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
  diagnostics = [...validateProgramForScene(program, scene, currentBoardProfile), ...extra];
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

// @ts-expect-error Node strip-types runner.
import { displayArtworks, displayTargets, layoutDisplayText } from './display-model.ts';
// @ts-expect-error Node strip-types tests import the source extension.
import { displayAnimationMs, displayArtworkById } from './display-graphics.ts';

function runtimeForDevice(device: SceneDevice): RuntimeDeviceState {
  if (isEducationalModuleKind(device.kind)) return { kind: 'educationalModule', deviceKind: device.kind, values: structuredClone((device as EducationalModuleDevice).config.values) };
  switch (device.kind) {
    case 'display': return {
      kind: 'display',
      texts: Object.fromEntries(displayTargets(device.config).map(area => [area.id, layoutDisplayText('', area).lines])),
      artworkRows: Array.from({ length: 8 }, () => 0),
      animation: null,
      pressedButton: null,
    };
    case 'ledMatrix': return { kind: 'ledMatrix', rows: Array.from({ length: 8 }, () => 0), scrolling: false };
    case 'messages': return { kind: 'messages', received: [], transmitted: [], damaged: 0 };
    case 'trafficLight':
      return { kind: 'trafficLight', color: 'OFF' };
    case 'led':
      return {
        kind: 'led',
        brightness: Math.max(0, Math.min(100, device.config.brightness)),
      };
    case 'smartLights':
      return { kind: 'smartLights', pixels: Array.from({ length: device.config.count }, () => '#000000'), brightness: device.config.brightness, animation: null };
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
    case 'otto':
      return { kind: 'otto', motion: 'HOME', phase: 0, speed: 0, distance: 30, expression: 'SMILE', sound: null, soundUntil: 0, arms: 'DOWN' };
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
    case 'infraredBarrier':
      return { kind: 'infraredBarrier', interrupted: device.config.interrupted };
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
        received: [], transmitted: [], rejected: 0,
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
  const devices = createDeviceState();
  dashboardManual.clear(); dashboardProgramStates.clear();
  for (const id of dashboardDeviceIds(scene)) if (devices[id]) dashboardProgramStates.set(id, structuredClone(devices[id]));
  return {
    now: 0,
    status: 'idle',
    devices,
    dashboardModes: Object.fromEntries([...dashboardDeviceIds(scene)].map(id => [id, 'program' as const])),
    wifi: 'disconnected',
    wifiAvailable: true,
    counter: 0,
    variables: Object.fromEntries((program.variables ?? []).map(variable => [variable.id, variable.type === 'text' ? '' : variable.type === 'boolean' ? false : 0])),
    timers: Object.fromEntries((program.timers ?? []).map(timer => [timer.id, { name: timer.name, status: 'stopped' as const, elapsedMs: 0, remainingMs: 0, durationMs: 0, repeat: false, pendingEvents: 0 }])),
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

function programDevice(deviceId: string) {
  return dashboardManual.has(deviceId) ? dashboardProgramStates.get(deviceId) : state.devices[deviceId];
}

function setDashboardControl(deviceId: string, action: unknown) {
  if (!dashboardDeviceIds(scene).has(deviceId)) return;
  const device = state.devices[deviceId]; if (!device) return;
  if (action === 'program') {
    dashboardManual.delete(deviceId); state.dashboardModes[deviceId] = 'program';
    const programmed = dashboardProgramStates.get(deviceId); if (programmed) state.devices[deviceId] = structuredClone(programmed);
    appendConsole(`${deviceName(deviceId)}: vuelve al programa`); return;
  }
  if (action !== 'cycle') return;
  if (!dashboardManual.has(deviceId)) dashboardProgramStates.set(deviceId, structuredClone(device));
  dashboardManual.add(deviceId); state.dashboardModes[deviceId] = 'manual';
  if (device.kind === 'trafficLight') device.color = device.color === 'OFF' ? 'RED' : device.color === 'RED' ? 'YELLOW' : device.color === 'YELLOW' ? 'GREEN' : 'OFF';
  else if (device.kind === 'led') device.brightness = device.brightness >= 100 ? 0 : device.brightness + 25;
  else if (device.kind === 'motor') device.power = device.power <= -100 ? 0 : device.power === 0 ? 100 : -100;
  else if (device.kind === 'servo') device.angle = device.angle >= 180 ? 0 : device.angle + 45;
  else if (device.kind === 'robot') {
    const code = device.left === 0 && device.right === 0 ? 0 : device.left > 0 && device.right > 0 ? 1 : device.left < 0 && device.right < 0 ? 2 : device.left < device.right ? 3 : 4;
    const speeds = [[60,60],[-60,-60],[-60,60],[60,-60],[0,0]] as const; [device.left, device.right] = speeds[code];
  }
  appendConsole(`${deviceName(deviceId)}: control manual desde la pantalla`);
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
  const showsProgress = state.status === 'running' || state.status === 'paused';
  state.execution = {
    mode,
    awaitingFrame,
    trace: [...trace],
    tasks: showsProgress ? executions.map(executionTaskState) : [],
  };
  scope.postMessage({
    type,
    state: {
      ...state,
      console: [...state.console],
      activeBlockIds: { ...state.activeBlockIds },
    },
  });
}

function executionTaskState(execution: ThreadExecution): ExecutionTaskState {
  const node = execution.instructions[execution.pc];
  const status: ExecutionTaskState['status'] = !execution.started
    ? 'inactive'
    : execution.done
      ? 'done'
      : execution.pending
        ? 'waiting'
        : node?.op === 'join'
          ? 'joining'
          : 'ready';
  const task: ExecutionTaskState = {
    id: execution.thread.id,
    label: execution.label,
    status,
  };
  const blockId = state.activeBlockIds[execution.thread.id];
  if (blockId) task.blockId = blockId;
  const pending = execution.pending;
  if (pending) {
    if (pending.kind === 'visual') {
      task.detail = 'Esperando que termine la animación';
    } else if (pending.kind === 'timer') {
      const timer = state.timers[pending.timerId];
      task.remainingMs = timer?.remainingMs;
      task.durationMs = timer?.durationMs;
      task.detail = timer
        ? `Esperando el evento de ${timer.name}${timer.status === 'stopped' ? ' (todavía no iniciado)' : ''}`
        : 'Temporizador no disponible';
    } else {
      const target = pending.kind === 'wait'
        ? pending.until
        : pending.kind === 'otto'
          ? pending.until
        : pending.kind === 'message' || pending.kind === 'wifiMessage'
          ? pending.timeoutAt
          : state.wifiAvailable
            ? pending.readyAt
            : pending.timeoutAt;
      task.remainingMs = Math.max(0, Math.round(target - virtualNow));
      task.durationMs = Math.max(0, Math.round(target - pending.startedAt));
      task.detail = pending.kind === 'wait'
        ? `${(task.remainingMs / 1000).toFixed(2)} s restantes`
        : pending.kind === 'otto'
          ? `Movimiento Otto · ${(task.remainingMs / 1000).toFixed(1)} s`
        : pending.kind === 'message' || pending.kind === 'wifiMessage'
          ? `Esperando “${pending.expected}”${pending.kind === 'wifiMessage' ? ` de ${pending.sender === '*' ? 'cualquier placa' : pending.sender}` : ''} · ${(task.remainingMs / 1000).toFixed(1)} s`
          : state.wifiAvailable
            ? 'Conectando a Wi-Fi'
            : 'Esperando la red Wi-Fi';
    }
  } else if (status === 'joining') {
    task.detail = 'Espera a los otros caminos';
  } else if (blockId) {
    const latest = trace.findLast(
      item => item.taskId === execution.thread.id && item.blockId === blockId,
    );
    task.detail = latest?.message ?? 'Ejecutando';
  }
  const activeLoop = execution.loopCounters.findLastIndex(value => value > 0);
  if (activeLoop >= 0 && execution.loopTotals[activeLoop] > 0) {
    task.totalIterations = execution.loopTotals[activeLoop];
    task.iteration = task.totalIterations - execution.loopCounters[activeLoop] + 1;
  }
  return task;
}

function createExecutions(): ThreadExecution[] {
  let tasks: ReturnType<typeof compileTaskGraph>;
  try { tasks = compileTaskGraph(program); } catch { return []; } // Validation reports the rejected graph without losing its diagnostics.
  return tasks.map((task) => {
    return {
      thread: { id: task.id, startBlockId: task.startBlockId, nodes: [] },
      label: task.label,
      instructions: task.output,
      pc: 0,
      loopCounters: Array.from({ length: task.loopSlots }, () => -1),
      loopTotals: Array.from({ length: task.loopSlots }, () => 0),
      pending: null,
      done: !task.initial,
      started: task.initial,
      launch: task.initialLaunch ?? null,
    };
  });
}

function applyInputValue(deviceId: string, value: unknown) {
  const device = state.devices[deviceId];
  if (device?.kind === 'display') {
    device.pressedButton = ['RIGHT', 'UP', 'DOWN', 'LEFT', 'SELECT'].includes(String(value))
      ? value as typeof device.pressedButton
      : null;
    return;
  }
  if (device?.kind === 'button') {
    device.pressed = Boolean(value);
    return;
  }
  if (device?.kind === 'infraredBarrier') {
    device.interrupted = Boolean(value);
    return;
  }
  if (device?.kind === 'lightSensor' || device?.kind === 'potentiometer') {
    const numeric = Number(value);
    device.value = Number.isFinite(numeric)
      ? Math.max(0, Math.min(4095, numeric))
      : 0;
  }
  if (device?.kind === 'otto') {
    const numeric = Number(value);
    device.distance = Number.isFinite(numeric) ? Math.max(0, Math.min(500, numeric)) : 0;
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

function resetExecution(status: SimulatorState['status'] = 'idle', preserveDashboardManual = false) {
  const manualDevices = preserveDashboardManual
    ? new Map(
        [...dashboardManual]
          .map(id => [id, state.devices[id] ? structuredClone(state.devices[id]) : null] as const)
          .filter((entry): entry is readonly [string, RuntimeDeviceState] => entry[1] !== null),
      )
    : new Map<string, RuntimeDeviceState>();
  stopSounds();
  state = freshState();
  for (const [deviceId, device] of manualDevices) {
    if (!state.devices[deviceId] || !dashboardDeviceIds(scene).has(deviceId)) continue;
    dashboardManual.add(deviceId);
    state.dashboardModes[deviceId] = 'manual';
    state.devices[deviceId] = device;
  }
  applyInputOverrides();
  state.status = status;
  virtualNow = 0;
  schedulerDebtMs = 0;
  executions = createExecutions();
  schedulerCursor = 0;
  schedulerBudgetUsed = 0;
  quantumOpen = false;
  trace = [];
  awaitingFrame = null;
  guidedNextAt = 0;
  running = false;
  doneEmitted = false;
  lastRealTime = performance.now();
  lastSnapshotRealTime = 0;
  lastBlockActivityRealTime = Number.NEGATIVE_INFINITY;
  lastSoundRealTime = Number.NEGATIVE_INFINITY;
  pendingBlockActivity = null;
  pendingSounds.clear();
  messageQueues.clear();
  wifiMessageQueues.clear(); wifiMessageSequence = 0;
  lastReceivedMessages.clear();
  visualAnimations.clear();
  ottoOwners.clear();
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
  if (condition.kind === 'displayButtonPressed') {
    const device = state.devices[condition.deviceId];
    return device?.kind === 'display' && device.pressedButton === condition.button;
  }
  if (condition.kind === 'value') return Boolean(evaluateValue(condition.expression));
  if (condition.kind === 'valueCompare') {
    const left = evaluateValue(condition.left);
    const right = evaluateValue(condition.right);
    if (condition.operator === 'EQ') return left === right;
    if (condition.operator === 'NEQ') return left !== right;
    return numberOperators[condition.operator](Number(left), Number(right));
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

function valueText(value: number | string | boolean) {
  return (typeof value === 'boolean' ? value ? 'sí' : 'no' : String(value)).slice(0, 120);
}

function evaluateValue(expression: ValueExpression): number | string | boolean {
  switch (expression.kind) {
    case 'number': return normalizeCounterValue(expression.value);
    case 'text': return expression.value.slice(0, 120);
    case 'boolean': return expression.value;
    case 'counterValue': return state.counter;
    case 'timerElapsed': return Math.floor((state.timers[expression.timerId]?.elapsedMs ?? 0) / 1000);
    case 'timerRemaining': return Math.ceil((state.timers[expression.timerId]?.remainingMs ?? 0) / 1000);
    case 'parameter': return expression.valueType === 'text' ? '' : expression.valueType === 'boolean' ? false : 0;
    case 'functionCall': return expression.valueType === 'text' ? '' : expression.valueType === 'boolean' ? false : 0;
    case 'componentValue': {
      const device = state.devices[expression.deviceId];
      if (!device) return expression.valueType === 'text' ? '' : expression.valueType === 'boolean' ? false : 0;
      if (device.kind === 'educationalModule') return device.values[expression.property] ?? (expression.valueType === 'text' ? '' : expression.valueType === 'boolean' ? false : 0);
      if (device.kind === 'trafficLight' && expression.property === 'color') return device.color;
      if (device.kind === 'led' && expression.property === 'brightness') return device.brightness;
      if (device.kind === 'robot' && expression.property === 'motion') {
        if (device.left === 0 && device.right === 0) return 'STOP';
        if (device.left > 0 && device.right > 0) return 'FORWARD';
        if (device.left < 0 && device.right < 0) return 'BACKWARD';
        return device.left < device.right ? 'LEFT' : 'RIGHT';
      }
      if (device.kind === 'motor' && expression.property === 'power') return device.power;
      if (device.kind === 'servo' && expression.property === 'angle') return device.angle;
      if (device.kind === 'button' && expression.property === 'pressed') return device.pressed;
      if (device.kind === 'infraredBarrier' && expression.property === 'interrupted') return device.interrupted;
      if ((device.kind === 'lightSensor' || device.kind === 'potentiometer') && expression.property === 'value') return device.value;
      if (device.kind === 'wifiNode' && expression.property === 'connected') return device.status === 'connected';
      if (device.kind === 'wifiNode' && expression.property === 'status') return device.status;
      if (device.kind === 'wifiNode' && expression.property === 'lastWifiMessage') return device.received.at(-1)?.text ?? '';
      if (device.kind === 'wifiNode' && expression.property === 'lastWifiSender') return device.received.at(-1)?.sender ?? '';
      if (device.kind === 'messages' && expression.property === 'lastMessage') return lastReceivedMessages.get(expression.deviceId) ?? '';
      if (device.kind === 'otto' && expression.property === 'distance') return device.distance;
      if (device.kind === 'otto' && expression.property === 'motion') return device.motion;
      if (device.kind === 'otto' && expression.property === 'expression') return device.expression;
      return expression.valueType === 'text' ? '' : expression.valueType === 'boolean' ? false : 0;
    }
    case 'variable': return state.variables[expression.variableId] ?? (expression.valueType === 'text' ? '' : expression.valueType === 'boolean' ? false : 0);
    case 'sensorValue': {
      const device = state.devices[expression.deviceId];
      return device?.kind === 'lightSensor' || device?.kind === 'potentiometer' ? device.value : 0;
    }
    case 'ottoDistance': {
      const device = state.devices[expression.deviceId];
      return device?.kind === 'otto' ? device.distance : 0;
    }
    case 'buttonValue': {
      const device = state.devices[expression.deviceId];
      return device?.kind === 'button' && device.pressed;
    }
    case 'barrierValue': {
      const device = state.devices[expression.deviceId];
      const interrupted = device?.kind === 'infraredBarrier' && device.interrupted;
      return expression.expected === 'CLEAR' ? !interrupted : interrupted;
    }
    case 'displayButtonValue': {
      const device = state.devices[expression.deviceId];
      return device?.kind === 'display' && device.pressedButton === expression.button;
    }
    case 'messageValue': {
      return lastReceivedMessages.get(expression.deviceId) ?? '';
    }
    case 'wifiValue': return state.wifi === 'connected';
    case 'join': return expression.parts.map(part => valueText(evaluateValue(part))).join('').slice(0, 120);
    case 'math': {
      const left = Number(evaluateValue(expression.left)) || 0;
      const right = Number(evaluateValue(expression.right)) || 0;
      if (expression.operator === 'DIVIDE') return normalizeCounterValue(right === 0 ? 0 : Math.trunc(left / right));
      if (expression.operator === 'SUBTRACT') return addCounterValues(left, -right);
      if (expression.operator === 'MULTIPLY') return normalizeCounterValue(left * right);
      return addCounterValues(left, right);
    }
  }
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
    if (device.kind === 'otto' && device.sound && device.soundUntil > virtualNow) {
      pendingSounds.set(deviceId, { frequency: ottoSoundFrequency(device.sound) });
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
    if (device?.kind === 'otto') {
      const remainingVirtualMs = Math.max(0, device.soundUntil - virtualNow);
      if (!device.sound || remainingVirtualMs <= 0) continue;
      scope.postMessage({ type: 'SOUND', deviceId, frequency: sound.frequency, durationMs: remainingVirtualMs });
      continue;
    }
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

function cancelVisualAnimation(deviceId: string) {
  visualAnimations.delete(deviceId);
  const device = state.devices[deviceId];
  if (device?.kind === 'display') device.animation = null;
  if (device?.kind === 'ledMatrix') device.scrolling = false;
  if (device?.kind === 'smartLights') device.animation = null;
}

function updateVisualAnimations() {
  for (const [deviceId, animation] of visualAnimations) {
    const device = state.devices[deviceId];
    let done = virtualNow >= animation.until;
    const elapsed = Math.max(0, virtualNow - animation.startedAt);
    const cycleElapsed = done ? animation.cycleMs : elapsed % animation.cycleMs;
    if (animation.kind === 'smartLights') {
      if (device?.kind === 'smartLights') {
        const step = Math.floor(cycleElapsed / animation.speedMs);
        const rainbow = ['#ff1744', '#ff9100', '#ffee00', '#00e676', '#00b0ff', '#7c4dff'];
        device.pixels = device.pixels.map((_, index) => {
          if (animation.effect === 'RAINBOW') return rainbow[(index + step) % rainbow.length];
          if (animation.effect === 'CHASE') return (index + step) % 4 === 0 ? animation.color : '#000000';
          if (animation.effect === 'PULSE') {
            const level = 0.1 + 0.9 * (1 - Math.abs((step % 16) - 8) / 8);
            const value = Number.parseInt(animation.color.slice(1), 16);
            const channel = (shift: number) => Math.round(((value >> shift) & 255) * level).toString(16).padStart(2, '0');
            return `#${channel(16)}${channel(8)}${channel(0)}`;
          }
          return step % 2 === 0 ? animation.color : '#000000';
        });
        device.animation = done ? null : animation.effect === 'RAINBOW' ? 'arcoíris' : animation.effect === 'CHASE' ? 'persecución' : animation.effect === 'PULSE' ? 'pulso' : 'parpadeo';
      } else done = true;
    } else if (animation.kind === 'matrix') {
      if (device?.kind === 'ledMatrix') {
        const offset = Math.floor(cycleElapsed / animation.speedMs);
        device.rows = matrixScrollRows(animation.text, offset);
        device.scrolling = !done;
      }
    } else if (animation.kind === 'displayText') {
      const definition = scene.devices.find(item => item.id === deviceId);
      const area = definition?.kind === 'display'
        ? displayTargets(definition.config).find(item => item.id === animation.areaId)
        : undefined;
      if (device?.kind === 'display' && area) {
        const final = layoutDisplayText(animation.text, area);
        const step = Math.floor(cycleElapsed / animation.speedMs);
        if (animation.effect === 'type') {
          const count = final.cells.length;
          const chunk = Math.ceil(count / 24);
          const visible = Math.min(count, (step + 1) * chunk);
          device.texts[animation.areaId] = layoutDisplayText(
            `${final.cells.slice(0, visible)}${' '.repeat(count - visible)}`,
            area,
          ).lines;
        } else if (animation.effect === 'scroll') {
          const offset = Math.min(area.columns, step + 1);
          device.texts[animation.areaId] = final.lines.map(line =>
            `${' '.repeat(area.columns - offset)}${line.slice(0, offset)}`,
          );
        } else {
          device.texts[animation.areaId] = step % 2 === 0
            ? final.lines
            : Array.from({ length: area.rows }, () => ' '.repeat(area.columns));
        }
        device.animation = animation.effect;
        device.artworkRows = Array.from({ length: 8 }, () => 0);
        if (done) {
          device.texts[animation.areaId] = final.lines;
          device.animation = null;
        }
      } else done = true;
    } else {
      if (device?.kind === 'display') {
        const step = Math.floor(cycleElapsed / animation.speedMs);
        if (animation.effect === 'slide') {
          const shift = Math.max(0, 16 - (step + 1));
          device.artworkRows = animation.rows.map(row =>
            shift ? Math.floor(row / 2 ** shift) : row,
          );
        } else {
          device.artworkRows = step % 2 === 0
            ? [...animation.rows]
            : Array.from({ length: 8 }, () => 0);
        }
        device.animation = animation.effect;
        device.texts = Object.fromEntries(
          Object.entries(device.texts).map(([id, lines]) => [id, lines.map(line => ' '.repeat(line.length))]),
        );
        if (done) {
          device.artworkRows = [...animation.rows];
          device.animation = null;
        }
      } else done = true;
    }
    if (done) visualAnimations.delete(deviceId);
  }
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
  if (pending.kind === 'otto') {
    const device = state.devices[pending.deviceId];
    if (ottoOwners.get(pending.deviceId) !== execution.thread.id) {
      execution.pending = null;
      execution.pc += 1;
      return 'advanced';
    }
    if (device?.kind === 'otto') {
      device.motion = pending.action;
      device.phase = Math.floor((virtualNow - pending.startedAt) / pending.stepMs) % 4;
      device.speed = pending.speed;
    }
    if (virtualNow < pending.until) return 'waiting';
    if (device?.kind === 'otto') { device.motion = 'HOME'; device.phase = 0; device.speed = 0; }
    ottoOwners.delete(pending.deviceId);
    execution.pending = null;
    execution.pc += 1;
    return 'advanced';
  }
  if (pending.kind === 'message') {
    const queue = messageQueues.get(pending.deviceId) ?? [];
    const received = queue.shift();
    if (received !== undefined) {
      execution.pending = null;
      lastReceivedMessages.set(pending.deviceId, received);
      execution.pc = received === pending.expected ? pending.equalTarget : pending.differentTarget;
      appendConsole(`${deviceName(pending.deviceId)} recibió “${received}”: ${received === pending.expected ? 'igual' : 'distinto'}`);
      return 'advanced';
    }
    if (virtualNow >= pending.timeoutAt) {
      execution.pending = null;
      execution.pc = pending.timeoutTarget;
      appendConsole(`${deviceName(pending.deviceId)}: no llegó ningún mensaje a tiempo`);
      return 'advanced';
    }
    return 'waiting';
  }
  if (pending.kind === 'wifiMessage') {
    const queue = wifiMessageQueues.get(pending.deviceId) ?? [];
    const index = queue.findIndex(item => pending.sender === '*' || item.sender === pending.sender);
    const received = index >= 0 ? queue.splice(index, 1)[0] : undefined;
    if (received) {
      execution.pending = null;
      execution.pc = received.text === pending.expected ? pending.equalTarget : pending.differentTarget;
      appendConsole(`${deviceName(pending.deviceId)} recibió de ${received.sender} “${received.text}”: ${received.text === pending.expected ? 'igual' : 'distinto'}`);
      return 'advanced';
    }
    if (virtualNow >= pending.timeoutAt) { execution.pending = null; execution.pc = pending.timeoutTarget; appendConsole(`${deviceName(pending.deviceId)}: no llegó ningún mensaje Wi-Fi a tiempo`); return 'advanced'; }
    return 'waiting';
  }
  if (pending.kind === 'visual') {
    if (visualAnimations.has(pending.deviceId)) return 'waiting';
    execution.pending = null;
    execution.pc += 1;
    return 'advanced';
  }
  if (pending.kind === 'timer') {
    const timer = state.timers[pending.timerId];
    if (!timer) {
      execution.pending = null;
      execution.pc += 1;
      return 'advanced';
    }
    if (timer.status === 'stopped' && timer.pendingEvents < 0) {
      timer.pendingEvents = 0;
      execution.pending = null;
      execution.pc += 1;
      appendConsole(`${timer.name}: espera cancelada`);
      return 'advanced';
    }
    if (timer.pendingEvents <= 0) return 'waiting';
    timer.pendingEvents -= 1;
    execution.pending = null;
    execution.pc += 1;
    appendConsole(`${timer.name}: llegó el evento`);
    return 'advanced';
  }
  if (pending.kind !== 'wifi') return 'waiting';
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

function ottoSoundFrequency(sound: string) {
  return ({ HAPPY: 880, SAD: 220, SURPRISE: 1175, CONFUSED: 330, SLEEPING: 165, BUTTON: 660, MODE: 990, FART: 110 } as Record<string, number>)[sound] ?? 440;
}

function executeInstruction(
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

  if (node.op === 'fork') {
    for (const index of node.children) {
      const child = executions[index];
      child.pc = 0;
      child.loopCounters.fill(-1);
      child.loopTotals.fill(0);
      child.pending = null;
      child.done = false;
      child.started = true;
    }
    execution.pc += 1;
    return 'yield';
  }
  if (node.op === 'join') {
    if (node.children.some(index => !executions[index].done)) return 'wait';
    execution.pc += 1;
    return 'continue';
  }

  if (node.op === 'repeatStart') {
    if (execution.loopCounters[node.slot] < 0) {
      execution.loopCounters[node.slot] = node.count;
      execution.loopTotals[node.slot] = node.count;
    }
    if (execution.loopCounters[node.slot] === 0) {
      execution.loopCounters[node.slot] = -1;
      execution.loopTotals[node.slot] = 0;
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
      execution.loopTotals[node.slot] = 0;
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
      startedAt: virtualNow,
      until: virtualNow + Math.max(0, node.ms),
      blockId: node.blockId,
    };
    return 'wait';
  }
  if (node.op === 'otto') {
    const device = state.devices[node.deviceId];
    if (node.action === 'HOME') {
      ottoOwners.delete(node.deviceId);
      if (device?.kind === 'otto') { device.motion = 'HOME'; device.phase = 0; device.speed = 0; }
      execution.pc += 1;
      return 'action';
    }
    const stepMs = 480 - Math.round(Math.max(0, Math.min(100, node.speed)) * 3);
    ottoOwners.set(node.deviceId, execution.thread.id);
    if (device?.kind === 'otto') { device.motion = node.action; device.phase = 0; device.speed = node.speed; }
    execution.pending = { kind: 'otto', startedAt: virtualNow, until: virtualNow + stepMs * 4 * Math.max(1, node.repetitions), stepMs, deviceId: node.deviceId, action: node.action, speed: node.speed, blockId: node.blockId };
    appendConsole(`${deviceName(node.deviceId)}: ${node.action.toLowerCase()} (${node.repetitions} vez/veces)`);
    return 'wait';
  }
  if (node.op === 'wifi') {
    state.wifi = 'connecting';
    appendConsole('Buscando red Wi-Fi…');
    execution.pending = {
      kind: 'wifi',
      startedAt: virtualNow,
      readyAt: virtualNow + 1200,
      timeoutAt: virtualNow + Math.max(1000, node.timeoutMs),
      blockId: node.blockId,
    };
    return 'wait';
  }
  if (node.op === 'messageReceiveWait') {
    execution.pending = {
      kind: 'message',
      startedAt: virtualNow,
      timeoutAt: virtualNow + Math.max(100, node.timeoutMs),
      deviceId: node.deviceId,
      expected: node.expected,
      equalTarget: node.equalTarget,
      differentTarget: node.differentTarget,
      timeoutTarget: node.timeoutTarget,
      blockId: node.blockId,
    };
    return 'wait';
  }
  if (node.op === 'wifiMessageReceiveWait') {
    execution.pending = { kind: 'wifiMessage', startedAt: virtualNow, timeoutAt: virtualNow + Math.max(100, node.timeoutMs), deviceId: node.deviceId, expected: node.expected, sender: node.sender, equalTarget: node.equalTarget, differentTarget: node.differentTarget, timeoutTarget: node.timeoutTarget, blockId: node.blockId };
    return 'wait';
  }
  if (node.op === 'matrixScroll') {
    const cycleMs = matrixScrollSteps(node.text) * Math.max(40, node.speedMs);
    const duration = node.repeatCount === 0 ? Number.POSITIVE_INFINITY : cycleMs * node.repeatCount;
    const device = state.devices[node.deviceId];
    if (device?.kind === 'ledMatrix') device.scrolling = true;
    visualAnimations.set(node.deviceId, { kind: 'matrix', startedAt: virtualNow, until: virtualNow + duration, cycleMs, deviceId: node.deviceId, text: node.text, speedMs: Math.max(40, node.speedMs) });
    execution.pc += 1;
    return 'action';
  }
  if (node.op === 'displayAnimateText') {
    const definition = scene.devices.find(item => item.id === node.deviceId);
    const area = definition?.kind === 'display'
      ? displayTargets(definition.config).find(item => item.id === node.areaId)
      : undefined;
    const speedMs = definition?.kind === 'display'
      ? displayAnimationMs(definition.config.animationSpeed)
      : 200;
    const cells = area ? area.columns * area.rows : 1;
    const steps = node.effect === 'type'
      ? Math.min(24, cells)
      : node.effect === 'scroll'
        ? area?.columns ?? 1
        : 5;
    const cycleMs = Math.max(1, steps) * speedMs;
    visualAnimations.set(node.deviceId, {
      kind: 'displayText',
      startedAt: virtualNow,
      until: node.repeatCount === 0 ? Number.POSITIVE_INFINITY : virtualNow + cycleMs * node.repeatCount,
      cycleMs,
      deviceId: node.deviceId,
      areaId: node.areaId,
      text: node.text,
      effect: node.effect,
      speedMs,
    });
    execution.pc += 1;
    return 'action';
  }
  if (node.op === 'displayArtwork') {
    const definition = scene.devices.find(item => item.id === node.deviceId);
    const artwork = definition?.kind === 'display'
      ? displayArtworkById(displayArtworks(definition.config), node.artworkId)
      : undefined;
    const device = state.devices[node.deviceId];
    if (!artwork || device?.kind !== 'display') {
      execution.pc += 1;
      return 'action';
    }
    device.texts = Object.fromEntries(
      Object.entries(device.texts).map(([id, lines]) => [
        id,
        lines.map(line => ' '.repeat(line.length)),
      ]),
    );
    if (node.effect === 'still') {
      cancelVisualAnimation(node.deviceId);
      device.artworkRows = [...artwork.rows];
      device.animation = null;
      execution.pc += 1;
      return 'action';
    }
    const speedMs = definition?.kind === 'display'
      ? displayAnimationMs(definition.config.animationSpeed)
      : 200;
    const cycleMs = (node.effect === 'slide' ? 16 : 5) * speedMs;
    visualAnimations.set(node.deviceId, {
      kind: 'displayArtwork',
      startedAt: virtualNow,
      until: node.repeatCount === 0 ? Number.POSITIVE_INFINITY : virtualNow + cycleMs * node.repeatCount,
      cycleMs,
      deviceId: node.deviceId,
      rows: [...artwork.rows],
      effect: node.effect,
      speedMs,
    });
    execution.pc += 1;
    return 'action';
  }
  if (node.op === 'visualWait') {
    if (!visualAnimations.has(node.deviceId)) {
      execution.pc += 1;
      return 'action';
    }
    execution.pending = { kind: 'visual', startedAt: virtualNow, deviceId: node.deviceId, blockId: node.blockId };
    return 'wait';
  }
  if (node.op === 'timerWait') {
    const timer = state.timers[node.timerId];
    if (timer && timer.pendingEvents > 0) {
      timer.pendingEvents -= 1;
      execution.pc += 1;
      appendConsole(`${timer.name}: llegó el evento`);
      return 'action';
    }
    execution.pending = { kind: 'timer', startedAt: virtualNow, timerId: node.timerId, blockId: node.blockId };
    return 'wait';
  }

  execution.pc += 1;
  switch (node.op) {
    case 'traffic': {
      const device = programDevice(node.deviceId);
      if (device?.kind === 'trafficLight') {
        device.color = node.color;
        appendConsole(
          `${deviceName(node.deviceId)}: ${node.color.toLowerCase()}`,
        );
      }
      break;
    }
    case 'led': {
      const device = programDevice(node.deviceId);
      if (device?.kind === 'led') {
        device.brightness = Math.max(0, Math.min(100, node.brightness));
        appendConsole(
          `${deviceName(node.deviceId)}: ${Math.round(device.brightness)}%`,
        );
      }
      if (device?.kind === 'educationalModule' && device.deviceKind === 'powerSwitch') {
        device.values.power = Math.max(0, Math.min(100, node.brightness));
        appendConsole(`${deviceName(node.deviceId)}: ${Math.round(Number(device.values.power))}%`);
      }
      break;
    }
    case 'rgbFill': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'smartLights') {
        cancelVisualAnimation(node.deviceId);
        const color = /^#[0-9a-f]{6}$/i.test(node.color) ? node.color.toLowerCase() : '#000000';
        device.pixels.fill(color); device.brightness = Math.max(0, Math.min(100, node.brightness)); device.animation = null;
        appendConsole(`${deviceName(node.deviceId)}: todas ${color}`);
      }
      break;
    }
    case 'rgbPixel': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'smartLights') {
        cancelVisualAnimation(node.deviceId);
        const index = Math.max(0, Math.min(device.pixels.length - 1, Math.round(node.pixel) - 1));
        device.pixels[index] = /^#[0-9a-f]{6}$/i.test(node.color) ? node.color.toLowerCase() : '#000000'; device.animation = null;
      }
      break;
    }
    case 'rgbSegment': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'smartLights') {
        cancelVisualAnimation(node.deviceId);
        const color = /^#[0-9a-f]{6}$/i.test(node.color) ? node.color.toLowerCase() : '#000000';
        const from = Math.max(0, Math.min(device.pixels.length - 1, Math.min(node.from, node.to) - 1));
        const to = Math.max(0, Math.min(device.pixels.length - 1, Math.max(node.from, node.to) - 1));
        for (let index = from; index <= to; index += 1) device.pixels[index] = color;
      }
      break;
    }
    case 'rgbCoordinate': {
      const device = state.devices[node.deviceId];
      const definition = scene.devices.find(item => item.id === node.deviceId);
      if (device?.kind === 'smartLights' && definition?.kind === 'smartLights') {
        cancelVisualAnimation(node.deviceId);
        let x = Math.round(node.x) - 1, y = Math.round(node.y) - 1;
        if (definition.config.origin.includes('right')) x = definition.config.width - 1 - x;
        if (definition.config.origin.startsWith('bottom')) y = definition.config.height - 1 - y;
        if (definition.config.layout === 'zigzag' && y % 2 === 1) x = definition.config.width - 1 - x;
        const index = y * definition.config.width + x;
        if (index >= 0 && index < device.pixels.length) device.pixels[index] = /^#[0-9a-f]{6}$/i.test(node.color) ? node.color.toLowerCase() : '#000000';
      }
      break;
    }
    case 'rgbGradient': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'smartLights') {
        cancelVisualAnimation(node.deviceId);
        const decode = (color: string) => { const value = Number.parseInt((/^#[0-9a-f]{6}$/i.test(color) ? color : '#000000').slice(1), 16); return [(value >> 16) & 255, (value >> 8) & 255, value & 255]; };
        const start = decode(node.startColor), end = decode(node.endColor);
        const from = Math.max(0, Math.min(device.pixels.length - 1, Math.min(node.from, node.to) - 1)), to = Math.max(0, Math.min(device.pixels.length - 1, Math.max(node.from, node.to) - 1)), span = Math.max(1, to - from);
        for (let index = from; index <= to; index += 1) { const amount = (index - from) / span; device.pixels[index] = `#${start.map((channel, part) => Math.round(channel + (end[part] - channel) * amount).toString(16).padStart(2, '0')).join('')}`; }
      }
      break;
    }
    case 'rgbPattern': {
      const device = state.devices[node.deviceId];
      const definition = scene.devices.find(item => item.id === node.deviceId);
      if (device?.kind === 'smartLights' && definition?.kind === 'smartLights') {
        cancelVisualAnimation(node.deviceId);
        device.pixels.fill('#000000');
        const rows = node.pattern === 'HEART' ? [0, 0x66, 0xff, 0xff, 0x7e, 0x3c, 0x18, 0] : [0, 0x42, 0, 0, 0x42, 0x24, 0x18, 0];
        for (let y = 0; y < definition.config.height; y += 1) for (let x = 0; x < definition.config.width; x += 1) {
          const on = node.pattern === 'CHECKER' ? (x + y) % 2 === 0 : Boolean(rows[Math.floor(y * 8 / definition.config.height)] & (1 << (7 - Math.floor(x * 8 / definition.config.width))));
          if (!on) continue;
          let xx = x, yy = y;
          if (definition.config.origin.includes('right')) xx = definition.config.width - 1 - xx;
          if (definition.config.origin.startsWith('bottom')) yy = definition.config.height - 1 - yy;
          if (definition.config.layout === 'zigzag' && yy % 2 === 1) xx = definition.config.width - 1 - xx;
          device.pixels[yy * definition.config.width + xx] = /^#[0-9a-f]{6}$/i.test(node.color) ? node.color.toLowerCase() : '#ff2266';
        }
      }
      break;
    }
    case 'rgbAnimation': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'smartLights') {
        device.animation = node.effect === 'RAINBOW' ? 'arcoíris' : node.effect === 'CHASE' ? 'persecución' : node.effect === 'PULSE' ? 'pulso' : 'parpadeo';
        const palette = node.effect === 'RAINBOW' ? ['#ff1744','#ff9100','#ffee00','#00e676','#00b0ff','#7c4dff'] : [node.color.toLowerCase(), '#000000'];
        device.pixels = device.pixels.map((_, index) => palette[index % palette.length]);
        const cycleMs = Math.max(160, device.pixels.length * 80);
        visualAnimations.set(node.deviceId, { kind: 'smartLights', startedAt: virtualNow, until: node.repeat === 0 ? Number.POSITIVE_INFINITY : virtualNow + cycleMs * node.repeat, cycleMs, deviceId: node.deviceId, effect: node.effect, color: /^#[0-9a-f]{6}$/i.test(node.color) ? node.color.toLowerCase() : '#ffffff', speedMs: 80 });
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
      const device = programDevice(node.deviceId);
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
      const device = programDevice(node.deviceId);
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
    case 'stepper': {
      const device = programDevice(node.deviceId);
      if (device?.kind === 'educationalModule' && device.deviceKind === 'stepper') {
        device.values.position = Number(device.values.position) + node.steps;
        device.values.moving = node.steps !== 0;
        appendConsole(`${deviceName(node.deviceId)}: ${Math.round(node.steps)} pasos a ${Math.round(node.speed)}`);
      }
      break;
    }
    case 'servo': {
      const device = programDevice(node.deviceId);
      if (device?.kind === 'servo') {
        device.angle = Math.max(0, Math.min(180, node.angle));
        appendConsole(
          `${deviceName(node.deviceId)}: ${Math.round(device.angle)}°`,
        );
      }
      break;
    }
    case 'ottoSound': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'otto') {
        device.sound = node.sound;
        device.soundUntil = virtualNow + 700;
        pendingSounds.set(node.deviceId, { frequency: ottoSoundFrequency(node.sound) });
        appendConsole(`${deviceName(node.deviceId)}: sonido ${node.sound.toLowerCase()}`);
      }
      break;
    }
    case 'ottoExpression': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'otto') { device.expression = node.expression; appendConsole(`${deviceName(node.deviceId)}: cara ${node.expression.toLowerCase()}`); }
      break;
    }
    case 'ottoArms': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'otto') { device.arms = node.pose; appendConsole(`${deviceName(node.deviceId)}: brazos ${node.pose.toLowerCase()}`); }
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
    case 'displayWrite':
    case 'displayClear': {
      cancelVisualAnimation(node.deviceId);
      const device = state.devices[node.deviceId];
      const definition = scene.devices.find(device => device.id === node.deviceId);
      const area = definition?.kind === 'display' ? displayTargets(definition.config).find(area => area.id === node.areaId) : undefined;
      if (device?.kind === 'display' && area) {
        const text = node.op === 'displayWrite' ? node.expression ? valueText(evaluateValue(node.expression)) : node.text : '';
        device.texts[node.areaId] = layoutDisplayText(text, area).lines;
        device.animation = null;
      }
      break;
    }
    case 'matrixClear': {
      cancelVisualAnimation(node.deviceId);
      const device = state.devices[node.deviceId];
      if (device?.kind === 'ledMatrix') { device.rows = Array.from({ length: 8 }, () => 0); device.scrolling = false; }
      break;
    }
    case 'matrixPixel': {
      cancelVisualAnimation(node.deviceId);
      const device = state.devices[node.deviceId];
      if (device?.kind === 'ledMatrix') { device.rows = matrixPixel(device.rows, node.x, node.y, node.enabled); device.scrolling = false; }
      break;
    }
    case 'matrixPattern': {
      cancelVisualAnimation(node.deviceId);
      const device = state.devices[node.deviceId];
      const definition = scene.devices.find(device => device.id === node.deviceId);
      const pattern = definition?.kind === 'ledMatrix' ? definition.config.patterns.find(pattern => pattern.id === node.patternId) : undefined;
      if (device?.kind === 'ledMatrix' && pattern) { device.rows = [...pattern.rows]; device.scrolling = false; }
      break;
    }
    case 'counterChange':
      state.counter = addCounterValues(state.counter, node.delta);
      appendConsole(`Contador = ${state.counter}`);
      break;
    case 'timerStart': {
      const timer = state.timers[node.timerId];
      if (timer) {
        timer.status = 'running'; timer.durationMs = Math.max(100, node.durationMs); timer.remainingMs = timer.durationMs;
        timer.elapsedMs = 0; timer.repeat = node.repeat; timer.pendingEvents = 0;
        appendConsole(`${timer.name}: ${node.repeat ? 'repite' : 'una vez'} cada ${(timer.durationMs / 1000).toFixed(1)} s`);
      }
      break;
    }
    case 'timerRestart': {
      const timer = state.timers[node.timerId];
      if (timer?.durationMs) { timer.status = 'running'; timer.remainingMs = timer.durationMs; timer.elapsedMs = 0; timer.pendingEvents = 0; appendConsole(`${timer.name}: reiniciado`); }
      break;
    }
    case 'timerPause': {
      const timer = state.timers[node.timerId];
      if (timer?.status === 'running') { timer.status = 'paused'; appendConsole(`${timer.name}: pausado`); }
      break;
    }
    case 'timerResume': {
      const timer = state.timers[node.timerId];
      if (timer?.status === 'paused') { timer.status = 'running'; appendConsole(`${timer.name}: continúa`); }
      break;
    }
    case 'timerStop': {
      const timer = state.timers[node.timerId];
      if (timer) { timer.status = 'stopped'; timer.elapsedMs = 0; timer.remainingMs = 0; timer.pendingEvents = -1; appendConsole(`${timer.name}: detenido`); }
      break;
    }
    case 'variableSet': {
      const variable = program.variables?.find(variable => variable.id === node.variableId);
      if (variable) {
        const value = evaluateValue(node.value);
        state.variables[node.variableId] = variable.type === 'text' ? valueText(value) : variable.type === 'boolean' ? Boolean(value) : normalizeCounterValue(Number(value) || 0);
        appendConsole(`${variable.name} = ${valueText(state.variables[node.variableId])}`);
      }
      break;
    }
    case 'variableChange': {
      const variable = program.variables?.find(variable => variable.id === node.variableId);
      if (variable?.type === 'number') {
        state.variables[node.variableId] = addCounterValues(Number(state.variables[node.variableId]) || 0, Number(evaluateValue(node.delta)) || 0);
        appendConsole(`${variable.name} = ${state.variables[node.variableId]}`);
      }
      break;
    }
    case 'serial':
      appendConsole(node.expression ? valueText(evaluateValue(node.expression)) : node.text);
      break;
    case 'messageSend': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'messages') {
        const text = node.expression ? valueText(evaluateValue(node.expression)) : node.text;
        device.transmitted = [...device.transmitted.slice(-15), text];
        appendConsole(`${deviceName(node.deviceId)} envió “${text}”`);
      }
      break;
    }
    case 'wifiMessageSend': {
      const device = state.devices[node.deviceId];
      if (device?.kind === 'wifiNode') {
        const text = node.expression ? valueText(evaluateValue(node.expression)) : node.text;
        const sequence = ++wifiMessageSequence;
        device.transmitted = [...device.transmitted.slice(-15), { target: node.target, text, sequence }];
        appendConsole(`${deviceName(node.deviceId)} envió a ${node.target === '*' ? 'todas' : node.target} “${text}”`);
      }
      break;
    }
  }
  return 'action';
}

function recordEvent(execution: ThreadExecution, blockId: string, message: string, deviceId?: string) {
  trace = [...trace.slice(-29), { seq: ++eventSequence, now: Math.round(virtualNow), taskId: execution.thread.id, label: execution.label, blockId, message, ...(deviceId ? { deviceId } : {}) }];
  markBlockActive(execution.thread.id, blockId);
}

function executeOne(execution: ThreadExecution) {
  if (execution.launch) {
    recordEvent(execution, execution.launch.blockId, `Empiezan ${execution.launch.count} caminos al mismo tiempo.`);
    execution.launch = null;
    return 'launch';
  }
  const node = execution.instructions[execution.pc];
  const pending = execution.pending;
  const wasDone = execution.done;
  const consoleBefore = state.console;
  const result = executeInstruction(execution);
  if (wasDone || !node) return result;
  let message = '';
  if (pending) {
    if (!execution.pending) message = pending.kind === 'wait'
      ? 'Terminó la espera; seguimos.'
      : pending.kind === 'otto'
        ? 'Terminó el movimiento de Otto; volvemos al centro.'
      : pending.kind === 'message' || pending.kind === 'wifiMessage'
        ? (state.console.at(-1)?.replace(/^[^·]*· /, '') ?? 'Terminó la espera de mensaje.')
        : pending.kind === 'visual'
          ? 'Terminó la animación; seguimos.'
          : state.wifi === 'connected'
            ? 'Wi-Fi conectado.'
            : 'No se pudo conectar a Wi-Fi.';
  } else {
    switch (node.op) {
      case 'jumpIfFalse': message = execution.pc === node.target ? 'La condición es falsa: vamos por «si no».' : 'La condición es verdadera: vamos por «si».'; break;
      case 'repeatStart': message = node.count ? `Comienza el bucle de ${node.count} vueltas.` : 'Cero vueltas: saltamos el bucle.'; break;
      case 'repeatNext': message = execution.loopCounters[node.slot] > 0 ? `Vuelta completada. Faltan ${execution.loopCounters[node.slot]}.` : 'Terminó el bucle.'; break;
      case 'jump': if (node.yieldAfter) message = 'Terminó una vuelta; repetimos por siempre.'; break;
      case 'fork': message = `Empiezan ${node.children.length} caminos al mismo tiempo.`; break;
      case 'join': if (result !== 'wait') message = 'Todos los caminos terminaron; seguimos debajo.'; break;
      case 'halt': message = 'Este camino terminó.'; break;
      case 'wait': message = `Esperamos ${Math.max(0, node.ms) / 1000} segundos sin bloquear los otros caminos.`; break;
      case 'otto': message = node.action === 'HOME' ? `${deviceName(node.deviceId)} vuelve al centro.` : `${deviceName(node.deviceId)} se mueve sin bloquear los otros caminos.`; break;
      case 'wifi': message = 'Buscamos una red Wi-Fi.'; break;
      case 'messageReceiveWait': message = `Esperamos “${node.expected}” sin detener los otros caminos.`; break;
      case 'wifiMessageReceiveWait': message = `Esperamos “${node.expected}” por Wi-Fi sin detener los otros caminos.`; break;
      case 'matrixScroll': message = `Desplazamos “${node.text.slice(0, 32)}” sin detener los otros caminos.`; break;
      case 'rgbFill': message = `${deviceName(node.deviceId)}: encendemos todas las luces con el color elegido.`; break;
      case 'rgbPixel': message = `${deviceName(node.deviceId)}: cambiamos la luz ${node.pixel}.`; break;
      case 'rgbSegment': message = `${deviceName(node.deviceId)}: coloreamos un tramo de luces.`; break;
      case 'rgbCoordinate': message = `${deviceName(node.deviceId)}: cambiamos un punto de la matriz.`; break;
      case 'rgbGradient': message = `${deviceName(node.deviceId)}: mezclamos dos colores en un tramo.`; break;
      case 'rgbPattern': message = `${deviceName(node.deviceId)}: mostramos el dibujo elegido.`; break;
      case 'rgbAnimation': message = `${deviceName(node.deviceId)}: iniciamos una animación sin detener los otros caminos.`; break;
      case 'displayAnimateText': message = `Animamos “${node.text.slice(0, 32)}” sin detener los otros caminos.`; break;
      case 'displayArtwork': message = `${deviceName(node.deviceId)}: mostramos y animamos el dibujo elegido.`; break;
      case 'visualWait': message = `Esperamos que termine ${deviceName(node.deviceId)} sin detener los otros caminos.`; break;
      case 'timerWait': message = 'Esperamos el próximo evento sin detener los otros caminos.'; break;
      case 'timerStart': message = `Temporizador iniciado por ${node.durationMs / 1000} segundos${node.repeat ? ' y repetitivo' : ''}.`; break;
      case 'timerRestart': case 'timerPause': case 'timerResume': case 'timerStop': message = state.console !== consoleBefore ? state.console.at(-1)!.replace(/^[^·]*· /, '') : 'Temporizador actualizado.'; break;
      case 'matrixClear': message = `${deviceName(node.deviceId)}: apagamos todos los puntos.`; break;
      case 'matrixPixel': message = `${deviceName(node.deviceId)}: ${node.enabled ? 'encendemos' : 'apagamos'} x ${node.x}, y ${node.y}.`; break;
      case 'matrixPattern': message = `${deviceName(node.deviceId)}: mostramos el dibujo elegido.`; break;
      case 'buzzer': case 'tone': message = `${deviceName(node.deviceId)}: suena durante ${node.durationMs / 1000} segundos.`; break;
      case 'displayWrite': message = `${deviceName(node.deviceId)}: escribimos «${node.text.slice(0, 80)}».`; break;
      case 'displayClear': message = `${deviceName(node.deviceId)}: borramos la zona de texto elegida.`; break;
      default: message = state.console !== consoleBefore ? state.console.at(-1)!.replace(/^[^·]*· /, '') : 'Acción ejecutada.';
    }
  }
  if (message) recordEvent(execution, node.op === 'halt' ? execution.thread.startBlockId : node.blockId, message, 'deviceId' in node ? node.deviceId : undefined);
  return result;
}

function updatePhysics(deltaMs: number) {
  updateVisualAnimations();
  for (const timer of Object.values(state.timers)) {
    if (timer.status !== 'running' || timer.durationMs <= 0 || deltaMs <= 0) continue;
    if (deltaMs < timer.remainingMs) {
      timer.elapsedMs += deltaMs;
      timer.remainingMs -= deltaMs;
      continue;
    }
    if (!timer.repeat) {
      timer.elapsedMs = timer.durationMs;
      timer.remainingMs = 0;
      timer.pendingEvents = Math.min(65_535, timer.pendingEvents + 1);
      timer.status = 'expired';
      continue;
    }
    timer.elapsedMs += deltaMs;
    const afterFirst = deltaMs - timer.remainingMs;
    const expirations = 1 + Math.floor(afterFirst / timer.durationMs);
    timer.pendingEvents = Math.min(65_535, timer.pendingEvents + expirations);
    const remainder = afterFirst % timer.durationMs;
    timer.remainingMs = remainder === 0 ? timer.durationMs : timer.durationMs - remainder;
  }
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
    if (device.kind === 'otto' && device.sound && virtualNow >= device.soundUntil) {
      device.sound = null;
      device.soundUntil = 0;
      stopSounds(deviceId);
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
  if ((!executions.length || executions.every((execution) => execution.done)) && !visualAnimations.size) {
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
  if (visualAnimations.size) return true;
  return Object.values(state.devices).some((device) => {
    if (device.kind === 'robot') return device.left !== 0 || device.right !== 0;
    if (device.kind === 'otto') return Boolean(device.sound && device.soundUntil > virtualNow);
    return (
      (device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer') &&
      device.playing
    );
  });
}

function runScheduler(stopAtEvent = false) {
  if (!executions.length) {
    finishProgramIfDone();
    return;
  }
  const threadBudget = Math.max(
    1,
    Math.floor(GENERATED_LOOP_BUDGET / executions.length),
  );
  if (!quantumOpen) { quantumOpen = true; schedulerCursor = 0; schedulerBudgetUsed = 0; }
  while (schedulerCursor < executions.length) {
    const sequence = eventSequence;
    const result = executeOne(executions[schedulerCursor]);
    if (result !== 'launch') schedulerBudgetUsed++;
    if (schedulerBudgetUsed >= threadBudget || result === 'wait' || result === 'yield' || result === 'done') {
      schedulerCursor++;
      schedulerBudgetUsed = 0;
    }
    if (stopAtEvent && sequence !== eventSequence) {
      finishProgramIfDone();
      return;
    }
  }
  quantumOpen = false;
  finishProgramIfDone();
}

function tick() {
  const now = performance.now();
  const realDelta = Math.min(100, now - lastRealTime);
  lastRealTime = now;
  if (mode === 'guided') {
    if (running && awaitingFrame === null && now >= guidedNextAt) {
      stepOnce();
      awaitingFrame = eventSequence;
      flushBlockActivity(true);
      flushSounds(true);
      emit();
    }
    return;
  }
  const continueFinishedPhysics = state.status === 'done' && hasDynamicOutput();
  if (!running && !continueFinishedPhysics) return;
  const previousStatus = state.status;
  const logicalDelta = realDelta * speed;
  if (running) {
    // Resume the exact instruction budget left by guided/manual stepping.
    if (quantumOpen) runScheduler();
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

function stepOnce() {
  if (!executions.length) {
    finishProgramIfDone();
    return;
  }
  const sequence = eventSequence;
  // At most one simulated second without an event per click: bounded work and
  // visible wait progress. No wall-clock delay is added to the program.
  for (let quantum = 0; quantum < 63; quantum++) {
    if (!quantumOpen) {
      const delta = SCHEDULER_QUANTUM_MS - schedulerDebtMs;
      virtualNow += delta;
      updatePhysics(delta);
      schedulerDebtMs = 0;
    }
    runScheduler(true);
    if (eventSequence !== sequence || state.status === 'done') break;
  }
  if (eventSequence === sequence && state.status !== 'done') {
    const waiting = executions.find(execution => !execution.done && execution.pending);
    if (waiting?.pending) recordEvent(waiting, waiting.pending.blockId, 'La espera sigue avanzando en el reloj simulado.');
  }
  finishProgramIfDone();
}

function stopOutputs() {
  for (const deviceId of visualAnimations.keys()) cancelVisualAnimation(deviceId);
  for (const device of Object.values(state.devices)) {
    if (device.kind === 'robot') {
      device.left = 0;
      device.right = 0;
    }
    if (device.kind === 'motor') device.power = 0;
    if (device.kind === 'otto') {
      device.motion = 'HOME';
      device.phase = 0;
      device.speed = 0;
      device.sound = null;
      device.soundUntil = 0;
    }
    if (device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer') {
      device.playing = false;
      device.stopAt = 0;
    }
  }
}

function setInputById(deviceId: string, value: unknown) {
  const device = state.devices[deviceId];
  if (device?.kind === 'educationalModule' && value && typeof value === 'object') {
    const record = value as { property?: unknown; value?: unknown };
    if (typeof record.property === 'string' && ['number','string','boolean'].includes(typeof record.value) && record.property in device.values) device.values[record.property] = record.value as number | string | boolean;
    return;
  }
  if (device?.kind === 'messages' && typeof value === 'string') {
    const queue = messageQueues.get(deviceId) ?? [];
    if (queue.length < 16) queue.push(value);
    messageQueues.set(deviceId, queue);
    device.received = [...device.received.slice(-15), value];
    appendConsole(`${deviceName(deviceId)} recibió un paquete “${value}”`);
    return;
  }
  if (device?.kind === 'wifiNode' && (typeof value === 'string' || (value && typeof value === 'object'))) {
    const record = typeof value === 'string' ? { sender: 'placa-simulada', text: value } : value as { sender?: unknown; text?: unknown };
    if (typeof record.text === 'string') {
      const sender = typeof record.sender === 'string' ? record.sender : 'placa-simulada';
      const sequence = ++wifiMessageSequence;
      const queue = wifiMessageQueues.get(deviceId) ?? [];
      if (queue.length < 16) queue.push({ sender, text: record.text, sequence }); else device.rejected += 1;
      wifiMessageQueues.set(deviceId, queue);
      device.received = [...device.received.slice(-15), { sender, text: record.text, sequence }];
      appendConsole(`${deviceName(deviceId)} recibió por la red de ${sender} “${record.text}”`);
    }
    return;
  }
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
    case 'SYNC_SCENE': {
      if (!isSceneDefinition(message.scene)) break;
      currentBoardProfile = isBoardProfileId(message.boardProfile) ? message.boardProfile : 'wemos-d1-r32';
      scene = cloneScene(message.scene);
      resetExecution();
      refreshDiagnostics();
      break;
    }
    case 'LOAD': {
      const invalidScene =
        message.scene !== undefined && !isSceneDefinition(message.scene);
      try {
        currentBoardProfile = isBoardProfileId(message.boardProfile) ? message.boardProfile : 'wemos-d1-r32';
        scene = isSceneDefinition(message.scene)
          ? cloneScene(message.scene)
          : inferSceneForProgram(message.program);
        program = normalizeCompiledProgram(message.program, scene);
        resetExecution('idle', true);
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
      awaitingFrame = null;
      guidedNextAt = 0;
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
      awaitingFrame = null;
      state.status = 'paused';
      stopSounds();
      stepOnce();
      flushBlockActivity(true);
      flushSounds(true);
      emit();
      break;
    case 'SET_MODE':
      if (message.mode !== 'normal' && message.mode !== 'guided') break;
      mode = message.mode;
      running = false;
      awaitingFrame = null;
      if (state.status === 'running') state.status = 'paused';
      stopSounds();
      emit();
      break;
    case 'FRAME_SHOWN':
      if (awaitingFrame !== null && message.seq === awaitingFrame) {
        awaitingFrame = null;
        guidedNextAt = performance.now() + 750;
      }
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
    case 'SET_DASHBOARD':
      if (typeof message.deviceId === 'string') setDashboardControl(message.deviceId, message.action);
      emit();
      break;
  }
});

setInterval(tick, 16);

export {};
