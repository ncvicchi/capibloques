import type { ExampleDefinition } from './capiblocks';
// @ts-expect-error Node strip-types runner.
import { createSceneFromTemplate } from './scene-model.ts';
// @ts-expect-error Node strip-types runner.
import { referencePosture } from './gorilla-model.ts';
export function gorillaPostureExample(modular: boolean): ExampleDefinition {
  type Block = Record<string, unknown>;
  let i = 0;
  const id = () => `posture-${modular ? 'mod' : 'direct'}-${i++}`;
  const seq = (...blocks: Block[]) => {
    const all = structuredClone(blocks);
    for (let n = 0; n < all.length - 1; n++) {
      let tail = all[n];
      while (tail.next) tail = (tail.next as { block: Block }).block;
      tail.next = { block: all[n + 1] };
    }
    return all[0];
  };
  const pose = (key: string) => ({
    type: 'capi_gorilla_posture',
    id: id(),
    fields: { DEVICE_ID: 'gorilla-robot', POSTURE_ID: key, SECONDS: 2 },
  });
  const call = (key: string) => ({
    type: 'capi_procedure_call',
    id: id(),
    fields: { ROUTINE: { id: `pose-task-${key}` } },
  });
  const pause = () => ({
    type: 'capi_wait',
    id: id(),
    fields: { SECONDS: 0.3 },
  });
  const tasks = [
    {
      key: 'reference',
      name: 'Volver a referencia',
      body: () => pose('reference'),
    },
    { key: 'a', name: 'Probar motores A', body: () => seq(pose('a'), pause()) },
    { key: 'b', name: 'Probar motores B', body: () => seq(pose('b'), pause()) },
    {
      key: 'explore',
      name: 'Explorar posturas',
      body: () => seq(call('a'), call('b'), call('reference')),
    },
  ];
  const defs = modular
    ? tasks.map((t, n) => ({
        type: 'capi_procedure_def',
        id: `pose-def-${t.key}`,
        x: 48,
        y: 48 + n * 350,
        fields: {
          ROUTINE: { id: `pose-task-${t.key}` },
          P1_TYPE: 'none',
          P2_TYPE: 'none',
          P3_TYPE: 'none',
        },
        inputs: { BODY: { block: t.body() } },
      }))
    : [];
  const scene = createSceneFromTemplate('gorillaBench'),
    robot = scene.devices[0];
  if (robot.kind === 'gorilla')
    robot.config.postures = [
      referencePosture(),
      { id: 'a', name: 'Motores A +8°', angles: [8, 0, 8, 0, 8, 0, 8, 0] },
      { id: 'b', name: 'Motores B −8°', angles: [0, -8, 0, -8, 0, -8, 0, -8] },
    ];
  return {
    id: modular ? 'gorillaPosturesProcedures' : 'gorillaPostures',
    title: modular
      ? 'GorillaBot: posturas con procedimientos'
      : 'GorillaBot: explorar posturas',
    icon: '🦍',
    level: 'Inicial',
    mission: 'Coordiná ocho motores con posturas por ángulos, sin caminar.',
    description: modular
      ? 'Solución completa: cuatro tareas y tres pestañas. Explorar posturas reúne pruebas A/B y regreso a referencia, tres veces. Robot sostenido: no son posturas de apoyo validadas.'
      : 'Solución completa: preparar, referencia y tres ciclos A/B/referencia. Los ocho motores comparten la transición; probalo con el robot sostenido. No simula equilibrio ni coordenadas del pie.',
    scene,
    workspace: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'capi_start',
            id: 'start-main',
            x: 48,
            y: 42,
            inputs: {
              DO: {
                block: seq(
                  {
                    type: 'capi_gorilla_prepare',
                    id: id(),
                    fields: { DEVICE_ID: 'gorilla-robot' },
                  },
                  modular ? call('reference') : pose('reference'),
                  {
                    type: 'capi_repeat',
                    id: id(),
                    fields: { TIMES: 3 },
                    inputs: {
                      DO: {
                        block: modular
                          ? call('explore')
                          : seq(
                              pose('a'),
                              pause(),
                              pose('b'),
                              pause(),
                              pose('reference'),
                            ),
                      },
                    },
                  },
                ),
              },
            },
          },
          ...defs,
        ],
      },
      ...(modular
        ? {
            variables: tasks.map((t) => ({
              id: `pose-task-${t.key}`,
              name: t.name,
              type: 'Procedure',
            })),
          }
        : {}),
      capiTabs: {
        version: 1,
        tabs: [
          { id: 'main', name: 'Principal', rootBlockIds: ['start-main'] },
          ...(modular
            ? [
                {
                  id: 'tab-pose-sequence',
                  name: 'Secuencia',
                  rootBlockIds: ['pose-def-explore'],
                },
                {
                  id: 'tab-pose-moves',
                  name: 'Posturas',
                  rootBlockIds: defs
                    .filter((d) => d.id !== 'pose-def-explore')
                    .map((d) => d.id),
                },
              ]
            : []),
        ],
      },
    },
  };
}
