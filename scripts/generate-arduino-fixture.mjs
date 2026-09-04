import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { generateEsp32CodeResult } from '../lib/capiblocks.ts';
import {
  addDeviceToScene,
  composeSceneTemplates,
  createEmptyScene,
} from '../lib/scene-model.ts';

const outputArgument = process.argv[2];
if (!outputArgument) {
  throw new Error(
    'Uso: node --experimental-strip-types scripts/generate-arduino-fixture.mjs <ruta/sketch.ino>',
  );
}

let scene = composeSceneTemplates(
  ['traffic', 'robot', 'counter'],
  'Fixture Arduino CI',
).scene;
const traffic = scene.devices.find((device) => device.kind === 'trafficLight');
const robot = scene.devices.find((device) => device.kind === 'robot');
const buzzer = scene.devices.find((device) => device.kind === 'passiveBuzzer');

if (!traffic || !robot || !buzzer) {
  throw new Error('No se pudo construir la escena representativa para CI.');
}

const program = {
  version: 2,
  threads: [
    {
      id: 'traffic-thread',
      startBlockId: 'traffic-start',
      nodes: [
        {
          op: 'repeat',
          count: -1,
          blockId: 'traffic-loop',
          body: [
            {
              op: 'traffic',
              deviceId: traffic.id,
              color: 'RED',
              blockId: 'traffic-red',
            },
            { op: 'wait', ms: 500, blockId: 'traffic-wait-red' },
            {
              op: 'traffic',
              deviceId: traffic.id,
              color: 'GREEN',
              blockId: 'traffic-green',
            },
            { op: 'wait', ms: 500, blockId: 'traffic-wait-green' },
          ],
        },
      ],
    },
    {
      id: 'robot-thread',
      startBlockId: 'robot-start',
      nodes: [
        {
          op: 'robot',
          deviceId: robot.id,
          action: 'FORWARD',
          speed: 45,
          blockId: 'robot-forward',
        },
        { op: 'wait', ms: 250, blockId: 'robot-wait' },
        {
          op: 'robot',
          deviceId: robot.id,
          action: 'STOP',
          speed: 0,
          blockId: 'robot-stop',
        },
        {
          op: 'tone',
          deviceId: buzzer.id,
          frequency: 660,
          durationMs: 120,
          blockId: 'finish-tone',
        },
      ],
    },
  ],
};

// Two physical circuits keep the fixture within the board's real GPIO budget.
// Together they compile every operation and condition emitted by the editor.
const auxiliary = process.argv[3] === 'auxiliary';
if (auxiliary) {
  scene = createEmptyScene('Motor y buzzer activo');
  for (const kind of ['motor', 'activeBuzzer']) {
    scene = addDeviceToScene(scene, kind).scene;
  }
  const motor = scene.devices.find((device) => device.kind === 'motor');
  const activeBuzzer = scene.devices.find(
    (device) => device.kind === 'activeBuzzer',
  );
  program.threads = [
    {
      id: 'auxiliary',
      startBlockId: 'auxiliary-start',
      nodes: [
        {
          op: 'motor',
          deviceId: motor.id,
          direction: 'BACKWARD',
          power: 60,
          blockId: 'motor-power',
        },
        {
          op: 'buzzer',
          deviceId: activeBuzzer.id,
          kind: 'ACTIVE',
          frequency: 1000,
          durationMs: 100,
          blockId: 'active-tone',
        },
        { op: 'pin', pin: 18, value: true, blockId: 'raw-output' },
        { op: 'wait', ms: 100, blockId: 'motor-wait' },
        {
          op: 'motor',
          deviceId: motor.id,
          direction: 'STOP',
          power: 0,
          blockId: 'motor-stop',
        },
      ],
    },
  ];
} else {
  for (const kind of [
    'led',
    'servo',
    'button',
    'lightSensor',
    'potentiometer',
    'wifiNode',
  ]) {
    scene = addDeviceToScene(scene, kind).scene;
  }
  const device = (kind) => scene.devices.find((item) => item.kind === kind);
  device('servo').config.angle = 37;
  const conditions = [
    { kind: 'counter', operator: 'GTE', value: 3 },
    { kind: 'compare', operator: 'NEQ', left: 2, right: 7 },
    { kind: 'buttonPressed', deviceId: device('button').id },
    {
      kind: 'sensor',
      sensor: 'LIGHT',
      deviceId: device('lightSensor').id,
      operator: 'LT',
      value: 40,
    },
    {
      kind: 'sensor',
      sensor: 'POTENTIOMETER',
      deviceId: device('potentiometer').id,
      operator: 'GT',
      value: 60,
    },
    { kind: 'wifiConnected' },
    { kind: 'boolean', value: true },
  ];
  program.threads.push({
    id: 'controls',
    startBlockId: 'controls-start',
    nodes: [
      { op: 'counterSet', value: 2147483647, blockId: 'counter-set' },
      { op: 'counterChange', delta: 5, blockId: 'counter-saturate' },
      { op: 'counterSet', value: -2147483648, blockId: 'counter-min' },
      { op: 'counterChange', delta: -5, blockId: 'counter-negative' },
      {
        op: 'led',
        deviceId: device('led').id,
        brightness: 65,
        blockId: 'led-brightness',
      },
      {
        op: 'servo',
        deviceId: device('servo').id,
        angle: 120,
        blockId: 'servo-position',
      },
      {
        op: 'buzzer',
        deviceId: buzzer.id,
        kind: 'PASSIVE',
        frequency: 880,
        durationMs: 100,
        blockId: 'passive-tone',
      },
      { op: 'wifi', timeoutMs: 1000, blockId: 'connect-wifi' },
      {
        op: 'repeat',
        count: 3,
        blockId: 'finite-loop',
        body: [{ op: 'counterChange', delta: 1, blockId: 'count-iteration' }],
      },
      ...conditions.map((condition, index) => ({
        op: 'if',
        condition,
        blockId: `condition-${index}`,
        consequent: [
          {
            op: 'serial',
            text: `Sí ${index}: "OK"\\\n`,
            blockId: `yes-${index}`,
          },
        ],
        otherwise: [
          { op: 'serial', text: `No ${index}`, blockId: `no-${index}` },
        ],
      })),
    ],
  });
}

const generated = generateEsp32CodeResult(program, 'Fixture Arduino CI', scene);
const errors = generated.diagnostics.filter(
  (diagnostic) => diagnostic.severity === 'error',
);
if (errors.length) {
  throw new Error(
    `El fixture produjo errores:\n${errors.map(({ message }) => `- ${message}`).join('\n')}`,
  );
}

const outputPath = resolve(outputArgument);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, generated.code, 'utf8');
console.log(outputPath);
