import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../interpreter/main/main.cpp', import.meta.url), 'utf8');

for (const operation of ['servo', 'buzzer', 'tone', 'wifi', 'wifiMessageSend', 'wifiMessageReceiveWait', 'timerStart', 'timerRestart', 'timerPause', 'timerResume', 'timerStop', 'timerWait', 'otto', 'ottoSound', 'ottoExpression', 'ottoArms', 'displayWrite', 'displayClear', 'displayAnimateText', 'displayArtwork', 'matrixScroll', 'visualWait', 'messageSend', 'messageReceiveWait', 'rgbFill', 'rgbPixel', 'rgbSegment', 'rgbCoordinate', 'rgbGradient', 'rgbPattern', 'rgbAnimation'])
  assert.match(source, new RegExp(`"${operation}"`), `missing interpreter operation ${operation}`);
for (const capability of ['parallel', 'variables', 'timers', 'component-state', 'servo', 'buzzer', 'wifi', 'wifi-messages', 'otto', 'display-lcd', 'display-keypad', 'display-ssd1306', 'display-ili9341', 'display-ili9488', 'matrix', 'messages', 'smart-lights'])
  assert.match(source, new RegExp(`"${capability}"`), `missing negotiated capability ${capability}`);
assert.match(source, /rules_a/);
assert.match(source, /rules_b/);
assert.match(source, /message_crc_byte/);
assert.match(source, /CONFIG_WIFI/);
assert.match(source, /CONFIG_PAIR/);
assert.match(source, /hardwareId/);
assert.match(source, /PAIR_CONFIGURED/);
assert.match(source, /MAX_RULES = 32 \* 1024/);
assert.match(source, /#define CAPI_FIRMWARE_VERSION "1\.5\.0"/);
assert.equal((await readFile(new URL('../interpreter/main/font5x7.h', import.meta.url), 'utf8')).includes('CAPI_FONT_5X7'), true);
console.log('Firmware interpreter source contract: OK');
