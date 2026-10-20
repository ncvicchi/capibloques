import type { ExampleDefinition } from './capiblocks';
// @ts-expect-error Node strip-types runner.
import { gorillaAutonomyExample } from './gorilla-autonomy-examples.ts';
export function gorillaRemoteExample(modular: boolean): ExampleDefinition {
  type B = Record<string, unknown>;
  let n = 0;
  const b = (
    type: string,
    fields: Record<string, unknown> = {},
    inputs: Record<string, unknown> = {},
  ): B => ({ type, id: `remote-${modular}-${n++}`, fields, inputs });
  const input = (block: B) => ({ block });
  const seq = (...items: B[]) => {
    for (let i = 0; i < items.length - 1; i++) {
      let tail = items[i];
      while (tail.next) tail = (tail.next as { block: B }).block;
      tail.next = input(items[i + 1]);
    }
    return items[0];
  };
  const num = (v: number) => b('capi_value_number', { VALUE: v }),
    text = (v: string) => b('capi_value_text', { VALUE: v }),
    bool = (v: boolean) =>
      b('capi_value_boolean', { VALUE: v ? 'TRUE' : 'FALSE' });
  const read = (key: string, type = 'boolean', device = 'gorilla-robot') =>
    b('capi_component_' + type, { DEVICE_ID: device, PROPERTY: key });
  const cmp = (a: B, c: string, d: B) =>
    b(
      'capi_value_compare',
      { OPERATOR: c },
      { LEFT: input(a), RIGHT: input(d) },
    );
  const choose = (c: B, body: B) =>
    b('capi_if', {}, { CONDITION: input(c), DO: input(body) });
  const wait = () => b('capi_wait', { SECONDS: 0.05 });
  const get = (id: string) =>
    b('capi_variable_get_boolean', { VAR: { id: 'remote-' + id } });
  const set = (id: string, v: boolean) =>
    b(
      'capi_variable_set_boolean',
      { VAR: { id: 'remote-' + id } },
      { VALUE: input(bool(v)) },
    );
  const call = (id: string) =>
    b('capi_procedure_call', { ROUTINE: { id: 'remote-task-' + id } });
  const walk = (mode: number, c: B = bool(false)) =>
    b(
      'capi_gorilla_remote_walk',
      { DEVICE_ID: 'gorilla-robot', MODE: String(mode), LIMIT: 30 },
      { CONDITION: input(c) },
    );
  const manual = () =>
    seq(
      ...['adelante', 'atrás'].map((name, i) =>
        choose(cmp(read('remoteDirection', 'text'), 'EQ', text(name)), walk(i)),
      ),
    );
  const monitor = () =>
    seq(
      choose(
        cmp(read('valid', 'boolean', 'gorilla-sonar'), 'EQ', bool(false)),
        set('stop', true),
      ),
      choose(
        cmp(read('distance', 'number', 'gorilla-sonar'), 'LTE', num(3)),
        set('stop', true),
      ),
      choose(
        b('capi_button_pressed', { DEVICE_ID: 'gorilla-button' }),
        set('stop', true),
      ),
      wait(),
    );
  const mission = () =>
    seq(
      set('stop', false),
      set('done', false),
      monitor(),
      {
        ...b(
          'capi_parallel',
          {},
          {
            BRANCH0: input(seq(walk(0, get('stop')), set('done', true))),
            BRANCH1: input(
              b(
                'capi_while',
                { MODE: 'UNTIL' },
                { CONDITION: input(get('done')), DO: input(call('monitor')) },
              ),
            ),
          },
        ),
        extraState: { branches: 2 },
      },
      b(
        'capi_serial',
        { TEXT: 'Misión terminada: ' },
        { DYNAMIC: input(read('walkOutcome', 'text')) },
      ),
    );
  const tasks = modular
    ? [
        { id: 'manual', name: 'Mover con el mando', body: manual },
        { id: 'mission', name: 'Explorar con distancia', body: mission },
        { id: 'monitor', name: 'Revisar distancia y botón', body: monitor },
      ]
    : [];
  const main = seq(
    b('capi_gorilla_prepare', { DEVICE_ID: 'gorilla-robot' }),
    ...(modular ? [set('used', false)] : []),
    b(
      'capi_forever',
      {},
      {
        DO: input(
          seq(
            ...(modular
              ? [
                  choose(
                    cmp(read('remoteMission', 'number'), 'EQ', num(0)),
                    set('used', false),
                  ),
                ]
              : []),
            choose(
              read('remoteArmed'),
              seq(
                choose(
                  cmp(read('remoteMode', 'text'), 'EQ', text('manual')),
                  modular ? call('manual') : manual(),
                ),
                ...(modular
                  ? [
                      choose(
                        cmp(read('remoteMode', 'text'), 'EQ', text('autónomo')),
                        choose(
                          cmp(read('remoteMission', 'number'), 'EQ', num(1)),
                          choose(
                            cmp(get('used'), 'EQ', bool(false)),
                            seq(set('used', true), call('mission')),
                          ),
                        ),
                      ),
                    ]
                  : []),
              ),
            ),
            wait(),
          ),
        ),
      },
    ),
  );
  const scene = structuredClone(gorillaAutonomyExample(false).scene!);
  if (!modular)
    scene.devices = scene.devices.filter(
      (d) => d.kind !== 'distanceSensor' && d.kind !== 'button',
    );
  scene.canvas.arenaEnvironment = {
    guides: true,
    obstacles: modular ? [{ x: 430, y: 355, radius: 28 }] : [],
  };
  const robot = scene.devices.find((d) => d.kind === 'gorilla');
  if (robot?.kind === 'gorilla')
    robot.config.remote = { missions: modular ? ['Explorar el corredor'] : [] };
  const defs = tasks.map((t, i) => ({
    ...b(
      'capi_procedure_def',
      {
        ROUTINE: { id: 'remote-task-' + t.id },
        P1_TYPE: 'none',
        P2_TYPE: 'none',
        P3_TYPE: 'none',
      },
      { BODY: input(t.body()) },
    ),
    id: 'remote-def-' + t.id,
    x: 48,
    y: 48 + i * 620,
  }));
  return {
    id: modular ? 'gorillaRemoteMissions' : 'gorillaRemote',
    title: modular
      ? 'GorillaBot: mando y misión con sensores'
      : 'GorillaBot: mando desde el celular',
    icon: '🎮',
    level: 'Intermedio',
    mission:
      'Ejecutá, conectá el mando y habilitalo en reposo. Mantené una dirección presionada.',
    description: modular
      ? 'Solución completa con procedimientos y pestañas. Mando manual o misión autorizada: avanza hasta obstáculo, botón, pérdida del mando o máximo 30 s. Sin eco se detiene; no se repite la misión automáticamente.'
      : 'Solución completa de mando manual: preparar sin mover y responder a adelante/atrás mientras se mantiene presionado. Soltar o desconectar termina en apoyo. Sin detección de obstáculos. Giros requieren validación y bloques explícitos.',
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
      variables: modular
        ? [
            ...['stop', 'done', 'used'].map((id) => ({
              id: 'remote-' + id,
              name: (
                {
                  stop: 'Terminar misión',
                  done: 'Misión terminada',
                  used: 'Misión atendida',
                } as Record<string, string>
              )[id],
              type: 'Boolean',
            })),
            ...tasks.map((t) => ({
              id: 'remote-task-' + t.id,
              name: t.name,
              type: 'Procedure',
            })),
          ]
        : [],
      capiTabs: {
        version: 1,
        tabs: [
          { id: 'main', name: 'Principal', rootBlockIds: ['start-main'] },
          ...(modular
            ? [
                {
                  id: 'tab-remote-manual',
                  name: 'Mando',
                  rootBlockIds: ['remote-def-manual'],
                },
                {
                  id: 'tab-remote-missions',
                  name: 'Autonomía',
                  rootBlockIds: ['remote-def-mission', 'remote-def-monitor'],
                },
              ]
            : []),
        ],
      },
    },
  };
}
