import { addDeviceToScene, composeSceneTemplates, createEmptyScene } from '../lib/scene-model.ts';

// Same bounded physical circuits and program for both firmware frameworks.
export function firmwareFixture(auxiliary = false) {
  let scene = composeSceneTemplates(
    ['traffic', 'robot', 'counter'],
    'Fixture Arduino CI',
  ).scene;
  const traffic = scene.devices.find((device) => device.kind === 'trafficLight');
  const robot = scene.devices.find((device) => device.kind === 'robot');
  const buzzer = scene.devices.find((device) => device.kind === 'passiveBuzzer');
  
  if (!traffic || !robot || !buzzer) {
    throw new Error('No se pudo construir la escena representativa para CI.');
  }
  
  const program = {
    version: 2,
    threads: [
      {
        id: 'traffic-thread',
        startBlockId: 'traffic-start',
        nodes: [
          {
            op: 'repeat',
            count: -1,
            blockId: 'traffic-loop',
            body: [
              {
                op: 'traffic',
                deviceId: traffic.id,
                color: 'RED',
                blockId: 'traffic-red',
              },
              { op: 'wait', ms: 500, blockId: 'traffic-wait-red' },
              {
                op: 'traffic',
                deviceId: traffic.id,
                color: 'GREEN',
                blockId: 'traffic-green',
              },
              { op: 'wait', ms: 500, blockId: 'traffic-wait-green' },
            ],
          },
        ],
      },
      {
        id: 'robot-thread',
        startBlockId: 'robot-start',
        nodes: [
          {
            op: 'robot',
            deviceId: robot.id,
            action: 'FORWARD',
            speed: 45,
            blockId: 'robot-forward',
          },
          { op: 'wait', ms: 250, blockId: 'robot-wait' },
          {
            op: 'robot',
            deviceId: robot.id,
            action: 'STOP',
            speed: 0,
            blockId: 'robot-stop',
          },
          {
            op: 'tone',
            deviceId: buzzer.id,
            frequency: 660,
            durationMs: 120,
            blockId: 'finish-tone',
          },
        ],
      },
    ],
  };
  
  // Two physical circuits keep the fixture within the board's real GPIO budget.
  // Together they compile every operation and condition emitted by the editor.
  if (auxiliary) {
    scene = createEmptyScene('Motor y buzzer activo');
    for (const kind of ['motor', 'activeBuzzer', 'messages', 'infraredBarrier']) {
      scene = addDeviceToScene(scene, kind).scene;
    }
    const motor = scene.devices.find((device) => device.kind === 'motor');
    const activeBuzzer = scene.devices.find(
      (device) => device.kind === 'activeBuzzer',
    );
    const messages = scene.devices.find((device) => device.kind === 'messages');
    const infraredBarrier = scene.devices.find((device) => device.kind === 'infraredBarrier');
    program.threads = [
      {
        id: 'auxiliary',
        startBlockId: 'auxiliary-start',
        nodes: [
          {
            op: 'motor',
            deviceId: motor.id,
            direction: 'BACKWARD',
            power: 60,
            blockId: 'motor-power',
          },
          {
            op: 'buzzer',
            deviceId: activeBuzzer.id,
            kind: 'ACTIVE',
            frequency: 1000,
            durationMs: 100,
            blockId: 'active-tone',
          },
          { op: 'messageSend', deviceId: messages.id, text: 'AVANZAR', blockId: 'message-send' },
          {
            op: 'if',
            condition: { kind: 'value', expression: { kind: 'barrierValue', deviceId: infraredBarrier.id, expected: 'INTERRUPTED' } },
            then: [{ op: 'serial', text: 'barrera interrumpida', blockId: 'barrier-interrupted' }],
            otherwise: [{ op: 'serial', text: 'barrera libre', blockId: 'barrier-clear' }],
            blockId: 'barrier-condition',
          },
          {
            op: 'messageReceive', deviceId: messages.id, expected: 'DETENER', timeoutMs: 100,
            equal: [{ op: 'serial', text: '', expression: { kind: 'join', parts: [{ kind: 'text', value: 'igual: ' }, { kind: 'messageValue', deviceId: messages.id }] }, blockId: 'message-equal' }],
            different: [{ op: 'serial', text: 'distinto', blockId: 'message-different' }],
            timeout: [{ op: 'serial', text: 'timeout', blockId: 'message-timeout' }],
            blockId: 'message-receive',
          },
          { op: 'pin', pin: 18, value: true, blockId: 'raw-output' },
          { op: 'wait', ms: 100, blockId: 'motor-wait' },
          {
            op: 'motor',
            deviceId: motor.id,
            direction: 'STOP',
            power: 0,
            blockId: 'motor-stop',
          },
        ],
      },
    ];
  } else {
    for (const kind of [
      'led',
      'servo',
      'button',
      'lightSensor',
      'potentiometer',
      'wifiNode',
    ]) {
      scene = addDeviceToScene(scene, kind).scene;
    }
    const device = (kind) => scene.devices.find((item) => item.kind === kind);
    device('servo').config.angle = 37;
    const conditions = [
      { kind: 'counter', operator: 'GTE', value: 3 },
      { kind: 'compare', operator: 'NEQ', left: 2, right: 7 },
      { kind: 'buttonPressed', deviceId: device('button').id },
      {
        kind: 'sensor',
        sensor: 'LIGHT',
        deviceId: device('lightSensor').id,
        operator: 'LT',
        value: 40,
      },
      {
        kind: 'sensor',
        sensor: 'POTENTIOMETER',
        deviceId: device('potentiometer').id,
        operator: 'GT',
        value: 60,
      },
      { kind: 'wifiConnected' },
      { kind: 'boolean', value: true },
      { kind: 'value', expression: { kind: 'variable', variableId: 'ready', valueType: 'boolean' } },
      { kind: 'valueCompare', operator: 'GTE', left: { kind: 'variable', variableId: 'score', valueType: 'number' }, right: { kind: 'number', value: 1 } },
      { kind: 'valueCompare', operator: 'EQ', left: { kind: 'variable', variableId: 'label', valueType: 'text' }, right: { kind: 'text', value: 'El contador está en ' } },
    ];
    program.variables = [
      { id: 'score', name: 'puntos', type: 'number' },
      { id: 'label', name: 'mensaje', type: 'text' },
      { id: 'ready', name: 'listo', type: 'boolean' },
    ];
    program.threads.push({
      id: 'controls',
      startBlockId: 'controls-start',
      nodes: [
        { op: 'counterSet', value: 2147483647, blockId: 'counter-set' },
        { op: 'counterChange', delta: 5, blockId: 'counter-saturate' },
        { op: 'counterSet', value: -2147483648, blockId: 'counter-min' },
        { op: 'counterChange', delta: -5, blockId: 'counter-negative' },
        { op: 'variableSet', variableId: 'score', value: { kind: 'math', operator: 'ADD', left: { kind: 'counterValue' }, right: { kind: 'number', value: 5 } }, blockId: 'variable-score' },
        { op: 'variableChange', variableId: 'score', delta: { kind: 'number', value: 1 }, blockId: 'variable-score-plus' },
        { op: 'variableSet', variableId: 'label', value: { kind: 'text', value: 'El contador está en ' }, blockId: 'variable-label' },
        { op: 'variableSet', variableId: 'ready', value: { kind: 'boolean', value: true }, blockId: 'variable-ready' },
        { op: 'serial', text: '', expression: { kind: 'join', parts: [{ kind: 'variable', variableId: 'label', valueType: 'text' }, { kind: 'counterValue' }] }, blockId: 'variable-output' },
        {
          op: 'led',
          deviceId: device('led').id,
          brightness: 65,
          blockId: 'led-brightness',
        },
        {
          op: 'servo',
          deviceId: device('servo').id,
          angle: 120,
          blockId: 'servo-position',
        },
        {
          op: 'buzzer',
          deviceId: buzzer.id,
          kind: 'PASSIVE',
          frequency: 880,
          durationMs: 100,
          blockId: 'passive-tone',
        },
        { op: 'wifi', timeoutMs: 1000, blockId: 'connect-wifi' },
        {
          op: 'repeat',
          count: 3,
          blockId: 'finite-loop',
          body: [{ op: 'counterChange', delta: 1, blockId: 'count-iteration' }],
        },
        ...conditions.map((condition, index) => ({
          op: 'if',
          condition,
          blockId: `condition-${index}`,
          consequent: [
            {
              op: 'serial',
              text: `Sí ${index}: "OK"\\\n`,
              blockId: `yes-${index}`,
            },
          ],
          otherwise: [
            { op: 'serial', text: `No ${index}`, blockId: `no-${index}` },
          ],
        })),
      ],
    });
  }
  
  // Exercise fork/join (including loop-slot and optional Wi-Fi reset) in both
  // actual Arduino builds, not just string assertions.
  program.threads = [{ id: 'single-start', startBlockId: 'single-start', nodes: [
    { op: 'serial', text: 'Comenzar', blockId: 'before-parallel' },
    { op: 'parallel', blockId: 'parallel-fixture', branches: [...program.threads.map(thread => thread.nodes), [{ op: 'repeat', count: 2, blockId: 'parallel-loop', body: [{ op: 'wait', ms: 10, blockId: 'parallel-wait' }] }]] },
    { op: 'serial', text: 'Todos terminaron', blockId: 'after-parallel' },
  ] }];
  
  return { scene, program };
}

export function matrixFirmwareFixture() {
  const added = addDeviceToScene(createEmptyScene('Matriz LED CI'), 'ledMatrix');
  const matrix = added.device;
  return {
    scene: added.scene,
    program: { version: 2, threads: [{ id: 'matrix-thread', startBlockId: 'matrix-start', nodes: [
      { op: 'matrixPattern', deviceId: matrix.id, patternId: matrix.config.patterns[0].id, blockId: 'matrix-pattern' },
      { op: 'matrixPixel', deviceId: matrix.id, x: 31, y: 7, enabled: true, blockId: 'matrix-pixel' },
      { op: 'matrixScroll', deviceId: matrix.id, text: '¡Hola, Capi!', speedMs: 80, repeatCount: 2, blockId: 'matrix-scroll' },
      { op: 'visualWait', deviceId: matrix.id, blockId: 'matrix-wait' },
      { op: 'matrixClear', deviceId: matrix.id, blockId: 'matrix-clear' },
    ] }] },
  };
}

export function ottoFirmwareFixture() {
  const added = addDeviceToScene(createEmptyScene('Otto completo CI'), 'otto');
  const otto = added.device;
  otto.config.profile = 'humanoid6-expressive';
  Object.assign(otto.pins, {
    leftLeg: 4,
    rightLeg: 13,
    leftFoot: 14,
    rightFoot: 16,
    leftArm: 17,
    rightArm: 18,
    buzzer: 19,
    trigger: 23,
    echo: 34,
    matrixDin: 25,
    matrixClk: 26,
    matrixCs: 27,
  });
  return {
    scene: added.scene,
    program: {
      version: 2,
      variables: [{ id: 'distance', name: 'distancia', type: 'number' }],
      threads: [{
        id: 'otto-thread',
        startBlockId: 'otto-start',
        nodes: [
          { op: 'otto', deviceId: otto.id, action: 'MOONWALK_LEFT', speed: 80, repetitions: 2, blockId: 'otto-move' },
          { op: 'ottoSound', deviceId: otto.id, sound: 'HAPPY', blockId: 'otto-sound' },
          { op: 'ottoExpression', deviceId: otto.id, expression: 'LOVE', blockId: 'otto-face' },
          { op: 'ottoArms', deviceId: otto.id, pose: 'UP', blockId: 'otto-arms' },
          { op: 'variableSet', variableId: 'distance', value: { kind: 'ottoDistance', deviceId: otto.id }, blockId: 'otto-distance' },
          { op: 'wait', ms: 750, blockId: 'otto-wait' },
          { op: 'otto', deviceId: otto.id, action: 'HOME', speed: 50, repetitions: 1, blockId: 'otto-home' },
        ],
      }],
    },
  };
}
