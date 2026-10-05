import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validFrameAnimations, animationFrame } from '../lib/frame-animation.ts';
import { validMatrixConfig } from '../lib/led-matrix.ts';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model.ts';
import { generateEsp32CodeResult, generateEspIdfCodeResult, validateProgramForScene } from '../lib/capiblocks.ts';
import { matrixFirmwareSupport } from '../lib/led-matrix-firmware.ts';
import { displayAnimationFirmwareSupport } from '../lib/display-animation-firmware.ts';
import { createCapiRules, parseCapiRules } from '../lib/capi-rules.ts';
import { displayConfig, validDisplayConfig } from '../lib/display-model.ts';

const animation = { id: 'anim-test', name: 'Saludo', frameMs: 100, frames: [Array(8).fill(1), Array(8).fill(2)] };
assert.ok(validFrameAnimations([animation], 32));
for (const invalid of [{ ...animation, frameMs: 0 }, { ...animation, frames: [] }, { ...animation, frames: Array(17).fill(animation.frames[0]) }, { ...animation, frames: [Array(8).fill(2 ** 32)] }, { ...animation, id: '?' }]) assert.equal(validFrameAnimations([invalid], 32), false);
assert.equal(validFrameAnimations([animation, { ...animation, id: 'other' }], 32), false);
for (const repeat of [0, 1, 3]) {
  for (let step = 0; step < 9; step++) {
    const result = animationFrame(animation, step * 100, repeat);
    const done = repeat > 0 && step >= repeat * 2;
    assert.equal(result.done, done);
    assert.deepEqual(result.rows, animation.frames[done ? 1 : step % 2]);
  }
}
const added = addDeviceToScene(createEmptyScene('Cuadros'), 'ledMatrix');
added.device.config.animations = [animation];
assert.ok(validMatrixConfig(added.device.config));
assert.ok(validDisplayConfig({ ...displayConfig('ssd1306'), animations: [animation] }));
assert.equal(validDisplayConfig({ ...displayConfig('lcd1602'), animations: [animation] }), false);
const program = { version: 2, threads: [{ id: 'start', startBlockId: 'start', nodes: [
  { op: 'frameAnimation', deviceId: added.device.id, animationId: animation.id, repeatCount: 3, blockId: 'frames' },
  { op: 'visualWait', deviceId: added.device.id, blockId: 'wait' },
] }] };
assert.deepEqual(validateProgramForScene(program, added.scene).filter(item => item.severity === 'error'), []);
for (const result of [generateEsp32CodeResult(program, 'Cuadros', added.scene), generateEspIdfCodeResult(program, 'Cuadros', added.scene)]) {
  assert.equal(result.diagnostics.some(item => item.severity === 'error'), false);
  assert.match(result.code, /capiMatrixStartFrames\(FRAMES_/);
  assert.match(result.code, /const uint32_t \(\*frames\)\[8\]/);
}
const rules = createCapiRules(program, added.scene, 'wemos-d1-r32');
assert.ok(rules.requiredCapabilities.includes('frame-animation'));
assert.equal(parseCapiRules(rules.bytes).instructionCount, rules.instructionCount);
const graphic = addDeviceToScene(createEmptyScene('Gráficos'), 'display', { config: { ...displayConfig('ssd1306'), animations: [animation] } });
const graphicProgram = structuredClone(program);
for (const node of graphicProgram.threads[0].nodes) node.deviceId = graphic.device.id;
for (const result of [generateEsp32CodeResult(graphicProgram, 'Gráficos', graphic.scene), generateEspIdfCodeResult(graphicProgram, 'Gráficos', graphic.scene)]) {
  assert.equal(result.diagnostics.some(item => item.severity === 'error'), false);
  assert.match(result.code, /capiDisplayStartFrames\(FRAMES_/);
}
program.threads[0].nodes[0].animationId = 'missing';
assert.ok(validateProgramForScene(program, added.scene).some(item => item.code === 'animation-missing'));

const dir = resolve('work/frame-animation-test');
await mkdir(dir, { recursive: true });
const source = resolve(dir, 'playback.cpp'), binary = resolve(dir, 'playback.exe');
await writeFile(source, `#include "${resolve('interpreter/main/frame_animation.h').replaceAll('\\', '/')}"
#include <cassert>
int main(){FrameAnimationPlayback a; a.count=2; a.frame_ms=100; a.frames[0][0]=1; a.frames[1][0]=2; uint32_t rows[8]={};
for(unsigned repeat: {0u,1u,3u}) {a.repeats=repeat; for(unsigned step=0;step<9;step++){bool active=a.render(step*100,rows); bool done=repeat&&step>=repeat*2; assert(active==!done); assert(rows[0]==(done?2:(step%2+1)));}}
a.started_at=0xfffffff0u; assert(a.render(0x54u,rows)); assert(rows[0]==2);}
`.replace('#include <cassert>', '#include <cassert>\n#include <initializer_list>'));
const compiler = process.env.CXX || (process.platform === 'win32' ? 'C:/msys64/mingw64/bin/g++.exe' : 'g++');
const compiled = spawnSync(compiler, ['-std=c++17', '-Wall', '-Wextra', '-Werror', source, '-o', binary], { encoding: 'utf8' });
assert.equal(compiled.status, 0, compiled.stderr);
assert.equal(spawnSync(binary, [], { encoding: 'utf8' }).status, 0);
for (const native of [false, true]) {
  await writeFile(source, `#include <cstdint>
#include <cstring>
#include <cassert>
#include <initializer_list>
constexpr int LOW=0,HIGH=1,OUTPUT=1;
void pinMode(int,int){} void digitalWrite(int,int){} void capiOutput(int){} void capiDigitalWrite(int,int){}
${matrixFirmwareSupport(added.scene, native)}
constexpr int CAPI_DISPLAY_COLUMNS=16,CAPI_DISPLAY_ROWS=8,CAPI_DISPLAY_CELLS=128;
char capiDisplayWanted[128]={};
${displayAnimationFirmwareSupport()}
int main(){uint32_t matrix[2][8]={{1},{2}}; uint16_t display[2][8]={{32768},{16384}};
for(unsigned repeats: {0u,1u,3u}){
capiMatrixStartFrames(matrix,2,100,repeats,0);capiDisplayStartFrames(display,2,100,repeats,0);
for(unsigned step=0;step<9;step++){capiMatrixService(step*100);capiDisplayAnimationService(step*100);bool done=repeats&&step>=repeats*2;
assert(capiMatrixAnimationActive()==!done);assert(capiDisplayAnimationActive()==!done);assert(capiMatrixRows[0]==(done?2:(step%2+1)));assert(capiDisplayWanted[(done||step%2)?1:0]==0x7f);}}
capiMatrixStartFrames(matrix,2,100,0,0);capiMatrixClear();assert(!capiMatrixAnimationActive());
capiDisplayStartFrames(display,2,100,0,0);capiDisplayWrite(0,0,1,1,"X");assert(!capiDisplayAnimationActive());}
`);
  const compiledService = spawnSync(compiler, ['-std=c++17', '-Wall', '-Wextra', '-Werror', source, '-o', binary], { encoding: 'utf8' });
  assert.equal(compiledService.status, 0, compiledService.stderr);
  assert.equal(spawnSync(binary, [], { encoding: 'utf8' }).status, 0);
}
console.log('Frame animation: strict model, finite/endless playback, exports and firmware clock rollover passed.');
