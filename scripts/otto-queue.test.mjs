import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ottoQueueSupport } from '../lib/otto-queue.ts';
const header = await readFile(
  new URL('../interpreter/main/otto_turn.h', import.meta.url),
  'utf8',
);
assert.equal(
  header.slice(header.indexOf('struct CapiOttoQueue')).trim(),
  ottoQueueSupport.trim(),
);
const source = await readFile(
  new URL('../interpreter/main/main.cpp', import.meta.url),
  'utf8',
);
assert.match(source, /#include "otto_turn.h"/);
assert.match(source, /CAPI_FIRMWARE_VERSION "1\.11\.0"/);
assert.match(source, /otto\.turns\.clear\(\)/);
assert.match(source, /otto\.turns\.release\(task_index\)/);
assert.match(source, /ottoArms"\)\) \{if\(!otto_turn\(task_index\)\)/);
const dir = await mkdtemp(join(tmpdir(), 'capi-otto-queue-')),
  exe = join(dir, process.platform === 'win32' ? 'queue.exe' : 'queue');
try {
  const cpp =
    '#include <cassert>\n' +
    ottoQueueSupport +
    '\nint main(){CapiOttoQueue q;assert(q.try_acquire(1));assert(!q.try_acquire(2));assert(!q.try_acquire(3));assert(q.try_acquire(1));assert(q.count==3);q.release(1);assert(!q.try_acquire(1));assert(q.try_acquire(2));q.release(2);assert(q.try_acquire(3));q.release(3);assert(q.try_acquire(1));q.clear();for(int i=0;i<32;++i)q.try_acquire(i);assert(q.count==32);assert(!q.try_acquire(32));assert(q.count==32);q.release(0);assert(q.try_acquire(1));q.clear();assert(q.try_acquire(99));}\n';
  const compiled = spawnSync(
    process.env.CXX || 'g++',
    ['-x', 'c++', '-std=c++17', '-Wall', '-Wextra', '-Werror', '-o', exe, '-'],
    { input: cpp, encoding: 'utf8' },
  );
  assert.equal(compiled.status, 0, compiled.error?.message || compiled.stderr);
  const result = spawnSync(exe, [], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log(
  'Otto: cola C++ compartida exports/intérprete y paridad del simulador, FIFO, límite, reset y contrato sin preempción aprobados.',
);
