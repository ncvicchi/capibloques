import type { ExampleDefinition } from './capiblocks';
// @ts-expect-error Node strip-types runner.
import { createSceneFromTemplate } from './scene-model.ts';
export function pondExample(modular: boolean): ExampleDefinition {
  type Block = Record<string, unknown>;
  let index = 0;
  const id = () => `pond-${modular ? 'mod' : 'basic'}-${index++}`;
  const sequence = (...blocks: Block[]) => {
    const copy = structuredClone(blocks);
    for (let i = 0; i < copy.length - 1; i++) {
      let tail = copy[i];
      while (tail.next) tail = (tail.next as { block: Block }).block;
      tail.next = { block: copy[i + 1] };
    }
    return copy[0];
  };
  const number = (value: number) => ({
    type: 'capi_value_number',
    id: id(),
    fields: { VALUE: value },
  });
  const read = (role: string, property: string) => ({
    type: 'capi_component_number',
    id: id(),
    fields: { DEVICE_ID: `pond-${role}`, PROPERTY: property },
  });
  const variable = (key: string) => ({
    type: 'capi_variable_get_number',
    id: id(),
    fields: { VAR: { id: `pond-${key}` } },
  });
  const compare = (left: Block, operator: string, value: number) => ({
    type: 'capi_value_compare',
    id: id(),
    fields: { OPERATOR: operator },
    inputs: { LEFT: { block: left }, RIGHT: { block: number(value) } },
  });
  const test = (role: string, property: string, op: string, value: number) =>
    compare(read(role, property), op, value);
  const set = (key: string, value: number) => ({
    type: 'capi_variable_set_number',
    id: id(),
    fields: { VAR: { id: `pond-${key}` } },
    inputs: { VALUE: { block: number(value) } },
  });
  const choose = (condition: Block, yes: Block, no?: Block) => ({
    type: 'capi_if',
    id: id(),
    ...(no ? { extraState: { hasElse: true } } : {}),
    inputs: {
      CONDITION: { block: condition },
      DO: { block: yes },
      ...(no ? { ELSE: { block: no } } : {}),
    },
  });
  const pump = (power: number) => ({
    type: 'capi_power_switch',
    id: id(),
    fields: { DEVICE_ID: 'pond-pump', POWER: power },
  });
  const gate = (angle: number) => ({
    type: 'capi_servo',
    id: id(),
    fields: { DEVICE_ID: 'pond-drain', ANGLE: angle },
  });
  const led = (brightness: number) => ({
    type: 'capi_led',
    id: id(),
    fields: { DEVICE_ID: 'pond-alert', BRIGHTNESS: brightness },
  });
  const wait = (seconds: number) => ({
    type: 'capi_wait',
    id: id(),
    fields: { SECONDS: seconds },
  });
  const loop = (body: Block) => ({
    type: 'capi_forever',
    id: id(),
    inputs: { DO: { block: body } },
  });
  const call = (key: string) => ({
    type: 'capi_procedure_call',
    id: id(),
    fields: { ROUTINE: { id: `pond-task-${key}` } },
  });
  const show = (text: string, role?: string) => ({
    type: 'capi_display_write',
    id: id(),
    fields: { DEVICE_ID: 'pond-display', AREA_ID: 'screen', TEXT: text },
    ...(role ? { inputs: { DYNAMIC: { block: read(role, 'distance') } } } : {}),
  });
  const stop = () => pump(0);
  const regulate = () =>
    sequence(
      choose(
        test('lagoonSensor', 'distance', 'GT', 80),
        sequence(
          ...(modular
            ? [
                choose(test('pump', 'power', 'EQ', 0), {
                  type: 'capi_timer_start',
                  id: id(),
                  fields: {
                    TIMER: { id: 'pond-pump-timer' },
                    SECONDS: 25,
                    MODE: 'ONCE',
                  },
                }),
              ]
            : []),
          pump(100),
        ),
      ),
      choose(test('lagoonSensor', 'distance', 'LTE', 50), pump(0)),
    );
  const manage = () =>
    sequence(
      choose(
        test('reserveSensor', 'distance', 'GT', 110),
        sequence(call('stop'), set('status', 1)),
        choose(
          compare(variable('fault'), 'EQ', 1),
          sequence(call('stop'), set('status', 2)),
          sequence(set('status', 0), call('regulate')),
        ),
      ),
      choose(
        test('pump', 'power', 'GT', 0),
        choose(
          {
            type: 'capi_timer_compare',
            id: id(),
            fields: {
              TIMER: { id: 'pond-pump-timer' },
              TIMER_VALUE: 'ELAPSED',
              OPERATOR: 'GTE',
              VALUE: 25,
            },
          },
          sequence(set('fault', 1), set('status', 2), call('stop')),
        ),
      ),
    );
  const drain = () =>
    sequence(
      choose(test('lagoonSensor', 'distance', 'LT', 30), gate(90)),
      choose(test('lagoonSensor', 'distance', 'GT', 40), gate(0)),
    );
  const warn = () =>
    sequence(
      led(100),
      choose(
        compare(variable('warned'), 'EQ', 0),
        sequence(set('warned', 1), {
          type: 'capi_buzzer',
          id: id(),
          fields: {
            DEVICE_ID: 'pond-buzzer',
            KIND: 'ACTIVE',
            DURATION: 300,
            FREQUENCY: 660,
          },
        }),
      ),
    );
  const clear = () => sequence(led(0), set('warned', 0));
  const alerts = () =>
    choose(
      {
        type: 'capi_component_boolean',
        id: id(),
        fields: { DEVICE_ID: 'pond-spillSensor', PROPERTY: 'wet' },
      },
      warn(),
      choose(compare(variable('status'), 'GT', 0), warn(), clear()),
    );
  const report = () =>
    sequence(
      choose(
        compare(variable('status'), 'EQ', 2),
        show('Tiempo agotado: reset'),
        choose(
          compare(variable('status'), 'EQ', 1),
          show('Recargar reserva'),
          show('Laguna cm: ', 'lagoonSensor'),
        ),
      ),
      wait(1),
      show('Reserva cm: ', 'reserveSensor'),
      wait(1),
    );
  const routines = [
    { key: 'manage', name: 'Revisar reserva y bombeo', body: manage },
    { key: 'regulate', name: 'Regular la laguna', body: regulate },
    { key: 'stop', name: 'Detener la bomba', body: stop },
    { key: 'drain', name: 'Evitar nivel excesivo', body: drain },
    { key: 'alerts', name: 'Actualizar avisos', body: alerts },
    { key: 'report', name: 'Mostrar informe', body: report },
  ];
  const main = sequence(
    pump(0),
    gate(0),
    led(0),
    ...(modular
      ? [
          set('fault', 0),
          set('status', 0),
          set('warned', 0),
          {
            type: 'capi_parallel',
            id: id(),
            extraState: { branches: 3 },
            inputs: {
              BRANCH0: {
                block: loop(sequence(call('manage'), call('drain'), wait(0.2))),
              },
              BRANCH1: { block: loop(sequence(call('alerts'), wait(0.2))) },
              BRANCH2: { block: loop(call('report')) },
            },
          },
        ]
      : [loop(sequence(regulate(), wait(0.2)))]),
  );
  const defs = modular
    ? routines.map((r, i) => ({
        type: 'capi_procedure_def',
        id: `pond-def-${r.key}`,
        x: 48,
        y: 48 + (i % 2) * 700,
        fields: {
          ROUTINE: { id: `pond-task-${r.key}` },
          P1_TYPE: 'none',
          P2_TYPE: 'none',
          P3_TYPE: 'none',
        },
        inputs: { BODY: { block: r.body() } },
      }))
    : [];
  return {
    id: modular ? 'pondLabProcedures' : 'pondLab',
    title: modular
      ? 'Laguna protegida con procedimientos'
      : 'Laguna con nivel automático',
    icon: '💧',
    level: 'Intermedio',
    mission: 'Leé distancias para decidir cuándo llenar y evitar derrames.',
    description: modular
      ? 'Solución completa: seis tareas, cuatro pestañas y tres procesos. Protege reserva, desagota nivel excesivo, avisa y limita cada bombeo a 25 s. Tiempo agotado requiere Reiniciar.'
      : 'Solución directa completa: llena por debajo de 40% y apaga al llegar a 70%. Sin protección de reserva ni desagüe automático; compará con el segundo ejemplo.',
    scene: createSceneFromTemplate('pondLab'),
    workspace: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'capi_start',
            id: 'start-main',
            x: 48,
            y: 42,
            inputs: { DO: { block: main } },
          },
          ...defs,
        ],
      },
      ...(modular
        ? {
            variables: [
              ...routines.map((r) => ({
                id: `pond-task-${r.key}`,
                name: r.name,
                type: 'Procedure',
              })),
              {
                id: 'pond-fault',
                name: 'Tiempo de bomba agotado',
                type: 'Number',
              },
              {
                id: 'pond-status',
                name: 'Estado del bombeo',
                type: 'Number',
              },
              { id: 'pond-warned', name: 'Aviso emitido', type: 'Number' },
              {
                id: 'pond-pump-timer',
                name: 'Tiempo de bombeo',
                type: 'Timer',
              },
            ],
          }
        : {}),
      capiTabs: {
        version: 1,
        tabs: [
          { id: 'main', name: 'Principal', rootBlockIds: ['start-main'] },
          ...(modular
            ? [
                {
                  id: 'tab-pond-control',
                  name: 'Bombeo',
                  rootBlockIds: ['pond-def-manage', 'pond-def-regulate'],
                },
                {
                  id: 'tab-pond-protection',
                  name: 'Protección',
                  rootBlockIds: ['pond-def-stop', 'pond-def-drain'],
                },
                {
                  id: 'tab-pond-info',
                  name: 'Avisos e informe',
                  rootBlockIds: ['pond-def-alerts', 'pond-def-report'],
                },
              ]
            : []),
        ],
      },
    },
  };
}
