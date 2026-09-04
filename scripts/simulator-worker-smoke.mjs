import assert from 'node:assert/strict';

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
const scene = baseScene([button, led, robot, buzzer]);

// Las entradas explícitas deben sobrevivir aunque lleguen antes de LOAD y
// también entre RUN y RESET.
send({ type: 'SET_INPUT', deviceId: button.id, value: true });
send({ type: 'SET_INPUT', name: 'wifiAvailable', value: false });
send({
  type: 'LOAD',
  scene,
  program: { version: 2, threads: [] },
});
assert.equal(latestState().devices[button.id].pressed, true);
assert.equal(latestState().wifiAvailable, false);
assert.equal(latestState().devices[robot.id].angle, 90);
send({ type: 'RUN' });
assert.equal(latestState().devices[button.id].pressed, true);
assert.equal(latestState().wifiAvailable, false);
send({ type: 'RESET' });
assert.equal(latestState().devices[button.id].pressed, true);
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

console.log('Simulator worker smoke checks passed.');
