import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { firmwareFixture, matrixFirmwareFixture, ottoFirmwareFixture, smartLightsFirmwareFixture } from './firmware-fixtures.mjs';
import { generateEspIdfCodeResult } from '../lib/capiblocks.ts';
import { addDeviceToScene, assignSafePins, createEmptyScene, createSceneFromTemplate } from '../lib/scene-model.ts';
import { displayConfig, displayProfiles, displayTargets } from '../lib/display-model.ts';
import { espIdfProjectFiles, createEspIdfArchive } from '../lib/firmware-archive.ts';

const fixtures = [['main', firmwareFixture()], ['auxiliary', firmwareFixture(true)], ['matrix', matrixFirmwareFixture()], ['otto', ottoFirmwareFixture()], ['smart-lights', smartLightsFirmwareFixture()]];
let s3Scene = createSceneFromTemplate('traffic');
s3Scene = addDeviceToScene(s3Scene, 'servo', { boardProfile: 'diymall-esp32-s3-devkitc-v1-n16r8' }).scene;
s3Scene = addDeviceToScene(s3Scene, 'passiveBuzzer', { boardProfile: 'diymall-esp32-s3-devkitc-v1-n16r8' }).scene;
s3Scene = assignSafePins(s3Scene, { boardProfile: 'diymall-esp32-s3-devkitc-v1-n16r8', reassignAll: true }).scene;
const s3Traffic = s3Scene.devices.find(device => device.kind === 'trafficLight');
const s3Servo = s3Scene.devices.find(device => device.kind === 'servo');
const s3Buzzer = s3Scene.devices.find(device => device.kind === 'passiveBuzzer');
fixtures.push(['s3', { boardProfile: 'diymall-esp32-s3-devkitc-v1-n16r8', scene: s3Scene, program: { version: 2, threads: [{ id: 's3', startBlockId: 's3-start', nodes: [{ op: 'traffic', deviceId: s3Traffic.id, color: 'GREEN', blockId: 'green' }, { op: 'servo', deviceId: s3Servo.id, angle: 90, blockId: 'servo' }, { op: 'tone', deviceId: s3Buzzer.id, frequency: 440, durationMs: 100, blockId: 'tone' }, { op: 'wait', ms: 500, blockId: 'wait' }, { op: 'traffic', deviceId: s3Traffic.id, color: 'RED', blockId: 'red' }] }] } }]);
for (const profile of Object.keys(displayProfiles)) {
  const boardProfile = profile === 'waveshare5' ? 'waveshare-esp32-s3-touch-lcd-5-28117' : 'wemos-d1-r32';
  const { scene, device } = addDeviceToScene(createEmptyScene('Pantalla'), 'display', { config: displayConfig(profile), boardProfile });
  const led = profile === 'waveshare5' ? { scene, device: null } : addDeviceToScene(scene, 'led');
  const areaId = displayTargets(device.config)[0].id;
  fixtures.push([profile, { scene: led.scene, program: { version: 2, threads: [{ id: 'start', startBlockId: 'start', nodes: [
    { op: 'parallel', blockId: 'together', branches: [
      [{ op: 'displayWrite', deviceId: device.id, areaId, text: 'Hola ESP32!\nListo', blockId: 'write' }, ...(displayProfiles[profile].graphic ? [{ op: 'displayAnimateText', deviceId: device.id, areaId, text: 'Hola animado', effect: 'blink', repeatCount: 2, blockId: 'animate' }, { op: 'visualWait', deviceId: device.id, blockId: 'wait-animation' }, { op: 'displayArtwork', deviceId: device.id, artworkId: 'builtin-capybara', effect: 'slide', repeatCount: 1, blockId: 'artwork' }] : []), { op: 'wait', ms: 2000, blockId: 'wait' }, { op: 'displayClear', deviceId: device.id, areaId, blockId: 'clear' }],
      [...(led.device ? [{ op: 'led', deviceId: led.device.id, brightness: 50, blockId: 'led' }] : []), { op: 'serial', text: 'Consola independiente', blockId: 'serial' }],
    ] },
  ] }] }, boardProfile }]);
}
for (const [name, { scene, program, boardProfile = 'wemos-d1-r32' }] of fixtures) {
  const generated = generateEspIdfCodeResult(program, 'Fixture ESP-IDF CI', scene, boardProfile);
  const errors = generated.diagnostics.filter(item => item.severity === 'error');
  if (errors.length) throw new Error(`${name}: ${JSON.stringify(errors)}`);
  const files = espIdfProjectFiles(generated);
  for (const [path, contents] of Object.entries(files)) {
    const output = resolve('.idf-ci', name, path);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, contents);
  }
  await writeFile(resolve('.idf-ci', `${name}.zip`), await createEspIdfArchive(generated));
  console.log(`${name}: native ESP-IDF source + ZIP generated`);
}
