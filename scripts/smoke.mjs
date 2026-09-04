import assert from 'node:assert/strict';
import {
  addCounterValues,
  collectRawOutputPins,
  decodeProject,
  examples,
  generateEsp32Code,
  generateEsp32CodeResult,
  isProjectFile,
  makeProject,
  normalizeCounterValue,
  normalizeCompiledProgram,
  validateProgramForScene,
} from '../lib/capiblocks.ts';
import {
  addDeviceToScene,
  composeSceneTemplates,
  createEmptyScene,
  createSceneFromTemplate,
  duplicateSceneDevice,
  duplicateSceneWidget,
  removeDeviceFromScene,
  validateScene,
} from '../lib/scene-model.ts';

const composition = composeSceneTemplates(
  ['traffic', 'traffic', 'robot'],
  'Cruce con robot',
);
const scene = composition.scene;
const trafficLights = scene.devices.filter(
  (device) => device.kind === 'trafficLight',
);
const robot = scene.devices.find((device) => device.kind === 'robot');

assert.equal(trafficLights.length, 2);
assert.ok(robot);
assert.equal(validateScene(scene).hardwareReady, true);
assert.equal(normalizeCounterValue(5.5), 6);
assert.equal(normalizeCounterValue(-2.5), -2);
assert.equal(normalizeCounterValue(Number.MAX_SAFE_INTEGER), 2_147_483_647);
assert.equal(addCounterValues(2_147_483_647, 1), 2_147_483_647);
assert.equal(addCounterValues(-2_147_483_648, -1), -2_147_483_648);
assert.deepEqual(
  trafficLights.map((device) => device.name),
  ['Semáforo principal', 'Semáforo principal 2'],
);

const repeatedComposition = composeSceneTemplates(
  ['traffic', 'traffic', 'counter', 'counter'],
  'Plantillas repetidas',
).scene;
assert.deepEqual(
  repeatedComposition.devices
    .filter((device) => device.kind === 'trafficLight')
    .map((device) => device.name),
  ['Semáforo principal', 'Semáforo principal 2'],
);
assert.deepEqual(
  repeatedComposition.devices
    .filter((device) => device.kind === 'passiveBuzzer')
    .map((device) => device.name),
  ['Buzzer de celebración'],
);
assert.deepEqual(
  repeatedComposition.widgets.map((widget) => widget.name),
  ['Contador de saltos'],
);
assert.equal(
  new Set([
    ...repeatedComposition.devices.map((device) => device.name),
    ...repeatedComposition.widgets.map((widget) => widget.name),
  ]).size,
  repeatedComposition.devices.length + repeatedComposition.widgets.length,
);

const duplicatedTraffic = duplicateSceneDevice(
  repeatedComposition,
  repeatedComposition.devices.find((device) => device.kind === 'trafficLight')
    .id,
);
assert.equal(duplicatedTraffic?.device.name, 'Semáforo principal 3');
const duplicatedCounter = duplicateSceneWidget(
  duplicatedTraffic.scene,
  duplicatedTraffic.scene.widgets[0].id,
);
assert.equal(
  duplicatedCounter,
  null,
  'El contador es global y no debe parecer independiente al duplicarlo',
);

let identityScene = createEmptyScene('Identidades estables');
identityScene = addDeviceToScene(identityScene, 'led').scene;
const firstLedId = identityScene.devices[0].id;
identityScene = removeDeviceFromScene(identityScene, firstLedId);
identityScene = addDeviceToScene(identityScene, 'led').scene;
assert.notEqual(identityScene.devices[0].id, firstLedId);
assert.deepEqual(identityScene.retiredDeviceIds, [firstLedId]);

const precisionName = 'X 9007199254740991';
let precisionScene = createEmptyScene('Nombres seguros');
precisionScene = addDeviceToScene(precisionScene, 'led', {
  name: precisionName,
}).scene;
precisionScene = addDeviceToScene(precisionScene, 'led', {
  name: 'X 9007199254740992',
}).scene;
precisionScene = addDeviceToScene(precisionScene, 'led', {
  name: precisionName,
}).scene;
assert.equal(new Set(precisionScene.devices.map(({ name }) => name)).size, 3);

const program = {
  version: 2,
  threads: [
    {
      id: 'north-program',
      startBlockId: 'start-north',
      nodes: [
        {
          op: 'repeat',
          count: -1,
          blockId: 'north-loop',
          body: [
            {
              op: 'traffic',
              deviceId: trafficLights[0].id,
              color: 'RED',
              blockId: 'north-red',
            },
            { op: 'wait', ms: 1000, blockId: 'north-wait' },
            {
              op: 'traffic',
              deviceId: trafficLights[0].id,
              color: 'GREEN',
              blockId: 'north-green',
            },
          ],
        },
      ],
    },
    {
      id: 'south-program',
      startBlockId: 'start-south',
      nodes: [
        {
          op: 'traffic',
          deviceId: trafficLights[1].id,
          color: 'GREEN',
          blockId: 'south-green',
        },
        {
          op: 'robot',
          deviceId: robot.id,
          action: 'FORWARD',
          speed: 55,
          blockId: 'robot-forward',
        },
      ],
    },
  ],
};

const generated = generateEsp32CodeResult(program, 'Cruce con robot', scene);
assert.deepEqual(
  generated.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'),
  [],
);
assert.match(generated.code, /esp32:esp32:d1_uno32/);
assert.match(generated.code, /DEV_TRAFFIC_LIGHT_1_/);
assert.match(generated.code, /DEV_TRAFFIC_LIGHT_2_/);
assert.match(generated.code, /DEV_ROBOT_1_/);
assert.match(generated.code, /void runThread0/);
assert.match(generated.code, /void runThread1/);
assert.match(generated.code, /runThread0\(now, 16\)/);
assert.match(generated.code, /runThread1\(now, 16\)/);
assert.match(generated.code, /driveRobot\(DEV_ROBOT_1_/);
assert.doesNotMatch(generated.code, /delay\s*\(/);
assert.doesNotMatch(generated.code, /loopCounters_T\d+\[0\]/);
assert.doesNotMatch(generated.code, /#error/);
assert.equal(
  generated.code,
  generateEsp32Code(program, 'Cruce con robot', scene),
);

const finiteRepeatCode = generateEsp32Code(
  [
    {
      op: 'repeat',
      count: 3,
      blockId: 'finite-repeat',
      body: [{ op: 'counterChange', delta: 1, blockId: 'increment' }],
    },
  ],
  'Repetición finita',
  createEmptyScene('Sin componentes'),
);
assert.match(finiteRepeatCode, /loopCounters_T0\[0\] > 0/);

const legacyNodes = [
  {
    op: 'traffic',
    color: 'YELLOW',
    blockId: 'legacy-traffic',
  },
];
const normalizedLegacy = normalizeCompiledProgram(legacyNodes, scene);
assert.equal(normalizedLegacy.threads.length, 1);
assert.equal(
  normalizedLegacy.threads[0].nodes[0].deviceId,
  trafficLights[0].id,
);

const missingTarget = {
  version: 2,
  threads: [
    {
      id: 'broken',
      startBlockId: 'broken-start',
      nodes: [
        {
          op: 'traffic',
          deviceId: 'deleted-traffic-light',
          color: 'RED',
          blockId: 'broken-block',
        },
      ],
    },
  ],
};
assert.ok(
  validateProgramForScene(missingTarget, scene).some(
    (diagnostic) => diagnostic.code === 'target-missing',
  ),
);

const project = makeProject('Prueba v2', scene, examples[0].workspace, 2);
const roundTrip = JSON.parse(JSON.stringify(project));
assert.equal(isProjectFile(roundTrip), true);
const decodedV2 = decodeProject(roundTrip);
assert.equal(decodedV2.project?.schemaVersion, 2);
assert.equal(decodedV2.project?.scene.devices.length, 3);
assert.equal(decodedV2.project?.simulation.speed, 2);
for (const example of examples) {
  const decodedExample = decodeProject(
    JSON.parse(
      JSON.stringify(
        makeProject(example.title, example.scene, example.workspace, 1),
      ),
    ),
  );
  assert.ok(
    decodedExample.project,
    `El ejemplo ${example.id} debe conservar compatibilidad JSON v2`,
  );
}

const persistedIdentity = decodeProject(
  JSON.parse(JSON.stringify(makeProject('IDs', identityScene, {}, 1))),
);
assert.deepEqual(persistedIdentity.project?.scene.retiredDeviceIds, [
  firstLedId,
]);
const identityAfterImport = addDeviceToScene(
  removeDeviceFromScene(
    persistedIdentity.project.scene,
    persistedIdentity.project.scene.devices[0].id,
  ),
  'led',
).scene;
assert.equal(new Set(identityAfterImport.retiredDeviceIds).size, 2);
assert.ok(
  !identityAfterImport.retiredDeviceIds.includes(
    identityAfterImport.devices[0].id,
  ),
);

const legacyProject = {
  application: 'CapiBloques',
  schemaVersion: 1,
  metadata: {
    title: 'Proyecto antiguo',
    locale: 'es-AR',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  target: {
    boardProfile: 'wemos-d1-r32',
    pinAssignments: {
      trafficRed: 26,
      trafficYellow: 25,
      trafficGreen: 27,
    },
  },
  simulation: { scene: 'traffic', speed: 1 },
  workspace: examples[0].workspace,
};
assert.equal(isProjectFile(legacyProject), false);
const migrated = decodeProject(legacyProject);
assert.equal(migrated.migrated, true);
assert.equal(migrated.project?.schemaVersion, 2);
assert.equal(migrated.project?.metadata.migratedFrom, 1);
assert.match(JSON.stringify(migrated.project?.workspace), /DEVICE_ID/);

const malformedV2 = {
  ...roundTrip,
  scene: {
    ...roundTrip.scene,
    devices: [{ id: 'broken', kind: 'unknown-device' }],
  },
};
assert.equal(isProjectFile(malformedV2), false);
assert.equal(decodeProject(malformedV2).project, null);
assert.equal(
  decodeProject({ ...roundTrip, workspace: [] }).project,
  null,
  'Un workspace debe ser un objeto serializado, no una lista',
);
assert.equal(
  decodeProject({ ...roundTrip, metadata: undefined }).project,
  null,
  'Un proyecto v2 sin metadatos no debe aceptarse',
);

const unknownBlockProject = {
  ...roundTrip,
  workspace: {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: 'bloque_que_no_existe', id: 'unknown-1' }],
    },
  },
};
const unknownBlockDecode = decodeProject(unknownBlockProject);
assert.equal(unknownBlockDecode.project, null);
assert.equal(
  unknownBlockDecode.diagnostics[0]?.code,
  'workspace-block-type-unsupported',
);

const nullBlockDecode = decodeProject({
  ...roundTrip,
  workspace: {
    blocks: { languageVersion: 0, blocks: [null] },
  },
});
assert.equal(nullBlockDecode.project, null);
assert.equal(nullBlockDecode.diagnostics[0]?.code, 'workspace-block-invalid');

const missingWorkspaceVersion = decodeProject({
  ...roundTrip,
  workspace: { blocks: { blocks: [] } },
});
assert.equal(missingWorkspaceVersion.project, null);
assert.equal(
  missingWorkspaceVersion.diagnostics[0]?.code,
  'workspace-version-unsupported',
);

const cyclicWorkspace = {};
cyclicWorkspace.self = cyclicWorkspace;
const cycleDecode = decodeProject({ ...roundTrip, workspace: cyclicWorkspace });
assert.equal(cycleDecode.project, null);
assert.equal(cycleDecode.diagnostics[0]?.code, 'workspace-cycle');

assert.throws(
  () =>
    makeProject(
      'Workspace inválido',
      createEmptyScene('Vacía'),
      {
        blocks: { languageVersion: 0, blocks: [null] },
      },
      1,
    ),
  /bloque vacío o dañado/,
  'Exportar nunca debe reemplazar un workspace inválido por {}',
);

const deepWorkspace = {};
let deepCursor = deepWorkspace;
for (let depth = 0; depth < 140; depth += 1) {
  deepCursor.child = {};
  deepCursor = deepCursor.child;
}
const deepDecode = decodeProject({ ...roundTrip, workspace: deepWorkspace });
assert.equal(deepDecode.project, null);
assert.equal(deepDecode.diagnostics[0]?.code, 'workspace-too-deep');

const injectedProject = decodeProject({
  ...roundTrip,
  metadata: {
    ...roundTrip.metadata,
    title: 'Clase\nint payload = 42;',
  },
});
assert.equal(
  injectedProject.project?.metadata.title,
  'Clase int payload = 42;',
);

const injectedCode = generateEsp32Code(
  [
    {
      op: 'counterSet',
      value: 1,
      blockId: 'uno\\\nint payload = 42;',
    },
  ],
  'Clase\\\nint payload = 42;',
  createEmptyScene('Comentarios seguros'),
);
assert.doesNotMatch(injectedCode, /^int payload = 42;/m);
assert.match(injectedCode, /\/\/ Clase\/ int payload = 42;/);
assert.match(injectedCode, /\/\/ bloque: uno\/ int payload = 42;/);

const normalizedFractionalCounter = normalizeCompiledProgram(
  [
    { op: 'counterSet', value: 5.5, blockId: 'set-fraction' },
    {
      op: 'if',
      condition: { kind: 'counter', operator: 'LT', value: 5.5 },
      consequent: [],
      otherwise: [],
      blockId: 'compare-fraction',
    },
  ],
  createEmptyScene('Contador entero'),
);
assert.equal(normalizedFractionalCounter.threads[0].nodes[0].value, 6);
assert.equal(
  normalizedFractionalCounter.threads[0].nodes[1].condition.value,
  6,
);
const fractionalCounterCode = generateEsp32Code(
  normalizedFractionalCounter,
  'Contador entero',
  createEmptyScene('Contador entero'),
);
assert.match(fractionalCounterCode, /counterValue = 6;/);
assert.match(fractionalCounterCode, /counterValue < 6/);
assert.match(fractionalCounterCode, /uint32_t lastSchedulerTick = 0;/);
assert.match(
  fractionalCounterCode,
  /\(uint32_t\)\(now - lastSchedulerTick\) < SCHEDULER_QUANTUM_MS/,
);

const rawPinProgram = normalizeCompiledProgram(
  [{ op: 'pin', pin: 26, value: true, blockId: 'raw-output' }],
  createEmptyScene('GPIO avanzado'),
);
assert.deepEqual(collectRawOutputPins(rawPinProgram), [26]);
assert.ok(
  validateProgramForScene(
    rawPinProgram,
    createEmptyScene('GPIO avanzado'),
  ).some((diagnostic) => diagnostic.code === 'raw-pin-load-review'),
);

const counterProject = makeProject(
  'Contador único',
  createSceneFromTemplate('counter'),
  examples.find((example) => example.id === 'counter').workspace,
  1,
);
const duplicateCounterProject = JSON.parse(JSON.stringify(counterProject));
duplicateCounterProject.scene.widgets.push({
  ...duplicateCounterProject.scene.widgets[0],
  id: 'counter-2',
  name: 'Segundo contador',
});
const duplicateCounterDecode = decodeProject(duplicateCounterProject);
assert.equal(duplicateCounterDecode.project, null);
assert.ok(
  duplicateCounterDecode.diagnostics.some(
    (diagnostic) => diagnostic.code === 'scene-multiple-counter-widgets',
  ),
);

const offCanvasWidgetProject = JSON.parse(JSON.stringify(counterProject));
offCanvasWidgetProject.scene.widgets[0].position.x = 1e100;
const offCanvasWidgetDecode = decodeProject(offCanvasWidgetProject);
assert.equal(offCanvasWidgetDecode.project, null);
assert.ok(
  offCanvasWidgetDecode.diagnostics.some(
    (diagnostic) => diagnostic.code === 'scene-invalid-position',
  ),
);

const wifiCode = generateEsp32Code(
  [{ op: 'wifi', timeoutMs: 5000, blockId: 'wifi-connect' }],
  'Wi-Fi',
  createSceneFromTemplate('wifi'),
);
assert.match(wifiCode, /#include <WiFi\.h>/);
assert.doesNotMatch(wifiCode, /delay\s*\(/);

let buzzerScene = createEmptyScene('Dos buzzers');
buzzerScene = addDeviceToScene(buzzerScene, 'passiveBuzzer').scene;
buzzerScene = addDeviceToScene(buzzerScene, 'passiveBuzzer').scene;
const buzzers = buzzerScene.devices.filter(
  (device) => device.kind === 'passiveBuzzer',
);
assert.deepEqual(
  buzzers.map((buzzer) => buzzer.name),
  ['Buzzer pasivo 1', 'Buzzer pasivo 2'],
);
const buzzerProgram = {
  version: 2,
  threads: buzzers.map((buzzer, index) => ({
    id: `sound-${index}`,
    startBlockId: `sound-start-${index}`,
    nodes: [
      {
        op: 'tone',
        deviceId: buzzer.id,
        frequency: 440 + index * 220,
        durationMs: 200,
        blockId: `tone-${index}`,
      },
    ],
  })),
};
const buzzerCode = generateEsp32CodeResult(
  buzzerProgram,
  'Dos buzzers',
  buzzerScene,
);
assert.equal(
  buzzerCode.diagnostics.some(
    (item) => item.code === 'scene-passive-buzzer-limit',
  ),
  true,
  'No se debe generar firmware engañoso para dos tonos que compartirían timer',
);
assert.equal((buzzerCode.code.match(/uint32_t BUZZER_STOP_/g) ?? []).length, 2);
assert.match(buzzerCode.code, /#error/);

let unsafeButtonScene = createEmptyScene('Botón sin pull-up');
unsafeButtonScene = addDeviceToScene(unsafeButtonScene, 'button', {
  pins: { signal: 35 },
  autoAssignPins: false,
}).scene;
assert.equal(validateScene(unsafeButtonScene).hardwareReady, false);
assert.ok(
  validateProgramForScene([], unsafeButtonScene).some(
    (diagnostic) => diagnostic.code === 'scene-button-pullup-unavailable',
  ),
);

let pwmOverflowScene = createEmptyScene('Demasiado PWM');
for (let index = 0; index < 5; index += 1) {
  pwmOverflowScene = addDeviceToScene(pwmOverflowScene, 'robot').scene;
}
assert.equal(validateScene(pwmOverflowScene).hardwareReady, false);
assert.ok(
  validateProgramForScene([], pwmOverflowScene).some(
    (diagnostic) => diagnostic.code === 'scene-pwm-channel-limit',
  ),
);

let duplicateNameScene = createEmptyScene('Nombres duplicados');
duplicateNameScene = addDeviceToScene(duplicateNameScene, 'led').scene;
duplicateNameScene = addDeviceToScene(duplicateNameScene, 'servo').scene;
duplicateNameScene.devices[1].name = duplicateNameScene.devices[0].name;
assert.equal(validateScene(duplicateNameScene).valid, false);
assert.ok(
  validateScene(duplicateNameScene).issues.some(
    (issue) => issue.code === 'duplicate-item-name',
  ),
);

let collisionScene = createEmptyScene('Símbolos C++');
collisionScene = addDeviceToScene(collisionScene, 'led', {
  id: 'a,($%*&;}@&b',
  name: 'LED A',
}).scene;
collisionScene = addDeviceToScene(collisionScene, 'led', {
  id: 'a@(?#?%?#[:b',
  name: 'LED B',
}).scene;
const collisionResult = generateEsp32CodeResult(
  [],
  'Colisiones',
  collisionScene,
);
const collisionCode = collisionResult.code;
const pinSymbols = [
  ...collisionCode.matchAll(/constexpr uint8_t PIN_([A-Z0-9_]+) =/g),
].map((match) => match[1]);
assert.equal(pinSymbols.length, 2);
assert.equal(new Set(pinSymbols).size, 2);
assert.ok(
  collisionResult.diagnostics.some(
    (diagnostic) => diagnostic.code === 'cpp-symbol-collision-resolved',
  ),
);

console.log(
  'Smoke test correcto: identidades, JSON robusto, validación Wemos y generador seguro validados.',
);
