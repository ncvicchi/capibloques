import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import {
  challengeCatalog,
  decodeChallenge,
  variantScene,
  challengeSeed,
  challengeExpectations,
} from '../lib/challenges.ts';
import {
  registerBlocks,
  compileWorkspace,
  workspaceDevices,
} from '../lib/blockly-engine.ts';
import {
  normalizeCompiledProgram,
  validateProgramForScene,
  compileTaskGraph,
  generateEsp32CodeResult,
  generateEspIdfCodeResult,
  expandProgramRoutines,
} from '../lib/capiblocks.ts';
import { createCapiRules } from '../lib/capi-rules.ts';

globalThis.self = { postMessage() {}, addEventListener() {} };
globalThis.setInterval = () => 0;
const { assessChallenge } = await import('../lib/simulator.worker.ts');
registerBlocks(Blockly);
for (const challenge of challengeCatalog) {
  decodeChallenge(challenge);
  for (const type of challenge.palette)
    assert.ok(Blockly.Blocks[type], `${challenge.id}: unknown palette ${type}`);
  const workspace = new Blockly.Workspace();
  workspaceDevices.set(workspace, challenge.initial.scene.devices);
  Blockly.serialization.workspaces.load(challenge.initial.workspace, workspace);
  assert.ok(compileWorkspace(workspace).threads.length);
  workspace.dispose();
}
const scene = challengeCatalog[0].initial.scene,
  led = scene.devices.find((d) => d.kind === 'led').id;
const node = (brightness) => ({
  op: 'led',
  deviceId: led,
  brightness,
  blockId: `led-${brightness}`,
});
const program = (nodes) => normalizeCompiledProgram(nodes, scene);
assert.equal(
  assessChallenge(challengeCatalog[0], program([node(100)])).status,
  'passed',
);
assert.equal(
  assessChallenge(
    challengeCatalog[0],
    program([{ op: 'counterSet', value: 0, blockId: 'extra' }, node(100)]),
  ).status,
  'passed',
  'alternative solution allowed',
);
assert.equal(
  assessChallenge(challengeCatalog[0], program([node(25)])).status,
  'retry',
);
const button = scene.devices.find((d) => d.kind === 'button').id;
const switchNode = {
  op: 'switch',
  value: { kind: 'buttonValue', deviceId: button },
  cases: [
    { value: { kind: 'boolean', value: true }, body: [node(100)] },
    { value: { kind: 'boolean', value: false }, body: [node(25)] },
  ],
  otherwise: [],
  blockId: 'switch',
};
assert.equal(
  assessChallenge(challengeCatalog[9], program([switchNode])).status,
  'passed',
);
assert.equal(
  assessChallenge(challengeCatalog[9], program([node(100)])).status,
  'retry',
  'one fixed response fails alternate input',
);
assert.equal(
  assessChallenge(
    challengeCatalog[3],
    program([
      {
        op: 'if',
        condition: { kind: 'buttonPressed', deviceId: button },
        consequent: [node(100)],
        otherwise: [node(0)],
        blockId: 'if',
      },
    ]),
  ).status,
  'passed',
);
const duplicate = structuredClone(switchNode);
duplicate.cases[1].value = { kind: 'boolean', value: true };
assert.ok(
  validateProgramForScene(program([duplicate]), scene).some(
    (d) => d.code === 'switch-case-value',
  ),
);
const wrongType = structuredClone(switchNode);
wrongType.cases[1].value = { kind: 'text', value: 'false' };
assert.equal(
  assessChallenge(challengeCatalog[9], program([wrongType])).status,
  'invalid',
);
const dispatch = compileTaskGraph(program([switchNode]))[0].output.find(
  (n) => n.op === 'switchDispatch',
);
assert.equal(dispatch.cases.length, 2);
assert.notEqual(dispatch.cases[0].target, dispatch.cases[1].target);
assert.ok(
  createCapiRules(
    program([switchNode]),
    scene,
    'wemos-d1-r32',
  ).requiredCapabilities.includes('switch'),
);
const numeric = program([
  {
    ...switchNode,
    value: { kind: 'number', value: 2 },
    cases: [
      { value: { kind: 'number', value: 1 }, body: [node(0)] },
      { value: { kind: 'number', value: 2 }, body: [node(100)] },
    ],
  },
]);
for (const generated of [
  generateEsp32CodeResult(numeric, 'Según', scene),
  generateEspIdfCodeResult(numeric, 'Según', scene),
]) {
  assert.ok(generated.code);
  assert.match(generated.code, /const auto selected = \(2\)/);
  assert.match(generated.code, /if \(selected == \(1\)\)/);
}
const defaultCase = program([
  {
    ...switchNode,
    value: { kind: 'text', value: 'otro' },
    cases: [
      { value: { kind: 'text', value: 'uno' }, body: [node(0)] },
      { value: { kind: 'text', value: 'dos' }, body: [node(25)] },
    ],
    otherwise: [node(100)],
  },
]);
assert.equal(
  assessChallenge(challengeCatalog[0], defaultCase).status,
  'passed',
  'default branch',
);
const called = normalizeCompiledProgram(
  {
    threads: [
      {
        id: 'main',
        startBlockId: 'start',
        nodes: [
          {
            op: 'procedureCall',
            routineId: 'pick',
            arguments: [{ kind: 'boolean', value: true }],
            blockId: 'call',
          },
        ],
      },
    ],
    routines: [
      {
        id: 'pick',
        name: 'Elegir',
        kind: 'procedure',
        parameters: [{ id: '1', name: 'opcion', type: 'boolean' }],
        body: [
          {
            ...switchNode,
            value: {
              kind: 'parameter',
              parameterId: '1',
              valueType: 'boolean',
            },
          },
        ],
        blockId: 'definition',
      },
    ],
  },
  scene,
);
assert.equal(
  expandProgramRoutines(called).threads[0].nodes[1].value.kind,
  'boolean',
);
assert.equal(assessChallenge(challengeCatalog[0], called).status, 'passed');
assert.equal(
  challengeExpectations(program([node(100)]), challengeCatalog[2]).requirements
    .length,
  1,
);
assert.deepEqual(
  variantScene(challengeCatalog[3], challengeCatalog[3].variants[0]),
  variantScene(challengeCatalog[3], challengeCatalog[3].variants[0]),
);
assert.equal(challengeSeed(77)(), challengeSeed(77)());
const ws = new Blockly.Workspace();
workspaceDevices.set(ws, scene.devices);
const b = ws.newBlock('capi_switch');
assert.equal(b.getFieldValue('CASES'), '2');
b.setFieldValue('boolean', 'CASE_TYPE');
assert.equal(b.getFieldValue('CASE_VALUE0'), 'true');
assert.equal(b.getFieldValue('CASE_VALUE1'), 'false');
b.setFieldValue('traffic', 'CASE_TYPE');
assert.equal(b.getFieldValue('CASE_VALUE1'), 'RED');
b.setFieldValue('4', 'CASES');
assert.ok(b.getInput('CASE3'));
const saved = Blockly.serialization.workspaces.save(ws);
const copy = new Blockly.Workspace();
workspaceDevices.set(copy, scene.devices);
Blockly.serialization.workspaces.load(saved, copy);
assert.equal(
  copy
    .getAllBlocks()
    .find((b) => b.type === 'capi_switch')
    .getFieldValue('CASE_VALUE3'),
  'GREEN',
);
ws.dispose();
copy.dispose();
const bad = structuredClone(challengeCatalog[0]);
bad.variants[0].goals[0].atMs = 120001;
assert.throws(() => decodeChallenge(bad));
const wait = (ms) => ({ op: 'wait', ms, blockId: `wait-${ms}` });
const flash = [node(100), wait(1000), node(0), wait(1000)];
const buttonIf = (otherwise) => ({
  op: 'if',
  condition: { kind: 'buttonPressed', deviceId: button },
  consequent: [node(100)],
  otherwise: [node(otherwise)],
  blockId: 'if',
});
const routine = {
  id: 'on',
  name: 'Encender',
  kind: 'procedure',
  parameters: [],
  body: [node(100)],
  blockId: 'on-def',
};
const routineProgram = (parameters) =>
  normalizeCompiledProgram(
    {
      threads: [
        {
          id: 'main',
          startBlockId: 'start',
          nodes: [
            {
              op: 'procedureCall',
              routineId: 'on',
              arguments: parameters ? [{ kind: 'number', value: 100 }] : [],
              blockId: 'call',
            },
          ],
        },
      ],
      routines: [
        {
          ...routine,
          parameters: parameters
            ? [{ id: 'power', name: 'Potencia', type: 'number' }]
            : [],
          body: parameters
            ? [
                {
                  ...node(0),
                  expression: {
                    kind: 'parameter',
                    parameterId: 'power',
                    valueType: 'number',
                  },
                },
              ]
            : routine.body,
        },
      ],
    },
    scene,
  );
// Parameters are usable through expressions in a variable, then an action value.
const parameterProgram = normalizeCompiledProgram(
  {
    variables: [
      { id: 'powerValue', name: 'Potencia', type: 'number', initialValue: 0 },
    ],
    threads: [
      {
        id: 'main',
        startBlockId: 'start',
        nodes: [
          {
            op: 'procedureCall',
            routineId: 'on',
            arguments: [{ kind: 'number', value: 100 }],
            blockId: 'call',
          },
        ],
      },
    ],
    routines: [
      {
        ...routine,
        parameters: [{ id: 'power', name: 'Potencia', type: 'number' }],
        body: [
          {
            op: 'variableSet',
            variableId: 'powerValue',
            value: {
              kind: 'parameter',
              parameterId: 'power',
              valueType: 'number',
            },
            blockId: 'read-input',
          },
          node(100),
        ],
      },
    ],
  },
  scene,
);
const solutions = [
  program([node(100)]),
  program([{ op: 'repeat', count: 3, body: flash, blockId: 'loop' }]),
  routineProgram(false),
  program([buttonIf(0)]),
  program([buttonIf(25)]),
  program([
    {
      op: 'while',
      condition: { kind: 'buttonPressed', deviceId: button },
      until: false,
      body: [node(100), wait(20)],
      blockId: 'while',
    },
    node(0),
  ]),
  program([
    {
      op: 'if',
      condition: {
        kind: 'valueCompare',
        operator: 'LT',
        left: {
          kind: 'sensorValue',
          deviceId: scene.devices.find((d) => d.kind === 'potentiometer').id,
        },
        right: { kind: 'number', value: 2000 },
      },
      consequent: [node(0)],
      otherwise: [node(100)],
      blockId: 'perilla',
    },
  ]),
  program([
    { op: 'counterSet', value: 5, blockId: 'count' },
    {
      op: 'serial',
      text: '',
      expression: {
        kind: 'join',
        parts: [{ kind: 'text', value: 'Valor: ' }, { kind: 'counterValue' }],
      },
      blockId: 'text',
    },
  ]),
  parameterProgram,
  program([switchNode]),
  program([node(100), wait(1000), node(0)]),
  program([
    {
      op: 'parallel',
      branches: [
        [node(100), wait(2000), node(0)],
        [{ op: 'counterSet', value: 3, blockId: 'count' }],
      ],
      blockId: 'parallel',
    },
  ]),
  program([node(100)]),
  normalizeCompiledProgram(
    [
      {
        op: 'displayWrite',
        deviceId: 'challenge-display',
        areaId: 'screen',
        text: 'HOLA',
        blockId: 'display',
      },
      { op: 'serial', text: 'LISTO', blockId: 'serial' },
    ],
    challengeCatalog[13].initial.scene,
  ),
  program([{ op: 'repeat', count: 3, body: flash, blockId: 'refactor' }]),
  program([node(100), wait(1000), node(0)]),
  program([]),
];
for (let i = 0; i < challengeCatalog.length; i++) {
  const challenge = challengeCatalog[i],
    correct = solutions[i];
  const result = assessChallenge(challenge, correct);
  assert.equal(
    result.status,
    challenge.mode === 'creative' ? 'creative' : 'passed',
    `${challenge.id}: working solution ${JSON.stringify(result)}`,
  );
  const alternative = structuredClone(correct);
  alternative.threads[0].nodes.unshift(wait(16));
  assert.equal(
    assessChallenge(challenge, alternative).status,
    challenge.mode === 'creative' ? 'creative' : 'passed',
    `${challenge.id}: alternative`,
  );
  if (challenge.mode !== 'creative')
    assert.equal(
      assessChallenge(
        challenge,
        normalizeCompiledProgram([], challenge.initial.scene),
      ).status,
      'retry',
      `${challenge.id}: incomplete solution`,
    );
  if(challenge.mode!=='creative'){
    const near=JSON.parse(JSON.stringify(correct).replaceAll('"brightness":100','"brightness":99').replaceAll('"value":5','"value":4').replaceAll('"text":"HOLA"','"text":"HOLO"'));
    assert.equal(assessChallenge(challenge,near).status,'retry',`${challenge.id}: near incorrect solution`);
  }
}
assert.ok(
  createCapiRules(
    solutions[5],
    scene,
    'wemos-d1-r32',
  ).requiredCapabilities.includes('conditional-loop'),
);
for (const generator of [generateEsp32CodeResult, generateEspIdfCodeResult])
  assert.ok(generator(solutions[5], 'Mientras', scene).code);
const malformedInput = structuredClone(challengeCatalog[3]);
malformedInput.variants[0].inputs[0].values = ['false'];
assert.throws(() => decodeChallenge(malformedInput));
console.log(
  'Desafíos y Según: catálogo, variantes, alternativas, límites, Blockly, simulador y generadores OK.',
);
