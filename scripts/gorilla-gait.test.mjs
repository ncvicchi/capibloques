import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  planGorillaGait,
  advanceGorillaGait,
  defaultGorillaGait,
} from '../lib/gorilla-gait.ts';
import { defaultGorillaKinematics } from '../lib/gorilla-kinematics.ts';
import { gorillaSettings } from '../lib/gorilla-model.ts';
import { gorillaCore } from '../lib/gorilla-core.ts';
import {
  createGorillaTrack,
  advanceGorillaTrack,
} from '../lib/gorilla-track.ts';
import { createSceneFromTemplate } from '../lib/scene-model.ts';
const k = defaultGorillaKinematics(),
  s = gorillaSettings(),
  g = defaultGorillaGait;
let checks = '';
for (let mode = 0; mode < 5; mode++) {
  const p = planGorillaGait(k, s, mode, g, Array(8).fill(0));
  assert.ok(p.move, p.error);
  let job = p.move,
    previous = Array(8).fill(0),
    travel = 0,
    yaw = 0;
  const swings = [];
  for (const f of job.frames)
    if (f.swing >= 0 && swings.at(-1) !== f.swing) swings.push(f.swing);
  assert.deepEqual(swings, mode === 4 ? [] : [2, 0, 3, 1]);
  for (let t = 10; t <= job.duration + 10; t += 10) {
    const n = advanceGorillaGait(job, Math.min(10, job.duration - job.elapsed));
    assert.ok(!n.error);
    n.angles.forEach((a, i) => assert.ok(Math.abs(a - previous[i]) <= 0.31));
    if (n.swing >= 0 && p.move.frames.some((f) => f.swing === n.swing))
      assert.ok(Math.abs(n.travel) <= 0.1);
    travel += n.travel;
    yaw += n.yaw;
    job = n.move;
    previous = n.angles;
    if (!n.moving) break;
  }
  assert.ok(Math.abs(travel - (mode === 0 ? 4 : mode === 1 ? -4 : 0)) < 1e-7);
  assert.ok(Math.abs(yaw - (mode === 2 ? -4 : mode === 3 ? 4 : 0)) < 1e-7);
  const again = planGorillaGait(k, s, mode, g, previous);
  assert.ok(again.move, again.error);
  for (const time of [
    0,
    205,
    Math.floor(p.move.duration / 2),
    p.move.duration,
  ]) {
    const n = advanceGorillaGait(p.move, time);
    checks +=
      `{CapiGorilla r;r.ready=true;r.kinematics_verified=true;assert(r.gait(${mode},4,2,500,0));assert(r.duration==${p.move.duration});r.service(${time});` +
      n.angles
        .map((a, i) => `assert(std::abs(r.position[${i}]-(${a}))<1e-6);`)
        .join('') +
      '}\n';
  }
}
assert.ok(
  !planGorillaGait(k, { ...s, min7: 90, max7: 90 }, 0, g, Array(8).fill(0))
    .move,
);
assert.ok(
  !planGorillaGait(k, s, 0, { ...g, stride: 100 }, Array(8).fill(0)).move,
);
assert.ok(!planGorillaGait(k, s, 0, g, [20, -20, 0, 0, 0, 0, 0, 0]).move);
await mkdir('work/gorilla-gait', { recursive: true });
await writeFile(
  'work/gorilla-gait/test.cpp',
  `#include <cassert>\n#define PI 3.14159265359\n${gorillaCore}\nint main(){${checks}
 CapiGorilla r;r.ready=true;r.kinematics_verified=true;r.low[7]=90;r.high[7]=90;assert(!r.gait(0,4,2,500,0));assert(!r.busy);for(double p:r.position)assert(p==0);
 CapiGorilla a;a.ready=true;a.kinematics_verified=true;assert(a.gait(0,4,2,500,0));a.service(200);a.halt();double held=a.position[0];a.service(10000);assert(a.position[0]==held);assert(!a.busy&&!a.gait_active);
 CapiGorilla b;b.ready=true;b.kinematics_verified=true;assert(b.gait(0,4,2,500,UINT32_MAX-100));b.service(100);assert(b.busy);assert(!b.gait(1,4,2,500,100));
 b.write=[](int,double){return false;};b.service(200);assert(b.error&&!b.ready&&!b.busy);
}`,
);
const compile = spawnSync(
  'g++',
  [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    'work/gorilla-gait/test.cpp',
    '-o',
    'work/gorilla-gait/test.exe',
  ],
  { encoding: 'utf8' },
);
assert.equal(compile.status, 0, compile.stderr);
const run = spawnSync('work/gorilla-gait/test.exe', [], { encoding: 'utf8' });
assert.equal(run.status, 0, run.stderr);
const scene = createSceneFromTemplate('gorillaTrack');
let w = createGorillaTrack(scene);
w = advanceGorillaTrack(w, scene, 0, 0, -1, 600, false);
assert.deepEqual(w.visited, ['base']);
w = advanceGorillaTrack(w, scene, 32, 0, -1, 0, true);
assert.equal(w.x, 248);
assert.deepEqual(w.visited, ['base']);
w = advanceGorillaTrack(w, scene, 0, 0, -1, 500, false);
assert.deepEqual(w.visited, ['base', 'A']);
w = advanceGorillaTrack(w, scene, -32, 0, -1, 0, true);
assert.equal(w.x, 120);
scene.canvas.arenaEnvironment.obstacles = [{ x: 248, y: 355, radius: 28 }];
w = createGorillaTrack(scene);
w = advanceGorillaTrack(w, scene, 32, 0, -1, 0, true);
assert.ok(w.contact && w.x < 180);
assert.equal(w.contacts, 1);
w = advanceGorillaTrack(w, scene, 1, 0, -1, 0, true);
assert.equal(w.contacts, 1);
w = advanceGorillaTrack(w, scene, -4, 0, -1, 0, true);
assert.ok(!w.contact);
assert.equal(createGorillaTrack(scene).contacts, 0);
console.log(
  'Gorilla60: cuatro tiempos, reloj común, tasa, FK/IK TS=C++, entrada/salida, rechazo íntegro, STOP/rollover/bus, estaciones y contactos aprobados.',
);
