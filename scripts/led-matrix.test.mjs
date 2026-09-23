import assert from 'node:assert/strict';
import { addDeviceToScene, createEmptyScene, getPinRequirements, validateScene } from '../lib/scene-model.ts';
import { MAX_MATRIX_TEXT, matrixPixel, matrixScrollRows, matrixScrollSteps, normalizeMatrixText, validMatrixConfig } from '../lib/led-matrix.ts';
import { generateEsp32CodeResult, generateEspIdfCodeResult, validateProgramForScene } from '../lib/capiblocks.ts';

const added = addDeviceToScene(createEmptyScene('Matriz'), 'ledMatrix');
const matrix = added.device;
assert.equal(matrix.kind, 'ledMatrix');
assert.equal(matrix.config.order, 'right-to-left');
assert.equal(getPinRequirements(matrix).length, 3);
assert.equal(validMatrixConfig(matrix.config), true);
assert.equal(validateScene(added.scene).valid, true);
assert.throws(() => addDeviceToScene(added.scene, 'display'), /una sola pantalla o matriz/i);

const pixel = matrixPixel(Array(8).fill(0), 31, 7, true);
assert.equal(pixel[7], 1);
assert.equal(matrixPixel(pixel, 31, 7, false)[7], 0);
assert.equal(normalizeMatrixText('¡Hola, capi!'), '?HOLA, CAPI!');
assert.equal(normalizeMatrixText('A'.repeat(MAX_MATRIX_TEXT + 20)).length, MAX_MATRIX_TEXT);
assert.equal(matrixScrollRows('A', 0).every(row => row === 0), true);
assert.ok(matrixScrollSteps('A') > 32);

const program = { version: 2, threads: [{ id: 'start', startBlockId: 'start', nodes: [
  { op: 'matrixPattern', deviceId: matrix.id, patternId: matrix.config.patterns[0].id, blockId: 'pattern' },
  { op: 'matrixPixel', deviceId: matrix.id, x: 2, y: 3, enabled: true, blockId: 'pixel' },
  { op: 'matrixScroll', deviceId: matrix.id, text: 'HOLA', speedMs: 80, repeatCount: 1, blockId: 'scroll' },
  { op: 'visualWait', deviceId: matrix.id, blockId: 'wait-scroll' },
  { op: 'matrixClear', deviceId: matrix.id, blockId: 'clear' },
] }] };
assert.deepEqual(validateProgramForScene(program, added.scene).filter(item => item.severity === 'error'), []);
const foreverProgram = { version: 2, threads: [{ id: 'forever', startBlockId: 'forever', nodes: [
  { op: 'matrixScroll', deviceId: matrix.id, text: 'CICLO', speedMs: 80, repeatCount: 0, blockId: 'forever-scroll' },
  { op: 'visualWait', deviceId: matrix.id, blockId: 'forever-wait' },
] }] };
assert.ok(validateProgramForScene(foreverProgram, added.scene).some(item => item.code === 'wait-for-forever-animation'));
for (const generated of [generateEsp32CodeResult(program, 'Matriz', added.scene), generateEspIdfCodeResult(program, 'Matriz', added.scene)]) {
  assert.equal(generated.diagnostics.some(item => item.severity === 'error'), false);
  assert.match(generated.code, /capiMatrixBegin/);
  assert.match(generated.code, /constexpr bool CAPI_MATRIX_REVERSE = true;/);
  assert.match(generated.code, /capiMatrixStartScroll\("HOLA", 80, 1U, now\)/);
  assert.match(generated.code, /PATTERN_LED_MATRIX_1_[A-F0-9]+_HEART_[A-F0-9]+/);
  assert.doesNotMatch(generated.code, /delay\s*\(/);
}

console.log('LED matrix: model, pixels, scrolling and both generators passed.');
