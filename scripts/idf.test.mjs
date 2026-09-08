import assert from 'node:assert/strict';
import { generateEsp32CodeResult, generateEspIdfCodeResult, compileTaskGraph } from '../lib/capiblocks.ts';
import { createEmptyScene, addDeviceToScene } from '../lib/scene-model.ts';
import { allocateIdfPwm } from '../lib/idf-runtime.ts';
import { espIdfProjectFiles, createEspIdfArchive, zipFirmwareFiles } from '../lib/firmware-archive.ts';
import { displayConfig, displayProfiles, displayTargets } from '../lib/display-model.ts';
import { IDF_FONT, IDF_FONT_LICENSE } from '../lib/idf-font.ts';
import { firmwareFixture } from './firmware-fixtures.mjs';

for (const auxiliary of [false, true]) {
  const { scene, program } = firmwareFixture(auxiliary);
  const arduino = generateEsp32CodeResult(program, 'Fixture Arduino CI', scene);
  const native = generateEspIdfCodeResult(program, 'Fixture Arduino CI', scene);
  assert.deepEqual(native.program, arduino.program);
  assert.deepEqual(compileTaskGraph(native.program), compileTaskGraph(arduino.program));
  assert.equal(native.diagnostics.filter(item => item.severity === 'error').length, 0);
  assert.match(arduino.code, /#include <Arduino.h>/);
  assert.doesNotMatch(native.code, /#include [<"]Arduino|#include [<"]WiFi\.h|ledcAttach\(|Serial\.println|digitalWrite\(|analogRead\(/);
  assert.match(native.code, /extern "C" void app_main/);
  assert.match(native.code, /if \(!capiPrintln/);
  assert.match(native.code, /SCHEDULER_QUANTUM_MS = 16/);
  assert.match(native.code, /xQueueCreate\(32/);
  assert.match(native.code, /xQueueSend\(capiConsoleQueue, &message, 0\)/);
  assert.doesNotMatch(native.code, /nvs_flash_erase|esp_wifi_restore/);
  const assignments = allocateIdfPwm(scene);
  assert.ok(assignments?.length);
  const channels = new Set();
  for (const pin of assignments) {
    assert.ok(pin.channel < 8 && pin.timer < 4);
    const key = `${pin.bank}:${pin.channel}`;
    assert.ok(!channels.has(key)); channels.add(key);
    for (const other of assignments) if (other.bank === pin.bank && other.timer === pin.timer) {
      assert.equal(other.frequency, pin.frequency); assert.equal(other.resolution, pin.resolution);
      if (pin.tone) assert.equal(other.pin, pin.pin);
    }
  }
  const files = espIdfProjectFiles(native);
  assert.equal(files['main/main.cpp'], native.code);
  assert.match(files['main/CMakeLists.txt'], /\$\{COMPONENT_LIB\}/);
  assert.match(files['sdkconfig.defaults'], /CONFIG_FREERTOS_HZ=1000/);
  assert.match(files['main/wifi_config.example.h'], /TU_RED/);
  assert.ok(!Object.keys(files).includes('main/wifi_config.h'));
  assert.deepEqual(await createEspIdfArchive(native), await createEspIdfArchive(native));
  assert.throws(() => espIdfProjectFiles(arduino));
}
for (const profile of Object.keys(displayProfiles)) {
  const { scene, device } = addDeviceToScene(createEmptyScene('Display'), 'display', { config: displayConfig(profile) });
  const areaId = displayTargets(device.config)[0].id;
  const program = { version: 2, threads: [{ id: 'start', startBlockId: 'start', nodes: [
    { op: 'displayWrite', deviceId: device.id, areaId, text: '¡Sí!\nESP32', blockId: 'text' },
    { op: 'displayClear', deviceId: device.id, areaId, blockId: 'clear' },
  ] }] };
  const native = generateEspIdfCodeResult(program, 'Pantalla', scene);
  const arduino = generateEsp32CodeResult(program, 'Pantalla', scene);
  const calls = code => [...code.matchAll(/^\s+capiDisplayWrite\([0-9].*$/gm)].map(match => match[0]);
  assert.deepEqual(calls(native.code), calls(arduino.code));
  assert.equal(native.diagnostics.filter(item => item.severity === 'error').length, 0);
  assert.match(native.code, /capiDisplayService\(now\)/);
  assert.match(native.code, /capiDisplayReady = false; capiPrintln/);
  if (profile.startsWith('ili')) {
    assert.match(native.code, /spi_device_queue_trans.*pdMS_TO_TICKS\(20\)/);
    assert.match(native.code, /spi_device_get_trans_result.*pdMS_TO_TICKS\(20\)/);
    assert.doesNotMatch(native.code, /spi_device_polling_transmit|spi_device_transmit\(/);
  } else assert.match(native.code, /i2c_master_transmit\(capiDisplayDevice, data, count, 5\)/);
  device.pins[profile.startsWith('ili') ? 'sck' : 'sda'] = null;
  const invalid = generateEspIdfCodeResult(program, 'Invalid', scene);
  assert.throws(() => espIdfProjectFiles(invalid));
}
assert.equal(IDF_FONT.length, 475);
assert.match(IDF_FONT_LICENSE, /Copyright \(c\) 2012 Adafruit/);
for (const path of ['../oops', '/root', 'x/../oops', 'x//y', 'x\\y']) assert.throws(() => zipFirmwareFiles({ [path]: 'x' }));
assert.throws(() => zipFirmwareFiles({ 'main.cpp': 'x'.repeat(17 * 1024 * 1024) }));
console.log('ESP-IDF: shared graph, native APIs, PWM timer isolation, five displays, deterministic ZIP and invalid-input guards passed.');
