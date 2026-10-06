import {
  makeProject,
  normalizeCompiledProgram,
  type CompiledProgram,
  type ProjectFile,
  type ProgramNode,
  type ValueExpression,
  // @ts-expect-error Node strip-types runner.
} from './capiblocks.ts';
import {
  createEmptyScene,
  addDeviceToScene,
  isSceneDefinition,
  cloneScene,
  type SceneDefinition,
  // @ts-expect-error Node strip-types runner.
} from './scene-model.ts';
// @ts-expect-error Node strip-types runner.
import { componentValueCapabilities } from './component-capabilities.ts';

export type ChallengeScalar = number | string | boolean;
export type ChallengeObservation =
  | ValueExpression
  | { kind: 'consoleText' }
  | { kind: 'displayText'; deviceId: string; areaId: string }
  | { kind: 'actionCount'; operation: ProgramNode['op'] };
export interface ChallengeGoal {
  label: string;
  atMs: number;
  value: ChallengeObservation;
  operator: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE' | 'CONTAINS';
  expected: ChallengeScalar;
}
export interface ChallengeVariant {
  label: string;
  seed: number;
  reserved?: boolean;
  inputs: { deviceId: string; values: ChallengeScalar[] }[];
  goals: ChallengeGoal[];
}
export interface ChallengeExpectation {
  operation: ProgramNode['op'] | 'parameters' | 'dataText';
  minimum: number;
  mandatory: boolean;
  explanation: string;
}
export interface Challenge {
  format: 'CapiChallenge';
  schemaVersion: 1;
  id: string;
  version: number;
  title: string;
  prompt: string;
  stage: number;
  concepts: string[];
  mode: 'empty' | 'partial' | 'broken' | 'refactor' | 'creative';
  initial: ProjectFile;
  palette: string[];
  hints: string[];
  explanation: string;
  variants: ChallengeVariant[];
  expectations: ChallengeExpectation[];
}
export interface ChallengeReport {
  status: 'passed' | 'retry' | 'invalid' | 'validator-error' | 'creative';
  cases: { label: string; seed: number; passed: boolean; facts: string[] }[];
  suggestions: string[];
  requirements: string[];
  message: string;
}

export function challengeSeed(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function variantScene(
  challenge: Challenge,
  variant: ChallengeVariant,
): SceneDefinition {
  const scene = cloneScene(challenge.initial.scene),
    random = challengeSeed(variant.seed);
  for (const input of variant.inputs) {
    const device = scene.devices.find((item) => item.id === input.deviceId);
    if (!device)
      throw new Error('La variante apunta a un componente retirado.');
    const value = input.values[Math.floor(random() * input.values.length)];
    if (device.kind === 'button') device.config.pressed = Boolean(value);
    else if (device.kind === 'infraredBarrier')
      device.config.interrupted = Boolean(value);
    else if (device.kind === 'lightSensor' || device.kind === 'potentiometer')
      device.config.value = Number(value);
    else
      throw new Error(
        'Esta variante necesita un botón, barrera o sensor numérico.',
      );
  }
  return scene;
}
export function compareChallenge(
  left: ChallengeScalar,
  operator: ChallengeGoal['operator'],
  right: ChallengeScalar,
) {
  if (typeof left !== typeof right) return false;
  if (operator === 'CONTAINS')
    return (
      typeof left === 'string' &&
      typeof right === 'string' &&
      left.includes(right)
    );
  if (operator === 'EQ') return left === right;
  if (operator === 'NEQ') return left !== right;
  if (typeof left !== 'number' || typeof right !== 'number') return false;
  return operator === 'LT'
    ? left < right
    : operator === 'LTE'
      ? left <= right
      : operator === 'GT'
        ? left > right
        : left >= right;
}
export function challengeExpectations(
  program: CompiledProgram,
  challenge: Challenge,
) {
  const counts = new Map<string, number>();
  const containsData = (value: unknown): boolean =>
    !!value &&
    typeof value === 'object' &&
    (Array.isArray(value)
      ? value.some(containsData)
      : ['counterValue', 'variable'].includes(
          (value as { kind: string }).kind,
        ) || Object.values(value).some(containsData));
  const visit = (nodes: ProgramNode[]) => {
    for (const node of nodes) {
      counts.set(node.op, (counts.get(node.op) ?? 0) + 1);
      if (node.op === 'serial' && containsData(node.expression))
        counts.set('dataText', (counts.get('dataText') ?? 0) + 1);
      if (node.op === 'repeat' || node.op === 'while') visit(node.body);
      if (node.op === 'if') {
        visit(node.consequent);
        visit(node.otherwise);
      }
      if (node.op === 'switch') {
        node.cases.forEach((branch) => visit(branch.body));
        visit(node.otherwise);
      }
      if (node.op === 'parallel') node.branches.forEach(visit);
      if (node.op === 'messageReceive' || node.op === 'wifiMessageReceive') {
        visit(node.equal);
        visit(node.different);
        visit(node.timeout);
      }
    }
  };
  program.threads.forEach((thread) => visit(thread.nodes));
  const called = new Set<string>();
  const collectCalls = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(collectCalls);
      return;
    }
    const item = value as Record<string, unknown>;
    if (item.op === 'procedureCall' || item.kind === 'functionCall')
      called.add(String(item.routineId));
    Object.values(item).forEach(collectCalls);
  };
  program.threads.forEach((thread) => collectCalls(thread.nodes));
  for (let pass = 0; pass < 24; pass++)
    for (const routine of program.routines ?? [])
      if (called.has(routine.id)) {
        collectCalls(routine.body);
        collectCalls(routine.returnValue);
      }
  for (const routine of program.routines ?? [])
    if (called.has(routine.id)) {
      visit(routine.body);
      if (
        routine.parameters.some((parameter) =>
          JSON.stringify([routine.body, routine.returnValue]).includes(
            `"parameterId":"${parameter.id}"`,
          ),
        )
      )
        counts.set('parameters', (counts.get('parameters') ?? 0) + 1);
    }
  const suggestions: string[] = [],
    requirements: string[] = [];
  for (const expectation of challenge.expectations)
    if ((counts.get(expectation.operation) ?? 0) < expectation.minimum)
      (expectation.mandatory ? requirements : suggestions).push(
        expectation.explanation,
      );
  return { suggestions, requirements };
}
export function decodeChallenge(raw: unknown): Challenge {
  const fail = () => {
    throw new Error(
      'Desafío inválido: revisá proyecto, objetivos, variantes y límites.',
    );
  };
  if (!raw || typeof raw !== 'object' || JSON.stringify(raw).length > 250_000)
    fail();
  const c = raw as Challenge;
  if (
    c.format !== 'CapiChallenge' ||
    c.schemaVersion !== 1 ||
    !/^[-a-zA-Z0-9_]{1,100}$/.test(c.id) ||
    !Number.isInteger(c.version) ||
    c.version < 1 ||
    !Number.isInteger(c.stage) ||
    c.stage < 1 ||
    c.stage > 14 ||
    typeof c.title !== 'string' ||
    !c.title.trim() ||
    c.title.length > 100 ||
    typeof c.prompt !== 'string' ||
    !c.prompt.trim() ||
    c.prompt.length > 2000 ||
    !['empty', 'partial', 'broken', 'refactor', 'creative'].includes(c.mode)
  )
    fail();
  for (const [list, limit, max] of [
    [c.hints, 6, 500],
    [c.concepts, 10, 80],
    [c.palette, 180, 80],
  ] as const)
    if (
      !Array.isArray(list) ||
      list.length > limit ||
      list.some(
        (item) => typeof item !== 'string' || !item.trim() || item.length > max,
      )
    )
      fail();
  if (
    typeof c.explanation !== 'string' ||
    c.explanation.length > 2000 ||
    c.initial?.application !== 'CapiBloques' ||
    !isSceneDefinition(c.initial.scene) ||
    !c.initial.workspace
  )
    fail();
  if (
    !Array.isArray(c.variants) ||
    !c.variants.length ||
    c.variants.length > 8 ||
    !Array.isArray(c.expectations) ||
    c.expectations.length > 12
  )
    fail();
  for (const variant of c.variants) {
    if (variant.reserved !== undefined && typeof variant.reserved !== 'boolean')
      fail();
    if (
      typeof variant.label !== 'string' ||
      variant.label.length > 80 ||
      !Number.isInteger(variant.seed) ||
      variant.seed < 0 ||
      variant.seed > 0xffffffff ||
      !Array.isArray(variant.inputs) ||
      variant.inputs.length > 16 ||
      !Array.isArray(variant.goals) ||
      (!variant.goals.length && c.mode !== 'creative') ||
      variant.goals.length > 16
    )
      fail();
    for (const input of variant.inputs) {
      const device = c.initial.scene.devices.find(
          (d) => d.id === input.deviceId,
        ),
        boolean = device && ['button', 'infraredBarrier'].includes(device.kind);
      if (
        !device ||
        !Array.isArray(input.values) ||
        !input.values.length ||
        input.values.length > 16 ||
        input.values.some((value) =>
          boolean
            ? typeof value !== 'boolean'
            : typeof value !== 'number' ||
              !Number.isFinite(value) ||
              value < 0 ||
              value > 4095,
        )
      )
        fail();
    }
    variantScene(c, variant);
    for (const goal of variant.goals) {
      if (
        typeof goal.label !== 'string' ||
        !goal.label.trim() ||
        goal.label.length > 200 ||
        !Number.isInteger(goal.atMs) ||
        goal.atMs < 0 ||
        goal.atMs > 120_000 ||
        !['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'CONTAINS'].includes(
          goal.operator,
        ) ||
        !['number', 'string', 'boolean'].includes(typeof goal.expected) ||
        (typeof goal.expected === 'number' &&
          !Number.isFinite(goal.expected)) ||
        !goal.value
      )
        fail();
      if ((typeof goal.expected==='string'&&goal.expected.length>2000)||(['LT','LTE','GT','GTE'].includes(goal.operator)&&typeof goal.expected!=='number')||(goal.operator==='CONTAINS'&&typeof goal.expected!=='string'))fail();
      if (goal.value.kind === 'consoleText') {if(typeof goal.expected!=='string')fail();continue;}
      if (goal.value.kind === 'displayText') {
        const observation = goal.value;
        if (
          !c.initial.scene.devices.some(
            (d) => d.id === observation.deviceId && d.kind === 'display',
          ) ||
          typeof observation.areaId !== 'string'
          || typeof goal.expected!=='string'
        )
          fail();
        continue;
      }
      if (goal.value.kind === 'actionCount') {
        if (typeof goal.value.operation !== 'string') fail();
        continue;
      }
      const p = normalizeCompiledProgram(
        [
          {
            op: 'variableSet',
            variableId: 'goal',
            value: goal.value,
            blockId: 'goal',
          },
        ],
        c.initial.scene,
      );
      const normalized = p.threads[0]?.nodes[0];
      if (
        normalized?.op !== 'variableSet' ||
        JSON.stringify(normalized.value) !== JSON.stringify(goal.value)
      )
        fail();
      if (goal.value.kind === 'componentValue') {
        const observation = goal.value,
          device = c.initial.scene.devices.find(
            (d) => d.id === observation.deviceId,
          );
        if (
          !device ||
          !componentValueCapabilities(device).some(
            (cap) =>
              cap.key === observation.property &&
              cap.type === observation.valueType &&
              cap.source === observation.source,
          )
        )
          fail();
      }
      if (typeof goal.expected === 'string' && goal.expected.length > 2000)
        fail();
      if (
        (['LT', 'LTE', 'GT', 'GTE'].includes(goal.operator) &&
          typeof goal.expected !== 'number') ||
        (goal.operator === 'CONTAINS' && typeof goal.expected !== 'string')
      )
        fail();
    }
  }
  if (c.variants.every((variant) => variant.reserved)) fail();
  for (const e of c.expectations)
    if (
      typeof e.operation !== 'string' ||
      !Number.isInteger(e.minimum) ||
      e.minimum < 1 ||
      e.minimum > 100 ||
      typeof e.mandatory !== 'boolean' ||
      typeof e.explanation !== 'string' ||
      !e.explanation.trim() ||
      e.explanation.length > 500 ||
      (e.mandatory && !c.prompt.includes(e.explanation))
    )
      fail();
  return structuredClone(c);
}

const basic = [
  'capi_wait',
  'capi_serial',
  'capi_led',
  'capi_value_number',
  'capi_value_text',
  'capi_value_boolean',
];
const control = [
  'capi_repeat',
  'capi_forever',
  'capi_while',
  'capi_if',
  'capi_value_compare',
  'capi_compare',
  'capi_button_pressed',
  'capi_component_boolean',
  'capi_component_number',
  'capi_counter_set',
  'capi_counter_change',
  'capi_counter_value',
];
const data = [
  'capi_variable_set_number',
  'capi_variable_get_number',
  'capi_variable_change',
  'capi_number_math',
  'capi_text_join',
];
const routines = [
  'capi_procedure_def',
  'capi_procedure_call',
  'capi_parameter_number',
  'capi_parameter_text',
  'capi_function_def_number',
  'capi_function_call_number',
];
function sceneForChallenge() {
  let scene = createEmptyScene('Laboratorio de luces');
  scene.id = 'capi-laboratorio-luces';
  for (const kind of ['led', 'button', 'potentiometer'] as const) {
    scene = addDeviceToScene(scene, kind).scene;
    scene.devices.at(-1)!.id = `challenge-${kind}`;
  }
  return scene;
}
const initialScene = sceneForChallenge();
const ledId = initialScene.devices.find((device) => device.kind === 'led')!.id;
const buttonId = initialScene.devices.find(
  (device) => device.kind === 'button',
)!.id;
const potId = initialScene.devices.find(
  (device) => device.kind === 'potentiometer',
)!.id;
const brightness: ValueExpression = {
  kind: 'componentValue',
  deviceId: ledId,
  property: 'brightness',
  valueType: 'number',
  source: 'ordered',
};
const goal = (
  label: string,
  atMs: number,
  expected: number,
): ChallengeGoal => ({
  label,
  atMs,
  value: brightness,
  operator: 'EQ',
  expected,
});
const definitions: [
  string,
  string,
  string,
  ChallengeGoal[],
  ChallengeExpectation[],
][] = [
  [
    'Una luz con intención',
    'secuencia',
    'Encendé la luz al 100% y dejala encendida.',
    [goal('La luz queda encendida', 100, 100)],
    [],
  ],
  [
    'Tres destellos',
    'repetición',
    'Hacé tres destellos: cada encendido dura un segundo y cada apagado, otro segundo. Después queda apagada.',
    [
      goal('Primer destello', 500, 100),
      goal('Primer descanso', 1500, 0),
      goal('Segundo destello', 2500, 100),
      goal('Tercer descanso', 5500, 0),
    ],
    [
      {
        operation: 'repeat',
        minimum: 1,
        mandatory: false,
        explanation: 'Probá agrupar los destellos con Repetir.',
      },
    ],
  ],
  [
    'Mi tarea de encendido',
    'procedimientos',
    'Creá y llamá una tarea que deje encendida la luz.',
    [goal('La luz encendida', 100, 100)],
    [
      {
        operation: 'procedureCall',
        minimum: 1,
        mandatory: true,
        explanation: 'Creá y llamá una tarea que deje encendida la luz.',
      },
    ],
  ],
  [
    'Un botón decide',
    'decisión',
    'Si el botón está presionado, encendé la luz. Si no, dejala apagada.',
    [goal('Con botón, luz encendida', 100, 100)],
    [],
  ],
  [
    'Dos respuestas',
    'si / si no',
    'Con el botón presionado, brillo 100. Con el botón libre, brillo 25.',
    [goal('Brillo pedido', 100, 100)],
    [],
  ],
  [
    'Revisar sin quedarse esperando',
    'repetición condicional',
    'Mientras el botón esté presionado, mantené la luz en 100. Cuando no lo esté, apagála. Usá Mientras para consultar la condición en cada vuelta.',
    [
      goal('Consulta al botón', 100, 100),
      goal('Sigue respondiendo', 1000, 100),
    ],
    [
      {
        operation: 'while',
        minimum: 1,
        mandatory: true,
        explanation: 'Usá Mientras para consultar la condición en cada vuelta.',
      },
    ],
  ],
  [
    'La perilla tiene voz',
    'sensor numérico',
    'Si la perilla está por debajo de 2000, apagá la luz; de lo contrario, encendela al 100%.',
    [goal('Respuesta a la perilla', 100, 100)],
    [],
  ],
  [
    'Contar sin copiar',
    'variables y textos',
    'Dejá el contador en 5. Mostrá su valor en un mensaje construido con datos, no escrito a mano. Construí el mensaje con un dato del contador o una variable.',
    [
      {
        label: 'El contador llega a cinco',
        atMs: 100,
        value: { kind: 'counterValue' },
        operator: 'EQ',
        expected: 5,
      },
      {
        label: 'El mensaje incluye el dato',
        atMs: 100,
        value: { kind: 'consoleText' },
        operator: 'CONTAINS',
        expected: '5',
      },
    ],
    [
      {
        operation: 'dataText',
        minimum: 1,
        mandatory: true,
        explanation:
          'Construí el mensaje con un dato del contador o una variable.',
      },
    ],
  ],
  [
    'Una tarea con datos',
    'parámetros',
    'Creá una tarea con un dato de entrada y llamala para encender la luz.',
    [goal('La tarea enciende la luz', 100, 100)],
    [
      {
        operation: 'parameters',
        minimum: 1,
        mandatory: true,
        explanation:
          'Creá una tarea con un dato de entrada y llamala para encender la luz.',
      },
    ],
  ],
  [
    'Según el botón',
    'según',
    'Usá Según con sí/no: botón presionado, brillo 100; botón libre, brillo 25.',
    [goal('Caso elegido', 100, 100)],
    [
      {
        operation: 'switch',
        minimum: 1,
        mandatory: true,
        explanation:
          'Usá Según con sí/no: botón presionado, brillo 100; botón libre, brillo 25.',
      },
    ],
  ],
  [
    'Una alarma sin bloquear',
    'temporizadores',
    'Encendé la luz durante un segundo y luego apagála. Probá hacerlo con un temporizador.',
    [
      goal('Antes de la alarma', 500, 100),
      goal('Después de la alarma', 1500, 0),
    ],
    [
      {
        operation: 'timerStart',
        minimum: 1,
        mandatory: false,
        explanation:
          'Iniciá un temporizador y esperá su evento para apagar la luz.',
      },
    ],
  ],
  [
    'Dos tareas a la vez',
    'paralelo',
    'Una tarea enciende la luz al comenzar y la apaga a los dos segundos. Otra deja el contador en 3 antes del primer segundo.',
    [
      goal('Luz inicial', 500, 100),
      goal('Luz final', 2500, 0),
      {
        label: 'Contador independiente',
        atMs: 500,
        value: { kind: 'counterValue' },
        operator: 'EQ',
        expected: 3,
      },
    ],
    [
      {
        operation: 'parallel',
        minimum: 1,
        mandatory: false,
        explanation: 'Separá las tareas con Al mismo tiempo.',
      },
    ],
  ],
  [
    'Corregí la luz',
    'depuración',
    'El programa enciende la luz a 10%, pero necesitamos 100%. Encontrá y corregí el bloque.',
    [goal('Brillo corregido', 100, 100)],
    [],
  ],
];
export const challengeCatalog: Challenge[] = definitions.map(
  ([title, concept, prompt, goals, expectations], index) => {
    const id = `capi-reto-${index + 1}`;
    const workspace: Record<string, unknown> = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'capi_start',
            id: `${id}-start`,
            x: 40,
            y: 40,
            ...(index === 12
              ? {
                  inputs: {
                    DO: {
                      block: {
                        type: 'capi_led',
                        id: `${id}-broken`,
                        fields: { DEVICE_ID: ledId, BRIGHTNESS: 10 },
                      },
                    },
                  },
                }
              : {}),
          },
        ],
      },
    };
    const challenge: Challenge = {
      format: 'CapiChallenge',
      schemaVersion: 1,
      id,
      version: 1,
      title,
      prompt,
      stage: index + 1,
      concepts: [concept],
      mode: index === 12 ? 'broken' : 'empty',
      initial: makeProject(title, initialScene, workspace, 1),
      palette: [
        ...basic,
        ...(index > 0 ? control : []),
        ...(index >= 2 ? routines : []),
        ...(index >= 7 ? data : []),
        ...(index >= 9 ? ['capi_switch'] : []),
        ...(index >= 10
          ? [
              'capi_timer_start',
              'capi_timer_wait',
              'capi_timer_remaining',
              'capi_timer_elapsed',
            ]
          : []),
        ...(index >= 11 ? ['capi_parallel'] : []),
      ],
      hints: [
        'Probá paso a paso y observá qué cambia.',
        `Revisá la categoría relacionada con ${concept}.`,
        'Separá lo que querés observar de las órdenes necesarias para conseguirlo.',
      ],
      explanation:
        'Una solución funciona cuando cumple los objetivos en todos los casos probados. Hay distintas formas válidas de construirla.',
      variants: [{ label: 'Caso inicial', seed: 11, inputs: [], goals }],
      expectations,
    };
    challenge.initial.metadata.updatedAt = '2026-10-05T00:00:00.000Z';
    if ([3, 4, 5, 9].includes(index))
      challenge.variants = [true, false].map((pressed, i) => ({
        label: pressed ? 'Botón presionado' : 'Botón libre',
        seed: 11 + i,
        inputs: [{ deviceId: buttonId, values: [pressed] }],
        goals: goals.map((g) => ({
          ...g,
          expected: pressed ? 100 : [4, 9].includes(index) ? 25 : 0,
        })),
      }));
    if (index === 6)
      challenge.variants = [500, 1900, 2000, 3500].map((value, i) => ({
        label: `Perilla ${value}`,
        seed: 20 + i,
        inputs: [{ deviceId: potId, values: [value] }],
        goals: goals.map((g) => ({ ...g, expected: value < 2000 ? 0 : 100 })),
      }));
    return challenge;
  },
);
// Own complementary activities: each varies one concept, not someone else's story.
const screenScene = addDeviceToScene(cloneScene(initialScene), 'display').scene;
screenScene.devices.at(-1)!.id = 'challenge-display';
const screenChallenge: Challenge = {
  ...structuredClone(challengeCatalog[0]),
  id: 'capi-reto-14',
  title: 'Un saludo en la pantalla',
  stage: 13,
  concepts: ['mensajes', 'pantallas'],
  prompt:
    'Mostrá HOLA en la pantalla y enviá LISTO a la consola. Son dos destinos distintos.',
  initial: makeProject(
    'Un saludo en la pantalla',
    screenScene,
    {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'capi_start', id: 'screen-start', x: 40, y: 40 }],
      },
    },
    1,
  ),
  palette: [...basic, 'capi_display_write', 'capi_display_clear'],
  variants: [
    {
      label: 'Pantalla y consola',
      seed: 40,
      inputs: [],
      goals: [
        {
          label: 'Saludo en pantalla',
          atMs: 100,
          value: {
            kind: 'displayText',
            deviceId: 'challenge-display',
            areaId: 'screen',
          },
          operator: 'CONTAINS',
          expected: 'HOLA',
        },
        {
          label: 'Aviso independiente',
          atMs: 100,
          value: { kind: 'consoleText' },
          operator: 'CONTAINS',
          expected: 'LISTO',
        },
      ],
    },
  ],
};
screenChallenge.initial.metadata.updatedAt = '2026-10-05T00:00:00.000Z';
challengeCatalog.push(screenChallenge);
const refactor = structuredClone(challengeCatalog[1]);
refactor.id = 'capi-reto-15';
refactor.title = 'Un programa que se puede ordenar';
refactor.mode = 'refactor';
refactor.prompt += ' Conservá el comportamiento usando Repetir.';
refactor.expectations = [
  {
    operation: 'repeat',
    minimum: 1,
    mandatory: true,
    explanation: 'Conservá el comportamiento usando Repetir.',
  },
];
const actions = Array.from({ length: 3 }, () => [
  { type: 'capi_led', fields: { DEVICE_ID: ledId, BRIGHTNESS: 100 } },
  { type: 'capi_wait', fields: { SECONDS: 1 } },
  { type: 'capi_led', fields: { DEVICE_ID: ledId, BRIGHTNESS: 0 } },
  { type: 'capi_wait', fields: { SECONDS: 1 } },
]).flat();
let chain: Record<string, unknown> | undefined;
for (let i = actions.length - 1; i >= 0; i--)
  chain = {
    ...actions[i],
    id: `refactor-${i}`,
    ...(chain ? { next: { block: chain } } : {}),
  };
refactor.initial.workspace = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'capi_start',
        id: 'refactor-start',
        x: 40,
        y: 40,
        inputs: { DO: { block: chain } },
      },
    ],
  },
};
challengeCatalog.push(refactor);
const partial = structuredClone(challengeCatalog[0]);
partial.id = 'capi-reto-16';
partial.title = 'Completá el regreso';
partial.mode = 'partial';
partial.prompt =
  'El programa enciende la luz. Completalo para que la apague después de un segundo.';
partial.initial.workspace = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'capi_start',
        id: 'partial-start',
        x: 40,
        y: 40,
        inputs: {
          DO: {
            block: {
              type: 'capi_led',
              id: 'partial-led',
              fields: { DEVICE_ID: ledId, BRIGHTNESS: 100 },
            },
          },
        },
      },
    ],
  },
};
partial.variants[0].goals = [
  goal('Encendida al principio', 500, 100),
  goal('Apagada al final', 1500, 0),
];
challengeCatalog.push(partial);
const creative = structuredClone(challengeCatalog[11]);
creative.id = 'capi-reto-17';
creative.title = 'Tu laboratorio de luces';
creative.mode = 'creative';
creative.prompt =
  'Inventá una señal luminosa y contá qué significa. No hay una única solución ni calificación automática.';
creative.expectations = [];
creative.variants[0].goals = [];
challengeCatalog.push(creative);
