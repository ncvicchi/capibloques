import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  displayConfig,
  displayProfiles,
  displayTargets,
} from '../lib/display-model.ts';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model.ts';
import { generateEsp32CodeResult } from '../lib/capiblocks.ts';

for (const profile of Object.keys(displayProfiles)) {
  const boardProfile = profile === 'waveshare5' ? 'waveshare-esp32-s3-touch-lcd-5-28117' : 'wemos-d1-r32';
  const { scene, device } = addDeviceToScene(
    createEmptyScene(`Pantalla ${profile}`),
    'display',
    { config: displayConfig(profile), boardProfile },
  );
  const led = profile === 'waveshare5' ? { scene, device: null } : addDeviceToScene(scene, 'led');
  const areaId = displayTargets(device.config)[0].id;
  const generated = generateEsp32CodeResult(
    {
      version: 2,
      threads: [
        {
          id: 'start',
          startBlockId: 'start',
          nodes: [
            {
              op: 'displayWrite',
              deviceId: device.id,
              areaId,
              text: 'Hola ESP32!\nListo',
              blockId: 'write',
            },
            ...(displayProfiles[profile].graphic
              ? [
                  {
                    op: 'displayAnimateText',
                    deviceId: device.id,
                    areaId,
                    text: 'Hola animado',
                    effect: 'scroll',
                    repeatCount: 2,
                    blockId: 'animate',
                  },
                  { op: 'visualWait', deviceId: device.id, blockId: 'wait-animation' },
                  {
                    op: 'displayArtwork',
                    deviceId: device.id,
                    artworkId: 'builtin-robot',
                    effect: 'slide',
                    repeatCount: 1,
                    blockId: 'artwork',
                  },
                ]
              : []),
            ...(led.device ? [{
              op: 'led',
              deviceId: led.device.id,
              brightness: 50,
              blockId: 'light',
            }] : []),
            { op: 'wait', ms: 2000, blockId: 'wait' },
            {
              op: 'displayClear',
              deviceId: device.id,
              areaId,
              blockId: 'clear',
            },
            { op: 'serial', text: 'Mensaje independiente', blockId: 'console' },
          ],
        },
      ],
    },
    `Pantalla ${profile}`,
    led.scene,
    'arduino',
    boardProfile,
  );
  if (generated.diagnostics.some((issue) => issue.severity === 'error'))
    throw new Error(JSON.stringify(generated.diagnostics));
  const directory = resolve('.arduino-ci', profile);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${profile}.ino`), generated.code);
}
