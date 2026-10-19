import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { gorillaCore } from '../lib/gorilla-core.ts';
import { sonarCore, sonarFirmwareSupport } from '../lib/sonar-firmware.ts';
import {
  planGorillaGait,
  advanceGorillaGait,
  planGorillaSupport,
  defaultGorillaGait,
} from '../lib/gorilla-gait.ts';
import { defaultGorillaKinematics } from '../lib/gorilla-kinematics.ts';
import { gorillaSettings } from '../lib/gorilla-model.ts';
import { examples } from '../lib/capiblocks.ts';
const k = defaultGorillaKinematics(),
  s = gorillaSettings();
const gait = planGorillaGait(
  k,
  s,
  0,
  defaultGorillaGait,
  Array(8).fill(0),
).move;
const mid = advanceGorillaGait(gait, 1300),
  support = planGorillaSupport(k, s, mid.angles);
assert.ok(support.move, support.error);
const landed = advanceGorillaGait(support.move, support.move.duration);
assert.ok(!landed.error && !landed.moving);
assert.equal(landed.travel, 0);
const cpp = `#include <cassert>
#include <cstdio>
${gorillaCore}
${sonarCore}
int main(){
 CapiGorilla robot;robot.ready=true;robot.kinematics_verified=true;
 CapiGorillaWalk walk;assert(walk.begin(0,4,2,500,30000,0));assert(walk.service(robot,false,0));robot.service(1300);
 assert(walk.service(robot,true,1300));assert(walk.finishing&&walk.outcome==1);assert(robot.duration==${support.move.duration});
 robot.service(1300+robot.duration);assert(!walk.service(robot,false,1300+robot.duration));
 ${landed.angles.map((a, i) => `assert(std::abs(robot.position[${i}]-(${a}))<1e-6);`).join('')}
 CapiGorilla r;r.ready=true;r.kinematics_verified=true;CapiGorillaWalk timeout;assert(timeout.begin(0,4,2,200,1000,UINT32_MAX-500));assert(timeout.service(r,false,UINT32_MAX-500));r.service(400);assert(timeout.service(r,false,501));assert(timeout.outcome==2);
 CapiGorillaWalk request;r.halt();assert(request.begin(1,4,2,200,30000,0));request.requested=true;request.service(r,false,0);assert(request.outcome==3);
 CapiGorillaWalk fault;fault.begin(0,4,2,200,30000,0);r.error=true;assert(!fault.service(r,false,0));assert(fault.outcome==4&&!r.busy);
 CapiSonar sonar;assert(!sonar.fresh(0));assert(sonar.tick(0));sonar.edge(true,100);sonar.edge(false,5900);assert(!sonar.tick(6000));assert(sonar.distance.load()==100&&sonar.fresh(6000));assert(!sonar.fresh(256001));
 assert(sonar.tick(60000));assert(!sonar.tick(90001));assert(!sonar.valid.load());
 assert(sonar.tick(120000));sonar.edge(true,120100);sonar.edge(false,120150);sonar.tick(120200);assert(!sonar.valid.load()); // too short, never clear path
 sonar.reset();assert(sonar.tick(0));sonar.edge(true,100);sonar.edge(false,5900);sonar.tick(1000000);assert(!sonar.fresh(1000000)); // delayed consumer must not refresh an old echo
 sonar.reset();assert(sonar.tick(UINT32_MAX-100));sonar.edge(true,UINT32_MAX-50);sonar.edge(false,529);sonar.tick(600);assert(sonar.distance.load()==10&&sonar.fresh(600));
}`;
await mkdir('work/gorilla-autonomy', { recursive: true });
await writeFile('work/gorilla-autonomy/test.cpp', cpp);
const compile = spawnSync(
  'g++',
  [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    'work/gorilla-autonomy/test.cpp',
    '-o',
    'work/gorilla-autonomy/test.exe',
  ],
  { encoding: 'utf8' },
);
assert.equal(compile.status, 0, compile.stderr);
const run = spawnSync('work/gorilla-autonomy/test.exe', [], {
  encoding: 'utf8',
});
assert.equal(run.status, 0, run.stderr);
assert.ok(
  (await readFile('interpreter/main/sonar_core.h', 'utf8')).includes(
    sonarCore.trim(),
  ),
);
const e = examples.find((e) => e.id === 'gorillaAutonomy');
for (const native of [false, true]) {
  const code = sonarFirmwareSupport(
    e.scene,
    native,
    (id, key) => 'state_' + key,
  );
  assert.match(code, /gpio_isr_handler_add/);
  assert.ok(!code.includes('pulseIn'));
  assert.match(code, /fresh\(us\)/);
}
console.log(
  'Gorilla61: apoyo TS=C++, condición/timeout/solicitud/error, rollover, eco por flancos, caducidad y ausencia de eco aprobados.',
);
