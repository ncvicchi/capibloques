import {
  addDeviceToScene,
  cloneScene,
  createEmptyScene,
  createSceneFromTemplate,
  isLegacySceneId,
  isSceneDefinition,
  migrateSceneDefinition,
  pinLabel,
  sceneComponentCatalog,
  validateScene,
  wemosD1R32Pins,
  type LegacySceneId,
  type SceneDefinition,
  type SceneDevice,
  type SceneDeviceKind,
  // @ts-expect-error Node's type-stripping smoke runner needs the explicit suffix.
} from './scene-model.ts';

export type SceneId = LegacySceneId;

export type CompareOperator = 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE';

export type Condition =
  | {
      kind: 'counter';
      operator: CompareOperator;
      value: number;
    }
  | {
      kind: 'compare';
      operator: CompareOperator;
      left: number;
      right: number;
    }
  | { kind: 'buttonPressed'; deviceId: string }
  | {
      kind: 'sensor';
      deviceId: string;
      sensor: 'LIGHT' | 'POTENTIOMETER';
      operator: Exclude<CompareOperator, 'EQ' | 'NEQ'>;
      value: number;
    }
  | { kind: 'wifiConnected' }
  | { kind: 'boolean'; value: boolean };

export type ProgramNode =
  | { op: 'wait'; ms: number; blockId: string }
  | {
      op: 'traffic';
      deviceId: string;
      color: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
      blockId: string;
    }
  | { op: 'led'; deviceId: string; brightness: number; blockId: string }
  | { op: 'pin'; pin: number; value: boolean; blockId: string }
  | {
      op: 'robot';
      deviceId: string;
      action: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'STOP';
      speed: number;
      blockId: string;
    }
  | {
      op: 'motor';
      deviceId: string;
      direction: 'FORWARD' | 'BACKWARD' | 'STOP';
      power: number;
      blockId: string;
    }
  | { op: 'servo'; deviceId: string; angle: number; blockId: string }
  | {
      op: 'buzzer';
      deviceId: string;
      kind: 'ACTIVE' | 'PASSIVE';
      frequency: number;
      durationMs: number;
      blockId: string;
    }
  | { op: 'wifi'; timeoutMs: number; blockId: string }
  | { op: 'counterSet'; value: number; blockId: string }
  | { op: 'counterChange'; delta: number; blockId: string }
  | { op: 'serial'; text: string; blockId: string }
  | {
      op: 'tone';
      deviceId: string;
      frequency: number;
      durationMs: number;
      blockId: string;
    }
  | { op: 'repeat'; count: number; body: ProgramNode[]; blockId: string }
  | {
      op: 'if';
      condition: Condition;
      consequent: ProgramNode[];
      otherwise: ProgramNode[];
      blockId: string;
    };

export interface ProgramThread {
  id: string;
  startBlockId: string;
  nodes: ProgramNode[];
}

export interface CompiledProgram {
  version: 2;
  threads: ProgramThread[];
}

export interface ProjectTarget {
  family: 'esp32';
  framework: 'arduino';
  coreMajor: 3;
  coreVersion: '3.3.11';
  boardProfile: 'wemos-d1-r32';
  fqbn: 'esp32:esp32:d1_uno32';
}

export interface ProjectFile {
  application: 'CapiBloques';
  schemaVersion: 2;
  metadata: {
    title: string;
    locale: 'es-AR';
    updatedAt: string;
    migratedFrom?: 1;
  };
  target: ProjectTarget;
  scene: SceneDefinition;
  /** `scene` is retained as a template hint for transitional UI clients. */
  simulation: {
    scene: SceneId;
    speed: number;
  };
  workspace: Record<string, unknown>;
}

interface LegacyProjectFile {
  application: 'CapiBloques';
  schemaVersion: 1;
  metadata?: {
    title?: unknown;
    locale?: unknown;
    updatedAt?: unknown;
  };
  target?: {
    boardProfile?: unknown;
    pinAssignments?: Record<string, unknown>;
  };
  simulation?: { scene?: unknown; speed?: unknown };
  workspace?: unknown;
}

export interface ProjectDecodeResult {
  project: ProjectFile | null;
  migrated: boolean;
  warnings: string[];
  diagnostics: CapiDiagnostic[];
}

export interface ExampleDefinition {
  id: SceneId;
  title: string;
  mission: string;
  description: string;
  icon: string;
  level: 'Inicial' | 'Intermedio' | 'Avanzado';
  scene: SceneDefinition;
  workspace: Record<string, unknown>;
}

export type DiagnosticSeverity = 'error' | 'warning';

export interface CapiDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  deviceId?: string;
  blockId?: string;
  pin?: number;
}

export type WifiRuntimeState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type RuntimeDeviceState =
  | {
      kind: 'trafficLight';
      color: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
    }
  | { kind: 'led'; brightness: number }
  | {
      kind: 'robot';
      x: number;
      y: number;
      angle: number;
      left: number;
      right: number;
    }
  | { kind: 'motor'; power: number }
  | { kind: 'servo'; angle: number }
  | {
      kind: 'activeBuzzer';
      playing: boolean;
      frequency: number;
      stopAt: number;
    }
  | {
      kind: 'passiveBuzzer';
      playing: boolean;
      frequency: number;
      stopAt: number;
    }
  | { kind: 'button'; pressed: boolean }
  | { kind: 'lightSensor'; value: number }
  | { kind: 'potentiometer'; value: number }
  | { kind: 'wifiNode'; status: WifiRuntimeState };

export interface SimulatorState {
  now: number;
  status: 'idle' | 'running' | 'paused' | 'done' | 'stopped';
  devices: Record<string, RuntimeDeviceState>;
  wifi: WifiRuntimeState;
  wifiAvailable: boolean;
  counter: number;
  pins: Record<number, boolean>;
  console: string[];
  activeBlockIds: Record<string, string | undefined>;
  /** Compatibility projections for the original four fixed scenes. */
  traffic: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
  ledBrightness: number;
  servoAngle: number;
  buzzer: 'off' | 'active' | 'passive';
  robot: { x: number; y: number; angle: number; left: number; right: number };
  inputs: {
    button: boolean;
    light: number;
    potentiometer: number;
    wifiAvailable: boolean;
  };
  activeBlockId?: string;
}

const projectTarget: ProjectTarget = {
  family: 'esp32',
  framework: 'arduino',
  coreMajor: 3,
  coreVersion: '3.3.11',
  boardProfile: 'wemos-d1-r32',
  fqbn: 'esp32:esp32:d1_uno32',
};

const next = (
  block: Record<string, unknown>,
  following?: Record<string, unknown>,
) => (following ? { ...block, next: { block: following } } : block);

const chain = (...blocks: Record<string, unknown>[]) => {
  let result = blocks.at(-1) as Record<string, unknown>;
  for (let index = blocks.length - 2; index >= 0; index -= 1) {
    result = next(blocks[index], result);
  }
  return result;
};

const startWorkspace = (body: Record<string, unknown>) => ({
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
    ],
  },
});

const trafficWorkspace = startWorkspace({
  type: 'capi_forever',
  id: 'traffic-loop',
  inputs: {
    DO: {
      block: chain(
        {
          type: 'capi_traffic',
          id: 'traffic-red',
          fields: { DEVICE_ID: 'traffic-light-1', COLOR: 'RED' },
        },
        { type: 'capi_wait', id: 'traffic-wait-red', fields: { SECONDS: 3 } },
        {
          type: 'capi_traffic',
          id: 'traffic-green',
          fields: { DEVICE_ID: 'traffic-light-1', COLOR: 'GREEN' },
        },
        {
          type: 'capi_wait',
          id: 'traffic-wait-green',
          fields: { SECONDS: 3 },
        },
        {
          type: 'capi_traffic',
          id: 'traffic-yellow',
          fields: { DEVICE_ID: 'traffic-light-1', COLOR: 'YELLOW' },
        },
        {
          type: 'capi_wait',
          id: 'traffic-wait-yellow',
          fields: { SECONDS: 1 },
        },
      ),
    },
  },
});

const robotWorkspace = startWorkspace({
  type: 'capi_forever',
  id: 'robot-loop',
  inputs: {
    DO: {
      block: chain(
        {
          type: 'capi_robot',
          id: 'robot-forward',
          fields: {
            DEVICE_ID: 'robot-1',
            ACTION: 'FORWARD',
            SPEED: 70,
          },
        },
        {
          type: 'capi_wait',
          id: 'robot-wait-forward',
          fields: { SECONDS: 2 },
        },
        {
          type: 'capi_robot',
          id: 'robot-right',
          fields: { DEVICE_ID: 'robot-1', ACTION: 'RIGHT', SPEED: 65 },
        },
        {
          type: 'capi_wait',
          id: 'robot-wait-turn',
          fields: { SECONDS: 0.6 },
        },
      ),
    },
  },
});

const wifiWorkspace = startWorkspace(
  chain(
    { type: 'capi_wifi_connect', id: 'wifi-connect', fields: { TIMEOUT: 10 } },
    {
      type: 'capi_if',
      id: 'wifi-if',
      inputs: {
        CONDITION: {
          block: { type: 'capi_wifi_connected', id: 'wifi-condition' },
        },
        DO: {
          block: chain(
            {
              type: 'capi_led',
              id: 'wifi-red-off',
              fields: { DEVICE_ID: 'led-1', BRIGHTNESS: 0 },
            },
            {
              type: 'capi_led',
              id: 'wifi-green-on',
              fields: { DEVICE_ID: 'led-2', BRIGHTNESS: 100 },
            },
            {
              type: 'capi_serial',
              id: 'wifi-success',
              fields: { TEXT: 'Wi-Fi conectado' },
            },
          ),
        },
        ELSE: {
          block: chain(
            {
              type: 'capi_led',
              id: 'wifi-green-off',
              fields: { DEVICE_ID: 'led-2', BRIGHTNESS: 0 },
            },
            {
              type: 'capi_led',
              id: 'wifi-red-on',
              fields: { DEVICE_ID: 'led-1', BRIGHTNESS: 100 },
            },
            {
              type: 'capi_serial',
              id: 'wifi-failure',
              fields: { TEXT: 'No se pudo conectar' },
            },
          ),
        },
      },
    },
  ),
);

const counterWorkspace = startWorkspace(
  chain(
    { type: 'capi_counter_set', id: 'counter-zero', fields: { VALUE: 0 } },
    {
      type: 'capi_repeat',
      id: 'counter-repeat',
      fields: { TIMES: 5 },
      inputs: {
        DO: {
          block: chain(
            {
              type: 'capi_counter_change',
              id: 'counter-plus',
              fields: { DELTA: 1 },
            },
            {
              type: 'capi_tone',
              id: 'counter-tone',
              fields: {
                DEVICE_ID: 'passive-buzzer-1',
                FREQUENCY: 660,
                DURATION: 120,
              },
            },
            {
              type: 'capi_wait',
              id: 'counter-wait',
              fields: { SECONDS: 0.45 },
            },
          ),
        },
      },
    },
    {
      type: 'capi_if',
      id: 'counter-if',
      inputs: {
        CONDITION: {
          block: {
            type: 'capi_counter_compare',
            id: 'counter-condition',
            fields: { OPERATOR: 'GTE', VALUE: 5 },
          },
        },
        DO: {
          block: {
            type: 'capi_serial',
            id: 'counter-done',
            fields: { TEXT: '¡Llegamos a cinco!' },
          },
        },
      },
    },
  ),
);

export const examples: ExampleDefinition[] = [
  {
    id: 'traffic',
    title: 'Semáforo de la plaza',
    mission: 'Enciende rojo, verde y amarillo sin detener los demás programas.',
    description: 'Aprende secuencias, tiempos y bucles.',
    icon: '🚦',
    level: 'Inicial',
    scene: createSceneFromTemplate('traffic'),
    workspace: trafficWorkspace,
  },
  {
    id: 'counter',
    title: 'Contador de saltos',
    mission: 'Cuenta cinco saltos y celebra cuando alcances la meta.',
    description: 'Usa contador, repetición y comparación.',
    icon: '🐸',
    level: 'Inicial',
    scene: createSceneFromTemplate('counter'),
    workspace: counterWorkspace,
  },
  {
    id: 'robot',
    title: 'Robot explorador',
    mission: 'Haz avanzar al robot y girar antes de chocar con el borde.',
    description: 'Combina movimiento, velocidad y espera.',
    icon: '🤖',
    level: 'Intermedio',
    scene: createSceneFromTemplate('robot'),
    workspace: robotWorkspace,
  },
  {
    id: 'wifi',
    title: 'Señal Wi-Fi',
    mission: 'Muestra una luz verde si hay red y roja si falla la conexión.',
    description: 'Prueba estados, timeout y condicionales.',
    icon: '📶',
    level: 'Avanzado',
    scene: createSceneFromTemplate('wifi'),
    workspace: wifiWorkspace,
  },
];

/** Legacy export kept for callers that show the original kit table. */
export const defaultPinAssignments = {
  trafficRed: 26,
  trafficYellow: 25,
  trafficGreen: 27,
  robotLeftIn1: 17,
  robotLeftIn2: 16,
  robotRightIn1: 23,
  robotRightIn2: 19,
  ledPwm: 18,
  activeBuzzer: 13,
  passiveBuzzer: 13,
  servo: 14,
  button: 4,
  lightSensor: 35,
  potentiometer: 34,
} as const;

export const componentCatalog = sceneComponentCatalog.map((component) => ({
  id: component.kind,
  icon: component.icon,
  name: component.name,
  control: component.childFriendlyControl,
  pins: component.pinRequirements.length
    ? component.pinRequirements.map((pin) => pin.label).join(', ')
    : 'Integrado en la placa',
  status: 'ready' as const,
}));

function finiteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const COUNTER_MIN = -2_147_483_648;
export const COUNTER_MAX = 2_147_483_647;

export function normalizeCounterValue(value: unknown, fallback = 0) {
  const rounded = Math.round(finiteNumber(value, fallback));
  return Math.max(COUNTER_MIN, Math.min(COUNTER_MAX, rounded));
}

export function addCounterValues(current: number, delta: number) {
  return normalizeCounterValue(
    normalizeCounterValue(current) + normalizeCounterValue(delta),
  );
}

function unsafeTextCharacter(character: string, includeBidi = false) {
  const code = character.charCodeAt(0);
  return (
    code <= 31 ||
    code === 127 ||
    code === 0x2028 ||
    code === 0x2029 ||
    (includeBidi &&
      ((code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)))
  );
}

function replaceUnsafeText(value: string, includeBidi = false) {
  return Array.from(value, (character) =>
    unsafeTextCharacter(character, includeBidi) ? ' ' : character,
  ).join('');
}

function projectTitle(value: unknown) {
  if (typeof value !== 'string') return 'Mi aventura';
  const cleaned = replaceUnsafeText(value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'Mi aventura';
}

function projectTimestamp(value: unknown) {
  if (typeof value !== 'string' || value.length > 64) {
    return new Date().toISOString();
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : new Date().toISOString();
}

export const PROJECT_IMPORT_LIMITS = {
  workspaceBytes: 1_500_000,
  workspaceDepth: 128,
  workspaceNodes: 20_000,
  workspaceBlocks: 2_000,
  stringLength: 16_384,
  objectProperties: 512,
} as const;

const supportedBlocklyBlockTypes = new Set([
  'capi_start',
  'capi_forever',
  'capi_repeat',
  'capi_wait',
  'capi_if',
  'capi_compare',
  'capi_counter_compare',
  'capi_counter_set',
  'capi_counter_change',
  'capi_traffic',
  'capi_led',
  'capi_pin_write',
  'capi_robot',
  'capi_motor',
  'capi_servo',
  'capi_buzzer',
  'capi_tone',
  'capi_button_pressed',
  'capi_sensor_compare',
  'capi_wifi_connect',
  'capi_wifi_connected',
  'capi_serial',
]);

interface WorkspaceDecodeResult {
  workspace: Record<string, unknown> | null;
  diagnostics: CapiDiagnostic[];
}

type JsonContainer = Record<string, unknown> | unknown[];

function workspaceError(
  code: string,
  message: string,
  blockId?: string,
): WorkspaceDecodeResult {
  return {
    workspace: null,
    diagnostics: [{ severity: 'error', code, message, blockId }],
  };
}

function validBlocklyId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 128 &&
    !Array.from(value).some((character) => unsafeTextCharacter(character))
  );
}

/**
 * Clones only JSON data with explicit complexity bounds. This intentionally
 * avoids JSON.parse(JSON.stringify(...)): deeply nested input must be rejected,
 * never converted silently into an empty program.
 */
function decodeWorkspace(value: unknown): WorkspaceDecodeResult {
  if (!isObjectRecord(value)) {
    return workspaceError(
      'workspace-root-invalid',
      'El área de bloques debe ser un objeto de Blockly.',
    );
  }

  const root: Record<string, unknown> = {};
  const seen = new WeakSet<object>([value]);
  const stack: Array<{
    source: JsonContainer;
    target: JsonContainer;
    depth: number;
  }> = [{ source: value, target: root, depth: 0 }];
  let nodeCount = 1;
  let estimatedBytes = 2;
  const textEncoder = new TextEncoder();

  while (stack.length) {
    const current = stack.pop();
    if (!current) break;
    if (current.depth > PROJECT_IMPORT_LIMITS.workspaceDepth) {
      return workspaceError(
        'workspace-too-deep',
        `El proyecto supera ${PROJECT_IMPORT_LIMITS.workspaceDepth} niveles de anidación.`,
      );
    }
    const entries = Object.entries(current.source);
    if (
      Array.isArray(current.source) &&
      (entries.length !== current.source.length ||
        entries.some(([key], index) => key !== String(index)))
    ) {
      return workspaceError(
        'workspace-array-invalid',
        'El proyecto contiene una lista incompleta o con propiedades no permitidas.',
      );
    }
    if (
      !Array.isArray(current.source) &&
      entries.length > PROJECT_IMPORT_LIMITS.objectProperties
    ) {
      return workspaceError(
        'workspace-object-too-large',
        `Una sección del proyecto contiene más de ${PROJECT_IMPORT_LIMITS.objectProperties} propiedades.`,
      );
    }

    for (const [key, item] of entries) {
      estimatedBytes += textEncoder.encode(key).byteLength + 4;
      if (typeof item === 'string') {
        estimatedBytes += textEncoder.encode(item).byteLength + 2;
      } else {
        estimatedBytes += 8;
      }
      if (estimatedBytes > PROJECT_IMPORT_LIMITS.workspaceBytes) {
        return workspaceError(
          'workspace-too-large',
          `El área de bloques supera ${Math.floor(PROJECT_IMPORT_LIMITS.workspaceBytes / 1000)} KB.`,
        );
      }
      if (
        key === '__proto__' ||
        key === 'prototype' ||
        key === 'constructor' ||
        key.length > 128 ||
        Array.from(key).some((character) => unsafeTextCharacter(character))
      ) {
        return workspaceError(
          'workspace-property-invalid',
          'El proyecto contiene una propiedad interna no permitida.',
        );
      }

      const assign = (nextValue: unknown) => {
        if (Array.isArray(current.target)) {
          current.target[Number(key)] = nextValue;
        } else {
          current.target[key] = nextValue;
        }
      };

      if (item === null || typeof item === 'boolean') {
        assign(item);
        continue;
      }
      if (typeof item === 'number') {
        if (!Number.isFinite(item)) {
          return workspaceError(
            'workspace-number-invalid',
            'El proyecto contiene un número no válido.',
          );
        }
        assign(item);
        continue;
      }
      if (typeof item === 'string') {
        if (item.length > PROJECT_IMPORT_LIMITS.stringLength) {
          return workspaceError(
            'workspace-string-too-long',
            `Un texto del proyecto supera ${PROJECT_IMPORT_LIMITS.stringLength} caracteres.`,
          );
        }
        assign(item);
        continue;
      }
      if (!item || typeof item !== 'object') {
        return workspaceError(
          'workspace-value-invalid',
          'El proyecto contiene un valor que JSON no puede guardar.',
        );
      }
      const prototype = Object.getPrototypeOf(item);
      if (
        !Array.isArray(item) &&
        prototype !== Object.prototype &&
        prototype !== null
      ) {
        return workspaceError(
          'workspace-object-invalid',
          'El proyecto contiene un objeto que no pertenece al formato JSON.',
        );
      }
      if (seen.has(item)) {
        return workspaceError(
          'workspace-cycle',
          'El proyecto contiene una referencia circular o compartida y no puede importarse.',
        );
      }
      seen.add(item);
      nodeCount += 1;
      if (nodeCount > PROJECT_IMPORT_LIMITS.workspaceNodes) {
        return workspaceError(
          'workspace-too-complex',
          `El proyecto supera el límite de ${PROJECT_IMPORT_LIMITS.workspaceNodes} secciones internas.`,
        );
      }
      const child: JsonContainer = Array.isArray(item) ? [] : {};
      assign(child);
      stack.push({
        source: item as JsonContainer,
        target: child,
        depth: current.depth + 1,
      });
    }
  }

  const serialized = JSON.stringify(root);
  if (
    textEncoder.encode(serialized).byteLength >
    PROJECT_IMPORT_LIMITS.workspaceBytes
  ) {
    return workspaceError(
      'workspace-too-large',
      `El área de bloques supera ${Math.floor(PROJECT_IMPORT_LIMITS.workspaceBytes / 1000)} KB.`,
    );
  }

  const blocksSection = root.blocks;
  if (blocksSection === undefined) return { workspace: root, diagnostics: [] };
  if (!isObjectRecord(blocksSection)) {
    return workspaceError(
      'workspace-blocks-invalid',
      'La lista principal de bloques está dañada.',
    );
  }
  if (blocksSection.languageVersion !== 0) {
    return workspaceError(
      'workspace-version-unsupported',
      'El proyecto usa una versión de bloques que CapiBloques todavía no admite.',
    );
  }
  if (!Array.isArray(blocksSection.blocks)) {
    return workspaceError(
      'workspace-block-list-invalid',
      'La lista principal de bloques no es válida.',
    );
  }

  const blockStack: unknown[] = [...blocksSection.blocks];
  const blockIds = new Set<string>();
  let blockCount = 0;
  while (blockStack.length) {
    const block = blockStack.pop();
    if (!isObjectRecord(block)) {
      return workspaceError(
        'workspace-block-invalid',
        'Hay un bloque vacío o dañado en el proyecto.',
      );
    }
    blockCount += 1;
    if (blockCount > PROJECT_IMPORT_LIMITS.workspaceBlocks) {
      return workspaceError(
        'workspace-too-many-blocks',
        `El proyecto supera el máximo de ${PROJECT_IMPORT_LIMITS.workspaceBlocks} bloques.`,
      );
    }
    if (
      typeof block.type !== 'string' ||
      !supportedBlocklyBlockTypes.has(block.type)
    ) {
      const typeDescription =
        typeof block.type === 'string' ||
        typeof block.type === 'number' ||
        typeof block.type === 'boolean'
          ? String(block.type)
          : 'sin tipo válido';
      return workspaceError(
        'workspace-block-type-unsupported',
        `El proyecto contiene un bloque desconocido (${typeDescription}).`,
      );
    }
    if (!validBlocklyId(block.id)) {
      return workspaceError(
        'workspace-block-id-invalid',
        `El bloque ${block.type} no tiene una identidad segura.`,
      );
    }
    if (blockIds.has(block.id)) {
      return workspaceError(
        'workspace-block-id-duplicate',
        `El identificador de bloque ${block.id} está repetido.`,
        block.id,
      );
    }
    blockIds.add(block.id);

    if (block.fields !== undefined && !isObjectRecord(block.fields)) {
      return workspaceError(
        'workspace-fields-invalid',
        `Los valores del bloque ${block.id} están dañados.`,
        block.id,
      );
    }
    for (const coordinate of ['x', 'y'] as const) {
      if (
        block[coordinate] !== undefined &&
        (typeof block[coordinate] !== 'number' ||
          !Number.isFinite(block[coordinate]))
      ) {
        return workspaceError(
          'workspace-coordinate-invalid',
          `La posición del bloque ${block.id} no es válida.`,
          block.id,
        );
      }
    }

    if (block.inputs !== undefined) {
      if (!isObjectRecord(block.inputs)) {
        return workspaceError(
          'workspace-inputs-invalid',
          `Las conexiones del bloque ${block.id} están dañadas.`,
          block.id,
        );
      }
      for (const connection of Object.values(block.inputs)) {
        if (!isObjectRecord(connection)) {
          return workspaceError(
            'workspace-input-invalid',
            `Una conexión del bloque ${block.id} está dañada.`,
            block.id,
          );
        }
        for (const key of ['block', 'shadow'] as const) {
          if (connection[key] !== undefined) {
            if (!isObjectRecord(connection[key])) {
              return workspaceError(
                'workspace-connected-block-invalid',
                `Una conexión del bloque ${block.id} apunta a un bloque vacío.`,
                block.id,
              );
            }
            blockStack.push(connection[key]);
          }
        }
      }
    }
    if (block.next !== undefined) {
      if (!isObjectRecord(block.next) || !isObjectRecord(block.next.block)) {
        return workspaceError(
          'workspace-next-invalid',
          `La secuencia que sigue al bloque ${block.id} está dañada.`,
          block.id,
        );
      }
      blockStack.push(block.next.block);
    }
  }

  return { workspace: root, diagnostics: [] };
}

function cloneWorkspace(value: unknown): Record<string, unknown> {
  const decoded = decodeWorkspace(value);
  if (!decoded.workspace) {
    throw new Error(
      decoded.diagnostics[0]?.message ?? 'El área de bloques no es válida.',
    );
  }
  return decoded.workspace;
}

function templateHint(scene: SceneDefinition): SceneId {
  return scene.sourceTemplate ?? 'traffic';
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function makeProject(
  title: string,
  scene: SceneId | SceneDefinition,
  workspace: Record<string, unknown>,
  speed = 1,
): ProjectFile {
  const sceneDefinition = isLegacySceneId(scene)
    ? createSceneFromTemplate(scene)
    : cloneScene(scene);
  const sceneErrors = validateScene(sceneDefinition).issues.filter(
    (issue) => issue.severity === 'error',
  );
  if (sceneErrors.length) {
    throw new Error(
      `La escena no se puede guardar:\n${sceneErrors.map(({ message }) => `- ${message}`).join('\n')}`,
    );
  }
  return {
    application: 'CapiBloques',
    schemaVersion: 2,
    metadata: {
      title: projectTitle(title),
      locale: 'es-AR',
      updatedAt: new Date().toISOString(),
    },
    target: { ...projectTarget },
    scene: sceneDefinition,
    simulation: {
      scene: templateHint(sceneDefinition),
      speed: Math.max(0.25, Math.min(4, finiteNumber(speed, 1))),
    },
    workspace: cloneWorkspace(workspace),
  };
}

function isProjectV2(value: unknown): value is ProjectFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProjectFile>;
  return (
    candidate.application === 'CapiBloques' &&
    candidate.schemaVersion === 2 &&
    typeof candidate.metadata?.title === 'string' &&
    candidate.metadata.locale === 'es-AR' &&
    typeof candidate.metadata.updatedAt === 'string' &&
    candidate.target?.family === 'esp32' &&
    candidate.target.framework === 'arduino' &&
    candidate.target.coreMajor === 3 &&
    candidate.target.coreVersion === '3.3.11' &&
    candidate.target?.boardProfile === 'wemos-d1-r32' &&
    candidate.target.fqbn === 'esp32:esp32:d1_uno32' &&
    isSceneDefinition(candidate.scene) &&
    isObjectRecord(candidate.workspace) &&
    !!candidate.simulation &&
    Number.isFinite(candidate.simulation.speed)
  );
}

function isLegacyProject(value: unknown): value is LegacyProjectFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as LegacyProjectFile;
  return (
    candidate.application === 'CapiBloques' &&
    candidate.schemaVersion === 1 &&
    candidate.target?.boardProfile === 'wemos-d1-r32' &&
    isObjectRecord(candidate.workspace)
  );
}

export function isProjectFile(value: unknown): value is ProjectFile {
  const decoded = decodeProject(value);
  return decoded.project !== null && !decoded.migrated;
}

const blockKind = (block: Record<string, unknown>): SceneDeviceKind | null => {
  const type = block.type;
  const fields =
    block.fields && typeof block.fields === 'object'
      ? (block.fields as Record<string, unknown>)
      : {};
  switch (type) {
    case 'capi_traffic':
      return 'trafficLight';
    case 'capi_led':
      return 'led';
    case 'capi_robot':
      return 'robot';
    case 'capi_motor':
      return 'motor';
    case 'capi_servo':
      return 'servo';
    case 'capi_buzzer':
      return fields.KIND === 'PASSIVE' ? 'passiveBuzzer' : 'activeBuzzer';
    case 'capi_tone':
      return 'passiveBuzzer';
    case 'capi_button_pressed':
      return 'button';
    case 'capi_sensor_compare':
      return fields.SENSOR === 'POTENTIOMETER'
        ? 'potentiometer'
        : 'lightSensor';
    default:
      return null;
  }
};

function walkWorkspace(
  value: unknown,
  visitor: (block: Record<string, unknown>) => void,
) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkWorkspace(item, visitor));
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.type === 'string' && record.type.startsWith('capi_')) {
    visitor(record);
  }
  Object.values(record).forEach((item) => walkWorkspace(item, visitor));
}

function legacyPins(
  kind: SceneDeviceKind,
  assignments: Record<string, unknown>,
): Record<string, number | null> | undefined {
  const pin = (name: string, fallback: number) =>
    Math.trunc(finiteNumber(assignments[name], fallback));
  switch (kind) {
    case 'trafficLight':
      return {
        red: pin('trafficRed', 26),
        yellow: pin('trafficYellow', 25),
        green: pin('trafficGreen', 27),
      };
    case 'robot':
      return {
        leftIn1: pin('robotLeftIn1', 17),
        leftIn2: pin('robotLeftIn2', 16),
        rightIn1: pin('robotRightIn1', 23),
        rightIn2: pin('robotRightIn2', 19),
      };
    case 'led':
      return { signal: pin('ledPwm', 18) };
    case 'servo':
      return { signal: pin('servo', 14) };
    case 'activeBuzzer':
      return { signal: pin('activeBuzzer', 13) };
    case 'passiveBuzzer':
      return { signal: pin('passiveBuzzer', 13) };
    case 'button':
      return { signal: pin('button', 4) };
    case 'lightSensor':
      return { signal: pin('lightSensor', 35) };
    case 'potentiometer':
      return { signal: pin('potentiometer', 34) };
    default:
      return undefined;
  }
}

function enrichLegacySceneAndWorkspace(
  sourceScene: SceneDefinition,
  sourceWorkspace: unknown,
  assignments: Record<string, unknown>,
) {
  let scene = cloneScene(sourceScene);
  const workspace = cloneWorkspace(sourceWorkspace);
  const requiredKinds: SceneDeviceKind[] = [];
  walkWorkspace(workspace, (block) => {
    const kind = blockKind(block);
    if (kind && !requiredKinds.includes(kind)) requiredKinds.push(kind);
  });

  const warnings: string[] = [];
  for (const kind of requiredKinds) {
    if (scene.devices.some((device) => device.kind === kind)) continue;
    const added = addDeviceToScene(scene, kind, {
      pins: legacyPins(kind, assignments) as never,
    });
    scene = added.scene;
    warnings.push(...added.warnings);
  }

  const firstDeviceByKind = new Map<SceneDeviceKind, string>();
  for (const device of scene.devices) {
    if (!firstDeviceByKind.has(device.kind)) {
      firstDeviceByKind.set(device.kind, device.id);
    }
  }
  walkWorkspace(workspace, (block) => {
    const kind = blockKind(block);
    if (!kind) return;
    const deviceId = firstDeviceByKind.get(kind);
    if (!deviceId) return;
    const fields =
      block.fields && typeof block.fields === 'object'
        ? (block.fields as Record<string, unknown>)
        : {};
    block.fields = { ...fields, DEVICE_ID: deviceId };
  });
  return { scene, workspace, warnings };
}

function decodeProjectUnsafe(value: unknown): ProjectDecodeResult {
  if (isProjectV2(value)) {
    const decodedWorkspace = decodeWorkspace(value.workspace);
    if (!decodedWorkspace.workspace) {
      return {
        project: null,
        migrated: false,
        warnings: [],
        diagnostics: decodedWorkspace.diagnostics,
      };
    }
    const scene = cloneScene(value.scene);
    const validation = validateScene(scene);
    const sceneDiagnostics: CapiDiagnostic[] = validation.issues.map(
      (issue) => ({
        severity: issue.severity,
        code: `scene-${issue.code}`,
        message: issue.message,
        deviceId: issue.deviceId ?? issue.itemId,
        pin: issue.pin,
      }),
    );
    if (
      sceneDiagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ) {
      return {
        project: null,
        migrated: false,
        warnings: validation.issues.map((issue) => issue.message),
        diagnostics: sceneDiagnostics,
      };
    }
    return {
      project: {
        application: 'CapiBloques',
        schemaVersion: 2,
        metadata: {
          title: projectTitle(value.metadata.title),
          locale: 'es-AR',
          updatedAt: projectTimestamp(value.metadata.updatedAt),
          ...(value.metadata.migratedFrom === 1 ? { migratedFrom: 1 } : {}),
        },
        target: { ...projectTarget },
        scene,
        simulation: {
          scene: isLegacySceneId(value.simulation.scene)
            ? value.simulation.scene
            : templateHint(scene),
          speed: Math.max(
            0.25,
            Math.min(4, finiteNumber(value.simulation.speed, 1)),
          ),
        },
        workspace: decodedWorkspace.workspace,
      },
      migrated: false,
      warnings: validation.issues.map((issue) => issue.message),
      diagnostics: sceneDiagnostics,
    };
  }

  if (
    isObjectRecord(value) &&
    value.application === 'CapiBloques' &&
    value.schemaVersion === 2
  ) {
    if (!isObjectRecord(value.workspace)) {
      return {
        project: null,
        migrated: false,
        warnings: [],
        diagnostics: [
          {
            severity: 'error',
            code: 'workspace-root-invalid',
            message: 'El área de bloques debe ser un objeto de Blockly.',
          },
        ],
      };
    }
    if (!isSceneDefinition(value.scene)) {
      return {
        project: null,
        migrated: false,
        warnings: [],
        diagnostics: [
          {
            severity: 'error',
            code: 'scene-structure-invalid',
            message:
              'La escena contiene componentes, valores o propiedades que no pertenecen al formato CapiBloques.',
          },
        ],
      };
    }
    return {
      project: null,
      migrated: false,
      warnings: [],
      diagnostics: [
        {
          severity: 'error',
          code: 'project-settings-invalid',
          message:
            'Los metadatos o el perfil de placa del proyecto están dañados o no son compatibles.',
        },
      ],
    };
  }

  if (!isLegacyProject(value)) {
    return {
      project: null,
      migrated: false,
      warnings: [],
      diagnostics: [
        {
          severity: 'error',
          code: 'invalid-project',
          message: 'No es un proyecto CapiBloques compatible.',
        },
      ],
    };
  }

  const decodedWorkspace = decodeWorkspace(value.workspace);
  if (!decodedWorkspace.workspace) {
    return {
      project: null,
      migrated: false,
      warnings: [],
      diagnostics: decodedWorkspace.diagnostics,
    };
  }

  const legacyScene = isLegacySceneId(value.simulation?.scene)
    ? value.simulation.scene
    : 'traffic';
  const migratedScene = migrateSceneDefinition(value, legacyScene);
  const enriched = enrichLegacySceneAndWorkspace(
    migratedScene.scene,
    decodedWorkspace.workspace,
    value.target?.pinAssignments ?? {},
  );
  const project = makeProject(
    projectTitle(value.metadata?.title),
    enriched.scene,
    enriched.workspace,
    finiteNumber(value.simulation?.speed, 1),
  );
  project.metadata.updatedAt =
    typeof value.metadata?.updatedAt === 'string'
      ? value.metadata.updatedAt
      : new Date().toISOString();
  project.metadata.migratedFrom = 1;
  project.simulation.scene = legacyScene;
  const validation = validateScene(project.scene);
  const sceneDiagnostics: CapiDiagnostic[] = validation.issues.map((issue) => ({
    severity: issue.severity,
    code: `scene-${issue.code}`,
    message: issue.message,
    deviceId: issue.deviceId ?? issue.itemId,
    pin: issue.pin,
  }));
  if (sceneDiagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return {
      project: null,
      migrated: true,
      warnings: validation.issues.map((issue) => issue.message),
      diagnostics: sceneDiagnostics,
    };
  }
  const warnings = [
    ...migratedScene.warnings,
    ...enriched.warnings,
    ...validation.issues.map((issue) => issue.message),
  ];
  return {
    project,
    migrated: true,
    warnings: [...new Set(warnings)],
    diagnostics: sceneDiagnostics,
  };
}

export function decodeProject(value: unknown): ProjectDecodeResult {
  try {
    return decodeProjectUnsafe(value);
  } catch {
    return {
      project: null,
      migrated: false,
      warnings: [],
      diagnostics: [
        {
          severity: 'error',
          code: 'invalid-project-structure',
          message:
            'El archivo dice ser de CapiBloques, pero su estructura interna está dañada.',
        },
      ],
    };
  }
}

const compatibleKindsForNode = (
  node: Record<string, unknown>,
): SceneDeviceKind[] => {
  switch (node.op) {
    case 'traffic':
      return ['trafficLight'];
    case 'led':
      return ['led'];
    case 'robot':
      return ['robot'];
    case 'motor':
      return ['motor'];
    case 'servo':
      return ['servo'];
    case 'buzzer':
      return node.kind === 'PASSIVE' ? ['passiveBuzzer'] : ['activeBuzzer'];
    case 'tone':
      return ['passiveBuzzer'];
    default:
      return [];
  }
};

const compatibleKindsForCondition = (
  condition: Record<string, unknown>,
): SceneDeviceKind[] => {
  if (condition.kind === 'buttonPressed') return ['button'];
  if (condition.kind === 'sensor') {
    return condition.sensor === 'POTENTIOMETER'
      ? ['potentiometer']
      : ['lightSensor'];
  }
  return [];
};

function firstCompatibleDevice(
  scene: SceneDefinition,
  kinds: readonly SceneDeviceKind[],
) {
  return scene.devices.find((device) => kinds.includes(device.kind));
}

function normalizeCondition(raw: unknown, scene: SceneDefinition): Condition {
  const condition =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : ({ kind: 'boolean', value: false } as Record<string, unknown>);
  const operator = (
    typeof condition.operator === 'string' &&
    ['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE'].includes(condition.operator)
      ? condition.operator
      : 'EQ'
  ) as CompareOperator;
  switch (condition.kind) {
    case 'counter':
      return {
        kind: 'counter',
        operator,
        value: normalizeCounterValue(condition.value),
      };
    case 'compare':
      return {
        kind: 'compare',
        operator,
        left: finiteNumber(condition.left, 0),
        right: finiteNumber(condition.right, 0),
      };
    case 'buttonPressed': {
      const target = firstCompatibleDevice(
        scene,
        compatibleKindsForCondition(condition),
      );
      return {
        kind: 'buttonPressed',
        deviceId:
          typeof condition.deviceId === 'string'
            ? condition.deviceId
            : (target?.id ?? 'missing-button'),
      };
    }
    case 'sensor': {
      const sensor =
        condition.sensor === 'POTENTIOMETER' ? 'POTENTIOMETER' : 'LIGHT';
      const target = firstCompatibleDevice(
        scene,
        compatibleKindsForCondition({ ...condition, sensor }),
      );
      const sensorOperator = ['LT', 'LTE', 'GT', 'GTE'].includes(operator)
        ? (operator as 'LT' | 'LTE' | 'GT' | 'GTE')
        : 'GT';
      return {
        kind: 'sensor',
        sensor,
        deviceId:
          typeof condition.deviceId === 'string'
            ? condition.deviceId
            : (target?.id ?? `missing-${sensor.toLowerCase()}`),
        operator: sensorOperator,
        value: finiteNumber(condition.value, 2000),
      };
    }
    case 'wifiConnected':
      return { kind: 'wifiConnected' };
    case 'boolean':
      return { kind: 'boolean', value: Boolean(condition.value) };
    default:
      return { kind: 'boolean', value: false };
  }
}

function normalizeNodes(
  rawNodes: unknown,
  scene: SceneDefinition,
): ProgramNode[] {
  if (!Array.isArray(rawNodes)) return [];
  const result: ProgramNode[] = [];
  for (const item of rawNodes) {
    if (!item || typeof item !== 'object') continue;
    const node = item as Record<string, unknown>;
    const blockId =
      typeof node.blockId === 'string'
        ? node.blockId
        : `legacy-${result.length}`;
    const target = firstCompatibleDevice(scene, compatibleKindsForNode(node));
    const deviceId =
      typeof node.deviceId === 'string'
        ? node.deviceId
        : (target?.id ?? `missing-${String(node.op)}`);
    switch (node.op) {
      case 'wait':
        result.push({ op: 'wait', ms: finiteNumber(node.ms, 0), blockId });
        break;
      case 'traffic':
        result.push({
          op: 'traffic',
          deviceId,
          color: ['RED', 'YELLOW', 'GREEN', 'OFF'].includes(String(node.color))
            ? (node.color as 'RED' | 'YELLOW' | 'GREEN' | 'OFF')
            : 'OFF',
          blockId,
        });
        break;
      case 'led':
        result.push({
          op: 'led',
          deviceId,
          brightness: finiteNumber(node.brightness, 0),
          blockId,
        });
        break;
      case 'pin':
        result.push({
          op: 'pin',
          pin: Math.trunc(finiteNumber(node.pin, -1)),
          value: Boolean(node.value),
          blockId,
        });
        break;
      case 'robot':
        result.push({
          op: 'robot',
          deviceId,
          action: ['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT', 'STOP'].includes(
            String(node.action),
          )
            ? (node.action as
                | 'FORWARD'
                | 'BACKWARD'
                | 'LEFT'
                | 'RIGHT'
                | 'STOP')
            : 'STOP',
          speed: finiteNumber(node.speed, 0),
          blockId,
        });
        break;
      case 'motor':
        result.push({
          op: 'motor',
          deviceId,
          direction: ['FORWARD', 'BACKWARD', 'STOP'].includes(
            String(node.direction),
          )
            ? (node.direction as 'FORWARD' | 'BACKWARD' | 'STOP')
            : 'FORWARD',
          power: finiteNumber(node.power, 0),
          blockId,
        });
        break;
      case 'servo':
        result.push({
          op: 'servo',
          deviceId,
          angle: finiteNumber(node.angle, 90),
          blockId,
        });
        break;
      case 'buzzer':
        result.push({
          op: 'buzzer',
          deviceId,
          kind: node.kind === 'PASSIVE' ? 'PASSIVE' : 'ACTIVE',
          frequency: finiteNumber(node.frequency, 660),
          durationMs: finiteNumber(node.durationMs, 250),
          blockId,
        });
        break;
      case 'tone':
        result.push({
          op: 'tone',
          deviceId,
          frequency: finiteNumber(node.frequency, 660),
          durationMs: finiteNumber(node.durationMs, 180),
          blockId,
        });
        break;
      case 'wifi':
        result.push({
          op: 'wifi',
          timeoutMs: finiteNumber(node.timeoutMs, 10_000),
          blockId,
        });
        break;
      case 'counterSet':
        result.push({
          op: 'counterSet',
          value: normalizeCounterValue(node.value),
          blockId,
        });
        break;
      case 'counterChange':
        result.push({
          op: 'counterChange',
          delta: normalizeCounterValue(node.delta, 1),
          blockId,
        });
        break;
      case 'serial':
        result.push({
          op: 'serial',
          text: typeof node.text === 'string' ? node.text : '',
          blockId,
        });
        break;
      case 'repeat':
        result.push({
          op: 'repeat',
          count: finiteNumber(node.count, 0),
          body: normalizeNodes(node.body, scene),
          blockId,
        });
        break;
      case 'if':
        result.push({
          op: 'if',
          condition: normalizeCondition(node.condition, scene),
          consequent: normalizeNodes(node.consequent, scene),
          otherwise: normalizeNodes(node.otherwise, scene),
          blockId,
        });
        break;
    }
  }
  return result;
}

function collectRequiredKindsFromNodes(
  rawNodes: unknown,
  result: SceneDeviceKind[],
) {
  if (!Array.isArray(rawNodes)) return;
  for (const raw of rawNodes) {
    if (!raw || typeof raw !== 'object') continue;
    const node = raw as Record<string, unknown>;
    for (const kind of compatibleKindsForNode(node)) {
      if (!result.includes(kind)) result.push(kind);
    }
    if (node.op === 'if') {
      const condition =
        node.condition && typeof node.condition === 'object'
          ? (node.condition as Record<string, unknown>)
          : {};
      for (const kind of compatibleKindsForCondition(condition)) {
        if (!result.includes(kind)) result.push(kind);
      }
      collectRequiredKindsFromNodes(node.consequent, result);
      collectRequiredKindsFromNodes(node.otherwise, result);
    }
    if (node.op === 'repeat') collectRequiredKindsFromNodes(node.body, result);
  }
}

export function inferSceneForProgram(input: unknown): SceneDefinition {
  const required: SceneDeviceKind[] = [];
  if (Array.isArray(input)) {
    collectRequiredKindsFromNodes(input, required);
  } else if (input && typeof input === 'object') {
    const threads = (input as { threads?: unknown }).threads;
    if (Array.isArray(threads)) {
      for (const thread of threads) {
        collectRequiredKindsFromNodes(
          thread && typeof thread === 'object'
            ? (thread as { nodes?: unknown }).nodes
            : [],
          required,
        );
      }
    }
  }
  let scene = createEmptyScene('Escena inferida');
  for (const kind of required) scene = addDeviceToScene(scene, kind).scene;
  return scene;
}

export function normalizeCompiledProgram(
  input: unknown,
  sourceScene?: SceneDefinition,
): CompiledProgram {
  const scene = sourceScene ?? inferSceneForProgram(input);
  if (Array.isArray(input)) {
    return {
      version: 2,
      threads: [
        {
          id: 'main',
          startBlockId: 'start-main',
          nodes: normalizeNodes(input, scene),
        },
      ],
    };
  }
  if (!input || typeof input !== 'object') return { version: 2, threads: [] };
  const candidate = input as { threads?: unknown };
  if (!Array.isArray(candidate.threads)) return { version: 2, threads: [] };
  const usedIds = new Set<string>();
  return {
    version: 2,
    threads: candidate.threads.map((raw, index) => {
      const thread =
        raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const proposedId =
        typeof thread.id === 'string' && thread.id.trim()
          ? thread.id
          : `thread-${index + 1}`;
      let id = proposedId;
      let suffix = 2;
      while (usedIds.has(id)) id = `${proposedId}-${suffix++}`;
      usedIds.add(id);
      const startBlockId =
        typeof thread.startBlockId === 'string'
          ? thread.startBlockId
          : `start-${index + 1}`;
      return {
        id,
        startBlockId,
        nodes: normalizeNodes(thread.nodes, scene),
      };
    }),
  };
}

function visitProgram(
  program: CompiledProgram,
  visitor: (node: ProgramNode) => void,
) {
  const visit = (nodes: ProgramNode[]) => {
    for (const node of nodes) {
      visitor(node);
      if (node.op === 'repeat') visit(node.body);
      if (node.op === 'if') {
        visit(node.consequent);
        visit(node.otherwise);
      }
    }
  };
  program.threads.forEach((thread) => visit(thread.nodes));
}

export function collectRawOutputPins(
  input: CompiledProgram | ProgramNode[],
  scene?: SceneDefinition,
) {
  const program = normalizeCompiledProgram(input, scene);
  const pins = new Set<number>();
  visitProgram(program, (node) => {
    if (node.op === 'pin') pins.add(node.pin);
  });
  return [...pins].sort((left, right) => left - right);
}

function expectedKinds(node: ProgramNode): SceneDeviceKind[] {
  return compatibleKindsForNode(node as unknown as Record<string, unknown>);
}

function validateConditionTarget(
  condition: Condition,
  blockId: string,
  deviceMap: Map<string, SceneDevice>,
  diagnostics: CapiDiagnostic[],
) {
  if (condition.kind !== 'buttonPressed' && condition.kind !== 'sensor') return;
  const device = deviceMap.get(condition.deviceId);
  const expected = compatibleKindsForCondition(
    condition as unknown as Record<string, unknown>,
  );
  if (!device) {
    diagnostics.push({
      severity: 'error',
      code: 'target-missing',
      message: `El bloque apunta a un componente que ya no existe (${condition.deviceId}).`,
      deviceId: condition.deviceId,
      blockId,
    });
  } else if (!expected.includes(device.kind)) {
    diagnostics.push({
      severity: 'error',
      code: 'target-kind-mismatch',
      message: `${device.name} no es compatible con esta condición.`,
      deviceId: device.id,
      blockId,
    });
  }
}

export function validateProgramForScene(
  input: CompiledProgram | ProgramNode[],
  scene: SceneDefinition,
): CapiDiagnostic[] {
  const program = normalizeCompiledProgram(input, scene);
  const diagnostics: CapiDiagnostic[] = [];
  const deviceMap = new Map(scene.devices.map((device) => [device.id, device]));
  const sceneValidation = validateScene(scene);
  const hardwareBlockingSceneCodes = new Set([
    'missing-pin',
    'unsupported-pin',
    'pin-conflict',
    'pwm-channel-limit',
    'passive-buzzer-limit',
    'button-pullup-unavailable',
    'button-external-bias-required',
  ]);
  diagnostics.push(
    ...sceneValidation.issues.map((issue) => ({
      severity: hardwareBlockingSceneCodes.has(issue.code)
        ? ('error' as const)
        : issue.severity,
      code: `scene-${issue.code}`,
      message: issue.message,
      deviceId: issue.deviceId ?? issue.itemId,
      pin: issue.pin,
    })),
  );
  if (program.threads.length > 16) {
    diagnostics.push({
      severity: 'error',
      code: 'too-many-threads',
      message:
        'La placa admite hasta 16 programas “al comenzar” en este perfil.',
    });
  }
  visitProgram(program, (node) => {
    const kinds = expectedKinds(node);
    if (kinds.length) {
      const deviceId = 'deviceId' in node ? node.deviceId : '';
      const device = deviceMap.get(deviceId);
      if (!device) {
        diagnostics.push({
          severity: 'error',
          code: 'target-missing',
          message: `El bloque ${node.blockId} apunta a un componente inexistente (${deviceId}).`,
          deviceId,
          blockId: node.blockId,
        });
      } else if (!kinds.includes(device.kind)) {
        diagnostics.push({
          severity: 'error',
          code: 'target-kind-mismatch',
          message: `${device.name} no acepta la acción de este bloque.`,
          deviceId,
          blockId: node.blockId,
        });
      }
    }
    if (node.op === 'pin') {
      const definition = wemosD1R32Pins.find((pin) => pin.gpio === node.pin);
      if (!definition?.capabilities.includes('pwmOutput')) {
        diagnostics.push({
          severity: 'error',
          code: 'raw-pin-not-output',
          message: `GPIO ${node.pin} no es una salida segura del perfil Wemos.`,
          blockId: node.blockId,
          pin: node.pin,
        });
      }
      const owner = scene.devices.find((device) =>
        Object.values(device.pins).includes(node.pin),
      );
      if (owner) {
        diagnostics.push({
          severity: 'error',
          code: 'raw-pin-conflict',
          message: `GPIO ${node.pin} ya pertenece a ${owner.name}.`,
          deviceId: owner.id,
          blockId: node.blockId,
          pin: node.pin,
        });
      } else if (definition?.capabilities.includes('pwmOutput')) {
        diagnostics.push({
          severity: 'warning',
          code: 'raw-pin-load-review',
          message: `GPIO ${node.pin} es una salida avanzada: revisá resistencia, transistor o driver según la carga conectada.`,
          blockId: node.blockId,
          pin: node.pin,
        });
      }
    }
    if (node.op === 'if') {
      validateConditionTarget(
        node.condition,
        node.blockId,
        deviceMap,
        diagnostics,
      );
    }
  });
  return diagnostics.filter(
    (diagnostic, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.code === diagnostic.code &&
          candidate.blockId === diagnostic.blockId &&
          candidate.deviceId === diagnostic.deviceId &&
          candidate.pin === diagnostic.pin,
      ) === index,
  );
}

type FlatInstruction =
  | Exclude<ProgramNode, { op: 'repeat' } | { op: 'if' }>
  | {
      op: 'repeatStart';
      count: number;
      slot: number;
      end: number;
      blockId: string;
    }
  | { op: 'repeatNext'; slot: number; target: number; blockId: string }
  | { op: 'jumpIfFalse'; condition: Condition; target: number; blockId: string }
  | { op: 'jump'; target: number; yieldAfter?: boolean; blockId: string }
  | { op: 'halt'; blockId: string };

function flattenProgram(nodes: ProgramNode[]) {
  const output: FlatInstruction[] = [];
  let loopSlot = 0;
  const visit = (items: ProgramNode[]) => {
    for (const node of items) {
      if (node.op === 'repeat') {
        if (node.count < 0) {
          const start = output.length;
          visit(node.body);
          output.push({
            op: 'jump',
            target: start,
            yieldAfter: true,
            blockId: node.blockId,
          });
        } else {
          const slot = loopSlot++;
          const startIndex = output.length;
          output.push({
            op: 'repeatStart',
            count: Math.max(0, Math.floor(node.count)),
            slot,
            end: -1,
            blockId: node.blockId,
          });
          const bodyStart = output.length;
          visit(node.body);
          output.push({
            op: 'repeatNext',
            slot,
            target: bodyStart,
            blockId: node.blockId,
          });
          (
            output[startIndex] as Extract<
              FlatInstruction,
              { op: 'repeatStart' }
            >
          ).end = output.length;
        }
      } else if (node.op === 'if') {
        const conditionIndex = output.length;
        output.push({
          op: 'jumpIfFalse',
          condition: node.condition,
          target: -1,
          blockId: node.blockId,
        });
        visit(node.consequent);
        const jumpIndex = output.length;
        output.push({ op: 'jump', target: -1, blockId: node.blockId });
        (
          output[conditionIndex] as Extract<
            FlatInstruction,
            { op: 'jumpIfFalse' }
          >
        ).target = output.length;
        visit(node.otherwise);
        (output[jumpIndex] as Extract<FlatInstruction, { op: 'jump' }>).target =
          output.length;
      } else {
        output.push(node);
      }
    }
  };
  visit(nodes);
  output.push({ op: 'halt', blockId: 'program-end' });
  return { output, loopSlots: Math.max(1, loopSlot) };
}

const cppString = (value: string) =>
  `"${Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    if (character === '\r' || character === '\n' || character === '\t') {
      return character;
    }
    return code <= 31 || code === 127 || code === 0x2028 || code === 0x2029
      ? ' '
      : character;
  })
    .join('')
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
    .replaceAll('\t', '\\t')}"`;

const cppLineComment = (value: unknown) =>
  replaceUnsafeText(String(value), true)
    .replaceAll('\\', '/')
    .replaceAll('??/', '? /')
    .replace(/\s+/g, ' ')
    .trim();

function hashId(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function cppIdentifier(value: string) {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return `${(base || 'DEVICE').slice(0, 48)}_${hashId(value)}`;
}

function createCppSymbols(scene: SceneDefinition) {
  const symbols = new Map<string, string>();
  const owners = new Map<string, string>();
  const collisions: Array<{ deviceId: string; ownerId: string }> = [];
  for (const device of scene.devices) {
    const original = cppIdentifier(device.id);
    let symbol = original;
    let sequence = 2;
    while (owners.has(symbol) && owners.get(symbol) !== device.id) {
      if (sequence === 2) {
        collisions.push({
          deviceId: device.id,
          ownerId: owners.get(symbol) ?? '',
        });
      }
      symbol = `${original}_${sequence}`;
      sequence += 1;
    }
    owners.set(symbol, device.id);
    symbols.set(device.id, symbol);
  }
  return { symbols, collisions };
}

interface GeneratorContext {
  scene: SceneDefinition;
  symbols: Map<string, string>;
  threadIndex: number;
}

function deviceSymbol(context: GeneratorContext, deviceId: string) {
  return context.symbols.get(deviceId) ?? cppIdentifier(deviceId);
}

function pinConstant(context: GeneratorContext, deviceId: string) {
  return `PIN_${deviceSymbol(context, deviceId)}`;
}

function conditionToCpp(condition: Condition, context: GeneratorContext) {
  const operators = {
    EQ: '==',
    NEQ: '!=',
    LT: '<',
    LTE: '<=',
    GT: '>',
    GTE: '>=',
  } as const;
  if (condition.kind === 'wifiConnected')
    return 'WiFi.status() == WL_CONNECTED';
  if (condition.kind === 'buttonPressed')
    return `digitalRead(${pinConstant(context, condition.deviceId)}) == LOW`;
  if (condition.kind === 'sensor') {
    return `analogRead(${pinConstant(context, condition.deviceId)}) ${operators[condition.operator]} ${Math.max(0, Math.min(4095, Math.round(condition.value)))}`;
  }
  if (condition.kind === 'boolean') return condition.value ? 'true' : 'false';
  if (condition.kind === 'counter')
    return `counterValue ${operators[condition.operator]} ${normalizeCounterValue(condition.value)}`;
  return `${condition.left} ${operators[condition.operator]} ${condition.right}`;
}

function instructionToCpp(
  instruction: FlatInstruction,
  index: number,
  context: GeneratorContext,
) {
  const nextPc = index + 1;
  const suffix = `T${context.threadIndex}`;
  const pc = `pc_${suffix}`;
  const waiting = `waiting_${suffix}`;
  const waitStarted = `waitStarted_${suffix}`;
  const loops = `loopCounters_${suffix}`;
  const comment = `        // bloque: ${cppLineComment(instruction.blockId)}`;
  switch (instruction.op) {
    case 'traffic':
      return `${comment}\n        setTraffic(DEV_${deviceSymbol(context, instruction.deviceId)}, TrafficColor::${instruction.color});\n        ${pc} = ${nextPc};\n        break;`;
    case 'led': {
      const duty = Math.round(
        (Math.max(0, Math.min(100, instruction.brightness)) / 100) * 255,
      );
      return `${comment}\n        ledcWrite(${pinConstant(context, instruction.deviceId)}, ${duty});\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'pin':
      return `${comment}\n        pinMode(${instruction.pin}, OUTPUT);\n        digitalWrite(${instruction.pin}, ${instruction.value ? 'HIGH' : 'LOW'});\n        ${pc} = ${nextPc};\n        break;`;
    case 'wait':
      return `${comment}\n        if (!${waiting}) { ${waitStarted} = now; ${waiting} = true; return; }\n        if ((uint32_t)(now - ${waitStarted}) < ${Math.max(0, Math.round(instruction.ms))}U) return;\n        ${waiting} = false;\n        ${pc} = ${nextPc};\n        break;`;
    case 'robot': {
      const speed = Math.max(0, Math.min(100, Math.round(instruction.speed)));
      const motorPairs = {
        FORWARD: `${speed}, ${speed}`,
        BACKWARD: `${-speed}, ${-speed}`,
        LEFT: `${-speed}, ${speed}`,
        RIGHT: `${speed}, ${-speed}`,
        STOP: '0, 0',
      };
      return `${comment}\n        driveRobot(DEV_${deviceSymbol(context, instruction.deviceId)}, ${motorPairs[instruction.action]});\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'motor': {
      const power = Math.max(0, Math.min(100, Math.round(instruction.power)));
      const signedPower =
        instruction.direction === 'BACKWARD'
          ? -power
          : instruction.direction === 'STOP'
            ? 0
            : power;
      return `${comment}\n        driveMotor(DEV_${deviceSymbol(context, instruction.deviceId)}, ${signedPower});\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'servo':
      return `${comment}\n        setServoAngle(${pinConstant(context, instruction.deviceId)}, ${Math.max(0, Math.min(180, Math.round(instruction.angle)))});\n        ${pc} = ${nextPc};\n        break;`;
    case 'buzzer': {
      const pin = pinConstant(context, instruction.deviceId);
      const stop = `BUZZER_STOP_${deviceSymbol(context, instruction.deviceId)}`;
      const start =
        instruction.kind === 'ACTIVE'
          ? `ledcWrite(${pin}, 255);`
          : `ledcWriteTone(${pin}, ${Math.max(20, Math.round(instruction.frequency))});`;
      return `${comment}\n        ${start}\n        ${stop} = now + ${Math.max(10, Math.round(instruction.durationMs))}U;\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'tone': {
      const pin = pinConstant(context, instruction.deviceId);
      const stop = `BUZZER_STOP_${deviceSymbol(context, instruction.deviceId)}`;
      return `${comment}\n        ledcWriteTone(${pin}, ${Math.max(20, Math.round(instruction.frequency))});\n        ${stop} = now + ${Math.max(10, Math.round(instruction.durationMs))}U;\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'wifi':
      return `${comment}\n        if (!wifiAttemptActive_${suffix}) {\n          WiFi.mode(WIFI_STA);\n          WiFi.begin(WIFI_SSID, WIFI_PASSWORD);\n          wifiAttemptStarted_${suffix} = now;\n          wifiAttemptActive_${suffix} = true;\n          return;\n        }\n        if (WiFi.status() == WL_CONNECTED || (uint32_t)(now - wifiAttemptStarted_${suffix}) >= ${Math.max(1000, Math.round(instruction.timeoutMs))}U) {\n          wifiAttemptActive_${suffix} = false;\n          ${pc} = ${nextPc};\n          break;\n        }\n        return;`;
    case 'counterSet':
      return `${comment}\n        counterValue = ${normalizeCounterValue(instruction.value)};\n        ${pc} = ${nextPc};\n        break;`;
    case 'counterChange':
      return `${comment}\n        counterValue = addCounter(counterValue, ${normalizeCounterValue(instruction.delta)});\n        ${pc} = ${nextPc};\n        break;`;
    case 'serial':
      return `${comment}\n        Serial.println(${cppString(instruction.text)});\n        ${pc} = ${nextPc};\n        break;`;
    case 'repeatStart':
      return `${comment}\n        if (${loops}[${instruction.slot}] < 0) ${loops}[${instruction.slot}] = ${instruction.count};\n        if (${loops}[${instruction.slot}] == 0) { ${loops}[${instruction.slot}] = -1; ${pc} = ${instruction.end}; }\n        else { ${pc} = ${nextPc}; }\n        break;`;
    case 'repeatNext':
      return `${comment}\n        --${loops}[${instruction.slot}];\n        if (${loops}[${instruction.slot}] > 0) { ${pc} = ${instruction.target}; }\n        else { ${loops}[${instruction.slot}] = -1; ${pc} = ${nextPc}; }\n        return;`;
    case 'jumpIfFalse':
      return `${comment}\n        ${pc} = (${conditionToCpp(instruction.condition, context)}) ? ${nextPc} : ${instruction.target};\n        break;`;
    case 'jump':
      return `${comment}\n        ${pc} = ${instruction.target};\n        ${instruction.yieldAfter ? 'return;' : 'break;'}`;
    case 'halt':
      return `${comment}\n        active_${suffix} = false;\n        return;`;
  }
}

function programUsesWifi(program: CompiledProgram) {
  let usesWifi = false;
  visitProgram(program, (node) => {
    if (node.op === 'wifi') usesWifi = true;
    if (node.op === 'if' && node.condition.kind === 'wifiConnected') {
      usesWifi = true;
    }
  });
  return usesWifi;
}

function gpioOrPlaceholder(value: number | null) {
  return value ?? 255;
}

function deviceDeclarations(
  scene: SceneDefinition,
  symbols: Map<string, string>,
) {
  return scene.devices
    .map((device) => {
      const symbol = symbols.get(device.id) ?? cppIdentifier(device.id);
      const label = (pin: number | null) =>
        `${gpioOrPlaceholder(pin)}; // ${pinLabel(pin)}`;
      switch (device.kind) {
        case 'trafficLight':
          return `constexpr TrafficDevice DEV_${symbol}{${gpioOrPlaceholder(device.pins.red)}, ${gpioOrPlaceholder(device.pins.yellow)}, ${gpioOrPlaceholder(device.pins.green)}}; // ${cppLineComment(device.name)}`;
        case 'robot':
          return `constexpr RobotDevice DEV_${symbol}{${gpioOrPlaceholder(device.pins.leftIn1)}, ${gpioOrPlaceholder(device.pins.leftIn2)}, ${gpioOrPlaceholder(device.pins.rightIn1)}, ${gpioOrPlaceholder(device.pins.rightIn2)}}; // ${cppLineComment(device.name)}`;
        case 'motor':
          return `constexpr MotorDevice DEV_${symbol}{${gpioOrPlaceholder(device.pins.in1)}, ${gpioOrPlaceholder(device.pins.in2)}}; // ${cppLineComment(device.name)}`;
        case 'wifiNode':
          return `// ${cppLineComment(device.name)}: radio Wi-Fi integrada, sin GPIO externo.`;
        default:
          return `constexpr uint8_t PIN_${symbol} = ${label(device.pins.signal)}`;
      }
    })
    .join('\n');
}

function buzzerDeclarations(
  scene: SceneDefinition,
  symbols: Map<string, string>,
) {
  return scene.devices
    .filter(
      (device) =>
        device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer',
    )
    .map(
      (device) =>
        `uint32_t BUZZER_STOP_${symbols.get(device.id) ?? cppIdentifier(device.id)} = 0;`,
    )
    .join('\n');
}

function setupLines(scene: SceneDefinition, symbols: Map<string, string>) {
  const lines: string[] = [];
  for (const device of scene.devices) {
    const symbol = symbols.get(device.id) ?? cppIdentifier(device.id);
    switch (device.kind) {
      case 'trafficLight':
        lines.push(
          `  pinMode(DEV_${symbol}.red, OUTPUT);`,
          `  pinMode(DEV_${symbol}.yellow, OUTPUT);`,
          `  pinMode(DEV_${symbol}.green, OUTPUT);`,
          `  setTraffic(DEV_${symbol}, TrafficColor::OFF);`,
        );
        break;
      case 'robot':
        lines.push(
          `  ledcAttach(DEV_${symbol}.leftIn1, 20000, 8);`,
          `  ledcAttach(DEV_${symbol}.leftIn2, 20000, 8);`,
          `  ledcAttach(DEV_${symbol}.rightIn1, 20000, 8);`,
          `  ledcAttach(DEV_${symbol}.rightIn2, 20000, 8);`,
          `  driveRobot(DEV_${symbol}, 0, 0);`,
        );
        break;
      case 'motor':
        lines.push(
          `  ledcAttach(DEV_${symbol}.in1, 20000, 8);`,
          `  ledcAttach(DEV_${symbol}.in2, 20000, 8);`,
          `  driveMotor(DEV_${symbol}, 0);`,
        );
        break;
      case 'led':
        lines.push(
          `  ledcAttach(PIN_${symbol}, 5000, 8);`,
          `  ledcWrite(PIN_${symbol}, 0);`,
        );
        break;
      case 'servo':
        lines.push(
          `  ledcAttach(PIN_${symbol}, 50, 16);`,
          `  setServoAngle(PIN_${symbol}, ${Math.max(0, Math.min(180, Math.round(device.config.angle)))});`,
        );
        break;
      case 'activeBuzzer':
        lines.push(
          `  ledcAttach(PIN_${symbol}, 1000, 8);`,
          `  ledcWrite(PIN_${symbol}, 0);`,
        );
        break;
      case 'passiveBuzzer':
        lines.push(
          // Keep the passive tone on a timer that is not shared with active
          // buzzers. ledcWriteTone reconfigures its timer at runtime.
          `  ledcAttach(PIN_${symbol}, 1100, 8);`,
          `  ledcWrite(PIN_${symbol}, 0);`,
        );
        break;
      case 'button':
        lines.push(
          `  pinMode(PIN_${symbol}, ${device.config.pullup ? 'INPUT_PULLUP' : 'INPUT'});`,
        );
        break;
      case 'lightSensor':
      case 'potentiometer':
      case 'wifiNode':
        break;
    }
  }
  if (
    scene.devices.some(
      (device) =>
        device.kind === 'lightSensor' || device.kind === 'potentiometer',
    )
  ) {
    lines.push('  analogReadResolution(12);');
  }
  return lines.join('\n');
}

function serviceBuzzerLines(
  scene: SceneDefinition,
  symbols: Map<string, string>,
) {
  return scene.devices
    .filter(
      (device) =>
        device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer',
    )
    .map((device) => {
      const symbol = symbols.get(device.id) ?? cppIdentifier(device.id);
      return `  if (BUZZER_STOP_${symbol} != 0 && (int32_t)(now - BUZZER_STOP_${symbol}) >= 0) {
    ledcWriteTone(PIN_${symbol}, 0);
    ledcWrite(PIN_${symbol}, 0);
    BUZZER_STOP_${symbol} = 0;
  }`;
    })
    .join('\n');
}

export interface CodeGenerationResult {
  code: string;
  diagnostics: CapiDiagnostic[];
  program: CompiledProgram;
  scene: SceneDefinition;
}

export function generateEsp32CodeResult(
  input: CompiledProgram | ProgramNode[],
  title: string,
  sourceScene?: SceneDefinition,
): CodeGenerationResult {
  const scene = sourceScene
    ? cloneScene(sourceScene)
    : inferSceneForProgram(input);
  const program = normalizeCompiledProgram(input, scene);
  const diagnostics = validateProgramForScene(program, scene);
  const { symbols, collisions } = createCppSymbols(scene);
  diagnostics.push(
    ...collisions.map(({ deviceId, ownerId }) => ({
      severity: 'warning' as const,
      code: 'cpp-symbol-collision-resolved',
      message: `Las identidades ${ownerId} y ${deviceId} producían el mismo nombre interno; el generador las separó de forma segura.`,
      deviceId,
    })),
  );
  const usesWifi = programUsesWifi(program);
  const wifiHeader = usesWifi
    ? `#include <WiFi.h>

const char* WIFI_SSID = "TU_RED";
const char* WIFI_PASSWORD = "TU_CLAVE";
`
    : '';
  const errors = diagnostics.filter((item) => item.severity === 'error');
  const diagnosticHeader = diagnostics.length
    ? `// Diagnóstico de configuración:\n${diagnostics
        .map(
          (item) =>
            `// [${item.severity.toUpperCase()} ${cppLineComment(item.code)}] ${cppLineComment(item.message)}`,
        )
        .join('\n')}\n${errors
        .map((item) => `#error ${cppString(`CapiBloques: ${item.message}`)}`)
        .join('\n')}\n`
    : '';

  const flattened = program.threads.map((thread) =>
    flattenProgram(thread.nodes),
  );
  const threadGlobals = flattened
    .map(({ loopSlots }, index) => {
      const suffix = `T${index}`;
      const loopSlotCount = Math.max(1, loopSlots);
      return `uint16_t pc_${suffix} = 0;
bool active_${suffix} = true;
bool waiting_${suffix} = false;
uint32_t waitStarted_${suffix} = 0;
int32_t loopCounters_${suffix}[${loopSlotCount}] = { ${Array.from(
        { length: loopSlotCount },
        () => '-1',
      ).join(', ')} };
${usesWifi ? `bool wifiAttemptActive_${suffix} = false;\nuint32_t wifiAttemptStarted_${suffix} = 0;` : ''}`;
    })
    .join('\n\n');
  const threadFunctions = flattened
    .map(({ output }, threadIndex) => {
      const context: GeneratorContext = { scene, symbols, threadIndex };
      const cases = output
        .map(
          (instruction, index) =>
            `      case ${index}: {\n${instructionToCpp(instruction, index, context)}\n      }`,
        )
        .join('\n\n');
      return `void runThread${threadIndex}(uint32_t now, uint8_t budgetLimit) {
  if (!active_T${threadIndex}) return;
  for (uint8_t budget = 0; budget < budgetLimit; ++budget) {
    switch (pc_T${threadIndex}) {
${cases}
      default:
        active_T${threadIndex} = false;
        return;
    }
  }
}`;
    })
    .join('\n\n');
  const threadBudget = Math.max(
    1,
    Math.floor(32 / Math.max(1, program.threads.length)),
  );
  const runThreads = program.threads.length
    ? program.threads
        .map((_, index) => `  runThread${index}(now, ${threadBudget});`)
        .join('\n')
    : '  // No hay programas “al comenzar”.';

  const code = `// ${cppLineComment(projectTitle(title))}
// Generado por CapiBloques para WEMOS D1 R32
// Arduino-ESP32 3.3.11 | FQBN: esp32:esp32:d1_uno32
// Scheduler cooperativo con ${program.threads.length} programa(s) y esperas no bloqueantes.

#include <Arduino.h>
${wifiHeader}${diagnosticHeader}
struct TrafficDevice { uint8_t red; uint8_t yellow; uint8_t green; };
struct RobotDevice { uint8_t leftIn1; uint8_t leftIn2; uint8_t rightIn1; uint8_t rightIn2; };
struct MotorDevice { uint8_t in1; uint8_t in2; };
enum class TrafficColor { RED, YELLOW, GREEN, OFF };

${deviceDeclarations(scene, symbols)}

int32_t counterValue = 0;
uint32_t lastSchedulerTick = 0;
constexpr uint32_t SCHEDULER_QUANTUM_MS = 16;
${buzzerDeclarations(scene, symbols)}
${threadGlobals}

void setTraffic(const TrafficDevice& device, TrafficColor color) {
  digitalWrite(device.red, color == TrafficColor::RED ? HIGH : LOW);
  digitalWrite(device.yellow, color == TrafficColor::YELLOW ? HIGH : LOW);
  digitalWrite(device.green, color == TrafficColor::GREEN ? HIGH : LOW);
}

int32_t addCounter(int32_t current, int32_t delta) {
  const int64_t result = (int64_t)current + (int64_t)delta;
  if (result > INT32_MAX) return INT32_MAX;
  if (result < INT32_MIN) return INT32_MIN;
  return (int32_t)result;
}

void motorWrite(uint8_t in1, uint8_t in2, int speedPercent) {
  speedPercent = constrain(speedPercent, -100, 100);
  const uint8_t duty = (uint8_t)((abs(speedPercent) * 255 + 50) / 100);
  if (speedPercent >= 0) {
    ledcWrite(in1, duty);
    ledcWrite(in2, 0);
  } else {
    ledcWrite(in1, 0);
    ledcWrite(in2, duty);
  }
}

void driveRobot(const RobotDevice& device, int leftSpeed, int rightSpeed) {
  motorWrite(device.leftIn1, device.leftIn2, leftSpeed);
  motorWrite(device.rightIn1, device.rightIn2, rightSpeed);
}

void driveMotor(const MotorDevice& device, int power) {
  motorWrite(device.in1, device.in2, power);
}

void setServoAngle(uint8_t pin, int angle) {
  angle = constrain(angle, 0, 180);
  const uint32_t pulseMicros = 500U + ((uint32_t)angle * 2000U) / 180U;
  const uint32_t duty = (pulseMicros * 65535U) / 20000U;
  ledcWrite(pin, duty);
}

${threadFunctions}

void setup() {
  Serial.begin(115200);
${setupLines(scene, symbols)}
}

void loop() {
  const uint32_t now = millis();
${serviceBuzzerLines(scene, symbols)}
  if ((uint32_t)(now - lastSchedulerTick) < SCHEDULER_QUANTUM_MS) {
    yield();
    return;
  }
  lastSchedulerTick = now;
${runThreads}
  yield();
}
`;
  return { code, diagnostics, program, scene };
}

export function generateEsp32Code(
  input: CompiledProgram | ProgramNode[],
  title: string,
  scene?: SceneDefinition,
) {
  return generateEsp32CodeResult(input, title, scene).code;
}

export function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function safeFilename(value: string) {
  const simplified = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();
  return simplified || 'mi-aventura';
}
