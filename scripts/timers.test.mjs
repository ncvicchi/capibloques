import assert from 'node:assert/strict';
import { generateEsp32CodeResult, generateEspIdfCodeResult, normalizeCompiledProgram, validateProgramForScene } from '../lib/capiblocks.ts';
import { createCapiRules, parseCapiRules } from '../lib/capi-rules.ts';
import { createEmptyScene } from '../lib/scene-model.ts';

const scene = createEmptyScene('Temporizadores');
const program = {
  version: 2,
  timers: [{ id: 'pulse', name: 'Pulso' }],
  variables: [],
  threads: [{ id: 'main', startBlockId: 'start', nodes: [
    { op: 'timerStart', timerId: 'pulse', durationMs: 1500, repeat: true, blockId: 'timer-start' },
    { op: 'timerWait', timerId: 'pulse', blockId: 'timer-wait' },
    { op: 'if', condition: { kind: 'valueCompare', operator: 'GTE', left: { kind: 'timerElapsed', timerId: 'pulse' }, right: { kind: 'number', value: 1 } }, consequent: [
      { op: 'serial', text: '', expression: { kind: 'join', parts: [{ kind: 'text', value: 'Restan ' }, { kind: 'timerRemaining', timerId: 'pulse' }] }, blockId: 'timer-message' },
    ], otherwise: [], blockId: 'timer-if' },
    { op: 'timerStop', timerId: 'pulse', blockId: 'timer-stop' },
  ] }],
};

const normalized = normalizeCompiledProgram(program, scene);
assert.deepEqual(normalized.timers, program.timers);
assert.deepEqual(validateProgramForScene(normalized, scene, 'wemos-d1-r32').filter(item => item.severity === 'error'), []);
const arduino = generateEsp32CodeResult(normalized, 'Temporizadores', scene, 'arduino', 'wemos-d1-r32').code;
const idf = generateEspIdfCodeResult(normalized, 'Temporizadores', scene, 'wemos-d1-r32').code;
for (const source of [arduino, idf]) {
  assert.match(source, /capiTimerStart\(0, 1500U, true, now\)/);
  assert.match(source, /capiTimerService\(now\)/);
  assert.match(source, /capiTimerConsume\(0\)/);
  assert.match(source, /capiTimerElapsed\(0\)/);
  assert.match(source, /capiTimerRemaining\(0\)/);
}
const rules = createCapiRules(normalized, scene, 'wemos-d1-r32');
assert.ok(rules.requiredCapabilities.includes('timers'));
assert.deepEqual(rules.document.timers, program.timers);
assert.ok(parseCapiRules(rules.bytes, 'wemos-d1-r32').requiredCapabilities.includes('timers'));

const missing = structuredClone(program);
missing.threads[0].nodes[0].timerId = 'missing';
assert.ok(validateProgramForScene(normalizeCompiledProgram(missing, scene), scene, 'wemos-d1-r32').some(item => item.code === 'timer-missing'));

console.log('Temporizadores cooperativos: OK');
