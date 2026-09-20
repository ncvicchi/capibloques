import assert from 'node:assert/strict';
import { boardProfile, projectTargetForBoard } from '../lib/board-profiles.ts';
import { addDeviceToScene, assignSafePins, createEmptyScene, validateScene } from '../lib/scene-model.ts';
import { decodeProject, generateEsp32CodeResult, makeProject } from '../lib/capiblocks.ts';
import { espIdfProjectFiles } from '../lib/firmware-archive.ts';

const s3Id = 'diymall-esp32-s3-devkitc-v1-n16r8';
const s3 = boardProfile(s3Id);
assert.equal(s3.chip, 'ESP32-S3');
assert.equal(s3.flashBytes, 16 * 1024 * 1024);
assert.equal(s3.psramBytes, 8 * 1024 * 1024);
assert.equal(s3.pins.some(pin => [35, 36, 37].includes(pin.gpio)), false);

let scene = createEmptyScene('Perfil S3');
for (const kind of ['trafficLight', 'servo', 'passiveBuzzer', 'button', 'lightSensor', 'messages']) {
  scene = addDeviceToScene(scene, kind, { boardProfile: s3Id }).scene;
}
scene = assignSafePins(scene, { boardProfile: s3Id, reassignAll: true }).scene;
assert.equal(validateScene(scene, s3Id).issues.some(issue => ['missing-pin', 'unsupported-pin', 'pin-conflict'].includes(issue.code)), false);
assert.equal(scene.devices.flatMap(device => Object.values(device.pins)).some(pin => [35, 36, 37].includes(pin)), false);

const target = projectTargetForBoard(s3Id);
const project = makeProject('S3 guardada', scene, {}, 1, target);
assert.deepEqual(decodeProject(project).project?.target, target);
const wrong = structuredClone(project);
wrong.scene.devices[0].pins.red = 35;
const decodedWrong = decodeProject(wrong);
assert.ok(decodedWrong.project);
assert.ok(decodedWrong.diagnostics.some(issue => issue.code === 'scene-unsupported-pin'));

const traffic = scene.devices.find(device => device.kind === 'trafficLight');
const program = { version: 2, threads: [{ id: 'start', startBlockId: 'start', nodes: [{ op: 'traffic', deviceId: traffic.id, color: 'GREEN', blockId: 'green' }] }] };
const arduino = generateEsp32CodeResult(program, 'S3', scene, 'arduino', s3Id);
const idf = generateEsp32CodeResult(program, 'S3', scene, 'esp-idf', s3Id);
const wrongGenerated = generateEsp32CodeResult(program, 'S3 cruzada', wrong.scene, 'arduino', s3Id);
assert.match(arduino.code, /esp32:esp32:esp32s3/);
assert.match(arduino.code, /ledcAttach\([^\n]+, 50, 14\)/);
assert.match(idf.code, /CONFIG_IDF_TARGET_ESP32S3/);
assert.doesNotMatch(idf.code, /LEDC_HIGH_SPEED_MODE/);
assert.doesNotMatch(idf.code, /LEDC_TIMER_16_BIT/);
assert.match(idf.code, /LEDC_TIMER_14_BIT/);
assert.ok((await import('../lib/idf-runtime.ts')).allocateIdfPwm(scene, s3Id).filter(item => scene.devices.find(device => device.kind === 'servo' && device.pins.signal === item.pin)).every(item => item.resolution === 14));
assert.match(espIdfProjectFiles(idf)['main/CMakeLists.txt'], /freertos esp_psram\)/);
assert.equal(arduino.diagnostics.some(issue => issue.severity === 'error'), false);
assert.ok(wrongGenerated.diagnostics.some(issue => issue.severity === 'error' && issue.code === 'scene-unsupported-pin'));

const wemos = makeProject('Compatible', createEmptyScene(), {}, 1);
assert.deepEqual(wemos.target, { family: 'esp32', framework: 'arduino', coreMajor: 3, coreVersion: '3.3.11', boardProfile: 'wemos-d1-r32', fqbn: 'esp32:esp32:d1_uno32' });
console.log('Board profiles: S3 N16R8 persistence, safe pins, cross-board rejection, Arduino/IDF targets and Wemos compatibility passed.');
