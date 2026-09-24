import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../interpreter/main/main.cpp', import.meta.url), 'utf8');

for (const operation of ['servo', 'buzzer', 'tone', 'otto', 'ottoSound', 'ottoExpression', 'ottoArms', 'matrixScroll', 'visualWait', 'messageSend', 'messageReceiveWait'])
  assert.match(source, new RegExp(`"${operation}"`), `missing interpreter operation ${operation}`);
for (const capability of ['parallel', 'variables', 'servo', 'buzzer', 'otto', 'matrix', 'messages'])
  assert.match(source, new RegExp(`"${capability}"`), `missing negotiated capability ${capability}`);
assert.match(source, /rules_a/);
assert.match(source, /rules_b/);
assert.match(source, /message_crc_byte/);
assert.match(source, /MAX_RULES = 32 \* 1024/);
console.log('Firmware interpreter source contract: OK');
