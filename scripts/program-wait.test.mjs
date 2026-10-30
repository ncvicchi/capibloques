import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const directory = 'work/program-wait'; await mkdir(directory, { recursive: true });
const header = await readFile('interpreter/main/program_wait.h', 'utf8');
await writeFile(`${directory}/program_wait.h`, header);
await writeFile(`${directory}/probe.cpp`, `#include "program_wait.h"
#include <cassert>
int main() {
  uint32_t now=0;bool running=true;unsigned sleeps=0;
  auto clock=[&]{return now;};
  auto sleep=[&](uint32_t ms){assert(ms<=10);now+=ms;++sleeps;};
  capi_program_wait(60000,[&]{return now<35;},[]{return false;},[]{return false;},clock,sleep);
  assert(now==40);
  now=0;capi_program_wait(100,[&]{return running;},[&]{return now>=20&&now<1020;},[]{return false;},clock,sleep);
  assert(now==1100);
  now=0;capi_program_wait(100,[&]{return running;},[]{return true;},[]{return true;},clock,sleep);assert(now==100);
  now=0;capi_program_wait(60000,[&]{return now<35;},[]{return true;},[]{return false;},clock,sleep);assert(now==35);
  now=0xfffffff0u;uint32_t before=now;capi_program_wait(40,[&]{return running;},[]{return false;},[]{return false;},clock,sleep);assert(uint32_t(now-before)==40);
  sleeps=0;capi_program_wait(0,[&]{return running;},[]{return false;},[]{return false;},clock,sleep);assert(sleeps==0);
}
`);
const compile = spawnSync(process.env.CXX || 'g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', `${directory}/probe.cpp`, '-o', `${directory}/probe.exe`], { encoding: 'utf8' });
assert.equal(compile.status, 0, compile.error?.message || compile.stderr);
const run = spawnSync(`${directory}/probe.exe`, [], { encoding: 'utf8' });assert.equal(run.status, 0, run.stderr);
const source=await readFile('interpreter/main/main.cpp','utf8');
assert.ok(source.includes('capi_program_wait(static_cast<uint32_t>'));
assert.ok(!source.includes('if (!strcmp(op,"wait")) vTaskDelay'));
console.log('Program wait C++: STOP during 60s wait, paused STOP, paused clock, STEP, zero and rollover passed');
