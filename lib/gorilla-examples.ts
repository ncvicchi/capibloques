import type { ExampleDefinition } from './capiblocks';
// @ts-expect-error Node strip-types runner.
import { createSceneFromTemplate } from './scene-model.ts';
export function gorillaExample(modular: boolean): ExampleDefinition {
  type Block = Record<string, unknown>;
  let i = 0;
  const id = () => `gorilla-${modular ? 'mod' : 'basic'}-${i++}`;
  const seq = (...blocks: Block[]) => {
    const c = structuredClone(blocks);
    for (let n = 0; n < c.length - 1; n++) {
      let t = c[n];
      while (t.next) t = (t.next as { block: Block }).block;
      t.next = { block: c[n + 1] };
    }
    return c[0];
  };
  const move = (a: number, b?: number) => ({
    type: b === undefined ? 'capi_gorilla_joint' : 'capi_gorilla_pair',
    id: id(),
    fields: {
      DEVICE_ID: 'gorilla-robot',
      INDEX: '0',
      A: a,
      ...(b !== undefined ? { B: b } : {}),
      SECONDS: 1,
    },
  });
  const wait = () => ({
    type: 'capi_wait',
    id: id(),
    fields: { SECONDS: 0.5 },
  });
  const call = (key: string) => ({
    type: 'capi_procedure_call',
    id: id(),
    fields: { ROUTINE: { id: `gorilla-task-${key}` } },
  });
  const tasks = [
    { key: 'neutral', name: 'Pata a referencia', body: () => move(0, 0) },
    {
      key: 'first',
      name: 'Mover la pata a un lado',
      body: () => seq(move(8, -8), wait()),
    },
    {
      key: 'second',
      name: 'Mover la pata al otro lado',
      body: () => seq(move(-8, 8), wait()),
    },
  ];
  const body = seq(
    {
      type: 'capi_gorilla_prepare',
      id: id(),
      fields: { DEVICE_ID: 'gorilla-robot' },
    },
    modular ? call('neutral') : move(0),
    {
      type: 'capi_repeat',
      id: id(),
      fields: { TIMES: 3 },
      inputs: {
        DO: {
          block: modular
            ? seq(call('first'), call('second'), call('neutral'))
            : seq(move(10), wait(), move(-10), wait(), move(0)),
        },
      },
    },
  );
  const defs = modular
    ? tasks.map((r, n) => ({
        type: 'capi_procedure_def',
        id: `gorilla-def-${r.key}`,
        x: 48,
        y: 48 + n * 350,
        fields: {
          ROUTINE: { id: `gorilla-task-${r.key}` },
          P1_TYPE: 'none',
          P2_TYPE: 'none',
          P3_TYPE: 'none',
        },
        inputs: { BODY: { block: r.body() } },
      }))
    : [];
  return {
    id: modular ? 'gorillaBenchProcedures' : 'gorillaBench',
    title: modular
      ? 'GorillaBot: una pata con procedimientos'
      : 'GorillaBot: conocer un motor',
    icon: '🦍',
    level: 'Inicial',
    mission: 'Prepará, observá los motores A/B y practicá sin caminar.',
    description: modular
      ? 'Solución completa: tres tareas, dos pestañas y tres repeticiones del par delantero izquierdo. Desplazamientos relativos, no cinemática cartesiana ni marcha.'
      : 'Solución completa: prepara sin centrar los ocho motores, lleva sólo el motor delantero izquierdo A a referencia y lo mueve ±10° tres veces.',
    scene: createSceneFromTemplate('gorillaBench'),
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
            variables: tasks.map((t) => ({
              id: `gorilla-task-${t.key}`,
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
                  id: 'tab-gorilla-leg',
                  name: 'Una pata',
                  rootBlockIds: defs.map((d) => d.id),
                },
              ]
            : []),
        ],
      },
    },
  };
}
