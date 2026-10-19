import type { ExampleDefinition } from './capiblocks';
// @ts-expect-error Node strip-types runner.
import { createSceneFromTemplate, addDeviceToScene } from './scene-model.ts';
export function gorillaAutonomyExample(modular: boolean): ExampleDefinition {
  type B = Record<string, unknown>;
  let n = 0;
  const b = (
    type: string,
    fields: Record<string, unknown> = {},
    inputs: Record<string, unknown> = {},
  ): B => ({
    type,
    id: `auto-${modular}-${n++}`,
    fields,
    ...(Object.keys(inputs).length ? { inputs } : {}),
  });
  const seq = (...items: B[]) => {
    for (let i = 0; i < items.length - 1; i++) {
      let t = items[i];
      while (t.next) t = (t.next as { block: B }).block;
      t.next = { block: items[i + 1] };
    }
    return items[0];
  };
  const input = (block: B) => ({ block }),
    num = (v: number) => b('capi_value_number', { VALUE: v }),
    bool = (v: boolean) =>
      b('capi_value_boolean', { VALUE: v ? 'TRUE' : 'FALSE' });
  const get = (key: string, type = 'boolean') =>
    b('capi_variable_get_' + type, { VAR: { id: 'auto-' + key } });
  const set = (key: string, value: B, type = 'boolean') =>
    b(
      'capi_variable_set_' + type,
      { VAR: { id: 'auto-' + key } },
      { VALUE: input(value) },
    );
  const yes = (key: string, v: boolean) => set(key, bool(v));
  const read = (property: string, type = 'number', device = 'gorilla-sonar') =>
    b('capi_component_' + type, { DEVICE_ID: device, PROPERTY: property });
  const cmp = (left: B, op: string, right: B) =>
    b(
      'capi_value_compare',
      { OPERATOR: op },
      { LEFT: input(left), RIGHT: input(right) },
    );
  const choose = (condition: B, doBlock: B, otherwise?: B) => ({
    ...b(
      'capi_if',
      {},
      {
        CONDITION: input(condition),
        DO: input(doBlock),
        ...(otherwise ? { ELSE: input(otherwise) } : {}),
      },
    ),
    ...(otherwise ? { extraState: { hasElse: true } } : {}),
  });
  const wait = (s = 0.05) => b('capi_wait', { SECONDS: s });
  const until = (condition: B, body: B) =>
    b(
      'capi_while',
      { MODE: 'UNTIL' },
      { CONDITION: input(condition), DO: input(body) },
    );
  const button = () =>
    b('capi_button_pressed', { DEVICE_ID: 'gorilla-button' });
  const status = (text: string) =>
    seq(
      set('state', b('capi_value_text', { VALUE: text }), 'text'),
      b('capi_serial', { TEXT: text }),
    );
  const routine = (key: string) =>
    b('capi_procedure_call', { ROUTINE: { id: 'auto-task-' + key } });
  const check = () =>
    choose(
      cmp(get('stop'), 'EQ', bool(false)),
      seq(
        choose(
          cmp(read('valid', 'boolean'), 'EQ', bool(false)),
          seq(yes('stop', true), yes('fault', true)),
          choose(
            cmp(get('reverse'), 'EQ', bool(false)),
            choose(cmp(read('distance'), 'LTE', num(3)), yes('stop', true)),
          ),
        ),
        choose(button(), seq(yes('stop', true), yes('manual', true))),
      ),
    );
  const walk = (reverse = false, limit = 40) =>
    seq(
      yes('reverse', reverse),
      yes('stop', false),
      yes('done', false),
      modular ? routine('check') : check(),
      {
        ...b(
          'capi_parallel',
          {},
          {
            BRANCH0: input(
              seq(
                b(
                  'capi_gorilla_walk',
                  {
                    DEVICE_ID: 'gorilla-robot',
                    MODE: reverse ? '1' : '0',
                    LIMIT: limit,
                  },
                  { CONDITION: input(get('stop')) },
                ),
                yes('done', true),
              ),
            ),
            BRANCH1: input(
              until(
                get('done'),
                seq(modular ? routine('check') : check(), wait()),
              ),
            ),
          },
        ),
        extraState: { branches: 2 },
      },
      choose(read('error', 'boolean', 'gorilla-robot'), yes('fault', true)),
      b(
        'capi_serial',
        { TEXT: 'Resultado de marcha: ' },
        { DYNAMIC: input(read('walkOutcome', 'text', 'gorilla-robot')) },
      ),
    );
  const prepare = () =>
    seq(
      b('capi_gorilla_prepare', { DEVICE_ID: 'gorilla-robot' }),
      status('Esperando botón'),
      until(button(), wait()),
      until(cmp(button(), 'EQ', bool(false)), wait()),
      wait(0.3),
    );
  const forward = () => seq(status('Avanzando'), walk());
  const recover = () =>
    seq(
      status('Recuperación: retroceso limitado'),
      walk(true, 4),
      status('Esperando camino libre'),
      b('capi_timer_start', {
        TIMER: { id: 'auto-clear-timer' },
        SECONDS: 5,
        MODE: 'ONCE',
      }),
      yes('clear', false),
      yes('expired', false),
      until(
        get('expired'),
        seq(
          choose(
            read('valid', 'boolean'),
            choose(
              cmp(read('distance'), 'GTE', num(4)),
              seq(yes('clear', true), yes('expired', true)),
            ),
            seq(yes('fault', true), yes('expired', true)),
          ),
          choose(button(), seq(yes('manual', true), yes('expired', true))),
          choose(
            b('capi_timer_compare', {
              TIMER: { id: 'auto-clear-timer' },
              TIMER_VALUE: 'ELAPSED',
              OPERATOR: 'GTE',
              VALUE: 5,
            }),
            yes('expired', true),
          ),
          wait(),
        ),
      ),
    );
  const retry = () =>
    choose(
      get('clear'),
      choose(
        cmp(get('fault'), 'EQ', bool(false)),
        choose(
          cmp(get('manual'), 'EQ', bool(false)),
          seq(
            status('Segundo y último intento'),
            walk(false, 20),
            status('Exploración terminada: sin más reintentos'),
          ),
        ),
      ),
      status('Obstáculo persistente: misión terminada'),
    );
  const tasks = [
    { key: 'prepare', name: 'Preparar y esperar botón', body: prepare },
    { key: 'check', name: 'Revisar distancia y botón', body: check },
    { key: 'forward', name: 'Explorar el corredor', body: forward },
    { key: 'recover', name: 'Retroceder y esperar', body: recover },
    { key: 'retry', name: 'Intentar una última vez', body: retry },
  ];
  const main = seq(
    yes('fault', false),
    yes('manual', false),
    yes('reverse', false),
    modular ? routine('prepare') : prepare(),
    modular ? routine('forward') : forward(),
    ...(modular
      ? [
          choose(
            cmp(get('fault'), 'EQ', bool(false)),
            choose(
              cmp(get('manual'), 'EQ', bool(false)),
              choose(
                cmp(read('distance'), 'LTE', num(3)),
                seq(routine('recover'), routine('retry')),
              ),
            ),
          ),
        ]
      : []),
    choose(
      get('fault'),
      status('Error: sensor o controlador; volver a iniciar'),
      choose(
        get('manual'),
        status('Finalizada por botón'),
        status('Misión finalizada: revisar resultado de marcha'),
      ),
    ),
    b(
      'capi_serial',
      { TEXT: 'Misión finalizada: ' },
      { DYNAMIC: input(get('state', 'text')) },
    ),
  );
  let scene = createSceneFromTemplate('gorillaTrack');
  scene.canvas.arenaEnvironment = {
    guides: true,
    obstacles: [{ x: 430, y: 355, radius: 28 }],
  };
  scene = addDeviceToScene(scene, 'distanceSensor', {
    id: 'gorilla-sonar',
    name: 'Distancia frontal',
    position: { x: 165, y: 190 },
    pins: { trigger: 17, echo: 34 },
  }).scene;
  scene = addDeviceToScene(scene, 'button', {
    id: 'gorilla-button',
    name: 'Iniciar o terminar misión',
    position: { x: 800, y: 420 },
    pins: { signal: 4 },
    config: { pullup: true },
  }).scene;
  const robot = scene.devices.find((d) => d.kind === 'gorilla');
  if (robot?.kind === 'gorilla' && robot.config.gait)
    robot.config.gait.phaseMs = 200;
  const defs = modular
    ? tasks.map((t, i) => ({
        ...b(
          'capi_procedure_def',
          {
            ROUTINE: { id: 'auto-task-' + t.key },
            P1_TYPE: 'none',
            P2_TYPE: 'none',
            P3_TYPE: 'none',
          },
          { BODY: input(t.body()) },
        ),
        id: 'auto-def-' + t.key,
        x: 48,
        y: 48 + i * 750,
      }))
    : [];
  const variables = [
    ...['stop', 'done', 'fault', 'manual', 'reverse', 'clear', 'expired'].map(
      (key) => ({
        id: 'auto-' + key,
        name: (
          {
            stop: 'Terminar marcha',
            done: 'Marcha terminada',
            fault: 'Error detectado',
            manual: 'Pedido por botón',
            reverse: 'Retrocediendo',
            clear: 'Camino libre',
            expired: 'Espera terminada',
          } as Record<string, string>
        )[key],
        type: 'Boolean',
      }),
    ),
    { id: 'auto-state', name: 'Estado de la misión', type: 'String' },
    ...(modular
      ? [
          {
            id: 'auto-clear-timer',
            name: 'Espera de camino libre',
            type: 'Timer',
          },
          ...tasks.map((t) => ({
            id: 'auto-task-' + t.key,
            name: t.name,
            type: 'Procedure',
          })),
        ]
      : []),
  ];
  return {
    id: modular ? 'gorillaAutonomyProcedures' : 'gorillaAutonomy',
    title: modular
      ? 'GorillaBot: explorar con procedimientos'
      : 'GorillaBot: parar ante un obstáculo',
    icon: '🦍',
    level: 'Intermedio',
    mission:
      'Pulsá y soltá el botón para comenzar. Volvé a pulsarlo para terminar.',
    description: modular
      ? 'Solución completa: distancia válida, monitor cooperativo, avance, retroceso máximo4s y un único reintento. Sin eco o con error finaliza; ninguna evasión ni giro oculto.'
      : 'Solución completa: espera el botón, avanza consultando distancia/validez/botón y termina apoyado ante un obstáculo (3cm virtuales), solicitud o límite40s. Sin eco no significa camino libre.',
    scene,
    workspace: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            ...b('capi_start', {}, { DO: input(main) }),
            id: 'start-main',
            x: 48,
            y: 42,
          },
          ...defs,
        ],
      },
      variables,
      capiTabs: {
        version: 1,
        tabs: [
          { id: 'main', name: 'Principal', rootBlockIds: ['start-main'] },
          ...(modular
            ? [
                {
                  id: 'tab-auto-main',
                  name: 'Misiones',
                  rootBlockIds: defs
                    .filter((d) => d.id !== 'auto-def-check')
                    .map((d) => d.id),
                },
                {
                  id: 'tab-auto-sensors',
                  name: 'Sensores',
                  rootBlockIds: ['auto-def-check'],
                },
              ]
            : []),
        ],
      },
    },
  };
}
