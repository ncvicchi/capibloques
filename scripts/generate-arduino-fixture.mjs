import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { generateEsp32CodeResult } from '../lib/capiblocks.ts';
import { firmwareFixture, matrixFirmwareFixture } from './firmware-fixtures.mjs';
import { createSceneFromTemplate, addDeviceToScene, assignSafePins } from '../lib/scene-model.ts';

const outputArgument = process.argv[2];
if (!outputArgument) throw new Error('Indicar ruta/sketch.ino');
const s3 = process.argv[3] === 's3';
let fixture = process.argv[3] === 'matrix' ? matrixFirmwareFixture() : firmwareFixture(process.argv[3] === 'auxiliary');
if (s3) {
  let scene = createSceneFromTemplate('traffic');
  scene = addDeviceToScene(scene, 'servo', { boardProfile: 'diymall-esp32-s3-devkitc-v1-n16r8' }).scene;
  scene = addDeviceToScene(scene, 'passiveBuzzer', { boardProfile: 'diymall-esp32-s3-devkitc-v1-n16r8' }).scene;
  scene = assignSafePins(scene, { boardProfile: 'diymall-esp32-s3-devkitc-v1-n16r8', reassignAll: true }).scene;
  const traffic = scene.devices.find(device => device.kind === 'trafficLight');
  const servo = scene.devices.find(device => device.kind === 'servo');
  const buzzer = scene.devices.find(device => device.kind === 'passiveBuzzer');
  fixture = { scene, program: { version: 2, threads: [{ id: 's3', startBlockId: 's3-start', nodes: [{ op: 'traffic', deviceId: traffic.id, color: 'GREEN', blockId: 'green' }, { op: 'servo', deviceId: servo.id, angle: 90, blockId: 'servo' }, { op: 'tone', deviceId: buzzer.id, frequency: 440, durationMs: 100, blockId: 'tone' }, { op: 'wait', ms: 500, blockId: 'wait' }, { op: 'traffic', deviceId: traffic.id, color: 'RED', blockId: 'red' }] }] } };
}
const { scene, program } = fixture;
const generated = generateEsp32CodeResult(program, 'Fixture Arduino CI', scene, 'arduino', s3 ? 'diymall-esp32-s3-devkitc-v1-n16r8' : 'wemos-d1-r32');
const errors = generated.diagnostics.filter(item => item.severity === 'error');
if (errors.length) throw new Error(JSON.stringify(errors));
const outputPath = resolve(outputArgument);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, generated.code, 'utf8');
console.log(outputPath);
