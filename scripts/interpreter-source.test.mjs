import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const source = await readFile(new URL('../interpreter/main/main.cpp', import.meta.url), 'utf8');

// Preserve the actual preprocessor guards: shared helpers must compile for
// Wemos as well as both S3 boards, even without the RGB/USB target code.
const boardProbe = '#include <cstring>\n' + source.split('\n').filter((line) =>
  /^#(?:if|else|elif|endif|define)/.test(line) || line.startsWith('static bool is_waveshare(')
).join('\n') + '\nint main(){return is_waveshare();}\n';
for (const [board, s3] of [['wemos-d1-r32', false], ['diymall-esp32-s3-devkitc-v1-n16r8', true], ['waveshare-esp32-s3-touch-lcd-5-28117', true]]) {
  const compile = spawnSync(process.env.CXX || 'g++', ['-x', 'c++', '-std=c++17', '-Wall', '-Werror', '-fsyntax-only', `-DCAPI_BOARD_ID="${board}"`, ...(s3 ? ['-DCONFIG_IDF_TARGET_ESP32S3=1'] : []), '-'], { input: boardProbe, encoding: 'utf8' });
  assert.equal(compile.status, 0, `board helper compilation (${board}): ${compile.error?.message || compile.stderr}`);
}

for (const operation of ['trafficVehicleDisplay', 'trafficPedestrianDisplay', 'servo', 'buzzer', 'tone', 'wifi', 'wifiMessageSend', 'wifiMessageReceiveWait', 'timerStart', 'timerRestart', 'timerPause', 'timerResume', 'timerStop', 'timerWait', 'otto', 'ottoSound', 'ottoExpression', 'ottoArms', 'displayWrite', 'displayClear', 'displayAnimateText', 'displayArtwork', 'matrixBrightness', 'matrixScroll', 'visualStop', 'visualWait', 'messageSend', 'messageReceiveWait', 'rgbFill', 'rgbPixel', 'rgbSegment', 'rgbCoordinate', 'rgbGradient', 'rgbPattern', 'rgbAnimation'])
  assert.match(source, new RegExp(`"${operation}"`), `missing interpreter operation ${operation}`);
for (const capability of ['traffic-display', 'parallel', 'variables', 'timers', 'component-state', 'servo', 'buzzer', 'wifi', 'wifi-messages', 'otto', 'display-lcd', 'display-keypad', 'display-ssd1306', 'display-ili9341', 'display-ili9488', 'matrix', 'messages', 'smart-lights', 'step', 'touch-inputs', 'autonomous-controls'])
  assert.match(source, new RegExp(`"${capability}"`), `missing negotiated capability ${capability}`);
assert.match(source, /rules_a/);
assert.match(source, /rules_b/);
assert.match(source, /message_crc_byte/);
assert.match(source, /CONFIG_WIFI/);
assert.match(source, /CONFIG_PAIR/);
assert.match(source, /hardwareId/);
assert.match(source, /PAIR_CONFIGURED/);
assert.match(source, /MAX_RULES = 32 \* 1024/);
assert.match(source, /#define CAPI_FIRMWARE_VERSION "1\.8\.0"/);
assert.match(source, /else if \(!strcmp\(type,"STEP"\)\)/);
assert.match(source, /waveshare_touch_service/);
assert.match(source, /ws_virtual_input/);
assert.match(source, /waveshare_inspector/);
assert.match(source, /DATOS DEL PROGRAMA/);
assert.match(source, /0x814e/);
assert.match(source, /waveshare_begin/);
assert.match(source, /waveshare_render/);
assert.match(source, /esp_lcd_new_rgb_panel/);
assert.match(source, /dma_burst_size=64/);
assert.doesNotMatch(source, /psram_trans_align/);
assert.match(source, /text\(dev,"name","Componente"\)/);
assert.match(source, /cooperative_delay_ms\(5\)/);
assert.doesNotMatch(source, /capi-matrix[^\n]+vTaskDelay\(pdMS_TO_TICKS\(5\)\)/);
assert.match(source, /usb_serial_jtag_read_bytes/);
assert.match(source, /usb_serial_jtag_write_bytes/);
assert.match(source, /usb_serial_jtag_is_driver_installed/);
assert.match(source, /if\(!usb_link_ready\)/);
assert.match(source, /CONFIG_IDF_TARGET_ESP32S3/);
assert.match(await readFile(new URL('../interpreter/sdkconfig.defaults', import.meta.url), 'utf8'), /CONFIG_FREERTOS_HZ=1000/);
assert.match(await readFile(new URL('../interpreter/sdkconfig.defaults.esp32s3', import.meta.url), 'utf8'), /CONFIG_SPIRAM_MODE_OCT=y/);
assert.match(await readFile(new URL('../interpreter/main/CMakeLists.txt', import.meta.url), 'utf8'), /esp_driver_usb_serial_jtag/);
assert.match(await readFile(new URL('../interpreter/main/CMakeLists.txt', import.meta.url), 'utf8'), /esp_lcd/);
assert.equal((await readFile(new URL('../interpreter/main/font5x7.h', import.meta.url), 'utf8')).includes('CAPI_FONT_5X7'), true);
console.log('Firmware interpreter source contract: OK');
