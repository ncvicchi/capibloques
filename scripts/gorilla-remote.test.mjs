import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  GorillaRemoteLease,
  validGorillaRemote,
} from '../lib/gorilla-remote.ts';
assert.ok(validGorillaRemote({ missions: ['Explorar'] }));
for (const bad of [
  { missions: [' a'] },
  { missions: ['a', 'a'] },
  { missions: [], key: 'secret' },
  null,
])
  assert.equal(validGorillaRemote(bad), false);
const lease = new GorillaRemoteLease();
assert.ok(lease.claim('phone', 0, 1));
assert.equal(lease.claim('other', 1, 2), false);
const send = (seq, ticket, extra = {}, now = seq * 100) =>
  lease.accept(
    'phone',
    {
      sequence: seq,
      ticket,
      direction: 0,
      rhythm: 50,
      mode: 0,
      mission: 0,
      arm: false,
      stop: false,
      ...extra,
    },
    now,
    ticket + 1,
    false,
    false,
    1,
  );
assert.ok(send(1, 1, { arm: true }));
assert.ok(send(2, 2, { direction: 1 }));
assert.equal(lease.direction, 1);
assert.equal(send(2, 2, { direction: 2 }), false);
assert.equal(send(3, 3, { direction: 3 }), false);
assert.ok(send(3, 3, { direction: 2 }));
assert.equal(lease.armed, false);
assert.equal(lease.direction, 0);
assert.ok(send(4, 4, { arm: true }));
assert.ok(send(5, 5, { stop: true }));
assert.ok(lease.stopped);
assert.ok(send(6, 6, { direction: 1 }));
assert.equal(lease.direction, 0);
assert.ok(send(7, 7, { arm: true }));
assert.equal(lease.stopped, false);
lease.expire(1200);
assert.equal(lease.connected, false);
assert.equal(send(8, 8, { direction: 1 }, 1201), false);
assert.ok(lease.claim('new', 1202, 33));
assert.equal(lease.armed, false);
const dir = 'work/gorilla-remote';
await mkdir(dir, { recursive: true });
const header = new URL(
  '../interpreter/main/remote_core.h',
  import.meta.url,
).pathname
  .replace(/^\/([A-Z]:)/, '$1')
  .replaceAll('\\', '/');
await writeFile(
  dir + '/core.cpp',
  `#include <cassert>\n#include "${header}"\nint main(){CapiRemote r;assert(r.claim(0,1));assert(!r.claim(1,2));assert(r.accept(1,1,0,50,0,0,true,false,100,2,false,false,1));assert(r.accept(2,2,1,50,0,0,false,false,200,3,false,false,1));assert(r.direction==1);assert(!r.accept(2,2,2,50,0,0,false,false,201,4,false,false,1));assert(!r.accept(3,3,3,50,0,0,false,false,300,4,false,false,1));assert(r.accept(3,3,2,50,0,0,false,false,300,4,false,false,1));assert(!r.armed&&!r.direction);assert(r.accept(4,4,0,50,0,0,true,true,400,5,false,false,1));assert(r.stopped);r.expire(900);assert(!r.connected);assert(r.claim(901,6));assert(!r.armed);CapiRemote wrap;assert(wrap.claim(0xffffff00,1));wrap.expire(0x100);assert(!wrap.connected);}`,
);
const build = spawnSync(
  'g++',
  [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    dir + '/core.cpp',
    '-o',
    dir + '/core.exe',
  ],
  { encoding: 'utf8' },
);
assert.equal(build.status, 0, build.stderr);
assert.equal(spawnSync(dir + '/core.exe').status, 0);
const html = await readFile(
  new URL('../interpreter/main/remote_panel.h', import.meta.url),
  'utf8',
);
assert.ok(html.includes('setPointerCapture'));
assert.ok(html.includes('visibilitychange'));
assert.ok(html.includes('AbortSignal.timeout(450)'));
assert.ok(!html.includes('innerHTML'));
console.log(
  'Mando62: contrato TS/C++, sesión exclusiva, secuencia/ticket, expiración/rollover, STOP y rearme aprobados.',
);
