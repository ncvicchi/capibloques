import type { ExampleDefinition } from './capiblocks';
// @ts-expect-error Node strip-types runner.
import { createSceneFromTemplate } from './scene-model.ts';
export function lineExample(modular: boolean): ExampleDefinition {
  type Block = Record<string, unknown>;
  let index = 0;
  const id = () => `line-${modular ? 'mod' : 'basic'}-${index++}`;
  const sequence = (...blocks: Block[]) => {
    const copies = structuredClone(blocks);
    for (let i = 0; i < copies.length - 1; i++) {
      let tail = copies[i];
      while (tail.next) tail = (tail.next as { block: Block }).block;
      tail.next = { block: copies[i + 1] };
    }
    return copies[0];
  };
  const literal = (value: number) => ({
    type: 'capi_value_number',
    id: id(),
    fields: { VALUE: value },
  });
  const set = (key: string, value: number) => ({
    type: 'capi_variable_set_number',
    id: id(),
    fields: { VAR: { id: `line-${key}` } },
    inputs: { VALUE: { block: literal(value) } },
  });
  const compare = (key: string, value: number) => ({
    type: 'capi_value_compare',
    id: id(),
    fields: { OPERATOR: 'EQ' },
    inputs: {
      LEFT: {
        block: {
          type: 'capi_variable_get_number',
          id: id(),
          fields: { VAR: { id: `line-${key}` } },
        },
      },
      RIGHT: { block: literal(value) },
    },
  });
  const sensor = (property: string) => ({
    type: 'capi_component_boolean',
    id: id(),
    fields: { DEVICE_ID: 'line-sensors', PROPERTY: property },
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
  const wheels = (left: number, right: number) => ({
    type: 'capi_robot_wheels',
    id: id(),
    fields: { DEVICE_ID: 'line-robot', LEFT: left, RIGHT: right },
  });
  const led = (brightness: number) => ({
    type: 'capi_led',
    id: id(),
    fields: { DEVICE_ID: 'line-alert', BRIGHTNESS: brightness },
  });
  const wait = () => ({
    type: 'capi_wait',
    id: id(),
    fields: { SECONDS: 0.05 },
  });
  const call = (key: string) => ({
    type: 'capi_procedure_call',
    id: id(),
    fields: { ROUTINE: { id: `line-task-${key}` } },
  });
  const resetSearch = () => sequence(set('searching', 0), led(0));
  const left = () => sequence(set('side', -1), resetSearch(), wheels(12, 44));
  const right = () => sequence(set('side', 1), resetSearch(), wheels(44, 12));
  const stop = () =>
    sequence(wheels(0, 0), led(100), ...(modular ? [set('failed', 1)] : []));
  const search = () =>
    sequence(
      led(100),
      choose(
        compare('searching', 0),
        sequence(set('searching', 1), {
          type: 'capi_timer_start',
          id: id(),
          fields: {
            TIMER: { id: 'line-search-timer' },
            SECONDS: 2,
            MODE: 'ONCE',
          },
        }),
      ),
      choose(
        {
          type: 'capi_timer_compare',
          id: id(),
          fields: {
            TIMER: { id: 'line-search-timer' },
            TIMER_VALUE: 'ELAPSED',
            OPERATOR: 'GTE',
            VALUE: 2,
          },
        },
        call('stop'),
        choose(compare('side', -1), wheels(-30, 30), wheels(30, -30)),
      ),
    );
  const follow = () =>
    choose(
      sensor('center'),
      sequence(...(modular ? [resetSearch()] : [led(0)]), wheels(40, 40)),
      choose(
        sensor('left'),
        modular ? call('left') : sequence(led(0), wheels(12, 44)),
        choose(
          sensor('right'),
          modular ? call('right') : sequence(led(0), wheels(44, 12)),
          modular ? call('search') : stop(),
        ),
      ),
    );
  const routines = [
    { key: 'follow', name: 'Seguir la línea', body: follow },
    { key: 'left', name: 'Corregir a izquierda', body: left },
    { key: 'right', name: 'Corregir a derecha', body: right },
    { key: 'search', name: 'Buscar por último lado', body: search },
    { key: 'stop', name: 'Detener y avisar', body: stop },
  ];
  const body = sequence(
    wheels(0, 0),
    led(0),
    ...(modular
      ? [set('side', -1), set('searching', 0), set('failed', 0)]
      : []),
    {
      type: 'capi_forever',
      id: id(),
      inputs: {
        DO: {
          block: sequence(
            modular
              ? choose(compare('failed', 0), call('follow'), call('stop'))
              : follow(),
            wait(),
          ),
        },
      },
    },
  );
  const defs = modular
    ? routines.map((r, i) => ({
        type: 'capi_procedure_def',
        id: `line-def-${r.key}`,
        x: 48,
        y: 48 + (i % 3) * 500,
        fields: {
          ROUTINE: { id: `line-task-${r.key}` },
          P1_TYPE: 'none',
          P2_TYPE: 'none',
          P3_TYPE: 'none',
        },
        inputs: { BODY: { block: r.body() } },
      }))
    : [];
  return {
    id: modular ? 'lineTrackProcedures' : 'lineTrack',
    title: modular
      ? 'Seguidor con búsqueda y procedimientos'
      : 'Seguidor de línea básico',
    icon: '〰️',
    level: 'Intermedio',
    mission:
      'Leé el suelo y decidí cuánto mueve cada motor. Sin piloto automático.',
    description: modular
      ? 'Solución completa: cinco tareas y tres pestañas; recuerda el último lado y busca durante dos segundos como máximo.'
      : 'Solución completa por condiciones: corrige a cada lado y se detiene con aviso al perder la línea.',
    scene: createSceneFromTemplate('lineTrack'),
    workspace: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'capi_start',
            id: 'start-main',
            x: 48,
            y: 42,
            inputs: { DO: { block: body } },
          },
          ...defs,
        ],
      },
      ...(modular
        ? {
            variables: [
              ...routines.map((r) => ({
                id: `line-task-${r.key}`,
                name: r.name,
                type: 'Procedure',
              })),
              { id: 'line-side', name: 'Último lado', type: 'Number' },
              { id: 'line-searching', name: 'Buscando', type: 'Number' },
              { id: 'line-failed', name: 'Búsqueda agotada', type: 'Number' },
              {
                id: 'line-search-timer',
                name: 'Tiempo de búsqueda',
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
                  id: 'tab-line-follow',
                  name: 'Seguimiento',
                  rootBlockIds: [
                    'line-def-follow',
                    'line-def-left',
                    'line-def-right',
                  ],
                },
                {
                  id: 'tab-line-search',
                  name: 'Búsqueda',
                  rootBlockIds: ['line-def-search', 'line-def-stop'],
                },
              ]
            : []),
        ],
      },
    },
  };
}
