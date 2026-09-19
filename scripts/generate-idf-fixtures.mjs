import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { firmwareFixture, matrixFirmwareFixture } from './firmware-fixtures.mjs';
import { generateEspIdfCodeResult } from '../lib/capiblocks.ts';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model.ts';
import { displayConfig, displayProfiles, displayTargets } from '../lib/display-model.ts';
import { espIdfProjectFiles, createEspIdfArchive } from '../lib/firmware-archive.ts';

const fixtures = [['main', firmwareFixture()], ['auxiliary', firmwareFixture(true)], ['matrix', matrixFirmwareFixture()]];
for (const profile of Object.keys(displayProfiles)) {
  const { scene, device } = addDeviceToScene(createEmptyScene('Pantalla'), 'display', { config: displayConfig(profile) });
  const led = addDeviceToScene(scene, 'led');
  const areaId = displayTargets(device.config)[0].id;
  fixtures.push([profile, { scene: led.scene, program: { version: 2, threads: [{ id: 'start', startBlockId: 'start', nodes: [
    { op: 'parallel', blockId: 'together', branches: [
      [{ op: 'displayWrite', deviceId: device.id, areaId, text: 'Hola ESP32!\nListo', blockId: 'write' }, ...(displayProfiles[profile].graphic ? [{ op: 'displayAnimateText', deviceId: device.id, areaId, text: 'Hola animado', effect: 'blink', repeatCount: 2, blockId: 'animate' }, { op: 'visualWait', deviceId: device.id, blockId: 'wait-animation' }, { op: 'displayArtwork', deviceId: device.id, artworkId: 'builtin-capybara', effect: 'slide', repeatCount: 1, blockId: 'artwork' }] : []), { op: 'wait', ms: 2000, blockId: 'wait' }, { op: 'displayClear', deviceId: device.id, areaId, blockId: 'clear' }],
      [{ op: 'led', deviceId: led.device.id, brightness: 50, blockId: 'led' }, { op: 'serial', text: 'Consola independiente', blockId: 'serial' }],
    ] },
  ] }] } }]);
}
for (const [name, { scene, program }] of fixtures) {
  const generated = generateEspIdfCodeResult(program, 'Fixture ESP-IDF CI', scene);
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
