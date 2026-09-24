import assert from 'node:assert/strict';
import { ledMatrixConfig } from '../lib/led-matrix.ts';

let clock = 0;
let messageListener;
let tick;
const messages = [];

Object.defineProperty(globalThis, 'performance', {
  configurable: true,
  value: { now: () => clock },
});
globalThis.self = {
  postMessage(message) {
    messages.push(structuredClone(message));
  },
  addEventListener(type, listener) {
    assert.equal(type, 'message');
    messageListener = listener;
  },
};
globalThis.setInterval = (callback) => {
  tick = callback;
  return 1;
};

await import('../lib/simulator.worker.ts');
assert.ok(messageListener, 'el worker debe registrar su receptor de mensajes');
assert.ok(tick, 'el worker debe registrar su reloj cooperativo');

const send = (data) => messageListener({ data });
const advance = (milliseconds) => {
  clock += milliseconds;
  tick();
};
const latestState = () =>
  messages.findLast((message) => message.type === 'SNAPSHOT')?.state;
const resetMessages = () => messages.splice(0, messages.length);

const baseScene = (devices) => ({
  schemaVersion: 1,
  id: 'simulator-worker-test',
  name: 'Prueba del simulador',
  description: 'Escena mínima para comprobar el worker.',
  canvas: {
    width: 480,
    height: 320,
    background: 'blank',
    gridSize: 20,
    snapToGrid: true,
  },
  devices,
  widgets: [],
  retiredDeviceIds: [],
});

const button = {
  schemaVersion: 1,
  id: 'button-test',
  kind: 'button',
  name: 'Botón de prueba',
  position: { x: 40, y: 40 },
  rotation: 0,
  pins: { signal: 35 },
  config: { pressed: false, pullup: false },
};
const barrier = {
  schemaVersion: 1,
  id: 'barrier-test',
  kind: 'infraredBarrier',
  name: 'Barrera de prueba',
  position: { x: 70, y: 40 },
  rotation: 0,
  pins: { signal: 4 },
  config: { interrupted: false, interruptedLevel: 'LOW' },
};
const led = {
  schemaVersion: 1,
  id: 'led-test',
  kind: 'led',
  name: 'LED de prueba',
  position: { x: 100, y: 40 },
  rotation: 0,
  pins: { signal: 26 },
  config: { brightness: 0, color: '#ff0000' },
};
const robot = {
  schemaVersion: 1,
  id: 'robot-test',
  kind: 'robot',
  name: 'Robot de prueba',
  position: { x: 240, y: 160 },
  rotation: 90,
  pins: { leftIn1: null, leftIn2: null, rightIn1: null, rightIn2: null },
  config: { speed: 60, heading: 0, color: '#4f46e5' },
};
const buzzer = {
  schemaVersion: 1,
  id: 'buzzer-test',
  kind: 'passiveBuzzer',
  name: 'Buzzer de prueba',
  position: { x: 160, y: 40 },
  rotation: 0,
  pins: { signal: 25 },
  config: { frequency: 440, durationMs: 250 },
};
const scene = baseScene([button, barrier, led, robot, buzzer]);

// Las entradas explícitas deben sobrevivir aunque lleguen antes de LOAD y
// también entre RUN y RESET.
send({ type: 'SET_INPUT', deviceId: button.id, value: true });
send({ type: 'SET_INPUT', deviceId: barrier.id, value: true });
send({ type: 'SET_INPUT', name: 'wifiAvailable', value: false });
send({
  type: 'LOAD',
  scene,
  program: { version: 2, threads: [] },
});
assert.equal(latestState().devices[button.id].pressed, true);
assert.equal(latestState().devices[barrier.id].interrupted, true);
assert.equal(latestState().wifiAvailable, false);
assert.equal(latestState().devices[robot.id].angle, 90);
send({ type: 'RUN' });
assert.equal(latestState().devices[button.id].pressed, true);
assert.equal(latestState().devices[barrier.id].interrupted, true);
assert.equal(latestState().wifiAvailable, false);
send({ type: 'RESET' });
assert.equal(latestState().devices[button.id].pressed, true);
assert.equal(latestState().devices[barrier.id].interrupted, true);
assert.equal(latestState().wifiAvailable, false);

// La rotación elegida en la escena también es el rumbo físico: a 90° avanzar
// aumenta Y y no hace que el robot se deslice de costado sobre X.
send({
  type: 'LOAD',
  scene,
  program: {
    version: 2,
    threads: [
      {
        id: 'robot-thread',
        startBlockId: 'robot-start',
        nodes: [
          {
            op: 'robot',
            deviceId: robot.id,
            action: 'FORWARD',
            speed: 100,
            blockId: 'robot-forward',
          },
          { op: 'wait', ms: 100, blockId: 'robot-wait' },
        ],
      },
    ],
  },
});
send({ type: 'RUN' });
advance(16);
advance(16);
assert.ok(latestState().devices[robot.id].y > 50);
assert.ok(Math.abs(latestState().devices[robot.id].x - 50) < 0.001);

// Contrato del firmware: cada hilo recibe su cuanto completo en orden. El
// primer hilo deja el contador en 1 antes de que el segundo evalúe el `if`.
send({
  type: 'LOAD',
  scene,
  program: {
    version: 2,
    threads: [
      {
        id: 'thread-a',
        startBlockId: 'start-a',
        nodes: [
          { op: 'counterSet', value: 0, blockId: 'set-zero' },
          { op: 'counterChange', delta: 1, blockId: 'add-one' },
        ],
      },
      {
        id: 'thread-b',
        startBlockId: 'start-b',
        nodes: [
          {
            op: 'if',
            blockId: 'counter-if',
            condition: { kind: 'counter', operator: 'EQ', value: 0 },
            consequent: [
              {
                op: 'led',
                deviceId: led.id,
                brightness: 100,
                blockId: 'led-on',
              },
            ],
            otherwise: [
              {
                op: 'led',
                deviceId: led.id,
                brightness: 0,
                blockId: 'led-off',
              },
            ],
          },
        ],
      },
    ],
  },
});
send({ type: 'RUN' });
advance(16);
assert.equal(latestState().status, 'done');
assert.equal(latestState().counter, 1);
assert.equal(latestState().devices[led.id].brightness, 0);

// Audio sigue el reloj virtual: pausa cancela el nodo audible y reanudar vuelve
// a emitir sólo el tiempo restante, sin dejar osciladores huérfanos.
resetMessages();
send({
  type: 'LOAD',
  scene,
  program: {
    version: 2,
    threads: [
      {
        id: 'sound-thread',
        startBlockId: 'sound-start',
        nodes: [
          {
            op: 'tone',
            deviceId: buzzer.id,
            frequency: 440,
            durationMs: 500,
            blockId: 'play-tone',
          },
          { op: 'wait', ms: 1000, blockId: 'wait-tone' },
        ],
      },
    ],
  },
});
send({ type: 'RUN' });
advance(16);
assert.ok(messages.some((message) => message.type === 'SOUND'));
const soundStopsBeforePause = messages.filter(
  (message) => message.type === 'SOUND_STOP',
).length;
send({ type: 'PAUSE' });
assert.equal(latestState().status, 'paused');
assert.ok(
  messages.filter((message) => message.type === 'SOUND_STOP').length >
    soundStopsBeforePause,
);
const soundsWhilePaused = messages.filter(
  (message) => message.type === 'SOUND',
).length;
for (let index = 0; index < 10; index += 1) advance(16);
assert.equal(
  messages.filter((message) => message.type === 'SOUND').length,
  soundsWhilePaused,
);
send({ type: 'RUN' });
assert.ok(
  messages.filter((message) => message.type === 'SOUND').length >
    soundsWhilePaused,
);

// Un bucle muy rápido no debe producir miles de eventos DOM por segundo.
resetMessages();
send({
  type: 'LOAD',
  scene,
  program: {
    version: 2,
    threads: [
      {
        id: 'fast-thread',
        startBlockId: 'fast-start',
        nodes: [
          {
            op: 'repeat',
            count: -1,
            blockId: 'forever',
            body: [{ op: 'counterChange', delta: 1, blockId: 'fast-counter' }],
          },
        ],
      },
    ],
  },
});
send({ type: 'RUN' });
for (let index = 0; index < 63; index += 1) advance(16);
const activityMessages = messages.filter(
  (message) => message.type === 'BLOCK_ACTIVE' && message.blockId,
);
assert.ok(activityMessages.length > 0);
assert.equal(latestState().counter, 63);
assert.ok(
  activityMessages.length <= 26,
  `se emitieron demasiados resaltados: ${activityMessages.length}`,
);
send({ type: 'PAUSE' });
const counterAtPause = latestState().counter;
for (let index = 0; index < 10; index += 1) advance(16);
assert.equal(latestState().counter, counterAtPause);
send({ type: 'STOP' });
assert.equal(latestState().status, 'stopped');

// El contador comparte redondeo y saturación int32 con el sketch generado.
resetMessages();
send({
  type: 'LOAD',
  scene: baseScene([]),
  program: {
    version: 2,
    threads: [
      {
        id: 'counter-bounds',
        startBlockId: 'counter-bounds-start',
        nodes: [
          { op: 'counterSet', value: 2147483647, blockId: 'set-max' },
          { op: 'counterChange', delta: 1, blockId: 'overflow-max' },
          { op: 'counterSet', value: -2147483648, blockId: 'set-min' },
          { op: 'counterChange', delta: -1, blockId: 'overflow-min' },
        ],
      },
    ],
  },
});
send({ type: 'STEP' });
assert.equal(latestState().counter, 2147483647);
send({ type: 'STEP' });
assert.equal(latestState().counter, 2147483647);
send({ type: 'STEP' });
assert.equal(latestState().counter, -2147483648);
send({ type: 'STEP' });
assert.equal(latestState().counter, -2147483648);

// Un objetivo inexistente bloquea la simulación, pero las advertencias de
// cableado (como los pines nulos del robot de esta escena) no lo hacen.
send({
  type: 'LOAD',
  scene,
  program: {
    version: 2,
    threads: [
      {
        id: 'invalid-target-thread',
        startBlockId: 'invalid-target-start',
        nodes: [
          {
            op: 'led',
            deviceId: 'missing-led',
            brightness: 100,
            blockId: 'invalid-led',
          },
        ],
      },
    ],
  },
});
assert.equal(
  messages.findLast((message) => message.type === 'DIAGNOSTICS')
    .simulationBlocked,
  true,
);
send({ type: 'RUN' });
assert.equal(latestState().status, 'idle');

// Mensajes espera cooperativamente y elige la rama a partir de un botón de
// entrada predefinido, sin confundir una recepción con el monitor USB.
const link = {
  schemaVersion: 1, id: 'messages-test', kind: 'messages', name: 'Robot del portón',
  position: { x: 80, y: 80 }, rotation: 0, pins: { tx: 17, rx: 16 },
  config: { mode: 'both', baudRate: 9600, messages: ['AVANZAR', 'DETENER'] },
};
send({
  type: 'LOAD', scene: baseScene([link]), program: { version: 2, threads: [{
    id: 'messages-thread', startBlockId: 'messages-start', nodes: [{
      op: 'messageReceive', deviceId: link.id, expected: 'DETENER', timeoutMs: 5000, blockId: 'receive',
      equal: [{ op: 'serial', text: '', expression: { kind: 'join', parts: [{ kind: 'text', value: 'rama igual: ' }, { kind: 'messageValue', deviceId: link.id }] }, blockId: 'equal' }],
      different: [{ op: 'serial', text: 'rama distinta', blockId: 'different' }],
      timeout: [{ op: 'serial', text: 'rama timeout', blockId: 'timeout' }],
    }],
  }] },
});
send({ type: 'RUN' });
advance(16);
assert.equal(latestState().execution.tasks[0].status, 'waiting');
send({ type: 'SET_INPUT', deviceId: link.id, value: 'DETENER' });
advance(16);
advance(16);
assert.ok(latestState().console.some(line => line.includes('rama igual: DETENER')));
assert.equal(latestState().devices[link.id].received.at(-1), 'DETENER');

// El texto de la matriz arranca en segundo plano: el mismo camino continúa y
// sólo el bloque de espera explícito se detiene.
const matrix = {
  schemaVersion: 1, id: 'matrix-test', kind: 'ledMatrix', name: 'Cartel',
  position: { x: 120, y: 90 }, rotation: 0, pins: { din: 26, clk: 25, cs: 27 }, config: ledMatrixConfig(),
};
send({ type: 'LOAD', scene: baseScene([matrix]), program: { version: 2, threads: [
  { id: 'matrix-thread', startBlockId: 'matrix-start', nodes: [
    { op: 'matrixPattern', deviceId: matrix.id, patternId: 'heart', blockId: 'pattern' },
    { op: 'matrixScroll', deviceId: matrix.id, text: 'HOLA', speedMs: 40, repeatCount: 0, blockId: 'scroll' },
    { op: 'counterChange', delta: 1, blockId: 'same-path-counter' },
    { op: 'visualWait', deviceId: matrix.id, blockId: 'wait-matrix' },
    { op: 'serial', text: 'matriz lista', blockId: 'matrix-done' },
  ] },
  { id: 'counter-thread', startBlockId: 'counter-start', nodes: [
    { op: 'counterChange', delta: 1, blockId: 'counter-during-scroll' },
    { op: 'wait', ms: 64, blockId: 'wait-before-clear' },
    { op: 'matrixClear', deviceId: matrix.id, blockId: 'cancel-scroll' },
  ] },
] } });
send({ type: 'RUN' });
advance(16); advance(16); advance(16);
assert.equal(latestState().devices[matrix.id].scrolling, true);
assert.equal(latestState().counter, 2);
assert.equal(latestState().execution.tasks[0].status, 'waiting');
for (let turn = 0; turn < 8 && latestState().status !== 'done'; turn++) advance(16);
assert.equal(latestState().status, 'done');
assert.equal(latestState().devices[matrix.id].scrolling, false);
assert.ok(latestState().console.some(line => line.includes('matriz lista')));

// Variables tipadas y textos dinámicos comparten semántica con el firmware.
send({ type: 'LOAD', scene: baseScene([]), program: {
  version: 2,
  variables: [
    { id: 'score', name: 'puntos', type: 'number' },
    { id: 'label', name: 'saludo', type: 'text' },
    { id: 'ready', name: 'listo', type: 'boolean' },
  ],
  threads: [{ id: 'variables-thread', startBlockId: 'variables-start', nodes: [
    { op: 'counterSet', value: 7, blockId: 'counter-seven' },
    { op: 'variableSet', variableId: 'score', value: { kind: 'math', operator: 'ADD', left: { kind: 'counterValue' }, right: { kind: 'number', value: 5 } }, blockId: 'score-set' },
    { op: 'variableSet', variableId: 'label', value: { kind: 'text', value: 'El contador está en ' }, blockId: 'label-set' },
    { op: 'variableSet', variableId: 'ready', value: { kind: 'boolean', value: true }, blockId: 'ready-set' },
    { op: 'serial', text: '', expression: { kind: 'join', parts: [{ kind: 'variable', variableId: 'label', valueType: 'text' }, { kind: 'counterValue' }] }, blockId: 'dynamic-text' },
    { op: 'if', condition: { kind: 'value', expression: { kind: 'variable', variableId: 'ready', valueType: 'boolean' } }, consequent: [{ op: 'serial', text: 'listo', blockId: 'ready-message' }], otherwise: [], blockId: 'ready-if' },
    { op: 'if', condition: { kind: 'valueCompare', operator: 'EQ', left: { kind: 'variable', variableId: 'score', valueType: 'number' }, right: { kind: 'number', value: 12 } }, consequent: [{ op: 'serial', text: 'doce puntos', blockId: 'score-message' }], otherwise: [], blockId: 'score-if' },
  ] }],
} });
send({ type: 'RUN' });
for (let turn = 0; turn < 8 && latestState().status !== 'done'; turn++) advance(16);
assert.equal(latestState().variables.score, 12);
assert.equal(latestState().variables.label, 'El contador está en ');
assert.equal(latestState().variables.ready, true);
assert.ok(latestState().console.some(line => line.includes('El contador está en 7')));
assert.ok(latestState().console.some(line => line.endsWith('listo')));
assert.ok(latestState().console.some(line => line.endsWith('doce puntos')));

// Los temporizadores generan eventos cooperativos: esperar uno no impide que
// otro camino continúe y el valor restante se puede consultar.
send({ type: 'LOAD', scene: baseScene([]), program: {
  version: 2,
  timers: [{ id: 'timer-pulse', name: 'Pulso' }],
  threads: [
    { id: 'timer-thread', startBlockId: 'timer-start', nodes: [
      { op: 'timerStart', timerId: 'timer-pulse', durationMs: 160, repeat: true, blockId: 'start-pulse' },
      { op: 'parallel', blockId: 'parallel-timer', branches: [
        [
          { op: 'timerWait', timerId: 'timer-pulse', blockId: 'wait-first-pulse' },
          { op: 'counterChange', delta: 10, blockId: 'after-pulse' },
        ],
        [
          { op: 'wait', ms: 16, blockId: 'short-wait' },
          { op: 'counterChange', delta: 1, blockId: 'parallel-counter' },
        ],
      ] },
    ] },
  ],
} });
send({ type: 'RUN' });
for (let turn = 0; turn < 8 && latestState().counter === 0; turn++) advance(16);
assert.equal(latestState().counter, 1, 'el camino paralelo debe avanzar mientras espera el temporizador');
assert.equal(latestState().timers['timer-pulse'].status, 'running');
assert.ok(latestState().timers['timer-pulse'].remainingMs > 0);
for (let turn = 0; turn < 16 && latestState().status !== 'done'; turn++) advance(16);
assert.equal(latestState().counter, 11);
assert.equal(latestState().status, 'done');

// La barrera es una entrada digital infantil (libre/interrumpida), utilizable
// como cualquier dato sí/no dentro de una bifurcación.
send({
  type: 'LOAD',
  scene,
  program: { version: 2, threads: [{ id: 'barrier-thread', startBlockId: 'barrier-start', nodes: [{
    op: 'if',
    condition: { kind: 'value', expression: { kind: 'barrierValue', deviceId: barrier.id, expected: 'INTERRUPTED' } },
    consequent: [{ op: 'led', deviceId: led.id, brightness: 100, blockId: 'barrier-blocked' }],
    otherwise: [{ op: 'led', deviceId: led.id, brightness: 0, blockId: 'barrier-clear' }],
    blockId: 'barrier-if',
  }] }] },
});
send({ type: 'RUN' });
for (let turn = 0; turn < 4 && latestState().status !== 'done'; turn++) advance(16);
assert.equal(latestState().devices[led.id].brightness, 100);

console.log('Simulator worker smoke checks passed.');
