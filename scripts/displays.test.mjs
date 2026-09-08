import assert from 'node:assert/strict';
import {
  displayConfig,
  displayProfiles,
  displayTargets,
  layoutDisplayText,
  nextTextAreaId,
  validDisplayConfig,
} from '../lib/display-model.ts';
import {
  addDeviceToScene,
  cloneScene,
  createEmptyScene,
  duplicateSceneDevice,
  isSceneDefinition,
  removeDeviceFromScene,
  validateScene,
} from '../lib/scene-model.ts';
import {
  decodeProject,
  generateEsp32CodeResult,
  makeProject,
  validateProgramForScene,
} from '../lib/capiblocks.ts';

const wrap = (nodes) => ({
  version: 2,
  threads: [{ id: 'start', startBlockId: 'start', nodes }],
});
for (const profile of Object.keys(displayProfiles)) {
  const config = displayConfig(profile);
  assert.equal(validDisplayConfig(config), true, profile);
  const { scene, device } = addDeviceToScene(
    createEmptyScene('Pantalla'),
    'display',
    { config },
  );
  assert.equal(validateScene(scene).hardwareReady, true, profile);
  assert.equal(isSceneDefinition(scene), true);
  assert.equal(duplicateSceneDevice(scene, device.id), null);
  assert.throws(() => addDeviceToScene(scene, 'display'), /una sola pantalla/);
  const doubled = cloneScene(scene);
  doubled.devices.push({
    ...structuredClone(device),
    id: 'second',
    name: 'Otra',
  });
  assert.ok(
    validateScene(doubled).issues.some(
      (issue) => issue.code === 'display-limit',
    ),
  );
  const target = displayTargets(config)[0];
  const nodes = [
    {
      op: 'displayWrite',
      deviceId: device.id,
      areaId: target.id,
      text: '¡Hola, pingüino! 🐧\nESP32',
      blockId: 'write',
    },
    {
      op: 'displayClear',
      deviceId: device.id,
      areaId: target.id,
      blockId: 'clear',
    },
  ];
  const generated = generateEsp32CodeResult(wrap(nodes), profile, scene);
  assert.equal(
    generated.diagnostics.filter((item) => item.severity === 'error').length,
    0,
    profile,
  );
  assert.match(generated.code, /capiDisplayWrite\(0, 0/);
  assert.doesNotMatch(generated.code, /Serial.println\("!Hola/);
  assert.doesNotMatch(generated.code, /delay\(/);
  if (profile === 'ili9488')
    assert.match(generated.code, /Arduino_ILI9488_18bit/);
  const saved = makeProject('Texto', scene, {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'capi_start',
          id: 'start',
          inputs: {
            DO: {
              block: {
                type: 'capi_display_write',
                id: 'write',
                fields: {
                  DEVICE_ID: device.id,
                  AREA_ID: target.id,
                  TEXT: 'Hola',
                },
              },
            },
          },
        },
      ],
    },
  });
  assert.deepEqual(decodeProject(saved).project.scene, scene);
  assert.ok(
    validateProgramForScene(
      wrap(nodes),
      removeDeviceFromScene(scene, device.id),
    ).some((issue) => issue.code === 'target-missing'),
  );
  if (config.areas.length) {
    const copy = cloneScene(scene);
    copy.devices[0].config.areas[0].name = 'Copia';
    assert.equal(scene.devices[0].config.areas[0].name, 'Mensaje');
    copy.devices[0].config.retiredAreaIds.push(target.id);
    copy.devices[0].config.areas = [];
    assert.notEqual(nextTextAreaId(copy.devices[0].config), target.id);
    assert.ok(
      validateProgramForScene(wrap(nodes), copy).some(
        (issue) => issue.code === 'display-area-missing',
      ),
    );
  }
}
assert.deepEqual(layoutDisplayText('abcd\nEF', { columns: 4, rows: 2 }).lines, [
  'abcd',
  'EF  ',
]);
assert.deepEqual(
  layoutDisplayText('abcd\n\nZ', { columns: 4, rows: 3 }).lines,
  ['abcd', '    ', 'Z   '],
);
assert.deepEqual(layoutDisplayText('\n\nZ', { columns: 4, rows: 3 }).lines, [
  '    ',
  '    ',
  'Z   ',
]);
assert.equal(layoutDisplayText('áñü😀', { columns: 4, rows: 1 }).cells, 'anu?');
assert.equal(layoutDisplayText('ABCDE', { columns: 4, rows: 1 }).clipped, true);
const config = displayConfig('ssd1306');
for (const patch of [
  { profile: 'unknown' },
  { address: 0x27 },
  {
    areas: [...config.areas, { ...config.areas[0], id: 'other', name: 'Otro' }],
  },
  { retiredAreaIds: ['text-1'] },
  { areas: [{ ...config.areas[0], columns: 17 }] },
  { areas: [{ ...config.areas[0], row: -1 }] },
])
  assert.equal(validDisplayConfig({ ...config, ...patch }), false);

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
const state = () =>
  messages.findLast((message) => message.type === 'SNAPSHOT')?.state;
config.areas.push({
  id: 'second',
  name: 'Estado',
  column: 0,
  row: 5,
  columns: 16,
  rows: 2,
});
const { scene, device } = addDeviceToScene(
  createEmptyScene('Dos zonas'),
  'display',
  { config },
);
const program = wrap([
  {
    op: 'displayWrite',
    deviceId: device.id,
    areaId: 'text-1',
    text: 'Hola',
    blockId: 'write',
  },
  {
    op: 'displayWrite',
    deviceId: device.id,
    areaId: 'second',
    text: 'Sigue aqui',
    blockId: 'second',
  },
  { op: 'wait', ms: 48, blockId: 'wait' },
  {
    op: 'displayClear',
    deviceId: device.id,
    areaId: 'text-1',
    blockId: 'clear',
  },
  { op: 'serial', text: 'Solo consola', blockId: 'console' },
]);
const runs = [];
for (const mode of ['normal', 'guided']) {
  send({ type: 'LOAD', scene, program });
  send({ type: 'SET_MODE', mode });
  if (mode === 'normal') send({ type: 'RUN' });
  for (let turn = 0; turn < 50 && state().status !== 'done'; turn++) {
    if (mode === 'guided') send({ type: 'STEP' });
    else {
      clock += 16;
      tick();
      send({ type: 'SET_INPUT', name: 'wifiAvailable', value: true });
    }
  }
  assert.equal(state().status, 'done');
  assert.equal(state().devices[device.id].texts['text-1'].join('').trim(), '');
  assert.equal(state().devices[device.id].texts.second[0].trim(), 'Sigue aqui');
  assert.ok(state().console.some((line) => line.includes('Solo consola')));
  assert.ok(
    !state().console.some(
      (line) => line.includes('Hola') || line.includes('Sigue aqui'),
    ),
  );
  assert.ok(
    state().execution.trace.some(
      (event) => event.blockId === 'write' && event.deviceId === device.id,
    ),
  );
  runs.push(state().devices);
}
assert.deepEqual(...runs);
send({ type: 'RESET' });
assert.equal(state().devices[device.id].texts.second.join('').trim(), '');
console.log(
  'Displays: five profiles, one screen, JSON, isolated areas, orphan identities, text layout, worker modes and generated adapters passed.',
);
