import assert from 'node:assert/strict';
import {
  displayConfig,
  displayArtworks,
  displayProfiles,
  displayTargets,
  layoutDisplayText,
  nextTextAreaId,
  validDisplayConfig,
} from '../lib/display-model.ts';
import {
  BUILTIN_DISPLAY_ARTWORKS,
  displayArtworkPixel,
} from '../lib/display-graphics.ts';
import {
  addDeviceToScene,
  cloneScene,
  createEmptyScene,
  duplicateSceneDevice,
  isSceneDefinition,
  migrateSceneDefinition,
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
  if (profile === 'lcd1602keypad') nodes.push({
    op: 'if',
    condition: { kind: 'displayButtonPressed', deviceId: device.id, button: 'SELECT' },
    consequent: [{ op: 'serial', text: 'Elegir', blockId: 'selected' }],
    otherwise: [],
    blockId: 'keypad-condition',
  });
  if (displayProfiles[profile].graphic) {
    nodes.push(
      {
        op: 'displayAnimateText',
        deviceId: device.id,
        areaId: target.id,
        text: 'Hola animado',
        effect: 'type',
        repeatCount: 1,
        blockId: 'animate',
      },
      {
        op: 'displayArtwork',
        deviceId: device.id,
        artworkId: 'builtin-robot',
        effect: 'slide',
        repeatCount: 1,
        blockId: 'artwork',
      },
    );
  }
  const generated = generateEsp32CodeResult(wrap(nodes), profile, scene);
  assert.equal(
    generated.diagnostics.filter((item) => item.severity === 'error').length,
    0,
    profile,
  );
  assert.match(generated.code, /capiDisplayWrite\(0, 0/);
  if (displayProfiles[profile].graphic) {
    assert.match(generated.code, /capiDisplayStartText\(/);
    assert.match(generated.code, /capiDisplayStartArtwork\(/);
    assert.match(generated.code, /DISPLAY_ART_/);
  }
  if (profile === 'lcd1602keypad') {
    assert.match(generated.code, /capiDisplayButtonPressed\(4\)/);
    assert.match(generated.code, /LiquidCrystal capiScreen/);
  }
  assert.ok(generated.code.indexOf('struct TrafficDevice') < generated.code.indexOf('void capiDisplayWrite'), 'Arduino inserts prototypes before the first sketch function: declare helper types first');
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
assert.equal(displayArtworks(config).length, 1);
assert.equal(BUILTIN_DISPLAY_ARTWORKS.some(item => item.id === 'builtin-capybara'), true);
assert.notDeepEqual(
  displayArtworkPixel(displayArtworks(config)[0].rows, 3, 2, true),
  displayArtworks(config)[0].rows,
);
const legacyConfig = structuredClone(config);
delete legacyConfig.animationSpeed;
delete legacyConfig.artworks;
delete legacyConfig.retiredArtworkIds;
assert.equal(validDisplayConfig(legacyConfig), true, 'legacy displays remain importable');
const legacyPinScene = addDeviceToScene(createEmptyScene('Pantalla anterior'), 'display', { config: displayConfig('lcd1602') }).scene;
for (const key of ['rs', 'en', 'd4', 'd5', 'd6', 'd7', 'backlight', 'keys']) delete legacyPinScene.devices[0].pins[key];
const migratedPins = migrateSceneDefinition(legacyPinScene);
assert.equal(migratedPins.migrated, true, 'legacy display pin maps are expanded');
assert.equal(migratedPins.scene.devices[0].pins.sda, legacyPinScene.devices[0].pins.sda);
assert.equal(migratedPins.scene.devices[0].pins.keys, null);
const plainLcd = migratedPins.scene.devices[0];
assert.ok(validateProgramForScene(wrap([{
  op: 'if',
  condition: { kind: 'displayButtonPressed', deviceId: plainLcd.id, button: 'SELECT' },
  consequent: [], otherwise: [], blockId: 'wrong-keypad',
}]), migratedPins.scene).some(issue => issue.code === 'target-kind-mismatch'));
assert.equal(
  layoutDisplayText(String.fromCharCode(92, 126), { columns: 2, rows: 1 })
    .cells,
  '??',
);
const unfinished = addDeviceToScene(createEmptyScene('Borrador'), 'display', {
  config,
}).scene;
unfinished.devices[0].config.areas[0].name = '';
unfinished.devices[0].config.areas[0].rows = 0;
assert.equal(
  isSceneDefinition(unfinished),
  false,
  'a project cannot use an unfinished layout',
);
assert.equal(
  isSceneDefinition(unfinished, true),
  true,
  'a bounded unfinished layout can be recovered locally',
);
assert.equal(validateScene(unfinished).canSimulate, false);
unfinished.devices[0].config.profile = 'constructor';
const invalidCode = generateEsp32CodeResult(
  wrap([
    {
      op: 'displayWrite',
      deviceId: unfinished.devices[0].id,
      areaId: 'text-1',
      text: 'Hola',
      blockId: 'bad',
    },
  ]),
  'Inválido',
  unfinished,
);
assert.match(invalidCode.code, /#error/);
for (const patch of [
  { profile: 'unknown' },
  { address: 0x27 },
  {
    areas: [...config.areas, { ...config.areas[0], id: 'other', name: 'Otro' }],
  },
  { retiredAreaIds: ['text-1'] },
  { areas: [{ ...config.areas[0], columns: 17 }] },
  { areas: [{ ...config.areas[0], row: -1 }] },
  { artworks: [{ id: 'bad', name: 'Mal', rows: [1] }] },
  { animationSpeed: 'turbo' },
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
const animatedConfig = displayConfig('ssd1306');
animatedConfig.animationSpeed = 'fast';
const animated = addDeviceToScene(
  createEmptyScene('Dibujos animados'),
  'display',
  { config: animatedConfig },
);
const animatedArea = displayTargets(animatedConfig)[0];
send({
  type: 'LOAD',
  scene: animated.scene,
  program: wrap([
    {
      op: 'displayAnimateText',
      deviceId: animated.device.id,
      areaId: animatedArea.id,
      text: 'Hola',
      effect: 'type',
      repeatCount: 1,
      blockId: 'animated-text',
    },
    { op: 'visualWait', deviceId: animated.device.id, blockId: 'wait-text' },
    {
      op: 'displayArtwork',
      deviceId: animated.device.id,
      artworkId: 'builtin-capybara',
      effect: 'blink',
      repeatCount: 2,
      blockId: 'animated-artwork',
    },
  ]),
});
send({ type: 'SET_MODE', mode: 'normal' });
send({ type: 'RUN' });
for (let turn = 0; turn < 400 && state().status !== 'done'; turn += 1) {
  clock += 16;
  tick();
}
assert.equal(state().status, 'done');
assert.deepEqual(
  state().devices[animated.device.id].artworkRows,
  BUILTIN_DISPLAY_ARTWORKS.find(item => item.id === 'builtin-capybara').rows,
);
assert.equal(state().devices[animated.device.id].animation, null);
console.log(
  'Displays: six profiles, keypad, drawings, animations, JSON, isolated areas, worker modes and generated adapters passed.',
);
