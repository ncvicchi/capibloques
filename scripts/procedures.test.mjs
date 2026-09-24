import assert from 'node:assert/strict';
import { compileTaskGraph, expandProgramRoutines, generateEsp32CodeResult, generateEspIdfCodeResult, normalizeCompiledProgram, validateProgramForScene } from '../lib/capiblocks.ts';
import { createCapiRules } from '../lib/capi-rules.ts';
import { createEmptyScene } from '../lib/scene-model.ts';

const scene = createEmptyScene('Mis bloques');
const program = normalizeCompiledProgram({ version:2, variables:[{id:'total',name:'Total',type:'number'}], routines:[
  { id:'add-task', name:'sumar a total', kind:'procedure', parameters:[{id:'1',name:'cantidad',type:'number'}], body:[
    {op:'variableChange',variableId:'total',delta:{kind:'parameter',parameterId:'1',valueType:'number'},blockId:'task-add'},
  ], blockId:'task-definition' },
  { id:'sum-function', name:'sumar dos', kind:'function', returnType:'number', parameters:[{id:'1',name:'primero',type:'number'},{id:'2',name:'segundo',type:'number'}], body:[], returnValue:{kind:'math',operator:'ADD',left:{kind:'parameter',parameterId:'1',valueType:'number'},right:{kind:'parameter',parameterId:'2',valueType:'number'}}, blockId:'function-definition' },
], threads:[{id:'main',startBlockId:'start',nodes:[
  {op:'procedureCall',routineId:'add-task',arguments:[{kind:'number',value:3}],blockId:'call-one'},
  {op:'procedureCall',routineId:'add-task',arguments:[{kind:'functionCall',routineId:'sum-function',arguments:[{kind:'number',value:4},{kind:'number',value:5}],valueType:'number'}],blockId:'call-two'},
]}]}, scene);

assert.deepEqual(validateProgramForScene(program, scene).filter(item => item.severity === 'error'), []);
const expanded = expandProgramRoutines(program);
assert.equal(JSON.stringify(expanded.threads).includes('procedureCall'), false);
assert.equal(JSON.stringify(expanded.threads).includes('functionCall'), false);
assert.equal(JSON.stringify(expanded.threads).includes('"parameter"'), false);
const graph = compileTaskGraph(program);
assert.equal(graph[0].output.filter(item => item.op === 'variableChange').length, 2);
assert.equal(graph[0].output.filter(item => item.blockId === 'call-one').length, 2, 'la llamada debe quedar visible al entrar y volver');
for (const generated of [generateEsp32CodeResult(program,'Mis bloques',scene,'arduino'),generateEspIdfCodeResult(program,'Mis bloques',scene)]) {
  assert.deepEqual(generated.diagnostics.filter(item => item.severity === 'error'), []);
  assert.match(generated.code, /addCounter\([^,]+, 3\)/);
  assert.match(generated.code, /addCounter\([^,]+, \(4 \+ 5\)\)/);
}
assert.ok(createCapiRules(program, scene, 'wemos-d1-r32').instructionCount > 2);

const recursive = structuredClone(program);
recursive.routines[0].body = [{op:'procedureCall',routineId:'add-task',arguments:[{kind:'number',value:1}],blockId:'recursive'}];
assert.ok(validateProgramForScene(recursive, scene).some(item => item.code === 'routine-cycle'));
const badArgs = structuredClone(program);
badArgs.threads[0].nodes[0].arguments = [{kind:'text',value:'tres'}];
assert.ok(validateProgramForScene(badArgs, scene).some(item => item.code === 'routine-arguments'));

console.log('Procedimientos y funciones tipadas: OK');
