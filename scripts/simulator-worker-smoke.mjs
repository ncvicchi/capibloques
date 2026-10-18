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

// Una animación por cuadros no bloquea; esperar es explícito y se conserva el último cuadro.
matrix.config.animations = [{ id: 'frames', name: 'Cuadros', frameMs: 64, frames: [Array(8).fill(1), Array(8).fill(2)] }];
send({ type: 'LOAD', scene: baseScene([matrix]), program: { version: 2, threads: [{ id: 'frames', startBlockId: 'frames-start', nodes: [
  { op: 'frameAnimation', deviceId: matrix.id, animationId: 'frames', repeatCount: 2, blockId: 'show-frames' },
  { op: 'counterChange', delta: 1, blockId: 'nonblocking' },
  { op: 'visualWait', deviceId: matrix.id, blockId: 'wait-frames' },
  { op: 'counterChange', delta: 10, blockId: 'after-frames' },
] }] } });
send({ type: 'RUN' });
advance(16); advance(16); advance(16);
assert.equal(latestState().counter, 1);
assert.equal(latestState().devices[matrix.id].scrolling, true);
for (let turn = 0; turn < 40 && latestState().status !== 'done'; turn++) advance(16);
assert.equal(latestState().counter, 11);
assert.deepEqual(latestState().devices[matrix.id].rows, Array(8).fill(2));
assert.equal(latestState().devices[matrix.id].scrolling, false);
// Paso a nivel: las condiciones leen la ocupación automática del tren, no
// eventos mágicos ni entradas manuales que compitan con el mundo.
// Compilar los bloques que abre el usuario, no una solución de test distinta.
const Blockly = await import('blockly');
const { registerBlocks, workspaceDevices, compileWorkspace } = await import('../lib/blockly-engine.ts');
const { examples, validateProgramForScene } = await import('../lib/capiblocks.ts');
registerBlocks(Blockly);
for (const [railwayExampleId, railwaySpeed] of ['railCrossing', 'railCrossingProcedures', 'railCrossing2', 'railCrossing4'].flatMap(id => [[id, 1], [id, 4]])) {
const railwayScene = examples.find(example => example.id === railwayExampleId).scene;
const railwayWorkspace = new Blockly.Workspace();
workspaceDevices.set(railwayWorkspace, railwayScene.devices);
Blockly.serialization.workspaces.load(structuredClone(examples.find(example => example.id === railwayExampleId).workspace), railwayWorkspace);
const railwayProgram = compileWorkspace(railwayWorkspace);
assert.deepEqual(validateProgramForScene(railwayProgram, railwayScene).filter(item => item.severity === 'error'), []);
railwayWorkspace.dispose();
send({ type: 'LOAD', scene: railwayScene, program: railwayProgram });
assert.ok(latestState().railWorld);
send({ type: 'SET_INPUT', deviceId: 'rail-westDetector', value: true });
assert.equal(latestState().devices['rail-westDetector'].interrupted, false, 'el detector vinculado no admite entrada manual');
send({ type: 'SET_SPEED', speed: railwaySpeed });
send({ type: 'RUN' });
let railDetected = false, railClosed = false, railReopened = false;
const railDirections = new Set();
let railLights = false, railAlarm = false;
let simultaneous = 0, pendingMax = 0, departuresWithOthers = 0, lastPending = 0;
for (let i = 0; i < 12000 / railwaySpeed; i++) {
  advance(16);
  const current = latestState();
  current.railWorld.trains.forEach(train => railDirections.add(train.direction));
  simultaneous = Math.max(simultaneous, current.railWorld.trains.length);
  const pending = Number(current.variables['rail-pending-trains'] ?? 0);
  pendingMax = Math.max(pendingMax, pending);
  if (lastPending > pending && pending > 0) {
    departuresWithOthers++;
    assert.equal(current.devices['rail-northGate'].angle, 0, 'no abrir al salir un tren si quedan otros');
    assert.equal(current.devices['rail-southGate'].angle, 0);
  }
  assert.ok(pending >= 0 && pending <= current.railWorld.trackCount, 'conteo de entradas y salidas acotado');
  lastPending = pending;
  if ([1, 2].every(index => current.devices[`rail-warning-${index}`].brightness === 100)) railLights = true;
  if (current.devices['rail-alarm'].playing) railAlarm = true;
  if (current.devices['rail-westDetector'].interrupted || current.devices['rail-eastDetector'].interrupted) railDetected = true;
  if (current.railWorld.gates.northGate === 0) railClosed = true;
  if (railClosed && current.railWorld.gates.northGate === 90) railReopened = true;
  assert.equal(current.railWorld.collision, null, 'un programa que espera el detector de salida despeja el cruce');
}
assert.ok(railDetected && railClosed && railReopened, 'el circuito sensor → programa → servo → mundo funciona');
assert.deepEqual([...railDirections].sort(), [-1, 1], 'el ejemplo resuelve ambos sentidos');
assert.ok(railLights && railAlarm, 'el ejemplo usa las dos luces y el buzzer');
if (currentTrackCount(railwayScene) > 1) {
  assert.equal(simultaneous, currentTrackCount(railwayScene));
  assert.ok(pendingMax >= 2 && departuresWithOthers > 0, 'concurrencia real con salida parcial sin reapertura');
}
send({ type: 'PAUSE' });
const pausedRail = structuredClone(latestState().railWorld);
advance(100);
assert.deepEqual(latestState().railWorld, pausedRail);
send({ type: 'RESET' });
assert.equal(latestState().railWorld.train, null);
assert.equal(latestState().railWorld.cars.length, 0);
assert.equal(latestState().railWorld.gates.northGate, 90);
assert.equal(latestState().devices['rail-westDetector'].interrupted, false);
send({ type: 'SET_SPEED', speed: 4 }); send({ type: 'RUN' }); advance(100); send({ type: 'PAUSE' });
assert.ok(latestState().railWorld.nextTrainInMs <= 3101, 'el tren usa la velocidad del mismo reloj del programa');
send({ type: 'RESET' }); send({ type: 'STEP' });
assert.ok(latestState().railWorld.nextTrainInMs < 3500, 'Paso también avanza mundo y detectores');
send({ type: 'STOP' });
resetMessages();
}
console.log('Simulator worker smoke checks passed, including automatic railway inputs and cooperative gates.');
function currentTrackCount(scene) { return scene.canvas.railTracks ?? 1; }

// Execute both actual parking workspaces, not a hand-written controller.
for (const exampleId of ['parking', 'parkingProcedures']) for (const capacity of [4, 8, 12]) for (const speed of [1, 4]) {
  const example = examples.find(item => item.id === exampleId);
  const parkingScene = structuredClone(example.scene);
  parkingScene.canvas.parkingCapacity = capacity;
  for (const device of parkingScene.devices) if (device.kind === 'infraredBarrier') device.config.interrupted = true;
  const serialized = structuredClone(example.workspace);
  const setCapacity = value => {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'capi_variable_set_number' && value.fields.VAR.id === 'parking-capacity') value.inputs.VALUE.block.fields.VALUE = capacity;
    Object.values(value).forEach(setCapacity);
  };
  setCapacity(serialized);
  const workspace = new Blockly.Workspace();
  workspaceDevices.set(workspace, parkingScene.devices);
  Blockly.serialization.workspaces.load(serialized, workspace);
  const parkingProgram = compileWorkspace(workspace); workspace.dispose();
  send({ type: 'LOAD', scene: parkingScene, program: parkingProgram });
  assert.ok(parkingScene.devices.filter(device => device.kind === 'infraredBarrier').every(device => latestState().devices[device.id].interrupted === false), 'al cargar manda el mundo vacío, no el ajuste manual del sensor');
  send({ type: 'SET_INPUT', deviceId: 'parking-entryArrival', value: true });
  assert.equal(latestState().devices['parking-entryArrival'].interrupted, false, 'no entrada manual competidora');
  send({ type: 'SET_SPEED', speed }); send({ type: 'RUN' });
  let entered = 0, exited = 0, seenFull = false;
  for (let i = 0; i < 10000 / speed; i++) {
    advance(20);
    const current = latestState();
    const world = current.parkingWorld;
    assert.ok(world, `${exampleId}: el mundo se conserva en el worker`);
    assert.equal(world.jammed, false, `${exampleId}/${capacity}/${speed}: no admitir si no hay plaza`);
    const count = Number(current.variables['parking-occupied']);
    assert.ok(count >= 0 && count <= capacity, 'contador sin duplicados ni valores negativos');
    // Snapshot can fall between sensor clear and the following count statement.
    assert.ok(Math.abs(count - (world.entries - world.exits)) <= 2, `cuenta propia sigue pasos completos: ${JSON.stringify({ exampleId, capacity, speed, now: current.now, count, entries: world.entries, exits: world.exits, cars: world.cars, variables: current.variables })}`);
    entered = world.entries; exited = world.exits; seenFull ||= count === capacity;
    if (i % 500 === 0) { const last = messages.findLast(message => message.type === 'SNAPSHOT'); resetMessages(); if (last) messages.push(last); }
  }
  assert.ok(entered >= 8 && exited >= 3, `${exampleId}/${capacity}/${speed}: entradas y salidas continúan (${entered}/${exited})`);
  if (capacity === 4) assert.ok(seenFull, 'se ejercita la espera por estacionamiento completo');
  send({ type: 'PAUSE' }); const before = structuredClone(latestState().parkingWorld);
  advance(200); assert.deepEqual(latestState().parkingWorld, before);
  send({ type: 'RESET' });
  assert.equal(latestState().parkingWorld.cars.length, 0);
  assert.equal(latestState().parkingWorld.jammed, false);
  assert.equal(latestState().parkingWorld.entries, 0);
  assert.ok(Object.values(latestState().parkingWorld.detectors).every(value => value === false));
  send({ type: 'STEP' }); assert.ok(latestState().parkingWorld.nextArrivalMs < 800);
  send({ type: 'STOP' }); resetMessages();
}
console.log('Estacionamiento: ambos ejemplos ejecutados con 4/8/12 plazas a 1×/4×, cola, conteo, pausa, paso y reinicio aprobados.');

for (const exampleId of ['greenhouse', 'greenhouseProcedures']) for (const speed of [1, 4]) {
  const example = examples.find(item => item.id === exampleId);
  const workspace = new Blockly.Workspace(); workspaceDevices.set(workspace, example.scene.devices);
  Blockly.serialization.workspaces.load(structuredClone(example.workspace), workspace);
  const gardenProgram = compileWorkspace(workspace); workspace.dispose();
  send({ type: 'LOAD', scene: example.scene, program: gardenProgram });
  send({ type: 'SET_INPUT', deviceId: 'garden-outsideSoil', value: { property: 'moisture', value: 99 } });
  assert.equal(latestState().devices['garden-outsideSoil'].values.moisture, 55);
  send({ type: 'SET_INPUT', name: 'gardenEnvironment', value: { sun: 'strong' } });
  assert.equal(latestState().gardenWorld.environment.sun, 'medium', 'rechazar clima incompleto');
  send({ type: 'SET_SPEED', speed }); send({ type: 'RUN' });
  const on = new Set(), off = new Set(); let opened = false, closedAfterOpen = false;
  for (let i = 0; i < 10000 / speed; i++) {
    advance(20); const current = latestState(), world = current.gardenWorld;
    assert.ok(world, 'el mundo está en el worker');
    for (const role of ['outside', 'inside']) {
      assert.ok(world[role].moisture >= 30 && world[role].moisture <= 70, `${exampleId}: riego estable ${role}=${world[role].moisture}`);
      assert.ok(world[role].health >= 85, 'cuidar la planta sin corregir el programa ocultamente');
      const power = Number(current.devices[`garden-${role}Pump`].values.power);
      if (power > 0) on.add(role); else if (on.has(role)) off.add(role);
      assert.ok(Math.abs(current.devices[`garden-${role}Soil`].values.moisture - world[role].moisture) <= 0.5, 'lectura realimentada al algoritmo con resolución de 1%');
    }
    if (world.windowAngle >= 89) opened = true;
    if (opened && world.windowAngle < 1) closedAfterOpen = true;
    if (i % 500 === 0) { const last = messages.findLast(message => message.type === 'SNAPSHOT'); resetMessages(); if (last) messages.push(last); }
  }
  assert.equal(on.size, 2); assert.equal(off.size, 2, 'ambos riegos completaron ciclos');
  if (exampleId === 'greenhouseProcedures') assert.ok(opened && closedAfterOpen, 'ventilar con dos umbrales');
  send({ type: 'PAUSE' }); const before = structuredClone(latestState().gardenWorld); advance(200); assert.deepEqual(latestState().gardenWorld, before);
  send({ type: 'RESET' }); assert.equal(latestState().gardenWorld.outside.moisture, 55); assert.equal(latestState().gardenWorld.inside.health, 90);
  send({ type: 'STEP' }); assert.ok(latestState().gardenWorld.outside.moisture < 55, 'Paso mueve el mismo mundo');
  send({ type: 'STOP' }); resetMessages();
}
console.log('Huerta: workspaces reales directo/modular, histéresis, sensores, ventilación, pausa, paso y reset a 1×/4× aprobados.');
