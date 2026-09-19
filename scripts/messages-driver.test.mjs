import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model.ts';
import { generateEsp32CodeResult } from '../lib/capiblocks.ts';

const directory = resolve('work/messages-driver-test');
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'Arduino.h'), `#pragma once
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <string>
#include <vector>
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define INPUT 0
#define INPUT_PULLUP 2
#define SERIAL_8N1 0
template<typename T> T constrain(T value, T low, T high) { return std::min(high, std::max(low, value)); }
struct HardwareSerial {
  int number; std::deque<uint8_t> rx; std::vector<uint8_t> tx; uint32_t baud = 0;
  explicit HardwareSerial(int value = 0): number(value) {}
  void begin(uint32_t value, int = 0, int = -1, int = -1) { baud = value; }
  int available() { return (int)rx.size(); }
  int read() { int value = rx.front(); rx.pop_front(); return value; }
  size_t write(const uint8_t* data, size_t length) { tx.insert(tx.end(), data, data + length); return length; }
  void println(const char*) {}
};
inline HardwareSerial Serial(0);
inline uint32_t testMillis = 0;
inline uint32_t millis() { return testMillis; }
inline void yield() {}
inline void pinMode(int, int) {}
inline void digitalWrite(int, int) {}
inline int digitalRead(int) { return LOW; }
inline int analogRead(int) { return 0; }
inline void analogReadResolution(int) {}
inline void ledcAttach(int, int, int) {}
inline void ledcWrite(int, int) {}
inline void ledcWriteTone(int, int) {}
`);

const { scene, device } = addDeviceToScene(createEmptyScene('Mensajes driver'), 'messages', {
  config: { mode: 'both', baudRate: 9600, messages: ['AVANZAR', 'DETENER'] },
});
const program = { version: 2, threads: [{ id: 'start', startBlockId: 'start', nodes: [
  { op: 'messageSend', deviceId: device.id, text: 'AVANZAR', blockId: 'send' },
  { op: 'messageReceive', deviceId: device.id, expected: 'DETENER', timeoutMs: 100, equal: [], different: [], timeout: [], blockId: 'receive' },
] }] };
const generated = generateEsp32CodeResult(program, 'Mensajes driver', scene);
assert.equal(generated.diagnostics.some(item => item.severity === 'error'), false);
const source = `${generated.code}
#include <cassert>
int main() {
  setup(); assert(CAPI_UART_1.baud == 9600);
  MessageDevice testDevice{1, 17, 16, 9600};
  assert(capiMessageSend(testDevice, "DETENER"));
  assert(CAPI_UART_1.tx.size() == 16 && CAPI_UART_1.tx[0] == 0x43 && CAPI_UART_1.tx[1] == 0x42);
  char received[121] = {};
  for (uint8_t byte : CAPI_UART_1.tx) CAPI_UART_1.rx.push_back(byte);
  assert(capiMessagePoll(testDevice, received) == 1 && strcmp(received, "DETENER") == 0);
  CAPI_UART_1.tx[5] ^= 1; for (uint8_t byte : CAPI_UART_1.tx) CAPI_UART_1.rx.push_back(byte);
  assert(capiMessagePoll(testDevice, received) == -1);
}
`;
const input = resolve(directory, 'messages.cpp');
const output = resolve(directory, process.platform === 'win32' ? 'messages.exe' : 'messages');
await writeFile(input, source);
const compiled = spawnSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-Wno-unused-parameter', '-I', directory, input, '-o', output], { encoding: 'utf8', timeout: 60000 });
assert.equal(compiled.status, 0, compiled.error ?? compiled.stderr);
const result = spawnSync(output, [], { encoding: 'utf8', timeout: 5000 });
assert.equal(result.status, 0, result.error ?? result.stderr);
console.log('Messages Arduino framing, CRC, parser and generated driver passed.');
