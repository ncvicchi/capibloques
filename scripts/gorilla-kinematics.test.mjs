import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { gorillaCore } from '../lib/gorilla-core.ts';
import { gorillaSettings } from '../lib/gorilla-model.ts';
import {
  defaultGorillaKinematics,
  validGorillaKinematics,
  gorillaForward,
  gorillaInverse,
  gorillaPathPreset,
  planGorillaPath,
  advanceGorillaPath,
  validGorillaTrajectories,
} from '../lib/gorilla-kinematics.ts';
const k = defaultGorillaKinematics(),
  s = gorillaSettings(),
  zero = Array(8).fill(0);
assert.ok(validGorillaKinematics(k));
assert.ok(!validGorillaKinematics({ ...k, pulseMinUs: 499 }));
assert.ok(!validGorillaKinematics({ ...k, zeroAngles: [90] }));
const home = gorillaForward(k, 0, 0, 0).foot;
assert.ok(Math.abs(home.x) < 1e-8);
assert.ok(Math.abs(home.y - (50 + Math.sqrt(10000 - 23 ** 2))) < 1e-8);
const samples = [];
for (let leg = 0; leg < 4; leg++)
  for (let x = -8; x <= 8; x += 2)
    for (let up = 0; up <= 6; up += 1) {
      const target = { x: home.x + x, y: home.y - up },
        q = gorillaInverse(k, s, leg, target);
      if (!q) continue;
      const actual = gorillaForward(k, leg, ...q).foot;
      assert.ok(Math.hypot(actual.x - target.x, actual.y - target.y) < 1e-7);
      samples.push({ leg, target, q });
    }
assert.ok(samples.length > 100);
assert.equal(gorillaInverse(k, s, 0, { x: 500, y: 500 }), null);
assert.equal(gorillaForward(k, 0, 90, -90), null);
const cpp = [];
for (const kind of ['lift', 'rectangle', 'arc']) {
  const points = gorillaPathPreset(kind),
    plan = planGorillaPath(k, s, 0, points, zero);
  assert.ok(plan.move, plan.error);
  assert.ok(
    validGorillaTrajectories([{ id: kind, name: kind, leg: 0, points }], k, s),
  );
  let job = plan.move,
    previous = zero;
  for (let t = 0; t < plan.move.duration; t += 10) {
    const next = advanceGorillaPath(
      job,
      Math.min(10, plan.move.duration - job.elapsed),
    );
    for (let i = 2; i < 8; i++) assert.equal(next.angles[i], 0);
    for (let i = 0; i < 2; i++)
      assert.ok(
        Math.abs(next.angles[i] - previous[i]) <= 0.31,
        '30°/s + discretization margin',
      );
    assert.equal(next.error, false);
    previous = next.angles;
    job = next.move;
  }
  assert.equal(advanceGorillaPath(plan.move, plan.move.duration).moving, false);
  cpp.push(
    `{double p[][3]={${points.map((p) => `{${p.forward},${p.up},${p.ms}}`).join(',')}};g.position[0]=g.position[1]=0;assert(g.path(0,p,${points.length},100));assert(std::abs((double)g.duration-${plan.move.duration})<=1);g.service(100+g.duration);assert(!g.busy&&!g.error);}`,
  );
}
assert.ok(planGorillaPath(k,s,0,gorillaPathPreset('lift'),[20,-20,0,0,0,0,0,0]).error,'no assembly branch jump');
const impossible = [
  { forward: 0, up: 2, ms: 1000 },
  { forward: 50, up: -30, ms: 1000 },
];
assert.ok(planGorillaPath(k, s, 0, impossible, zero).error);
assert.ok(
  planGorillaPath(
    k,
    { ...s, min1: 90, max1: 90 },
    0,
    gorillaPathPreset('lift'),
    zero,
  ).error,
);
assert.ok(
  !validGorillaTrajectories(
    [{ id: 'a', name: 'A', leg: 0, points: impossible }],
    k,
    s,
  ),
);
const dir = 'work/gorilla-kinematics';
await mkdir(dir, { recursive: true });
const code = `#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cassert>
#define PI 3.14159265358979323846
${gorillaCore}
int writes=0;bool ok=true;
bool output(int ch,double angle){assert(ch==0||ch==1);assert(angle>=70&&angle<=110);writes++;return ok;}
int main(){
CapiGorilla g;g.write=output;g.start(0,0,0,0,0,0);
double p[][3]={{0,4,1000}};assert(!g.path(0,p,1,0));assert(writes==0);
g.kinematics_verified=true;
${samples.map(({ leg, target, q }) => `{double out[2];assert(g.inverse(${leg},{${target.x},${target.y}},out));assert(std::abs(out[0]-(${q[0]}))<1e-7&&std::abs(out[1]-(${q[1]}))<1e-7);}`).join('\n')}
${cpp.join('\n')}
g.position[0]=20;g.position[1]=-20;assert(!g.path(0,p,1,0));g.position[0]=g.position[1]=0;double bad[][3]={{0,2,1000},{50,-30,1000}};int before=writes;assert(!g.path(0,bad,2,0));assert(writes==before&&!g.busy);
assert(g.path(0,p,1,UINT32_MAX-100));g.service(399);assert(g.busy);double held=g.position[0];g.halt();g.service(2000);assert(g.position[0]==held&&!g.busy);
g.position[0]=g.position[1]=0;assert(g.path(0,p,1,0));ok=false;g.service(20);assert(g.error&&!g.ready&&!g.busy);
}
`;
await writeFile(dir + '/test.cpp', code);
const build = spawnSync(
  'g++',
  [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    dir + '/test.cpp',
    '-o',
    dir + '/test.exe',
  ],
  { encoding: 'utf8' },
);
assert.equal(build.status, 0, build.stderr);
const run = spawnSync(dir + '/test.exe', [], { encoding: 'utf8' });
assert.equal(run.status, 0, run.stderr);
console.log(
  'Gorilla v3: FK/IK, ' +
    samples.length +
    ' puntos TS/C++, tres trayectorias, rechazo íntegro, límites, tasa, parada/rollover y fallo de bus aprobados.',
);
