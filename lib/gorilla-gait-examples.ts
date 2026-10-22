import type { ExampleDefinition } from './capiblocks';
// @ts-expect-error Node strip-types runner.
import { createSceneFromTemplate } from './scene-model.ts';
export function gorillaGaitExample(modular: boolean): ExampleDefinition {
  type Block = Record<string, unknown>;
  let n = 0;
  const block = (
    type: string,
    fields: Record<string, unknown> = {},
  ): Block => ({ type, id: `gait-${modular}-${n++}`, fields });
  const seq = (...items: Block[]) => {
    for (let i = 0; i < items.length - 1; i++) {
      let tail = items[i];
      while (tail.next) tail = (tail.next as { block: Block }).block;
      tail.next = { block: items[i + 1] };
    }
    return items[0];
  };
  const move = (mode: number) =>
    block('capi_gorilla_gait', {
      DEVICE_ID: 'gorilla-robot',
      MODE: String(mode),
      TIMES: 8,
    });
  const settle = () =>
    block('capi_gorilla_settle', { DEVICE_ID: 'gorilla-robot' });
  const wait = () => block('capi_wait', { SECONDS: 1 });
  const tasks = [
    {
      key: 'prepare',
      name: 'Preparar robot',
      body: () =>
        seq(
          block('capi_gorilla_prepare', { DEVICE_ID: 'gorilla-robot' }),
          settle(),
          wait(),
        ),
    },
    {
      key: 'out',
      name: 'Ir a la estación',
      body: () => seq(move(0), settle(), wait()),
    },
    {
      key: 'home',
      name: 'Volver a casa',
      body: () => seq(move(1), settle(), wait()),
    },
  ];
  const call = (key: string) =>
    block('capi_procedure_call', { ROUTINE: { id: `gait-task-${key}` } });
  const start = {
    ...block('capi_start'),
    id: 'start-main',
    x: 48,
    y: 42,
    inputs: {
      DO: {
        block: modular
          ? seq(...tasks.map((t) => call(t.key)))
          : seq(...tasks.map((t) => t.body())),
      },
    },
  };
  const defs = modular
    ? tasks.map((t, i) => ({
        ...block('capi_procedure_def', {
          ROUTINE: { id: `gait-task-${t.key}` },
          P1_TYPE: 'none',
          P2_TYPE: 'none',
          P3_TYPE: 'none',
        }),
        id: `gait-def-${t.key}`,
        x: 48,
        y: 48 + i * 380,
        inputs: { BODY: { block: t.body() } },
      }))
    : [];
  return {
    id: modular ? 'gorillaTrackProcedures' : 'gorillaTrack',
    title: modular
      ? 'GorillaBot: marcha con procedimientos'
      : 'GorillaBot: ida y vuelta',
    icon: '🦍',
    level: 'Intermedio',
    mission: 'Llegá a la estación A y regresá caminando hacia atrás.',
    description:
      'Solución completa: preparar, quedar apoyado, ocho ciclos hacia adelante, esperar y ocho hacia atrás. Pista y giro idealizados; no garantiza equilibrio físico. Cada ciclo recupera las cuatro patas. ' +
      (modular ? 'Tres procedimientos y dos pestañas.' : 'Versión secuencial.'),
    scene: createSceneFromTemplate('gorillaTrack'),
    workspace: {
      blocks: { languageVersion: 0, blocks: [start, ...defs] },
      ...(modular
        ? {
            variables: tasks.map((t) => ({
              id: `gait-task-${t.key}`,
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
                  id: 'tab-gait-tasks',
                  name: 'Recorrido',
                  rootBlockIds: defs.map((d) => d.id),
                },
              ]
            : []),
        ],
      },
    },
  };
}
