// Executes the generated C++ service with deterministic bus/driver doubles.
// Real libraries are compiled separately for Wemos in CI; this is not a hardware emulator.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { displayArduinoSupport } from '../lib/display-arduino.ts';
import { displayConfig, displayProfiles } from '../lib/display-model.ts';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model.ts';

const directory = resolve('work/display-driver-test');
await mkdir(directory, { recursive: true });
const stub = `#pragma once
#include <cstdint>
#include <cassert>
#include <cstring>
struct SerialStub { int messages = 0; void println(const char*) { ++messages; } } Serial;
struct WireStub {
  bool present = true; int probes = 0; int timeout = 0;
  bool begin(int, int, int) { return true; }
  void setTimeOut(int ms) { timeout = ms; }
  void beginTransmission(int) {}
  int endTransmission() { ++probes; return present ? 0 : 2; }
} Wire;
struct TestScreen {
  template<typename... Args> TestScreen(Args...) {}
  int draws = 0; bool available = true;
  template<typename... Args> bool begin(Args&&...) { return available; }
  void setBacklight(int) {} void clear() {} void clearDisplay() {}
  void setI2CAddress(int) {} void setBusClock(int) {} void setFont(const uint8_t*) {}
  void setTextSize(int) {} void setTextWrap(bool) {} void fillScreen(int) {}
  void setCursor(int, int) {} void write(uint8_t) { ++draws; }
  void drawGlyph(int, int, uint8_t) { ++draws; }
  void drawChar(int, int, uint8_t, int, int) { ++draws; }
};
using LiquidCrystal_PCF8574 = TestScreen;
using U8X8_SSD1306_128X64_NONAME_HW_I2C = TestScreen;
using Arduino_ILI9341 = TestScreen;
using Arduino_ILI9488_18bit = TestScreen;
using Arduino_ESP32SPI = TestScreen;
constexpr int U8X8_PIN_NONE = 255, GFX_NOT_DEFINED = -1, VSPI = 0;
const uint8_t u8x8_font_chroma48medium8_r[] = {0};
`;
await writeFile(resolve(directory, 'driver-stub.h'), stub);
for (const header of [
  'Wire.h',
  'LiquidCrystal_PCF8574.h',
  'U8x8lib.h',
  'Arduino_GFX_Library.h',
])
  await writeFile(
    resolve(directory, header),
    '#pragma once\n#include "driver-stub.h"\n',
  );
for (const profile of Object.keys(displayProfiles)) {
  const { scene } = addDeviceToScene(createEmptyScene('Driver'), 'display', {
    config: displayConfig(profile),
  });
  const i2c = displayProfiles[profile].bus === 'i2c';
  const source = `#include "driver-stub.h"
${displayArduinoSupport(scene)}
uint32_t testClock = 2;
void service() {
  const int before = capiScreen.draws;
  capiDisplayService(testClock); testClock += 2;
  assert(capiScreen.draws - before <= 1);
}
void flush() {
  for (int i = 0; i < CAPI_DISPLAY_CELLS + 1; ++i) service();
  assert(memcmp(capiDisplayWanted, capiDisplaySent, CAPI_DISPLAY_CELLS) == 0);
}
int main() {
  ${i2c ? 'Wire.present = false;' : 'capiScreen.available = false;'}
  capiDisplayBegin();
  assert(!capiDisplayReady);
  capiDisplayWrite(0, 0, 1, 1, "A");
  for (int i = 0; i < 100; ++i) service();
  assert(capiScreen.draws == 0);
  ${i2c ? 'assert(Wire.probes == 1); assert(Serial.messages == 1); Wire.present = true;' : 'capiScreen.available = true;'}
  capiDisplayBegin(); assert(capiDisplayReady);
  ${i2c ? 'assert(Wire.timeout == 2);' : ''}
  capiDisplayWrite(0, 0, 3, 1, "OLD");
  capiDisplayWrite(0, 0, 3, 1, "NEW");
  capiDisplayWrite(0, 1, 4, 1, "KEEP");
  flush();
  assert(memcmp(capiDisplaySent, "NEW", 3) == 0);
  assert(memcmp(capiDisplaySent + CAPI_DISPLAY_COLUMNS, "KEEP", 4) == 0);
  const int after = capiScreen.draws;
  for (int i = 0; i < 100; ++i) service();
  assert(capiScreen.draws == after);
  capiDisplayWrite(0, 0, 3, 1, nullptr); flush();
  assert(memcmp(capiDisplaySent, "   ", 3) == 0);
  assert(memcmp(capiDisplaySent + CAPI_DISPLAY_COLUMNS, "KEEP", 4) == 0);
  capiDisplayWrite(CAPI_DISPLAY_COLUMNS, 0, 1, 1, "X"); flush();
  assert(capiScreen.draws == after + 3);
  ${
    i2c
      ? `Wire.present = false;
  capiDisplayWrite(0, 0, 1, 1, "X"); service();
  assert(!capiDisplayReady);
  const int probes = Wire.probes, messages = Serial.messages;
  for (int i = 0; i < 100; ++i) service();
  assert(Wire.probes == probes && Serial.messages == messages);`
      : ''
  }
  return 0;
}
`;
  const input = resolve(directory, `${profile}.cpp`);
  const output = resolve(
    directory,
    `${profile}${process.platform === 'win32' ? '.exe' : ''}`,
  );
  await writeFile(input, source);
  const compile = spawnSync(
    'g++',
    [
      '-std=c++17',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-I',
      directory,
      input,
      '-o',
      output,
    ],
    { encoding: 'utf8', timeout: 60000 },
  );
  assert.equal(
    compile.status,
    0,
    `${profile}: ${compile.error ?? compile.stderr}`,
  );
  const run = spawnSync(output, [], { encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 0, `${profile}: ${run.error ?? run.stderr}`);
  console.log(
    `${profile}: generated C++ service passed bounded refresh, latest message, isolated clear and missing-device checks.`,
  );
}
