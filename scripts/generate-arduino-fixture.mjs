import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { generateEsp32CodeResult } from '../lib/capiblocks.ts';
import { composeSceneTemplates } from '../lib/scene-model.ts';

const outputArgument = process.argv[2];
if (!outputArgument) {
  throw new Error(
    'Uso: node --experimental-strip-types scripts/generate-arduino-fixture.mjs <ruta/sketch.ino>',
  );
}

const scene = composeSceneTemplates(
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
