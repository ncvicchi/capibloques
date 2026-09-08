import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateBuild } from './compiler-generate.mjs';

const examples = JSON.parse(readFileSync(new URL('../backend/tests/fixtures/projects-v2.json', import.meta.url)));
for (const source of examples) {
  const original = JSON.stringify(source);
  const wifi = JSON.stringify(source.workspace).includes('capi_wifi') ? { ssid: 'Prueba ñ', password: 'quote"\\$test' } : null;
  const a = generateBuild(source, 'arduino', wifi), b = generateBuild(source, 'esp-idf', wifi);
  assert.deepEqual(a.program, b.program);
  assert.equal(JSON.stringify(source), original);
  assert.equal(a.usesWifi, Boolean(wifi));
  if (wifi) {
    for (const output of [a, b]) {
      const text = Object.values(output.files).join('\n');
      assert.ok(!text.includes(wifi.ssid) && !text.includes(wifi.password));
      assert.ok(text.includes('\\161\\165\\157\\164\\145\\042'));
    }
    assert.throws(() => generateBuild(source, 'arduino'));
    assert.throws(() => generateBuild(source, 'esp-idf'));
  } else assert.throws(() => generateBuild(source, 'arduino', { ssid: 'Unneeded', password: '' }));
}
const defaults = structuredClone(examples[0]);
defaults.workspace.blocks.blocks[0].inputs.DO.block = {type:'capi_repeat',id:'repeat',inputs:{DO:{block:{type:'capi_wait',id:'wait'}}}};
const program = generateBuild(defaults,'arduino').program;
assert.equal(program.threads[0].nodes[0].count, 3); // Blockly default, not alternate compiler fallback.
assert.equal(program.threads[0].nodes[0].body[0].ms, 1000);
const legacy = structuredClone(defaults);
legacy.workspace.blocks.blocks.push({type:'capi_start',id:'second',y:100,inputs:{DO:{block:{type:'capi_serial',id:'say',fields:{TEXT:'Hola'}}}}});
assert.equal(generateBuild(legacy,'arduino').program.threads.length,1);
assert.equal(generateBuild(legacy,'arduino').program.threads[0].nodes[0].op,'parallel');
assert.equal(generateBuild(legacy,'arduino').program.threads[0].nodes[0].branches.length,2);
console.log('Server generator: shared Blockly defaults, framework parity, legacy parallel, credential escaping and non-mutation OK');
