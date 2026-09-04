import assert from 'node:assert/strict';
import {
  decodeProject,
  examples,
  generateEsp32Code,
  generateEsp32CodeResult,
  isProjectFile,
  makeProject,
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
  ['Buzzer de celebración', 'Buzzer de celebración 2'],
);
assert.deepEqual(
  repeatedComposition.widgets.map((widget) => widget.name),
  ['Contador de saltos', 'Contador de saltos 2'],
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
assert.equal(duplicatedCounter?.widget.name, 'Contador de saltos 3');

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
  buzzerCode.diagnostics.filter((item) => item.severity === 'error').length,
  0,
);
assert.equal((buzzerCode.code.match(/uint32_t BUZZER_STOP_/g) ?? []).length, 2);

console.log(
  'Smoke test correcto: multi-instancia, scheduler, JSON v2, migración y generador validados.',
);
