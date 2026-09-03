import type { Condition, ProgramNode } from './capiblocks';

type Frame = {
  nodes: ProgramNode[];
  index: number;
  remaining?: number;
  repeatBlockId?: string;
};

type Pending =
  | { kind: 'wait'; until: number; blockId: string }
  | { kind: 'wifi'; readyAt: number; timeoutAt: number; blockId: string }
  | null;

type SimulatorState = {
  now: number;
  status: 'idle' | 'running' | 'paused' | 'done' | 'stopped';
  traffic: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
  ledBrightness: number;
  servoAngle: number;
  buzzer: 'off' | 'active' | 'passive';
  robot: { x: number; y: number; angle: number; left: number; right: number };
  wifi: 'disconnected' | 'connecting' | 'connected' | 'error';
  counter: number;
  pins: Record<number, boolean>;
  console: string[];
  inputs: {
    button: boolean;
    light: number;
    potentiometer: number;
    wifiAvailable: boolean;
  };
  activeBlockId?: string;
};

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void,
  ): void;
};
let program: ProgramNode[] = [];
let stack: Frame[] = [];
let pending: Pending = null;
let running = false;
let speed = 1;
let virtualNow = 0;
let lastRealTime = performance.now();
let soundStopAt = 0;

const freshState = (): SimulatorState => ({
  now: 0,
  status: 'idle',
  traffic: 'OFF',
  ledBrightness: 0,
  servoAngle: 90,
  buzzer: 'off',
  robot: { x: 50, y: 72, angle: -90, left: 0, right: 0 },
  wifi: 'disconnected',
  counter: 0,
  pins: {},
  console: [],
  inputs: {
    button: false,
    light: 2500,
    potentiometer: 2000,
    wifiAvailable: true,
  },
});

let state = freshState();

function emit(type = 'SNAPSHOT') {
  state.now = Math.round(virtualNow);
  scope.postMessage({ type, state: { ...state, console: [...state.console] } });
}

function resetExecution(status: SimulatorState['status'] = 'idle') {
  const inputs = state.inputs;
  state = freshState();
  state.inputs = inputs;
  state.status = status;
  virtualNow = 0;
  stack = [{ nodes: program, index: 0 }];
  pending = null;
  running = false;
  soundStopAt = 0;
  lastRealTime = performance.now();
  emit();
}

function evaluate(condition: Condition) {
  const operators = {
    EQ: (a: number, b: number) => a === b,
    NEQ: (a: number, b: number) => a !== b,
    LT: (a: number, b: number) => a < b,
    LTE: (a: number, b: number) => a <= b,
    GT: (a: number, b: number) => a > b,
    GTE: (a: number, b: number) => a >= b,
  };
  if (condition.kind === 'boolean') return condition.value;
  if (condition.kind === 'wifiConnected') return state.wifi === 'connected';
  if (condition.kind === 'buttonPressed') return state.inputs.button;
  if (condition.kind === 'counter')
    return operators[condition.operator](state.counter, condition.value);
  if (condition.kind === 'sensor') {
    const value =
      condition.sensor === 'LIGHT'
        ? state.inputs.light
        : state.inputs.potentiometer;
    return operators[condition.operator](value, condition.value);
  }
  return operators[condition.operator](condition.left, condition.right);
}

function appendConsole(text: string) {
  state.console = [
    ...state.console.slice(-9),
    `${(virtualNow / 1000).toFixed(1)} s · ${text}`,
  ];
}

function finishFrame() {
  const frame = stack.at(-1);
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
  stack.pop();
  return false;
}

function resolvePending() {
  if (!pending) return true;
  if (pending.kind === 'wait') {
    if (virtualNow < pending.until) return false;
    pending = null;
    const frame = stack.at(-1);
    if (frame) frame.index += 1;
    return true;
  }
  if (state.inputs.wifiAvailable && virtualNow >= pending.readyAt) {
    state.wifi = 'connected';
    appendConsole('Wi-Fi conectado (simulación)');
    pending = null;
    const frame = stack.at(-1);
    if (frame) frame.index += 1;
    return true;
  }
  if (virtualNow >= pending.timeoutAt) {
    state.wifi = 'error';
    appendConsole('Tiempo de conexión agotado');
    pending = null;
    const frame = stack.at(-1);
    if (frame) frame.index += 1;
    return true;
  }
  return false;
}

function executeOne(): 'action' | 'control' | 'wait' | 'yield' | 'done' {
  if (!resolvePending()) return 'wait';

  while (stack.length) {
    if (finishFrame()) return 'yield';
    const frame = stack.at(-1);
    if (!frame) break;
    if (frame.index >= frame.nodes.length) continue;
    const node = frame.nodes[frame.index];
    state.activeBlockId = node.blockId;
    scope.postMessage({ type: 'BLOCK_ACTIVE', blockId: node.blockId });

    if (node.op === 'repeat') {
      frame.index += 1;
      if (node.count === 0) return 'control';
      stack.push({
        nodes: node.body,
        index: 0,
        remaining:
          node.count < 0
            ? Number.POSITIVE_INFINITY
            : Math.max(0, Math.floor(node.count)),
        repeatBlockId: node.blockId,
      });
      return 'control';
    }
    if (node.op === 'if') {
      frame.index += 1;
      stack.push({
        nodes: evaluate(node.condition) ? node.consequent : node.otherwise,
        index: 0,
      });
      return 'control';
    }
    if (node.op === 'wait') {
      pending = {
        kind: 'wait',
        until: virtualNow + Math.max(0, node.ms),
        blockId: node.blockId,
      };
      return 'wait';
    }
    if (node.op === 'wifi') {
      state.wifi = 'connecting';
      appendConsole('Buscando red Wi-Fi…');
      pending = {
        kind: 'wifi',
        readyAt: virtualNow + 1200,
        timeoutAt: virtualNow + Math.max(1000, node.timeoutMs),
        blockId: node.blockId,
      };
      return 'wait';
    }

    frame.index += 1;
    switch (node.op) {
      case 'traffic':
        state.traffic = node.color;
        appendConsole(`Semáforo: ${node.color.toLowerCase()}`);
        break;
      case 'led':
        state.ledBrightness = Math.max(0, Math.min(100, node.brightness));
        appendConsole(`Brillo del LED: ${Math.round(state.ledBrightness)}%`);
        break;
      case 'pin':
        state.pins = { ...state.pins, [node.pin]: node.value };
        appendConsole(
          `GPIO ${node.pin}: ${node.value ? 'encendido' : 'apagado'}`,
        );
        break;
      case 'robot': {
        const value = Math.max(0, Math.min(100, node.speed));
        const speeds = {
          FORWARD: [value, value],
          BACKWARD: [-value, -value],
          LEFT: [-value, value],
          RIGHT: [value, -value],
          STOP: [0, 0],
        } as const;
        [state.robot.left, state.robot.right] = speeds[node.action];
        appendConsole(`Robot: ${node.action.toLowerCase()} al ${value}%`);
        break;
      }
      case 'servo':
        state.servoAngle = Math.max(0, Math.min(180, node.angle));
        appendConsole(`Servo: ${Math.round(state.servoAngle)}°`);
        break;
      case 'buzzer':
        state.buzzer = node.kind === 'ACTIVE' ? 'active' : 'passive';
        soundStopAt = virtualNow + node.durationMs;
        scope.postMessage({
          type: 'SOUND',
          frequency: node.kind === 'ACTIVE' ? 880 : node.frequency,
          durationMs: node.durationMs,
        });
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
      case 'tone':
        state.buzzer = 'passive';
        soundStopAt = virtualNow + node.durationMs;
        scope.postMessage({
          type: 'SOUND',
          frequency: node.frequency,
          durationMs: node.durationMs,
        });
        break;
    }
    return 'action';
  }

  running = false;
  state.status = 'done';
  state.activeBlockId = undefined;
  scope.postMessage({ type: 'DONE' });
  emit();
  return 'done';
}

function updatePhysics(deltaMs: number) {
  const robot = state.robot;
  const average = (robot.left + robot.right) / 2;
  const turn = (robot.right - robot.left) * 0.0012 * deltaMs;
  robot.angle += turn;
  const radians = (robot.angle * Math.PI) / 180;
  robot.x += Math.cos(radians) * average * 0.00055 * deltaMs;
  robot.y += Math.sin(radians) * average * 0.00055 * deltaMs;
  if (robot.x < 5 || robot.x > 95) {
    robot.x = Math.max(5, Math.min(95, robot.x));
    robot.angle = 180 - robot.angle;
  }
  if (robot.y < 8 || robot.y > 90) {
    robot.y = Math.max(8, Math.min(90, robot.y));
    robot.angle = -robot.angle;
  }
  if (soundStopAt && virtualNow >= soundStopAt) {
    state.buzzer = 'off';
    soundStopAt = 0;
  }
}

function tick() {
  const now = performance.now();
  const realDelta = Math.min(100, now - lastRealTime);
  lastRealTime = now;
  if (!running) return;
  const logicalDelta = realDelta * speed;
  virtualNow += logicalDelta;
  updatePhysics(logicalDelta);

  const started = performance.now();
  for (
    let budget = 0;
    budget < 80 && performance.now() - started < 4;
    budget += 1
  ) {
    const result = executeOne();
    if (result === 'wait' || result === 'yield' || result === 'done') break;
  }
  emit();
}

scope.addEventListener('message', (event: MessageEvent) => {
  const message = event.data;
  switch (message.type) {
    case 'LOAD':
      program = Array.isArray(message.program) ? message.program : [];
      resetExecution();
      break;
    case 'RUN':
      if (
        state.status === 'done' ||
        state.status === 'stopped' ||
        !stack.length
      )
        resetExecution();
      running = true;
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
      state.robot.left = 0;
      state.robot.right = 0;
      state.buzzer = 'off';
      state.activeBlockId = undefined;
      emit();
      break;
    case 'RESET':
      resetExecution();
      break;
    case 'STEP': {
      running = false;
      state.status = 'paused';
      if (pending) {
        virtualNow =
          pending.kind === 'wait'
            ? pending.until
            : state.inputs.wifiAvailable
              ? pending.readyAt
              : pending.timeoutAt;
      }
      let result: ReturnType<typeof executeOne> = 'control';
      for (let budget = 0; budget < 40 && result === 'control'; budget += 1)
        result = executeOne();
      emit();
      break;
    }
    case 'SET_SPEED':
      speed = Math.max(0.25, Math.min(4, Number(message.speed) || 1));
      break;
    case 'SET_INPUT':
      if (message.name in state.inputs) {
        state.inputs = { ...state.inputs, [message.name]: message.value };
        emit();
      }
      break;
  }
});

setInterval(tick, 16);

export {};
