import assert from 'node:assert/strict';
import {
  compileTaskGraph,
  generateEsp32CodeResult,
  validateProgramForScene,
} from '../lib/capiblocks.ts';
import { createEmptyScene } from '../lib/scene-model.ts';

let clock = 0,
  listener,
  tick;
const messages = [];
Object.defineProperty(globalThis, 'performance', {
  configurable: true,
  value: { now: () => clock },
});
globalThis.self = {
  postMessage: (message) => messages.push(structuredClone(message)),
  addEventListener: (_, callback) => {
    listener = callback;
  },
};
globalThis.setInterval = (callback) => {
  tick = callback;
  return 1;
};
await import('../lib/simulator.worker.ts');
const send = (data) => listener({ data });
const advance = (milliseconds) => {
  clock += milliseconds;
  tick();
};
const state = () =>
  messages.findLast((message) => message.type === 'SNAPSHOT')?.state;
const scene = createEmptyScene('Paralelo y paso');
const action = (id, delta = 1) => ({ op: 'counterChange', delta, blockId: id });
const wait = (id, ms) => ({ op: 'wait', ms, blockId: id });
const parallel = (id, branches) => ({ op: 'parallel', branches, blockId: id });
const wrap = (nodes) => ({
  version: 2,
  threads: [{ id: 'start', startBlockId: 'start', nodes }],
});
const example = wrap([
  { op: 'counterSet', value: 0, blockId: 'zero' },
  parallel('roads', [
    [
      {
        op: 'repeat',
        count: 2,
        blockId: 'loop',
        body: [action('left'), wait('left-wait', 48)],
      },
    ],
    [
      wait('right-wait', 80),
      {
        op: 'if',
        blockId: 'condition',
        condition: { kind: 'counter', operator: 'GTE', value: 1 },
        consequent: [action('yes', 10)],
        otherwise: [action('no', -100)],
      },
    ],
  ]),
  action('after-join', 100),
]);

function run(program, guided) {
  messages.length = 0;
  send({ type: 'LOAD', scene, program });
  send({ type: 'SET_MODE', mode: guided ? 'guided' : 'normal' });
  if (!guided) send({ type: 'RUN' });
  const events = new Map();
  for (let turn = 0; turn < 500 && state().status !== 'done'; turn++) {
    if (guided) send({ type: 'STEP' });
    else {
      advance(16);
      send({ type: 'SET_INPUT', name: 'wifiAvailable', value: true });
    }
    for (const event of state().execution.trace) events.set(event.seq, event);
  }
  assert.equal(state().status, 'done');
  return {
    state: state(),
    trace: [...events.values()].map(({ seq, ...event }) => event),
  };
}
const normal = run(example, false),
  guided = run(example, true);
assert.equal(normal.state.counter, 112);
assert.equal(guided.state.counter, 112);
assert.deepEqual(
  guided.trace,
  normal.trace,
  'normal and guided keep condition results, ordering and logical times',
);
assert.ok(
  guided.trace.some(
    (event) =>
      event.blockId === 'condition' && event.message.includes('verdadera'),
  ),
);
assert.ok(
  guided.trace.findIndex((event) => event.blockId === 'after-join') >
    guided.trace.findIndex((event) => event.blockId === 'yes'),
);
assert.ok(
  guided.trace.some((event) => event.message.includes('Terminó la espera')),
);
const generated = generateEsp32CodeResult(example, 'Concurrencia', scene);
assert.equal(
  generated.diagnostics.filter((item) => item.severity === 'error').length,
  0,
);
assert.match(generated.code, /if \(active_T1 \|\| active_T2\) return;/);
assert.match(
  generated.code,
  /for \(auto &value : loopCounters_T1\) value = -1;/,
);
assert.doesNotMatch(generated.code, /delay\(/);
assert.deepEqual(
  compileTaskGraph(example).map((task) => task.initial),
  [true, false, false],
);

const nested = wrap([
  {
    op: 'repeat',
    count: 3,
    blockId: 'outer',
    body: [
      parallel('nested-parent', [
        [parallel('nested-child', [[action('a')], [action('b')]])],
        [action('c')],
      ]),
    ],
  },
  action('end'),
]);
assert.equal(
  run(nested, true).state.counter,
  10,
  'join resets child loops and can be reused inside loops',
);
assert.deepEqual(run(nested, true).trace, run(nested, false).trace);
const legacy = {
  version: 2,
  threads: [
    {
      id: 'a',
      startBlockId: 'start-a',
      nodes: [action('a'), wait('wa', 32), action('aa')],
    },
    {
      id: 'b',
      startBlockId: 'start-b',
      nodes: [action('b'), wait('wb', 64), action('bb')],
    },
  ],
};
const migrated = wrap([
  parallel(
    'migrated',
    legacy.threads.map((thread) => thread.nodes),
  ),
]);
assert.deepEqual(run(migrated, true).trace, run(migrated, false).trace);
assert.ok(run(migrated, true).trace[0].message.includes('caminos al mismo tiempo'));
const actions = (result) =>
  result.trace
    .filter((item) => ['a', 'b', 'aa', 'bb', 'wa', 'wb'].includes(item.blockId))
    .map((item) => [item.blockId, item.now, item.message]);
assert.deepEqual(
  actions(run(legacy, false)),
  actions(run(migrated, false)),
  'migration keeps old thread budgets/order/timing',
);

send({ type: 'LOAD', scene, program: example });
send({ type: 'SET_MODE', mode: 'guided' });
send({ type: 'RUN' });
advance(16);
const first = state().execution.awaitingFrame;
assert.ok(first > 0);
const counter = state().counter;
for (let i = 0; i < 50; i++) advance(100);
assert.equal(
  state().counter,
  counter,
  'guided has backpressure until the UI displays the frame',
);
send({ type: 'FRAME_SHOWN', seq: first - 1 });
advance(1000);
assert.equal(
  state().execution.awaitingFrame,
  first,
  'old ACK cannot advance another event',
);
send({ type: 'FRAME_SHOWN', seq: first });
advance(800);
assert.ok(state().execution.awaitingFrame > first);
send({ type: 'PAUSE' });
const pausedNow = state().now;
advance(1000);
assert.equal(state().now, pausedNow);
send({ type: 'SET_MODE', mode: 'normal' });
send({ type: 'RUN' });
for (let i = 0; i < 50; i++) advance(16);
assert.equal(
  state().counter,
  112,
  'switching mode resumes, not resets/repeats',
);

send({
  type: 'LOAD',
  scene,
  program: wrap([
    parallel('forever-and-finite', [
      [
        {
          op: 'repeat',
          count: -1,
          blockId: 'forever',
          body: [action('again')],
        },
      ],
      [action('one-time')],
    ]),
    action('never', 1000),
  ]),
});
send({ type: 'RUN' });
for (let i = 0; i < 100; i++) advance(16);
assert.equal(state().status, 'running');
assert.equal(state().execution.trace.length, 30, 'trace has a hard bound');
assert.ok(
  !state().execution.trace.some((event) => event.blockId === 'never'),
  'infinite child prevents continuation',
);
send({ type: 'STOP' });
assert.equal(state().status, 'stopped');
assert.deepEqual(state().execution.tasks, [], 'Stop clears every transient path indicator');
assert.deepEqual(state().activeBlockIds, {});

send({
  type: 'LOAD',
  scene,
  program: wrap([
    parallel('progress-roads', [
      [
        {
          op: 'repeat',
          count: 2,
          blockId: 'progress-loop',
          body: [wait('short-delay', 500)],
        },
      ],
      [wait('long-delay', 1000)],
    ]),
  ]),
});
send({ type: 'RUN' });
advance(16);
const progress = state().execution.tasks.filter(task => task.status === 'waiting');
assert.deepEqual(progress.map(task => task.label), ['Camino 1', 'Camino 2']);
assert.deepEqual(progress.map(task => task.blockId), ['short-delay', 'long-delay']);
assert.deepEqual(progress.map(task => task.durationMs), [500, 1000]);
assert.ok(progress[0].remainingMs < progress[1].remainingMs);
assert.equal(progress[0].iteration, 1);
assert.equal(progress[0].totalIterations, 2);
send({ type: 'PAUSE' });
const pausedProgress = structuredClone(state().execution.tasks);
advance(1000);
assert.deepEqual(
  state().execution.tasks,
  pausedProgress,
  'pause freezes each path progress on the logical clock',
);
send({ type: 'STOP' });
assert.deepEqual(state().execution.tasks, []);

const excessive = wrap([
  parallel(
    'too-wide',
    Array.from({ length: 33 }, () => []),
  ),
]);
assert.ok(
  validateProgramForScene(excessive, scene).some(
    (item) => item.severity === 'error',
  ),
);
assert.throws(() => compileTaskGraph(excessive));
console.log(
  'Programming experience: fork/join, legacy timing, normal/guided parity, bounded trace and backpressure passed.',
);
