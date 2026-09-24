import {
  addDeviceToScene,
  cloneScene,
  createEmptyScene,
  createSceneFromTemplate,
  dashboardDeviceIds,
  isLegacySceneId,
  isSceneDefinition,
  migrateSceneDefinition,
  pinLabel,
  sceneComponentCatalog,
  validateScene,
  type LegacySceneId,
  type SceneDefinition,
  type SceneDevice,
  type SceneDeviceKind,
  // @ts-expect-error Node's type-stripping smoke runner needs the explicit suffix.
} from './scene-model.ts';

export type SceneId = LegacySceneId;
// @ts-expect-error Node strip-types runner.
import { displayArtworks, displayProfiles, displayTargets, layoutDisplayText, MAX_DISPLAY_TEXT, validDisplayConfig } from './display-model.ts';
// @ts-expect-error Node strip-types runner.
import { BUILTIN_DISPLAY_ARTWORKS, displayAnimationMs, displayArtworkById, type DisplayArtworkEffect, type DisplayTextEffect } from './display-graphics.ts';
// @ts-expect-error Node strip-types runner.
import { displayArduinoSupport } from './display-arduino.ts';
// @ts-expect-error Node strip-types runner.
import { displayIdfSupport } from './display-idf.ts';
// @ts-expect-error Node strip-types runner.
import { allocateIdfPwm, idfRuntimeSupport, IDF_VERSION } from './idf-runtime.ts';
// @ts-expect-error Node strip-types runner.
import { MAX_MESSAGE_BYTES } from './messages-protocol.ts';
// @ts-expect-error Node strip-types runner.
import { MAX_MATRIX_TEXT, normalizeMatrixText, validMatrixConfig } from './led-matrix.ts';
// @ts-expect-error Node strip-types runner.
import { matrixFirmwareSupport, normalizedMatrixTextLiteral } from './led-matrix-firmware.ts';
// @ts-expect-error Node strip-types runner.
import { componentValueCapability, type ComponentValueSource } from './component-capabilities.ts';
// @ts-expect-error Node strip-types runner.
import { boardProfile, isProjectTarget, projectTargetForBoard, type BoardProfileId, type ProjectTarget } from './board-profiles.ts';

export type FirmwareFramework = 'arduino' | 'esp-idf';

export type CompareOperator = 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE';

export type VariableType = 'number' | 'text' | 'boolean';
export interface ProgramVariable {
  id: string;
  name: string;
  type: VariableType;
}

export interface ProgramTimer {
  id: string;
  name: string;
}

export interface ProgramRoutineParameter { id: string; name: string; type: VariableType }
export interface ProgramRoutine {
  id: string;
  name: string;
  kind: 'procedure' | 'function';
  returnType?: VariableType;
  parameters: ProgramRoutineParameter[];
  body: ProgramNode[];
  returnValue?: ValueExpression;
  blockId: string;
}

export type ValueExpression =
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'variable'; variableId: string; valueType: VariableType }
  | { kind: 'counterValue' }
  | { kind: 'timerElapsed'; timerId: string }
  | { kind: 'timerRemaining'; timerId: string }
  | { kind: 'parameter'; parameterId: string; valueType: VariableType }
  | { kind: 'functionCall'; routineId: string; arguments: ValueExpression[]; valueType: VariableType }
  | { kind: 'componentValue'; deviceId: string; property: string; valueType: VariableType; source: ComponentValueSource }
  | { kind: 'sensorValue'; deviceId: string }
  | { kind: 'ottoDistance'; deviceId: string }
  | { kind: 'buttonValue'; deviceId: string }
  | { kind: 'barrierValue'; deviceId: string; expected: 'INTERRUPTED' | 'CLEAR' }
  | { kind: 'displayButtonValue'; deviceId: string; button: 'RIGHT' | 'UP' | 'DOWN' | 'LEFT' | 'SELECT' }
  | { kind: 'messageValue'; deviceId: string }
  | { kind: 'wifiValue' }
  | { kind: 'join'; parts: ValueExpression[] }
  | { kind: 'math'; operator: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE'; left: ValueExpression; right: ValueExpression };

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
  | { kind: 'displayButtonPressed'; deviceId: string; button: 'RIGHT' | 'UP' | 'DOWN' | 'LEFT' | 'SELECT' }
  | {
      kind: 'sensor';
      deviceId: string;
      sensor: 'LIGHT' | 'POTENTIOMETER';
      operator: Exclude<CompareOperator, 'EQ' | 'NEQ'>;
      value: number;
    }
  | { kind: 'wifiConnected' }
  | { kind: 'valueCompare'; operator: CompareOperator; left: ValueExpression; right: ValueExpression }
  | { kind: 'value'; expression: ValueExpression }
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
      op: 'otto';
      deviceId: string;
      action: 'HOME' | 'WALK_FORWARD' | 'WALK_BACKWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'DANCE' | 'JUMP' | 'SWING' | 'TIPTOE' | 'JITTER' | 'MOONWALK_LEFT' | 'MOONWALK_RIGHT' | 'BEND_LEFT' | 'BEND_RIGHT' | 'SHAKE_LEFT' | 'SHAKE_RIGHT' | 'FLAP_FORWARD' | 'FLAP_BACKWARD';
      speed: number;
      repetitions: number;
      blockId: string;
    }
  | { op: 'ottoSound'; deviceId: string; sound: 'HAPPY' | 'SAD' | 'SURPRISE' | 'CONFUSED' | 'SLEEPING' | 'BUTTON' | 'MODE' | 'FART'; blockId: string }
  | { op: 'ottoExpression'; deviceId: string; expression: 'SMILE' | 'SAD' | 'ANGRY' | 'SURPRISED' | 'SLEEPY' | 'LOVE' | 'CLEAR'; blockId: string }
  | { op: 'ottoArms'; deviceId: string; pose: 'DOWN' | 'UP' | 'LEFT_UP' | 'RIGHT_UP' | 'OPEN'; blockId: string }
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
  | { op: 'timerStart'; timerId: string; durationMs: number; repeat: boolean; blockId: string }
  | { op: 'timerRestart'; timerId: string; blockId: string }
  | { op: 'timerPause'; timerId: string; blockId: string }
  | { op: 'timerResume'; timerId: string; blockId: string }
  | { op: 'timerStop'; timerId: string; blockId: string }
  | { op: 'timerWait'; timerId: string; blockId: string }
  | { op: 'procedureCall'; routineId: string; arguments: ValueExpression[]; blockId: string }
  | { op: 'variableSet'; variableId: string; value: ValueExpression; blockId: string }
  | { op: 'variableChange'; variableId: string; delta: ValueExpression; blockId: string }
  | { op: 'serial'; text: string; expression?: ValueExpression; blockId: string }
  | { op: 'messageSend'; deviceId: string; text: string; expression?: ValueExpression; blockId: string }
  | { op: 'wifiMessageSend'; deviceId: string; target: string; text: string; expression?: ValueExpression; blockId: string }
  | {
      op: 'messageReceive';
      deviceId: string;
      expected: string;
      timeoutMs: number;
      equal: ProgramNode[];
      different: ProgramNode[];
      timeout: ProgramNode[];
      blockId: string;
    }
  | {
      op: 'wifiMessageReceive';
      deviceId: string;
      expected: string;
      sender: string;
      timeoutMs: number;
      equal: ProgramNode[];
      different: ProgramNode[];
      timeout: ProgramNode[];
      blockId: string;
    }
  | { op: 'displayWrite'; deviceId: string; areaId: string; text: string; expression?: ValueExpression; blockId: string }
  | { op: 'displayClear'; deviceId: string; areaId: string; blockId: string }
  | { op: 'displayAnimateText'; deviceId: string; areaId: string; text: string; effect: DisplayTextEffect; repeatCount: number; blockId: string }
  | { op: 'displayArtwork'; deviceId: string; artworkId: string; effect: DisplayArtworkEffect; repeatCount: number; blockId: string }
  | { op: 'visualWait'; deviceId: string; blockId: string }
  | { op: 'matrixClear'; deviceId: string; blockId: string }
  | { op: 'matrixPixel'; deviceId: string; x: number; y: number; enabled: boolean; blockId: string }
  | { op: 'matrixPattern'; deviceId: string; patternId: string; blockId: string }
  | { op: 'matrixScroll'; deviceId: string; text: string; speedMs: number; repeatCount: number; blockId: string }
  | {
      op: 'tone';
      deviceId: string;
      frequency: number;
      durationMs: number;
      blockId: string;
    }
  | { op: 'repeat'; count: number; body: ProgramNode[]; blockId: string }
  | { op: 'parallel'; branches: ProgramNode[][]; blockId: string }
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
  variables?: ProgramVariable[];
  timers?: ProgramTimer[];
  routines?: ProgramRoutine[];
  threads: ProgramThread[];
}

export type { ProjectTarget };

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

export type ExampleId = SceneId | 'display' | 'robot-messages' | 'traffic-messages' | 'led-matrix';
export interface ExampleDefinition {
  id: ExampleId;
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
      kind: 'display';
      texts: Record<string, string[]>;
      artworkRows: number[];
      animation: string | null;
      pressedButton: 'RIGHT' | 'UP' | 'DOWN' | 'LEFT' | 'SELECT' | null;
    }
  | { kind: 'ledMatrix'; rows: number[]; scrolling: boolean }
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
  | { kind: 'otto'; motion: string; phase: number; speed: number; distance: number; expression: string; sound: string | null; soundUntil: number; arms: string }
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
  | { kind: 'infraredBarrier'; interrupted: boolean }
  | { kind: 'lightSensor'; value: number }
  | { kind: 'potentiometer'; value: number }
  | { kind: 'wifiNode'; status: WifiRuntimeState; received: Array<{ sender: string; text: string; sequence: number }>; transmitted: Array<{ target: string; text: string; sequence: number }>; rejected: number }
  | { kind: 'messages'; received: string[]; transmitted: string[]; damaged: number };

export interface ExecutionEvent {
  seq: number;
  now: number;
  taskId: string;
  label: string;
  blockId: string;
  deviceId?: string;
  message: string;
}

export type ExecutionTaskStatus =
  | 'ready'
  | 'waiting'
  | 'joining'
  | 'done'
  | 'inactive';

/** Transient simulator progress. It is never part of a project snapshot. */
export interface ExecutionTaskState {
  id: string;
  label: string;
  status: ExecutionTaskStatus;
  blockId?: string;
  detail?: string;
  remainingMs?: number;
  durationMs?: number;
  iteration?: number;
  totalIterations?: number;
}

export interface SimulatorState {
  execution?: {
    mode: 'normal' | 'guided';
    awaitingFrame: number | null;
    trace: ExecutionEvent[];
    tasks: ExecutionTaskState[];
  };
  now: number;
  status: 'idle' | 'running' | 'paused' | 'done' | 'stopped';
  devices: Record<string, RuntimeDeviceState>;
  dashboardModes: Record<string, 'program' | 'manual'>;
  wifi: WifiRuntimeState;
  wifiAvailable: boolean;
  counter: number;
  variables: Record<string, number | string | boolean>;
  timers: Record<string, {
    name: string;
    status: 'stopped' | 'running' | 'paused' | 'expired';
    elapsedMs: number;
    remainingMs: number;
    durationMs: number;
    repeat: boolean;
    pendingEvents: number;
  }>;
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

const projectTarget: ProjectTarget = projectTargetForBoard('wemos-d1-r32');

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

const robotMessagesScene = addDeviceToScene(createSceneFromTemplate('robot'), 'messages', {
  id: 'messages-1', name: 'Órdenes del robot', config: { mode: 'receive', baudRate: 9600, messages: ['AVANZAR', 'DETENER'] },
}).scene;
const trafficMessagesScene = addDeviceToScene(createSceneFromTemplate('traffic'), 'messages', {
  id: 'messages-1', name: 'Órdenes del semáforo', config: { mode: 'receive', baudRate: 9600, messages: ['VERDE', 'ROJO'] },
}).scene;
const matrixExample = addDeviceToScene(createEmptyScene('Cartel de bienvenida'), 'ledMatrix', { id: 'led-matrix-1', position: { x: 480, y: 270 } });
const messageReceiver = (expected: string, equal: Record<string, unknown>, different: Record<string, unknown>, timeout: Record<string, unknown>) => ({
  type: 'capi_forever', id: `listen-${expected.toLowerCase()}`, inputs: { DO: { block: {
    type: 'capi_message_receive', id: `receive-${expected.toLowerCase()}`,
    fields: { DEVICE_ID: 'messages-1', MESSAGE: expected, TIMEOUT: 5 },
    inputs: { EQUAL: { block: equal }, DIFFERENT: { block: different }, TIMEOUT_DO: { block: timeout } },
  } } },
});

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
  {
    id: 'display', title: 'Mensajes para la plaza', icon: '📺', level: 'Inicial',
    mission: 'Escribí en la pantalla, esperá para leer y borrá el mensaje. La consola es otro destino.',
    description: 'Una LCD de 16 × 2; podés cambiar el modelo desde Armar escena.',
    scene: addDeviceToScene(createEmptyScene('Mensajes para la plaza'), 'display', { id: 'display-1', position: { x: 480, y: 270 } }).scene,
    workspace: startWorkspace(chain(
      { type: 'capi_display_write', id: 'display-hello', fields: { DEVICE_ID: 'display-1', AREA_ID: 'screen', TEXT: 'Hola, explorador!' } },
      { type: 'capi_wait', id: 'display-read', fields: { SECONDS: 3 } },
      { type: 'capi_display_clear', id: 'display-clean', fields: { DEVICE_ID: 'display-1', AREA_ID: 'screen' } },
      { type: 'capi_serial', id: 'display-console', fields: { TEXT: 'Este mensaje va a la consola.' } },
    )),
  },
  {
    id: 'led-matrix', title: 'Cartel luminoso', icon: '🟨', level: 'Inicial',
    mission: 'Mostrá un corazón y después hacé cruzar un saludo sin frenar otros caminos.',
    description: 'Dibujos de 32 × 8, píxeles y texto desplazable.',
    scene: matrixExample.scene,
    workspace: startWorkspace(chain(
      { type: 'capi_matrix_pattern', id: 'matrix-heart', fields: { DEVICE_ID: matrixExample.device.id, PATTERN_ID: 'heart' } },
      { type: 'capi_wait', id: 'matrix-heart-wait', fields: { SECONDS: 1 } },
      { type: 'capi_matrix_scroll', id: 'matrix-hello', fields: { DEVICE_ID: matrixExample.device.id, TEXT: 'HOLA CAPI', SPEED: 100 } },
      { type: 'capi_matrix_clear', id: 'matrix-clean', fields: { DEVICE_ID: matrixExample.device.id } },
    )),
  },
  {
    id: 'robot-messages', title: 'Robot por mensajes', icon: '📥', level: 'Intermedio',
    mission: 'Probá órdenes predefinidas y hacé que el robot responda sin congelar otros caminos.',
    description: 'Recepción protegida, comparación y tres resultados posibles.',
    scene: robotMessagesScene,
    workspace: startWorkspace(messageReceiver(
      'AVANZAR',
      { type: 'capi_robot', id: 'message-robot-forward', fields: { DEVICE_ID: 'robot-1', ACTION: 'FORWARD', SPEED: 70 } },
      { type: 'capi_robot', id: 'message-robot-stop', fields: { DEVICE_ID: 'robot-1', ACTION: 'STOP', SPEED: 0 } },
      { type: 'capi_serial', id: 'message-robot-timeout', fields: { TEXT: 'No llegó una orden' } },
    )),
  },
  {
    id: 'traffic-messages', title: 'Semáforo por mensajes', icon: '🚦', level: 'Intermedio',
    mission: 'Encendé verde al recibir VERDE y rojo frente a cualquier otra orden.',
    description: 'Mensajes completos, respuesta distinta y timeout visible.',
    scene: trafficMessagesScene,
    workspace: startWorkspace(messageReceiver(
      'VERDE',
      { type: 'capi_traffic', id: 'message-traffic-green', fields: { DEVICE_ID: 'traffic-light-1', COLOR: 'GREEN' } },
      { type: 'capi_traffic', id: 'message-traffic-red', fields: { DEVICE_ID: 'traffic-light-1', COLOR: 'RED' } },
      { type: 'capi_traffic', id: 'message-traffic-timeout', fields: { DEVICE_ID: 'traffic-light-1', COLOR: 'YELLOW' } },
    )),
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
  infraredBarrier: 4,
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
  'capi_parallel',
  'capi_forever',
  'capi_repeat',
  'capi_wait',
  'capi_if',
  'capi_compare',
  'capi_value_compare',
  'capi_counter_compare',
  'capi_counter_set',
  'capi_counter_change',
  'capi_timer_start',
  'capi_timer_restart',
  'capi_timer_pause',
  'capi_timer_resume',
  'capi_timer_stop',
  'capi_timer_wait',
  'capi_timer_elapsed',
  'capi_timer_remaining',
  'capi_procedure_def',
  'capi_function_def_number',
  'capi_function_def_text',
  'capi_function_def_boolean',
  'capi_procedure_call',
  'capi_function_call_number',
  'capi_function_call_text',
  'capi_function_call_boolean',
  'capi_parameter_number',
  'capi_parameter_text',
  'capi_parameter_boolean',
  'capi_variable_set_number',
  'capi_variable_change',
  'capi_variable_set_text',
  'capi_variable_set_boolean',
  'capi_variable_get_number',
  'capi_variable_get_text',
  'capi_variable_get_boolean',
  'capi_value_number',
  'capi_value_text',
  'capi_value_boolean',
  'capi_counter_value',
  'capi_sensor_value',
  'capi_component_number',
  'capi_component_text',
  'capi_component_boolean',
  'capi_message_value',
  'capi_number_math',
  'capi_text_join',
  'capi_traffic',
  'capi_led',
  'capi_pin_write',
  'capi_robot',
  'capi_otto',
  'capi_otto_sound',
  'capi_otto_expression',
  'capi_otto_arms',
  'capi_otto_distance',
  'capi_motor',
  'capi_servo',
  'capi_buzzer',
  'capi_tone',
  'capi_button_pressed',
  'capi_barrier_state',
  'capi_display_button_pressed',
  'capi_sensor_compare',
  'capi_wifi_connect',
  'capi_wifi_connected',
  'capi_wifi_message_send',
  'capi_wifi_message_receive',
  'capi_serial',
  'capi_message_send',
  'capi_message_receive',
  'capi_display_write',
  'capi_display_clear',
  'capi_display_animate_text',
  'capi_display_artwork',
  'capi_visual_wait',
  'capi_matrix_clear',
  'capi_matrix_pixel',
  'capi_matrix_pattern',
  'capi_matrix_scroll',
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
    if (block.type === 'capi_parallel') {
      if (block.extraState !== undefined && (!isObjectRecord(block.extraState) || !Number.isInteger(block.extraState.branches))) return workspaceError('workspace-parallel-invalid', 'El estado de los caminos no es válido.', block.id);
      const extra = isObjectRecord(block.extraState) ? block.extraState.branches : undefined;
      const field = isObjectRecord(block.fields) ? block.fields.BRANCHES : undefined;
      const count = Number(extra ?? field ?? 2);
      if (!Number.isInteger(count) || count < 2 || count > 16 || (extra !== undefined && field !== undefined && Number(field) !== count) || (isObjectRecord(block.inputs) && Object.keys(block.inputs).some(name => !/^BRANCH\d+$/.test(name) || Number(name.slice(6)) >= count))) {
        return workspaceError('workspace-parallel-invalid', 'Los caminos de «Al mismo tiempo» están dañados; no se importó ningún bloque.', block.id);
      }
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

function legacyStartWarnings(workspace: Record<string, unknown>): string[] {
  const section = workspace.blocks;
  const starts = isObjectRecord(section) && Array.isArray(section.blocks) ? section.blocks.filter(block => isObjectRecord(block) && block.type === 'capi_start').length : 0;
  return starts > 1 ? ['Al abrir, los inicios anteriores se reúnen en un solo «Al comenzar» con caminos «Al mismo tiempo». Se conservan las acciones y su orden. Guardar conserva la conversión; el archivo original no se modifica.'] : [];
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
  target: ProjectTarget = projectTarget,
): ProjectFile {
  const sceneDefinition = isLegacySceneId(scene)
    ? createSceneFromTemplate(scene)
    : cloneScene(scene);
  const sceneErrors = validateScene(sceneDefinition, target.boardProfile).issues.filter(
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
    target: { ...target },
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
    isProjectTarget(candidate.target) &&
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
    case 'capi_display_write':
    case 'capi_display_clear':
    case 'capi_display_animate_text':
    case 'capi_display_artwork': return 'display';
    case 'capi_display_button_pressed': return 'display';
    case 'capi_matrix_clear':
    case 'capi_matrix_pixel':
    case 'capi_matrix_pattern':
    case 'capi_matrix_scroll': return 'ledMatrix';
    case 'capi_message_send':
    case 'capi_message_receive': return 'messages';
    case 'capi_traffic':
      return 'trafficLight';
    case 'capi_led':
      return 'led';
    case 'capi_robot':
      return 'robot';
    case 'capi_otto':
    case 'capi_otto_sound':
    case 'capi_otto_expression':
    case 'capi_otto_arms':
    case 'capi_otto_distance':
      return 'otto';
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
    case 'capi_barrier_state':
      return 'infraredBarrier';
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
    case 'infraredBarrier':
      return { signal: pin('infraredBarrier', 4) };
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
    const validation = validateScene(scene, value.target.boardProfile);
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
        target: { ...value.target },
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
      warnings: [...validation.issues.map((issue) => issue.message), ...legacyStartWarnings(decodedWorkspace.workspace)],
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
    const migratedScene = migrateSceneDefinition(value.scene);
    const originalDevices = isObjectRecord(value.scene) && Array.isArray(value.scene.devices)
      ? value.scene.devices
      : [];
    const preservedDevices = originalDevices.length === migratedScene.scene.devices.length &&
      originalDevices.every((device, index) =>
        isObjectRecord(device) &&
        device.id === migratedScene.scene.devices[index]?.id &&
        device.kind === migratedScene.scene.devices[index]?.kind,
      );
    if (migratedScene.migrated && preservedDevices) {
      const decoded = decodeProjectUnsafe({ ...value, scene: migratedScene.scene });
      if (decoded.project) {
        return {
          ...decoded,
          migrated: true,
          warnings: [...new Set([...migratedScene.warnings, ...decoded.warnings])],
        };
      }
      return decoded;
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
    case 'displayWrite':
    case 'displayClear':
    case 'displayAnimateText':
    case 'displayArtwork': return ['display'];
    case 'visualWait': return ['display', 'ledMatrix'];
    case 'matrixClear':
    case 'matrixPixel':
    case 'matrixPattern':
    case 'matrixScroll': return ['ledMatrix'];
    case 'messageSend':
    case 'messageReceive': return ['messages'];
    case 'wifiMessageSend':
    case 'wifiMessageReceive': return ['wifiNode'];
    case 'traffic':
      return ['trafficLight'];
    case 'led':
      return ['led'];
    case 'robot':
      return ['robot'];
    case 'otto':
    case 'ottoSound':
    case 'ottoExpression':
    case 'ottoArms':
      return ['otto'];
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
  if (condition.kind === 'displayButtonPressed') return ['display'];
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

const variableTypes: readonly VariableType[] = ['number', 'text', 'boolean'];

function normalizeValueExpression(raw: unknown): ValueExpression {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  switch (value.kind) {
    case 'number': return { kind: 'number', value: finiteNumber(value.value, 0) };
    case 'text': return { kind: 'text', value: typeof value.value === 'string' ? value.value.slice(0, 256) : '' };
    case 'boolean': return { kind: 'boolean', value: Boolean(value.value) };
    case 'variable': return {
      kind: 'variable',
      variableId: typeof value.variableId === 'string' ? value.variableId : '',
      valueType: variableTypes.includes(value.valueType as VariableType) ? value.valueType as VariableType : 'number',
    };
    case 'counterValue': return { kind: 'counterValue' };
    case 'timerElapsed': return { kind: 'timerElapsed', timerId: typeof value.timerId === 'string' ? value.timerId : '' };
    case 'timerRemaining': return { kind: 'timerRemaining', timerId: typeof value.timerId === 'string' ? value.timerId : '' };
    case 'parameter': return { kind: 'parameter', parameterId: typeof value.parameterId === 'string' ? value.parameterId : '', valueType: variableTypes.includes(value.valueType as VariableType) ? value.valueType as VariableType : 'number' };
    case 'functionCall': return { kind: 'functionCall', routineId: typeof value.routineId === 'string' ? value.routineId : '', arguments: Array.isArray(value.arguments) ? value.arguments.slice(0, 3).map(normalizeValueExpression) : [], valueType: variableTypes.includes(value.valueType as VariableType) ? value.valueType as VariableType : 'number' };
    case 'componentValue': return {
      kind: 'componentValue',
      deviceId: typeof value.deviceId === 'string' ? value.deviceId : '',
      property: typeof value.property === 'string' ? value.property : '',
      valueType: variableTypes.includes(value.valueType as VariableType) ? value.valueType as VariableType : 'number',
      source: ['measured', 'ordered', 'service'].includes(String(value.source)) ? value.source as ComponentValueSource : 'ordered',
    };
    case 'sensorValue': return { kind: 'sensorValue', deviceId: typeof value.deviceId === 'string' ? value.deviceId : '' };
    case 'ottoDistance': return { kind: 'ottoDistance', deviceId: typeof value.deviceId === 'string' ? value.deviceId : '' };
    case 'buttonValue': return { kind: 'buttonValue', deviceId: typeof value.deviceId === 'string' ? value.deviceId : '' };
    case 'barrierValue': return {
      kind: 'barrierValue',
      deviceId: typeof value.deviceId === 'string' ? value.deviceId : '',
      expected: value.expected === 'CLEAR' ? 'CLEAR' : 'INTERRUPTED',
    };
    case 'displayButtonValue': return {
      kind: 'displayButtonValue',
      deviceId: typeof value.deviceId === 'string' ? value.deviceId : '',
      button: ['RIGHT', 'UP', 'DOWN', 'LEFT', 'SELECT'].includes(String(value.button)) ? value.button as 'RIGHT' | 'UP' | 'DOWN' | 'LEFT' | 'SELECT' : 'SELECT',
    };
    case 'messageValue': return { kind: 'messageValue', deviceId: typeof value.deviceId === 'string' ? value.deviceId : '' };
    case 'wifiValue': return { kind: 'wifiValue' };
    case 'join': return { kind: 'join', parts: Array.isArray(value.parts) ? value.parts.slice(0, 8).map(normalizeValueExpression) : [] };
    case 'math': return {
      kind: 'math',
      operator: ['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE'].includes(String(value.operator)) ? value.operator as 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' : 'ADD',
      left: normalizeValueExpression(value.left),
      right: normalizeValueExpression(value.right),
    };
    default: return { kind: 'text', value: '' };
  }
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
    case 'valueCompare':
      return {
        kind: 'valueCompare',
        operator,
        left: normalizeValueExpression(condition.left),
        right: normalizeValueExpression(condition.right),
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
    case 'displayButtonPressed': {
      const target = firstCompatibleDevice(scene, ['display']);
      const button = ['RIGHT', 'UP', 'DOWN', 'LEFT', 'SELECT'].includes(String(condition.button))
        ? condition.button as 'RIGHT' | 'UP' | 'DOWN' | 'LEFT' | 'SELECT'
        : 'SELECT';
      return {
        kind: 'displayButtonPressed',
        deviceId: typeof condition.deviceId === 'string' ? condition.deviceId : (target?.id ?? 'missing-display'),
        button,
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
    case 'value':
      return { kind: 'value', expression: normalizeValueExpression(condition.expression) };
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
      case 'otto': {
        const actions = ['HOME', 'WALK_FORWARD', 'WALK_BACKWARD', 'TURN_LEFT', 'TURN_RIGHT', 'DANCE', 'JUMP', 'SWING', 'TIPTOE', 'JITTER', 'MOONWALK_LEFT', 'MOONWALK_RIGHT', 'BEND_LEFT', 'BEND_RIGHT', 'SHAKE_LEFT', 'SHAKE_RIGHT', 'FLAP_FORWARD', 'FLAP_BACKWARD'] as const;
        result.push({
          op: 'otto',
          deviceId,
          action: actions.includes(node.action as typeof actions[number]) ? node.action as typeof actions[number] : 'HOME',
          speed: Math.max(0, Math.min(100, finiteNumber(node.speed, 60))),
          repetitions: Math.max(1, Math.min(20, Math.floor(finiteNumber(node.repetitions, 1)))),
          blockId,
        });
        break;
      }
      case 'ottoSound': {
        const sounds = ['HAPPY', 'SAD', 'SURPRISE', 'CONFUSED', 'SLEEPING', 'BUTTON', 'MODE', 'FART'] as const;
        result.push({ op: 'ottoSound', deviceId, sound: sounds.includes(node.sound as typeof sounds[number]) ? node.sound as typeof sounds[number] : 'HAPPY', blockId });
        break;
      }
      case 'ottoExpression': {
        const expressions = ['SMILE', 'SAD', 'ANGRY', 'SURPRISED', 'SLEEPY', 'LOVE', 'CLEAR'] as const;
        result.push({ op: 'ottoExpression', deviceId, expression: expressions.includes(node.expression as typeof expressions[number]) ? node.expression as typeof expressions[number] : 'SMILE', blockId });
        break;
      }
      case 'ottoArms': {
        const poses = ['DOWN', 'UP', 'LEFT_UP', 'RIGHT_UP', 'OPEN'] as const;
        result.push({ op: 'ottoArms', deviceId, pose: poses.includes(node.pose as typeof poses[number]) ? node.pose as typeof poses[number] : 'DOWN', blockId });
        break;
      }
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
      case 'timerStart':
        result.push({
          op: 'timerStart',
          timerId: typeof node.timerId === 'string' ? node.timerId : '',
          durationMs: Math.max(100, Math.min(86_400_000, finiteNumber(node.durationMs, 1000))),
          repeat: Boolean(node.repeat),
          blockId,
        });
        break;
      case 'timerRestart':
      case 'timerPause':
      case 'timerResume':
      case 'timerStop':
      case 'timerWait':
        result.push({ op: node.op, timerId: typeof node.timerId === 'string' ? node.timerId : '', blockId });
        break;
      case 'procedureCall':
        result.push({ op: 'procedureCall', routineId: typeof node.routineId === 'string' ? node.routineId : '', arguments: Array.isArray(node.arguments) ? node.arguments.slice(0, 3).map(normalizeValueExpression) : [], blockId });
        break;
      case 'variableSet':
        result.push({
          op: 'variableSet',
          variableId: typeof node.variableId === 'string' ? node.variableId : '',
          value: normalizeValueExpression(node.value),
          blockId,
        });
        break;
      case 'variableChange':
        result.push({
          op: 'variableChange',
          variableId: typeof node.variableId === 'string' ? node.variableId : '',
          delta: normalizeValueExpression(node.delta),
          blockId,
        });
        break;
      case 'serial':
        result.push({
          op: 'serial',
          text: typeof node.text === 'string' ? node.text : '',
          ...(node.expression ? { expression: normalizeValueExpression(node.expression) } : {}),
          blockId,
        });
        break;
      case 'messageSend':
        result.push({ op: 'messageSend', deviceId: typeof node.deviceId === 'string' ? node.deviceId : '', text: typeof node.text === 'string' ? node.text : '', ...(node.expression ? { expression: normalizeValueExpression(node.expression) } : {}), blockId });
        break;
      case 'wifiMessageSend':
        result.push({ op: 'wifiMessageSend', deviceId: typeof node.deviceId === 'string' ? node.deviceId : '', target: typeof node.target === 'string' ? node.target : '*', text: typeof node.text === 'string' ? node.text : '', ...(node.expression ? { expression: normalizeValueExpression(node.expression) } : {}), blockId });
        break;
      case 'messageReceive':
        result.push({
          op: 'messageReceive',
          deviceId: typeof node.deviceId === 'string' ? node.deviceId : '',
          expected: typeof node.expected === 'string' ? node.expected : '',
          timeoutMs: Math.max(100, finiteNumber(node.timeoutMs, 5000)),
          equal: normalizeNodes(node.equal, scene),
          different: normalizeNodes(node.different, scene),
          timeout: normalizeNodes(node.timeout, scene),
          blockId,
        });
        break;
      case 'wifiMessageReceive':
        result.push({
          op: 'wifiMessageReceive', deviceId: typeof node.deviceId === 'string' ? node.deviceId : '',
          expected: typeof node.expected === 'string' ? node.expected : '', sender: typeof node.sender === 'string' ? node.sender : '*',
          timeoutMs: Math.max(100, finiteNumber(node.timeoutMs, 5000)),
          equal: normalizeNodes(node.equal, scene), different: normalizeNodes(node.different, scene), timeout: normalizeNodes(node.timeout, scene), blockId,
        });
        break;
      case 'displayWrite':
        result.push({ op: 'displayWrite', deviceId: typeof node.deviceId === 'string' ? node.deviceId : '', areaId: typeof node.areaId === 'string' ? node.areaId : '', text: typeof node.text === 'string' ? node.text : '', ...(node.expression ? { expression: normalizeValueExpression(node.expression) } : {}), blockId });
        break;
      case 'displayClear':
        result.push({ op: 'displayClear', deviceId: typeof node.deviceId === 'string' ? node.deviceId : '', areaId: typeof node.areaId === 'string' ? node.areaId : '', blockId });
        break;
      case 'displayAnimateText':
        result.push({
          op: 'displayAnimateText',
          deviceId: typeof node.deviceId === 'string' ? node.deviceId : '',
          areaId: typeof node.areaId === 'string' ? node.areaId : '',
          text: typeof node.text === 'string' ? node.text : '',
          effect: ['type', 'scroll', 'blink'].includes(String(node.effect)) ? node.effect as DisplayTextEffect : 'type',
          repeatCount: node.repeatCount === 0 ? 0 : Math.max(1, Math.min(100, Math.floor(finiteNumber(node.repeatCount, 1)))),
          blockId,
        });
        break;
      case 'displayArtwork':
        result.push({
          op: 'displayArtwork',
          deviceId: typeof node.deviceId === 'string' ? node.deviceId : '',
          artworkId: typeof node.artworkId === 'string' ? node.artworkId : '',
          effect: ['still', 'slide', 'blink'].includes(String(node.effect)) ? node.effect as DisplayArtworkEffect : 'still',
          repeatCount: node.repeatCount === 0 ? 0 : Math.max(1, Math.min(100, Math.floor(finiteNumber(node.repeatCount, 1)))),
          blockId,
        });
        break;
      case 'visualWait':
        result.push({ op: 'visualWait', deviceId: typeof node.deviceId === 'string' ? node.deviceId : '', blockId });
        break;
      case 'matrixClear':
        result.push({ op: 'matrixClear', deviceId, blockId });
        break;
      case 'matrixPixel':
        result.push({ op: 'matrixPixel', deviceId, x: finiteNumber(node.x, 0), y: finiteNumber(node.y, 0), enabled: node.enabled === true, blockId });
        break;
      case 'matrixPattern':
        result.push({ op: 'matrixPattern', deviceId, patternId: typeof node.patternId === 'string' ? node.patternId : '', blockId });
        break;
      case 'matrixScroll':
        result.push({ op: 'matrixScroll', deviceId, text: typeof node.text === 'string' ? node.text : '', speedMs: finiteNumber(node.speedMs, 120), repeatCount: node.repeatCount === 0 ? 0 : Math.max(1, Math.min(100, Math.floor(finiteNumber(node.repeatCount, 1)))), blockId });
        break;
      case 'repeat':
        result.push({
          op: 'repeat',
          count: finiteNumber(node.count, 0),
          body: normalizeNodes(node.body, scene),
          blockId,
        });
        break;
      case 'parallel':
        result.push({ op: 'parallel', branches: Array.isArray(node.branches) ? node.branches.map(branch => normalizeNodes(branch, scene)) : [], blockId });
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
    if (node.op === 'parallel' && Array.isArray(node.branches)) node.branches.forEach(branch => collectRequiredKindsFromNodes(branch, result));
    if (node.op === 'messageReceive') {
      collectRequiredKindsFromNodes(node.equal, result);
      collectRequiredKindsFromNodes(node.different, result);
      collectRequiredKindsFromNodes(node.timeout, result);
    }
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
      variables: [],
      timers: [],
      routines: [],
      threads: [
        {
          id: 'main',
          startBlockId: 'start-main',
          nodes: normalizeNodes(input, scene),
        },
      ],
    };
  }
  if (!input || typeof input !== 'object') return { version: 2, variables: [], timers: [], routines: [], threads: [] };
  const candidate = input as { threads?: unknown; variables?: unknown; timers?: unknown; routines?: unknown };
  if (!Array.isArray(candidate.threads)) return { version: 2, variables: [], timers: [], routines: [], threads: [] };
  const usedIds = new Set<string>();
  const usedVariableIds = new Set<string>();
  const variables = Array.isArray(candidate.variables) ? candidate.variables.flatMap((raw, index) => {
    const variable = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const id = typeof variable.id === 'string' && variable.id.trim() ? variable.id : `variable-${index + 1}`;
    if (usedVariableIds.has(id) || usedVariableIds.size >= 32) return [];
    usedVariableIds.add(id);
    return [{
      id,
      name: typeof variable.name === 'string' && variable.name.trim() ? variable.name.trim().slice(0, 32) : `dato ${index + 1}`,
      type: variableTypes.includes(variable.type as VariableType) ? variable.type as VariableType : 'number',
    }];
  }) : [];
  const usedTimerIds = new Set<string>();
  const timers = Array.isArray(candidate.timers) ? candidate.timers.flatMap((raw, index) => {
    const timer = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const id = typeof timer.id === 'string' && timer.id.trim() ? timer.id : `timer-${index + 1}`;
    if (usedTimerIds.has(id) || usedTimerIds.size >= 16) return [];
    usedTimerIds.add(id);
    return [{ id, name: typeof timer.name === 'string' && timer.name.trim() ? timer.name.trim().slice(0, 32) : `temporizador ${index + 1}` }];
  }) : [];
  const usedRoutineIds = new Set<string>();
  const routines = Array.isArray(candidate.routines) ? candidate.routines.flatMap((raw, index) => {
    const routine = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const id = typeof routine.id === 'string' && routine.id.trim() ? routine.id : `routine-${index + 1}`;
    if (usedRoutineIds.has(id) || usedRoutineIds.size >= 24) return [];
    usedRoutineIds.add(id);
    const kind = routine.kind === 'function' ? 'function' as const : 'procedure' as const;
    const parameters = Array.isArray(routine.parameters) ? routine.parameters.slice(0, 3).map((rawParameter, parameterIndex) => {
      const parameter = rawParameter && typeof rawParameter === 'object' ? rawParameter as Record<string, unknown> : {};
      return { id: typeof parameter.id === 'string' && parameter.id ? parameter.id : String(parameterIndex + 1), name: typeof parameter.name === 'string' && parameter.name.trim() ? parameter.name.trim().slice(0, 24) : `dato ${parameterIndex + 1}`, type: variableTypes.includes(parameter.type as VariableType) ? parameter.type as VariableType : 'number' };
    }) : [];
    const returnType = variableTypes.includes(routine.returnType as VariableType) ? routine.returnType as VariableType : 'number';
    return [{ id, name: typeof routine.name === 'string' && routine.name.trim() ? routine.name.trim().slice(0, 32) : `${kind === 'function' ? 'cálculo' : 'tarea'} ${index + 1}`, kind, returnType: kind === 'function' ? returnType : undefined, parameters, body: normalizeNodes(routine.body, scene), returnValue: kind === 'function' ? normalizeValueExpression(routine.returnValue) : undefined, blockId: typeof routine.blockId === 'string' ? routine.blockId : id }];
  }) : [];
  return {
    version: 2,
    variables,
    timers,
    routines,
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
      if (node.op === 'parallel') node.branches.forEach(visit);
      if (node.op === 'if') {
        visit(node.consequent);
        visit(node.otherwise);
      }
      if (node.op === 'messageReceive' || node.op === 'wifiMessageReceive') {
        visit(node.equal);
        visit(node.different);
        visit(node.timeout);
      }
    }
  };
  program.threads.forEach((thread) => visit(thread.nodes));
  for (const routine of program.routines ?? []) visit(routine.body);
}

function defaultValue(type: VariableType): ValueExpression {
  return type === 'text' ? { kind: 'text', value: '' } : type === 'boolean' ? { kind: 'boolean', value: false } : { kind: 'number', value: 0 };
}

/** Expand bounded, non-recursive routines so every runtime shares one graph. */
export function expandProgramRoutines(input: CompiledProgram): CompiledProgram {
  const routines = new Map((input.routines ?? []).map(routine => [routine.id, routine]));
  const substituteValue = (value: ValueExpression, bindings: Map<string, ValueExpression>, stack: string[]): ValueExpression => {
    if (value.kind === 'parameter') return bindings.get(value.parameterId) ?? defaultValue(value.valueType);
    if (value.kind === 'functionCall') {
      const routine = routines.get(value.routineId);
      if (!routine || routine.kind !== 'function' || stack.includes(routine.id) || stack.length >= 8) return defaultValue(value.valueType);
      const args = value.arguments.map(argument => substituteValue(argument, bindings, stack));
      const nested = new Map(routine.parameters.map((parameter, index) => [parameter.id, args[index] ?? defaultValue(parameter.type)]));
      return substituteValue(routine.returnValue ?? defaultValue(routine.returnType ?? 'number'), nested, [...stack, routine.id]);
    }
    if (value.kind === 'join') return { ...value, parts: value.parts.map(part => substituteValue(part, bindings, stack)) };
    if (value.kind === 'math') return { ...value, left: substituteValue(value.left, bindings, stack), right: substituteValue(value.right, bindings, stack) };
    return value;
  };
  const substituteCondition = (condition: Condition, bindings: Map<string, ValueExpression>, stack: string[]): Condition => {
    if (condition.kind === 'value') return { ...condition, expression: substituteValue(condition.expression, bindings, stack) };
    if (condition.kind === 'valueCompare') return { ...condition, left: substituteValue(condition.left, bindings, stack), right: substituteValue(condition.right, bindings, stack) };
    return condition;
  };
  const expandNodes = (nodes: ProgramNode[], bindings = new Map<string, ValueExpression>(), stack: string[] = []): ProgramNode[] => nodes.flatMap(node => {
    if (node.op === 'procedureCall') {
      const routine = routines.get(node.routineId);
      if (!routine || routine.kind !== 'procedure' || stack.includes(routine.id) || stack.length >= 8) return [];
      const args = node.arguments.map(argument => substituteValue(argument, bindings, stack));
      const nested = new Map(routine.parameters.map((parameter, index) => [parameter.id, args[index] ?? defaultValue(parameter.type)]));
      return [{ op: 'wait', ms: 0, blockId: node.blockId } as ProgramNode, ...expandNodes(routine.body, nested, [...stack, routine.id]), { op: 'wait', ms: 0, blockId: node.blockId } as ProgramNode];
    }
    if (node.op === 'repeat') return [{ ...node, body: expandNodes(node.body, bindings, stack) }];
    if (node.op === 'parallel') return [{ ...node, branches: node.branches.map(branch => expandNodes(branch, bindings, stack)) }];
    if (node.op === 'if') return [{ ...node, condition: substituteCondition(node.condition, bindings, stack), consequent: expandNodes(node.consequent, bindings, stack), otherwise: expandNodes(node.otherwise, bindings, stack) }];
    if (node.op === 'messageReceive' || node.op === 'wifiMessageReceive') return [{ ...node, equal: expandNodes(node.equal, bindings, stack), different: expandNodes(node.different, bindings, stack), timeout: expandNodes(node.timeout, bindings, stack) }];
    if (node.op === 'variableSet') return [{ ...node, value: substituteValue(node.value, bindings, stack) }];
    if (node.op === 'variableChange') return [{ ...node, delta: substituteValue(node.delta, bindings, stack) }];
    if ((node.op === 'serial' || node.op === 'messageSend' || node.op === 'wifiMessageSend' || node.op === 'displayWrite') && node.expression) return [{ ...node, expression: substituteValue(node.expression, bindings, stack) }];
    return [node];
  });
  return { ...input, threads: input.threads.map(thread => ({ ...thread, nodes: expandNodes(thread.nodes) })) };
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
  if (condition.kind !== 'buttonPressed' && condition.kind !== 'displayButtonPressed' && condition.kind !== 'sensor') return;
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
  } else if (condition.kind === 'displayButtonPressed' && (device.kind !== 'display' || device.config.profile !== 'lcd1602keypad')) {
    diagnostics.push({
      severity: 'error',
      code: 'target-kind-mismatch',
      message: `${device.name} no tiene el teclado de cinco botones.`,
      deviceId: device.id,
      blockId,
    });
  }
}

export function valueExpressionType(expression: ValueExpression): VariableType {
  if (expression.kind === 'text' || expression.kind === 'join' || expression.kind === 'messageValue') return 'text';
  if (expression.kind === 'boolean' || expression.kind === 'buttonValue' || expression.kind === 'barrierValue' || expression.kind === 'displayButtonValue' || expression.kind === 'wifiValue') return 'boolean';
  if (expression.kind === 'variable' || expression.kind === 'componentValue') return expression.valueType;
  if (expression.kind === 'parameter' || expression.kind === 'functionCall') return expression.valueType;
  return 'number';
}

function visitValueExpression(expression: ValueExpression, visitor: (value: ValueExpression) => void) {
  visitor(expression);
  if (expression.kind === 'join') expression.parts.forEach(part => visitValueExpression(part, visitor));
  if (expression.kind === 'math') {
    visitValueExpression(expression.left, visitor);
    visitValueExpression(expression.right, visitor);
  }
  if (expression.kind === 'functionCall') expression.arguments.forEach(argument => visitValueExpression(argument, visitor));
}

export function validateProgramForScene(
  input: CompiledProgram | ProgramNode[],
  scene: SceneDefinition,
  profileId: BoardProfileId = 'wemos-d1-r32',
): CapiDiagnostic[] {
  const program = normalizeCompiledProgram(input, scene);
  const diagnostics: CapiDiagnostic[] = [];
  const deviceMap = new Map(scene.devices.map((device) => [device.id, device]));
  const variables = new Map((program.variables ?? []).map(variable => [variable.id, variable]));
  const timers = new Map((program.timers ?? []).map(timer => [timer.id, timer]));
  const routines = new Map((program.routines ?? []).map(routine => [routine.id, routine]));
  const variableNames = new Set<string>();
  for (const variable of program.variables ?? []) {
    const normalizedName = variable.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!variable.name.trim() || variable.name.length > 32 || variableNames.has(normalizedName)) diagnostics.push({ severity: 'error', code: 'variable-name', message: 'Cada variable necesita un nombre distinto de hasta 32 caracteres.' });
    variableNames.add(normalizedName);
  }
  const timerNames = new Set<string>();
  for (const timer of program.timers ?? []) {
    const normalizedName = timer.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!timer.name.trim() || timer.name.length > 32 || timerNames.has(normalizedName)) diagnostics.push({ severity: 'error', code: 'timer-name', message: 'Cada temporizador necesita un nombre distinto de hasta 32 caracteres.' });
    timerNames.add(normalizedName);
  }
  const routineNames = new Set<string>();
  for (const routine of program.routines ?? []) {
    const normalizedName = routine.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!routine.name.trim() || routine.name.length > 32 || routineNames.has(normalizedName)) diagnostics.push({ severity: 'error', code: 'routine-name', message: 'Cada tarea o función necesita un nombre distinto de hasta 32 caracteres.', blockId: routine.blockId });
    routineNames.add(normalizedName);
    const parameterNames = new Set<string>();
    for (const parameter of routine.parameters) {
      const name = parameter.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (!parameter.name.trim() || parameterNames.has(name)) diagnostics.push({ severity: 'error', code: 'routine-parameter-name', message: `${routine.name}: cada dato de entrada necesita un nombre distinto.`, blockId: routine.blockId });
      parameterNames.add(name);
    }
    if (routine.kind === 'function' && (!routine.returnValue || valueExpressionType(routine.returnValue) !== routine.returnType)) diagnostics.push({ severity: 'error', code: 'routine-return-type', message: `${routine.name}: el resultado no coincide con el tipo elegido.`, blockId: routine.blockId });
  }
  const routineDependencies = new Map<string, string[]>();
  for (const routine of program.routines ?? []) {
    const encoded = JSON.stringify({ body: routine.body, value: routine.returnValue });
    routineDependencies.set(routine.id, [...routines.keys()].filter(id => encoded.includes(`"routineId":"${id}"`)));
  }
  const visitRoutine = (id: string, path: string[]) => {
    if (path.includes(id)) { diagnostics.push({ severity: 'error', code: 'routine-cycle', message: 'Las tareas y funciones no pueden llamarse formando un círculo.', blockId: routines.get(id)?.blockId }); return; }
    if (path.length >= 8) { diagnostics.push({ severity: 'error', code: 'routine-depth', message: 'Hay demasiadas llamadas anidadas. Usá hasta 8 niveles.', blockId: routines.get(id)?.blockId }); return; }
    for (const dependency of routineDependencies.get(id) ?? []) visitRoutine(dependency, [...path, id]);
  };
  for (const id of routines.keys()) visitRoutine(id, []);
  const profile = boardProfile(profileId);
  const sceneValidation = validateScene(scene, profileId);
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
  try { compileTaskGraph(program); } catch (error) {
    diagnostics.push({ severity: 'error', code: 'parallel-limit', message: error instanceof Error ? error.message : 'Demasiados caminos paralelos.' });
  }
  const foreverVisualDevices = new Set<string>();
  const visualWaitBlocks = new Map<string, string>();
  visitProgram(program, (node) => {
    const expressions: ValueExpression[] = [];
    if (node.op === 'variableSet') expressions.push(node.value);
    if (node.op === 'variableChange') expressions.push(node.delta);
    if (node.op === 'procedureCall') expressions.push(...node.arguments);
    if ((node.op === 'serial' || node.op === 'messageSend' || node.op === 'wifiMessageSend' || node.op === 'displayWrite') && node.expression) expressions.push(node.expression);
    if (node.op === 'if' && node.condition.kind === 'value') expressions.push(node.condition.expression);
    if (node.op === 'if' && node.condition.kind === 'valueCompare') expressions.push(node.condition.left, node.condition.right);
    for (const expression of expressions) visitValueExpression(expression, value => {
      if (value.kind === 'variable') {
        const variable = variables.get(value.variableId);
        if (!variable) diagnostics.push({ severity: 'error', code: 'variable-missing', message: 'Elegí una variable que todavía exista.', blockId: node.blockId });
        else if (variable.type !== value.valueType) diagnostics.push({ severity: 'error', code: 'variable-type', message: `${variable.name} cambió de tipo; volvé a elegirla.`, blockId: node.blockId });
      }
      if ((value.kind === 'timerElapsed' || value.kind === 'timerRemaining') && !timers.has(value.timerId)) diagnostics.push({ severity: 'error', code: 'timer-missing', message: 'Elegí un temporizador que todavía exista.', blockId: node.blockId });
      if (value.kind === 'functionCall') {
        const routine = routines.get(value.routineId);
        if (!routine || routine.kind !== 'function') diagnostics.push({ severity: 'error', code: 'routine-missing', message: 'Elegí una función que todavía exista.', blockId: node.blockId });
        else if (routine.returnType !== value.valueType || routine.parameters.length !== value.arguments.length || routine.parameters.some((parameter, index) => valueExpressionType(value.arguments[index] ?? defaultValue(parameter.type)) !== parameter.type)) diagnostics.push({ severity: 'error', code: 'routine-arguments', message: `${routine.name}: revisá la cantidad y el tipo de sus datos de entrada.`, blockId: node.blockId });
      }
      if (value.kind === 'componentValue') {
        const device = deviceMap.get(value.deviceId);
        const capability = componentValueCapability(device, value.property);
        if (!capability) diagnostics.push({ severity: 'error', code: 'component-value-missing', message: 'Elegí un dato disponible en un componente de la escena.', blockId: node.blockId, deviceId: value.deviceId });
        else if (capability.type !== value.valueType || capability.source !== value.source) diagnostics.push({ severity: 'error', code: 'component-value-stale', message: `${device?.name ?? 'El componente'} cambió. Volvé a elegir el dato que querés consultar.`, blockId: node.blockId, deviceId: value.deviceId });
      }
      if (value.kind === 'sensorValue') {
        const device = deviceMap.get(value.deviceId);
        if (!device || (device.kind !== 'lightSensor' && device.kind !== 'potentiometer')) diagnostics.push({ severity: 'error', code: 'value-sensor-missing', message: 'Elegí un sensor numérico colocado en la escena.', blockId: node.blockId, deviceId: value.deviceId });
      }
      if (value.kind === 'ottoDistance') {
        const device = deviceMap.get(value.deviceId);
        if (device?.kind !== 'otto' || !['biped4-explorer', 'biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile)) diagnostics.push({ severity: 'error', code: 'otto-distance-missing', message: 'Elegí un Otto que tenga sensor de distancia.', blockId: node.blockId, deviceId: value.deviceId });
      }
      if (value.kind === 'buttonValue') {
        const device = deviceMap.get(value.deviceId);
        if (device?.kind !== 'button') diagnostics.push({ severity: 'error', code: 'value-button-missing', message: 'Elegí un botón colocado en la escena.', blockId: node.blockId, deviceId: value.deviceId });
      }
      if (value.kind === 'barrierValue') {
        const device = deviceMap.get(value.deviceId);
        if (device?.kind !== 'infraredBarrier') diagnostics.push({ severity: 'error', code: 'value-barrier-missing', message: 'Elegí una barrera infrarroja colocada en la escena.', blockId: node.blockId, deviceId: value.deviceId });
      }
      if (value.kind === 'displayButtonValue') {
        const device = deviceMap.get(value.deviceId);
        if (device?.kind !== 'display' || device.config.profile !== 'lcd1602keypad') diagnostics.push({ severity: 'error', code: 'value-button-missing', message: 'Elegí una pantalla que tenga botones.', blockId: node.blockId, deviceId: value.deviceId });
      }
      if (value.kind === 'messageValue') {
        const device = deviceMap.get(value.deviceId);
        if (device?.kind !== 'messages') diagnostics.push({ severity: 'error', code: 'value-message-missing', message: 'Elegí un componente Mensajes colocado en la escena.', blockId: node.blockId, deviceId: value.deviceId });
      }
      if (value.kind === 'math' && (valueExpressionType(value.left) !== 'number' || valueExpressionType(value.right) !== 'number')) diagnostics.push({ severity: 'error', code: 'value-math-type', message: 'Las cuentas necesitan números en ambos lados.', blockId: node.blockId });
    });
    if (node.op === 'variableSet') {
      const variable = variables.get(node.variableId);
      if (!variable) diagnostics.push({ severity: 'error', code: 'variable-missing', message: 'Elegí una variable que todavía exista.', blockId: node.blockId });
      else if (variable.type !== valueExpressionType(node.value)) diagnostics.push({ severity: 'error', code: 'variable-type', message: `${variable.name} necesita un valor de tipo ${variable.type === 'number' ? 'número' : variable.type === 'text' ? 'texto' : 'sí/no'}.`, blockId: node.blockId });
    }
    if (node.op === 'ottoSound') {
      const device = deviceMap.get(node.deviceId);
      if (device?.kind === 'otto' && device.config.profile === 'biped4') diagnostics.push({ severity: 'error', code: 'otto-capability-missing', message: `${device.name} no tiene buzzer en esta configuración.`, blockId: node.blockId, deviceId: node.deviceId });
    }
    if (node.op === 'ottoExpression') {
      const device = deviceMap.get(node.deviceId);
      if (device?.kind === 'otto' && !['biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile)) diagnostics.push({ severity: 'error', code: 'otto-capability-missing', message: `${device.name} no tiene boca LED en esta configuración.`, blockId: node.blockId, deviceId: node.deviceId });
    }
    if (node.op === 'ottoArms') {
      const device = deviceMap.get(node.deviceId);
      if (device?.kind === 'otto' && device.config.profile !== 'humanoid6-expressive') diagnostics.push({ severity: 'error', code: 'otto-capability-missing', message: `${device.name} no tiene brazos en esta configuración.`, blockId: node.blockId, deviceId: node.deviceId });
    }
    if (node.op === 'variableChange') {
      const variable = variables.get(node.variableId);
      if (!variable || variable.type !== 'number' || valueExpressionType(node.delta) !== 'number') diagnostics.push({ severity: 'error', code: 'variable-type', message: 'Cambiar una variable necesita una variable numérica y un número.', blockId: node.blockId });
    }
    if (node.op === 'timerStart' || node.op === 'timerRestart' || node.op === 'timerPause' || node.op === 'timerResume' || node.op === 'timerStop' || node.op === 'timerWait') {
      if (!timers.has(node.timerId)) diagnostics.push({ severity: 'error', code: 'timer-missing', message: 'Elegí un temporizador que todavía exista.', blockId: node.blockId });
      if (node.op === 'timerStart' && (!Number.isFinite(node.durationMs) || node.durationMs < 100 || node.durationMs > 86_400_000)) diagnostics.push({ severity: 'error', code: 'timer-duration', message: 'El temporizador debe durar entre 0,1 segundos y 24 horas.', blockId: node.blockId });
    }
    if (node.op === 'procedureCall') {
      const routine = routines.get(node.routineId);
      if (!routine || routine.kind !== 'procedure') diagnostics.push({ severity: 'error', code: 'routine-missing', message: 'Elegí una tarea que todavía exista.', blockId: node.blockId });
      else if (routine.parameters.length !== node.arguments.length || routine.parameters.some((parameter, index) => valueExpressionType(node.arguments[index] ?? defaultValue(parameter.type)) !== parameter.type)) diagnostics.push({ severity: 'error', code: 'routine-arguments', message: `${routine.name}: revisá la cantidad y el tipo de sus datos de entrada.`, blockId: node.blockId });
    }
    if (node.op === 'if' && node.condition.kind === 'value' && valueExpressionType(node.condition.expression) !== 'boolean') diagnostics.push({ severity: 'error', code: 'condition-type', message: 'La condición necesita un valor de tipo sí/no.', blockId: node.blockId });
    if (node.op === 'if' && node.condition.kind === 'valueCompare') {
      const leftType = valueExpressionType(node.condition.left), rightType = valueExpressionType(node.condition.right);
      if (leftType !== rightType || ((node.condition.operator !== 'EQ' && node.condition.operator !== 'NEQ') && leftType !== 'number')) diagnostics.push({ severity: 'error', code: 'condition-type', message: 'Compará datos del mismo tipo; menor y mayor se usan solamente con números.', blockId: node.blockId });
    }
    if (node.op === 'displayAnimateText' || node.op === 'displayArtwork' || node.op === 'matrixScroll') {
      if (!Number.isInteger(node.repeatCount) || node.repeatCount < 0 || node.repeatCount > 100)
        diagnostics.push({ severity: 'error', code: 'animation-repeat-range', message: 'La animación debe repetirse entre 1 y 100 veces, o quedar sin parar.', blockId: node.blockId, deviceId: node.deviceId });
      if (node.repeatCount === 0 && !(node.op === 'displayArtwork' && node.effect === 'still')) foreverVisualDevices.add(node.deviceId);
    }
    if (node.op === 'visualWait') visualWaitBlocks.set(node.deviceId, node.blockId);
    if (node.op === 'messageSend' || node.op === 'messageReceive') {
      const text = node.op === 'messageSend' ? node.text : node.expected;
      const dynamic = node.op === 'messageSend' && Boolean(node.expression);
      const bytes = new TextEncoder().encode(text).length;
      if (!dynamic && (!bytes || bytes > MAX_MESSAGE_BYTES)) diagnostics.push({ severity: 'error', code: 'message-text-limit', message: `Un mensaje debe ocupar entre 1 y ${MAX_MESSAGE_BYTES} bytes.`, blockId: node.blockId, deviceId: node.deviceId });
      const device = deviceMap.get(node.deviceId);
      if (device?.kind === 'messages') {
        const incompatible = node.op === 'messageSend' ? device.config.mode === 'receive' : device.config.mode === 'send';
        if (incompatible) diagnostics.push({ severity: 'error', code: 'message-mode-mismatch', message: `${device.name} no está configurado para ${node.op === 'messageSend' ? 'enviar' : 'recibir'}.`, blockId: node.blockId, deviceId: node.deviceId });
        if (!dynamic && !device.config.messages.includes(text)) diagnostics.push({ severity: 'error', code: 'message-not-configured', message: `“${text}” ya no está en la lista de ${device.name}.`, blockId: node.blockId, deviceId: node.deviceId });
      }
      if (node.op === 'messageReceive' && (!Number.isFinite(node.timeoutMs) || node.timeoutMs < 100 || node.timeoutMs > 300_000)) diagnostics.push({ severity: 'error', code: 'message-timeout', message: 'La espera debe durar entre 0,1 y 300 segundos.', blockId: node.blockId, deviceId: node.deviceId });
    }
    if (node.op === 'wifiMessageSend' || node.op === 'wifiMessageReceive') {
      const device = deviceMap.get(node.deviceId);
      const text = node.op === 'wifiMessageSend' ? node.text : node.expected;
      const dynamic = node.op === 'wifiMessageSend' && Boolean(node.expression);
      if (device?.kind !== 'wifiNode') diagnostics.push({ severity: 'error', code: 'wifi-message-device', message: 'Elegí una conexión Wi-Fi colocada en la escena.', blockId: node.blockId, deviceId: node.deviceId });
      else {
        if (!dynamic && (!device.config.messages.includes(text) || new TextEncoder().encode(text).length > 120)) diagnostics.push({ severity: 'error', code: 'wifi-message-value', message: `Elegí un mensaje configurado en ${device.name}.`, blockId: node.blockId, deviceId: node.deviceId });
        const peer = node.op === 'wifiMessageSend' ? node.target : node.sender;
        if (peer !== '*' && !device.config.peers.includes(peer)) diagnostics.push({ severity: 'error', code: 'wifi-message-peer', message: `Elegí una placa conocida por ${device.name}.`, blockId: node.blockId, deviceId: node.deviceId });
      }
      if (node.op === 'wifiMessageReceive' && (!Number.isFinite(node.timeoutMs) || node.timeoutMs < 100 || node.timeoutMs > 300_000)) diagnostics.push({ severity: 'error', code: 'wifi-message-timeout', message: 'La espera Wi-Fi debe durar entre 0,1 y 300 segundos.', blockId: node.blockId, deviceId: node.deviceId });
    }
    if (
      node.op === 'displayWrite' ||
      node.op === 'displayClear' ||
      node.op === 'displayAnimateText'
    ) {
      const device = deviceMap.get(node.deviceId);
      const area = device?.kind === 'display' && validDisplayConfig(device.config) ? displayTargets(device.config).find(area => area.id === node.areaId) : undefined;
      if (device?.kind === 'display' && !area) diagnostics.push({ severity: 'error', code: 'display-area-missing', message: `${device.name}: elegí una zona de texto existente. La anterior fue retirada o cambió el modelo.`, blockId: node.blockId, deviceId: node.deviceId });
      if (node.op === 'displayWrite' || node.op === 'displayAnimateText') {
        const dynamic = node.op === 'displayWrite' && Boolean(node.expression);
        if (!dynamic && node.text.length > MAX_DISPLAY_TEXT) diagnostics.push({ severity: 'error', code: 'display-text-limit', message: `Un mensaje admite hasta ${MAX_DISPLAY_TEXT} caracteres.`, blockId: node.blockId });
        if (area) {
          const layout = layoutDisplayText(node.text, area);
          if (layout.converted) diagnostics.push({ severity: 'warning', code: 'display-text-converted', message: 'Pantalla: se quitan tildes y los símbolos no compatibles se muestran como ?. La vista previa usa el mismo texto que la placa.', blockId: node.blockId });
          if (layout.clipped) diagnostics.push({ severity: 'warning', code: 'display-text-clipped', message: 'El mensaje no cabe completo en su destino. Se muestra solamente la parte que entra.', blockId: node.blockId });
        }
      }
    }
    if (node.op === 'displayArtwork') {
      const device = deviceMap.get(node.deviceId);
      if (device?.kind === 'display') {
        if (!displayProfiles[device.config.profile].graphic)
          diagnostics.push({ severity: 'error', code: 'display-artwork-profile', message: `${device.name}: los dibujos necesitan una pantalla OLED o TFT.`, blockId: node.blockId, deviceId: node.deviceId });
        else if (!displayArtworkById(displayArtworks(device.config), node.artworkId))
          diagnostics.push({ severity: 'error', code: 'display-artwork-missing', message: `${device.name}: elegí un dibujo que todavía exista.`, blockId: node.blockId, deviceId: node.deviceId });
      }
    }
    if (node.op === 'matrixClear' || node.op === 'matrixPixel' || node.op === 'matrixPattern' || node.op === 'matrixScroll') {
      const device = deviceMap.get(node.deviceId);
      if (device?.kind === 'ledMatrix' && !validMatrixConfig(device.config)) diagnostics.push({ severity: 'error', code: 'matrix-config-invalid', message: `${device.name}: la configuración de la matriz está dañada.`, blockId: node.blockId, deviceId: node.deviceId });
      if (node.op === 'matrixPixel' && (!Number.isInteger(node.x) || node.x < 0 || node.x > 31 || !Number.isInteger(node.y) || node.y < 0 || node.y > 7)) diagnostics.push({ severity: 'error', code: 'matrix-pixel-range', message: 'El punto debe estar entre x 0–31 e y 0–7.', blockId: node.blockId, deviceId: node.deviceId });
      if (node.op === 'matrixPattern' && device?.kind === 'ledMatrix' && !device.config.patterns.some(pattern => pattern.id === node.patternId)) diagnostics.push({ severity: 'error', code: 'matrix-pattern-missing', message: `${device.name}: elegí un dibujo que todavía exista.`, blockId: node.blockId, deviceId: node.deviceId });
      if (node.op === 'matrixScroll') {
        if (!node.text.trim() || node.text.length > MAX_MATRIX_TEXT) diagnostics.push({ severity: 'error', code: 'matrix-text-limit', message: `El texto debe tener entre 1 y ${MAX_MATRIX_TEXT} caracteres.`, blockId: node.blockId, deviceId: node.deviceId });
        if (!Number.isFinite(node.speedMs) || node.speedMs < 40 || node.speedMs > 1000) diagnostics.push({ severity: 'error', code: 'matrix-speed-range', message: 'La velocidad debe estar entre 40 y 1000 ms por paso.', blockId: node.blockId, deviceId: node.deviceId });
        if (normalizeMatrixText(node.text) !== node.text.toUpperCase()) diagnostics.push({ severity: 'warning', code: 'matrix-text-converted', message: 'La matriz convierte el texto a mayúsculas sin tildes y reemplaza símbolos no disponibles.', blockId: node.blockId, deviceId: node.deviceId });
      }
    }
    if (node.op === 'parallel' && (node.branches.length < 2 || node.branches.length > 16)) diagnostics.push({ severity: 'error', code: 'parallel-branches', message: '«Al mismo tiempo» necesita entre 2 y 16 caminos.', blockId: node.blockId });
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
      const definition = profile.pins.find((pin) => pin.gpio === node.pin);
      if (!definition?.capabilities.includes('pwmOutput')) {
        diagnostics.push({
          severity: 'error',
          code: 'raw-pin-not-output',
          message: `GPIO ${node.pin} no es una salida segura del perfil ${profile.shortName}.`,
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
  for (const deviceId of foreverVisualDevices) {
    const blockId = visualWaitBlocks.get(deviceId);
    if (blockId) diagnostics.push({ severity: 'warning', code: 'wait-for-forever-animation', message: 'Esta pantalla tiene una animación “sin parar”: la espera sólo finalizará si otro camino la reemplaza, escribe o borra.', blockId, deviceId });
  }
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

export type FlatInstruction =
  | Exclude<ProgramNode, { op: 'repeat' } | { op: 'if' } | { op: 'parallel' } | { op: 'messageReceive' } | { op: 'wifiMessageReceive' }>
  | { op: 'messageReceiveWait'; deviceId: string; expected: string; timeoutMs: number; equalTarget: number; differentTarget: number; timeoutTarget: number; blockId: string }
  | { op: 'wifiMessageReceiveWait'; deviceId: string; expected: string; sender: string; timeoutMs: number; equalTarget: number; differentTarget: number; timeoutTarget: number; blockId: string }
  | { op: 'fork' | 'join'; children: number[]; blockId: string }
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

function flattenProgram(nodes: ProgramNode[], branchTask: (nodes: ProgramNode[], blockId: string, branch: number) => number) {
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
      } else if (node.op === 'parallel') {
        const children = node.branches.map((branch, index) => branchTask(branch, node.blockId, index));
        output.push({ op: 'fork', children, blockId: node.blockId }, { op: 'join', children, blockId: node.blockId });
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
      } else if (node.op === 'messageReceive') {
        const receiveIndex = output.length;
        output.push({ op: 'messageReceiveWait', deviceId: node.deviceId, expected: node.expected, timeoutMs: node.timeoutMs, equalTarget: -1, differentTarget: -1, timeoutTarget: -1, blockId: node.blockId });
        const equalTarget = output.length;
        visit(node.equal);
        const equalJump = output.length;
        output.push({ op: 'jump', target: -1, blockId: node.blockId });
        const differentTarget = output.length;
        visit(node.different);
        const differentJump = output.length;
        output.push({ op: 'jump', target: -1, blockId: node.blockId });
        const timeoutTarget = output.length;
        visit(node.timeout);
        const end = output.length;
        Object.assign(output[receiveIndex], { equalTarget, differentTarget, timeoutTarget });
        (output[equalJump] as Extract<FlatInstruction, { op: 'jump' }>).target = end;
        (output[differentJump] as Extract<FlatInstruction, { op: 'jump' }>).target = end;
      } else if (node.op === 'wifiMessageReceive') {
        const receiveIndex = output.length;
        output.push({ op: 'wifiMessageReceiveWait', deviceId: node.deviceId, expected: node.expected, sender: node.sender, timeoutMs: node.timeoutMs, equalTarget: -1, differentTarget: -1, timeoutTarget: -1, blockId: node.blockId });
        const equalTarget = output.length; visit(node.equal); const equalJump = output.length; output.push({ op: 'jump', target: -1, blockId: node.blockId });
        const differentTarget = output.length; visit(node.different); const differentJump = output.length; output.push({ op: 'jump', target: -1, blockId: node.blockId });
        const timeoutTarget = output.length; visit(node.timeout); const end = output.length;
        Object.assign(output[receiveIndex], { equalTarget, differentTarget, timeoutTarget });
        (output[equalJump] as Extract<FlatInstruction, { op: 'jump' }>).target = end;
        (output[differentJump] as Extract<FlatInstruction, { op: 'jump' }>).target = end;
      } else {
        output.push(node);
      }
    }
  };
  visit(nodes);
  output.push({ op: 'halt', blockId: 'program-end' });
  return { output, loopSlots: Math.max(1, loopSlot) };
}

export interface ExecutableTask {
  initialLaunch?: { blockId: string; count: number };
  id: string;
  startBlockId: string;
  label: string;
  initial: boolean;
  output: FlatInstruction[];
  loopSlots: number;
}

/** One bounded task graph is shared by simulation and the Arduino scheduler. */
export function compileTaskGraph(program: CompiledProgram): ExecutableTask[] {
  program = expandProgramRoutines(program);
  const tasks: ExecutableTask[] = [];
  const reservedIds = new Set(program.threads.map(thread => thread.id));
  const add = (nodes: ProgramNode[], blockId: string, label: string, initial: boolean, depth: number): number => {
    if (tasks.length >= 32 || depth > 4) throw new Error('Usá hasta 32 caminos y 4 niveles de «Al mismo tiempo».');
    const index = tasks.length;
    let id = `parallel-task-${index}`;
    while (reservedIds.has(id)) id += '-branch';
    reservedIds.add(id);
    tasks.push({ id, startBlockId: blockId, label, initial, output: [], loopSlots: 1 });
    const flat = flattenProgram(nodes, (branch, source, branchIndex) => add(branch, source, `${label} · camino ${branchIndex + 1}`, false, depth + 1));
    Object.assign(tasks[index], flat);
    return index;
  };
  program.threads.forEach((thread, index) => {
    // A sole root fork has no continuation to join. Avoid adding a scheduler
    // slot: migrated multi-start projects keep their instruction budgets/order.
    const only = thread.nodes.length === 1 ? thread.nodes[0] : null;
    if (only?.op === 'parallel') {
      const firstTask = tasks.length;
      only.branches.forEach((branch, branchIndex) => add(branch, only.blockId, `Camino ${branchIndex + 1}`, true, 1));
      if (tasks[firstTask]) tasks[firstTask].initialLaunch = { blockId: only.blockId, count: only.branches.length };
    } else {
      const taskIndex = add(thread.nodes, thread.startBlockId, index ? `Programa ${index + 1}` : 'Comenzar', true, 0);
      tasks[taskIndex].id = thread.id;
    }
  });
  return tasks;
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
  framework: FirmwareFramework;
  usesWifi: boolean;
  scene: SceneDefinition;
  symbols: Map<string, string>;
  threadIndex: number;
  variables: Map<string, ProgramVariable>;
  timers: Map<string, number>;
}

function timerIndex(context: GeneratorContext, timerId: string) {
  return context.timers.get(timerId) ?? 0;
}

function deviceSymbol(context: GeneratorContext, deviceId: string) {
  return context.symbols.get(deviceId) ?? cppIdentifier(deviceId);
}

function pinConstant(context: GeneratorContext, deviceId: string) {
  return `PIN_${deviceSymbol(context, deviceId)}`;
}

function variableSymbol(variableId: string) {
  return `VAR_${cppIdentifier(variableId)}`;
}

function componentStateSymbol(deviceId: string, property: string) {
  return `STATE_${cppIdentifier(deviceId)}_${cppIdentifier(property)}`;
}

function valueToCpp(expression: ValueExpression, context: GeneratorContext): string {
  switch (expression.kind) {
    case 'number': return String(normalizeCounterValue(expression.value));
    case 'text': return `capiText(${cppString(expression.value)})`;
    case 'boolean': return expression.value ? 'true' : 'false';
    case 'counterValue': return 'counterValue';
    case 'timerElapsed': return `capiTimerElapsed(${timerIndex(context, expression.timerId)})`;
    case 'timerRemaining': return `capiTimerRemaining(${timerIndex(context, expression.timerId)})`;
    case 'parameter': return expression.valueType === 'text' ? 'capiText("")' : expression.valueType === 'boolean' ? 'false' : '0';
    case 'functionCall': return expression.valueType === 'text' ? 'capiText("")' : expression.valueType === 'boolean' ? 'false' : '0';
    case 'componentValue': {
      const device = context.scene.devices.find(item => item.id === expression.deviceId);
      const capability = componentValueCapability(device, expression.property);
      if (!device || !capability) return expression.valueType === 'text' ? 'capiText("")' : expression.valueType === 'boolean' ? 'false' : '0';
      if (capability.source === 'ordered') {
        const symbol = componentStateSymbol(device.id, capability.key);
        return capability.type === 'text' ? `capiText(${symbol})` : symbol;
      }
      if (device.kind === 'lightSensor' || device.kind === 'potentiometer') return `${context.framework === 'esp-idf' ? 'capiAnalogRead' : 'analogRead'}(${pinConstant(context, device.id)})`;
      if (device.kind === 'button') return `${context.framework === 'esp-idf' ? 'capiDigitalRead' : 'digitalRead'}(${pinConstant(context, device.id)}) == ${context.framework === 'esp-idf' ? '0' : 'LOW'}`;
      if (device.kind === 'infraredBarrier') {
        const level = context.framework === 'esp-idf' ? (device.config.interruptedLevel === 'HIGH' ? '1' : '0') : device.config.interruptedLevel;
        return `${context.framework === 'esp-idf' ? 'capiDigitalRead' : 'digitalRead'}(${pinConstant(context, device.id)}) == ${level}`;
      }
      if (device.kind === 'otto' && capability.key === 'distance') return `DEV_${deviceSymbol(context, device.id)}.distanceCm`;
      if (device.kind === 'wifiNode' && capability.key === 'connected') return 'capiWifiConnected()';
      if (device.kind === 'wifiNode' && capability.key === 'status') return 'capiText(capiWifiConnected() ? "conectado" : "desconectado")';
      if (device.kind === 'wifiNode' && capability.key === 'lastWifiMessage') return 'capiText(CAPI_WIFI_LAST_MESSAGE)';
      if (device.kind === 'wifiNode' && capability.key === 'lastWifiSender') return 'capiText(CAPI_WIFI_LAST_SENDER)';
      if (device.kind === 'messages') return `capiText(MESSAGE_LAST_${deviceSymbol(context, device.id)})`;
      return expression.valueType === 'text' ? 'capiText("")' : expression.valueType === 'boolean' ? 'false' : '0';
    }
    case 'sensorValue': return `${context.framework === 'esp-idf' ? 'capiAnalogRead' : 'analogRead'}(${pinConstant(context, expression.deviceId)})`;
    case 'ottoDistance': return `DEV_${deviceSymbol(context, expression.deviceId)}.distanceCm`;
    case 'buttonValue': return `${context.framework === 'esp-idf' ? 'capiDigitalRead' : 'digitalRead'}(${pinConstant(context, expression.deviceId)}) == ${context.framework === 'esp-idf' ? '0' : 'LOW'}`;
    case 'barrierValue': {
      const device = context.scene.devices.find(item => item.id === expression.deviceId && item.kind === 'infraredBarrier');
      const interruptedLevel = device?.kind === 'infraredBarrier' ? device.config.interruptedLevel : 'LOW';
      const level = context.framework === 'esp-idf' ? (interruptedLevel === 'HIGH' ? '1' : '0') : interruptedLevel;
      const interrupted = `${context.framework === 'esp-idf' ? 'capiDigitalRead' : 'digitalRead'}(${pinConstant(context, expression.deviceId)}) == ${level}`;
      return expression.expected === 'CLEAR' ? `!(${interrupted})` : interrupted;
    }
    case 'displayButtonValue': {
      const buttons = { RIGHT: 0, UP: 1, DOWN: 2, LEFT: 3, SELECT: 4 } as const;
      return `capiDisplayButtonPressed(${buttons[expression.button]})`;
    }
    case 'messageValue': return `capiText(MESSAGE_LAST_${deviceSymbol(context, expression.deviceId)})`;
    case 'wifiValue': return 'capiWifiConnected()';
    case 'variable': {
      const symbol = variableSymbol(expression.variableId);
      return context.variables.get(expression.variableId)?.type === 'text' ? `capiText(${symbol})` : symbol;
    }
    case 'join': {
      const parts = expression.parts.length ? expression.parts : [{ kind: 'text', value: '' } as ValueExpression];
      return parts.map(part => valueAsTextToCpp(part, context)).reduce((left, right) => `capiJoin(${left}, ${right})`);
    }
    case 'math': {
      const left = valueToCpp(expression.left, context), right = valueToCpp(expression.right, context);
      if (expression.operator === 'DIVIDE') return `capiSafeDivide(${left}, ${right})`;
      const operator = { ADD: '+', SUBTRACT: '-', MULTIPLY: '*' }[expression.operator];
      return `(${left} ${operator} ${right})`;
    }
  }
}

function valueAsTextToCpp(expression: ValueExpression, context: GeneratorContext) {
  const value = valueToCpp(expression, context);
  return valueExpressionType(expression) === 'text' ? value : `capiText(${value})`;
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
  if (condition.kind === 'wifiConnected') return 'capiWifiConnected()';
  if (condition.kind === 'buttonPressed')
    return `${context.framework === 'esp-idf' ? 'capiDigitalRead' : 'digitalRead'}(${pinConstant(context, condition.deviceId)}) == ${context.framework === 'esp-idf' ? '0' : 'LOW'}`;
  if (condition.kind === 'displayButtonPressed') {
    const buttons = { RIGHT: 0, UP: 1, DOWN: 2, LEFT: 3, SELECT: 4 } as const;
    return `capiDisplayButtonPressed(${buttons[condition.button]})`;
  }
  if (condition.kind === 'sensor') {
    return `${context.framework === 'esp-idf' ? 'capiAnalogRead' : 'analogRead'}(${pinConstant(context, condition.deviceId)}) ${operators[condition.operator]} ${Math.max(0, Math.min(4095, Math.round(condition.value)))}`;
  }
  if (condition.kind === 'boolean') return condition.value ? 'true' : 'false';
  if (condition.kind === 'value') return valueToCpp(condition.expression, context);
  if (condition.kind === 'valueCompare') {
    const type = valueExpressionType(condition.left);
    if (type === 'text') {
      const comparison = `strcmp(${valueAsTextToCpp(condition.left, context)}.data, ${valueAsTextToCpp(condition.right, context)}.data)`;
      return condition.operator === 'NEQ' ? `${comparison} != 0` : `${comparison} == 0`;
    }
    return `${valueToCpp(condition.left, context)} ${operators[condition.operator]} ${valueToCpp(condition.right, context)}`;
  }
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
  const native = context.framework === 'esp-idf';
  const pwmWrite = native ? 'capiPwmWrite' : 'ledcWrite';
  const toneWrite = native ? 'capiTone' : 'ledcWriteTone';
  const logical = 'deviceId' in instruction && dashboardDeviceIds(context.scene).has(instruction.deviceId);
  switch (instruction.op) {
    case 'fork':
      return `${comment}\n${instruction.children.map(child => `        pc_T${child} = 0; active_T${child} = true; waiting_T${child} = false;\n        for (auto &value : loopCounters_T${child}) value = -1;\n${context.usesWifi ? `        wifiAttemptActive_T${child} = false;` : ''}`).join('\n')}\n        ${pc} = ${nextPc};\n        return;`;
    case 'join':
      return `${comment}\n        if (${instruction.children.map(child => `active_T${child}`).join(' || ') || 'false'}) return;\n        ${pc} = ${nextPc};\n        break;`;
    case 'traffic':
      return `${comment}\n        ${logical ? '// Objeto lógico del tablero: sin salida GPIO.' : `setTraffic(DEV_${deviceSymbol(context, instruction.deviceId)}, TrafficColor::${instruction.color});`}\n        capiAssignText(${componentStateSymbol(instruction.deviceId, 'color')}, ${cppString(instruction.color)});\n        ${pc} = ${nextPc};\n        break;`;
    case 'led': {
      const duty = Math.round(
        (Math.max(0, Math.min(100, instruction.brightness)) / 100) * 255,
      );
      return `${comment}\n        ${logical ? '// Objeto lógico del tablero: sin salida GPIO.' : `${pwmWrite}(${pinConstant(context, instruction.deviceId)}, ${duty});`}\n        ${componentStateSymbol(instruction.deviceId, 'brightness')} = ${Math.max(0, Math.min(100, Math.round(instruction.brightness)))};\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'pin':
      if (native) return `${comment}\n        capiOutput(${instruction.pin});\n        capiDigitalWrite(${instruction.pin}, ${instruction.value ? 1 : 0});\n        ${pc} = ${nextPc};\n        break;`;
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
      return `${comment}\n        ${logical ? '// Objeto lógico del tablero: sin salida GPIO.' : `driveRobot(DEV_${deviceSymbol(context, instruction.deviceId)}, ${motorPairs[instruction.action]});`}\n        capiAssignText(${componentStateSymbol(instruction.deviceId, 'motion')}, ${cppString(instruction.action)});\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'otto': {
      const device = `DEV_${deviceSymbol(context, instruction.deviceId)}`;
      if (instruction.action === 'HOME')
        return `${comment}\n        ${device}.owner = -1; ottoHome(${device});\n        capiAssignText(${componentStateSymbol(instruction.deviceId, 'motion')}, "HOME");\n        ${waiting} = false; ${pc} = ${nextPc};\n        break;`;
      const action = { WALK_FORWARD: 0, WALK_BACKWARD: 1, TURN_LEFT: 2, TURN_RIGHT: 3, DANCE: 4, JUMP: 5, SWING: 6, TIPTOE: 7, JITTER: 8, MOONWALK_LEFT: 9, MOONWALK_RIGHT: 10, BEND_LEFT: 11, BEND_RIGHT: 12, SHAKE_LEFT: 13, SHAKE_RIGHT: 14, FLAP_FORWARD: 15, FLAP_BACKWARD: 16 }[instruction.action];
      const stepMs = 480 - Math.round(Math.max(0, Math.min(100, instruction.speed)) * 3);
      const duration = stepMs * 4 * Math.max(1, Math.min(20, Math.round(instruction.repetitions)));
      return `${comment}\n        if (!${waiting}) { ${device}.owner = ${context.threadIndex}; capiAssignText(${componentStateSymbol(instruction.deviceId, 'motion')}, ${cppString(instruction.action)}); ${waitStarted} = now; ${waiting} = true; }\n        if (${device}.owner != ${context.threadIndex}) { ${waiting} = false; ${pc} = ${nextPc}; break; }\n        ottoMove(${device}, ${action}, (uint8_t)(((uint32_t)(now - ${waitStarted}) / ${stepMs}U) % 4U));\n        if ((uint32_t)(now - ${waitStarted}) < ${duration}U) return;\n        ${device}.owner = -1; ottoHome(${device}); capiAssignText(${componentStateSymbol(instruction.deviceId, 'motion')}, "HOME"); ${waiting} = false; ${pc} = ${nextPc};\n        break;`;
    }
    case 'ottoSound': {
      const sound = { HAPPY: 0, SAD: 1, SURPRISE: 2, CONFUSED: 3, SLEEPING: 4, BUTTON: 5, MODE: 6, FART: 7 }[instruction.sound];
      return `${comment}\n        ottoStartSound(DEV_${deviceSymbol(context, instruction.deviceId)}, ${sound}, now);\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'ottoExpression': {
      const expression = { SMILE: 0, SAD: 1, ANGRY: 2, SURPRISED: 3, SLEEPY: 4, LOVE: 5, CLEAR: 6 }[instruction.expression];
      return `${comment}\n        ottoExpression(DEV_${deviceSymbol(context, instruction.deviceId)}, ${expression});\n        capiAssignText(${componentStateSymbol(instruction.deviceId, 'expression')}, ${cppString(instruction.expression)});\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'ottoArms': {
      const pose = { DOWN: 0, UP: 1, LEFT_UP: 2, RIGHT_UP: 3, OPEN: 4 }[instruction.pose];
      return `${comment}\n        ottoArms(DEV_${deviceSymbol(context, instruction.deviceId)}, ${pose});\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'motor': {
      const power = Math.max(0, Math.min(100, Math.round(instruction.power)));
      const signedPower =
        instruction.direction === 'BACKWARD'
          ? -power
          : instruction.direction === 'STOP'
            ? 0
            : power;
      return `${comment}\n        ${logical ? '// Objeto lógico del tablero: sin salida GPIO.' : `driveMotor(DEV_${deviceSymbol(context, instruction.deviceId)}, ${signedPower});`}\n        ${componentStateSymbol(instruction.deviceId, 'power')} = ${signedPower};\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'servo':
      return `${comment}\n        ${logical ? '// Objeto lógico del tablero: sin salida GPIO.' : `setServoAngle(${pinConstant(context, instruction.deviceId)}, ${Math.max(0, Math.min(180, Math.round(instruction.angle)))});`}\n        ${componentStateSymbol(instruction.deviceId, 'angle')} = ${Math.max(0, Math.min(180, Math.round(instruction.angle)))};\n        ${pc} = ${nextPc};\n        break;`;
    case 'buzzer': {
      const pin = pinConstant(context, instruction.deviceId);
      const stop = `BUZZER_STOP_${deviceSymbol(context, instruction.deviceId)}`;
      const start =
        instruction.kind === 'ACTIVE'
          ? `${pwmWrite}(${pin}, 255);`
          : `${toneWrite}(${pin}, ${Math.max(20, Math.round(instruction.frequency))});`;
      return `${comment}\n        ${start}\n        ${stop} = now + ${Math.max(10, Math.round(instruction.durationMs))}U;\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'tone': {
      const pin = pinConstant(context, instruction.deviceId);
      const stop = `BUZZER_STOP_${deviceSymbol(context, instruction.deviceId)}`;
      return `${comment}\n        ${toneWrite}(${pin}, ${Math.max(20, Math.round(instruction.frequency))});\n        ${stop} = now + ${Math.max(10, Math.round(instruction.durationMs))}U;\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'wifi':
      if (native) return `${comment}\n        if (!wifiAttemptActive_${suffix}) {\n          capiWifiBegin();\n          wifiAttemptStarted_${suffix} = now;\n          wifiAttemptActive_${suffix} = true;\n          return;\n        }\n        if (capiWifiConnected() || (uint32_t)(now - wifiAttemptStarted_${suffix}) >= ${Math.max(1000, Math.round(instruction.timeoutMs))}U) {\n          wifiAttemptActive_${suffix} = false;\n          ${pc} = ${nextPc};\n          break;\n        }\n        return;`;
      return `${comment}\n        if (!wifiAttemptActive_${suffix}) {\n          WiFi.persistent(false);\n          ${context.scene.devices.some(device => device.kind === 'wifiNode' && device.config.role === 'create') ? 'WiFi.mode(WIFI_AP); WiFi.softAP(WIFI_SSID, WIFI_PASSWORD);' : 'WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);'}\n          wifiAttemptStarted_${suffix} = now;\n          wifiAttemptActive_${suffix} = true;\n          return;\n        }\n        if (capiWifiConnected() || (uint32_t)(now - wifiAttemptStarted_${suffix}) >= ${Math.max(1000, Math.round(instruction.timeoutMs))}U) {\n          wifiAttemptActive_${suffix} = false;\n          ${pc} = ${nextPc};\n          break;\n        }\n        return;`;
    case 'counterSet':
      return `${comment}\n        counterValue = ${normalizeCounterValue(instruction.value)};\n        ${pc} = ${nextPc};\n        break;`;
    case 'counterChange':
      return `${comment}\n        counterValue = addCounter(counterValue, ${normalizeCounterValue(instruction.delta)});\n        ${pc} = ${nextPc};\n        break;`;
    case 'timerStart':
      return `${comment}\n        capiTimerStart(${timerIndex(context, instruction.timerId)}, ${Math.max(100, Math.round(instruction.durationMs))}U, ${instruction.repeat ? 'true' : 'false'}, now);\n        ${pc} = ${nextPc};\n        break;`;
    case 'timerRestart':
      return `${comment}\n        capiTimerRestart(${timerIndex(context, instruction.timerId)}, now);\n        ${pc} = ${nextPc};\n        break;`;
    case 'timerPause':
      return `${comment}\n        capiTimerPause(${timerIndex(context, instruction.timerId)});\n        ${pc} = ${nextPc};\n        break;`;
    case 'timerResume':
      return `${comment}\n        capiTimerResume(${timerIndex(context, instruction.timerId)}, now);\n        ${pc} = ${nextPc};\n        break;`;
    case 'timerStop':
      return `${comment}\n        capiTimerStop(${timerIndex(context, instruction.timerId)});\n        ${pc} = ${nextPc};\n        break;`;
    case 'timerWait':
      return `${comment}\n        if (!capiTimerConsume(${timerIndex(context, instruction.timerId)})) return;\n        ${pc} = ${nextPc};\n        break;`;
    case 'variableSet': {
      const variable = context.variables.get(instruction.variableId);
      if (!variable) return `${comment}\n        ${pc} = ${nextPc};\n        break;`;
      const symbol = variableSymbol(variable.id);
      const assignment = variable.type === 'text'
        ? `capiAssignText(${symbol}, ${valueAsTextToCpp(instruction.value, context)}.data);`
        : `${symbol} = ${valueToCpp(instruction.value, context)};`;
      return `${comment}\n        ${assignment}\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'variableChange': {
      const variable = context.variables.get(instruction.variableId);
      if (!variable) return `${comment}\n        ${pc} = ${nextPc};\n        break;`;
      const symbol = variableSymbol(variable.id);
      return `${comment}\n        ${symbol} = addCounter(${symbol}, ${valueToCpp(instruction.delta, context)});\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'serial':
      if (native) return `${comment}\n        if (!capiPrintln(${instruction.expression ? `${valueAsTextToCpp(instruction.expression, context)}.data` : cppString(instruction.text)})) return; // bounded Serial backpressure, other paths continue\n        ${pc} = ${nextPc};\n        break;`;
      return `${comment}\n        Serial.println(${instruction.expression ? `${valueAsTextToCpp(instruction.expression, context)}.data` : cppString(instruction.text)});\n        ${pc} = ${nextPc};\n        break;`;
    case 'messageSend':
      return `${comment}\n        if (!capiMessageSend(DEV_${deviceSymbol(context, instruction.deviceId)}, ${instruction.expression ? `${valueAsTextToCpp(instruction.expression, context)}.data` : cppString(instruction.text)})) return;\n        ${pc} = ${nextPc};\n        break;`;
    case 'messageReceiveWait':
      return `${comment}\n        if (!${waiting}) { ${waitStarted} = now; ${waiting} = true; }\n        { char received[121] = {}; const int result = capiMessagePoll(DEV_${deviceSymbol(context, instruction.deviceId)}, received);\n          if (result == 1) { capiAssignText(MESSAGE_LAST_${deviceSymbol(context, instruction.deviceId)}, received); ${waiting} = false; ${pc} = strcmp(received, ${cppString(instruction.expected)}) == 0 ? ${instruction.equalTarget} : ${instruction.differentTarget}; break; }\n          if ((uint32_t)(now - ${waitStarted}) >= ${Math.max(100, Math.round(instruction.timeoutMs))}U) { ${waiting} = false; ${pc} = ${instruction.timeoutTarget}; break; }\n        }\n        return;`;
    case 'wifiMessageSend':
      return `${comment}\n        if (!capiWifiMessageSend(${cppString(instruction.target)}, ${instruction.expression ? `${valueAsTextToCpp(instruction.expression, context)}.data` : cppString(instruction.text)})) return;\n        ${pc} = ${nextPc};\n        break;`;
    case 'wifiMessageReceiveWait':
      return `${comment}\n        if (!${waiting}) { ${waitStarted} = now; ${waiting} = true; }\n        { char received[121] = {}; char sender[25] = {}; const int result = capiWifiMessagePoll(${cppString(instruction.sender)}, received, sender);\n          if (result == 1) { ${waiting} = false; ${pc} = strcmp(received, ${cppString(instruction.expected)}) == 0 ? ${instruction.equalTarget} : ${instruction.differentTarget}; break; }\n          if ((uint32_t)(now - ${waitStarted}) >= ${Math.max(100, Math.round(instruction.timeoutMs))}U) { ${waiting} = false; ${pc} = ${instruction.timeoutTarget}; break; }\n        }\n        return;`;
    case 'displayWrite':
    case 'displayClear': {
      const device = context.scene.devices.find(device => device.id === instruction.deviceId);
      const area = device?.kind === 'display' && validDisplayConfig(device.config) ? displayTargets(device.config).find(area => area.id === instruction.areaId) : undefined;
      const content = instruction.op === 'displayWrite'
        ? instruction.expression
          ? `capiLayoutText(${valueAsTextToCpp(instruction.expression, context)}, ${area?.columns ?? 1}, ${area?.rows ?? 1}).data`
          : cppString(area ? layoutDisplayText(instruction.text, area).cells : '')
        : 'nullptr';
      const call = area ? `capiDisplayWrite(${area.column}, ${area.row}, ${area.columns}, ${area.rows}, ${content});` : '// Destino inválido: revisar el diagnóstico #error.';
      return `${comment}\n        ${call}\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'displayAnimateText': {
      const device = context.scene.devices.find(device => device.id === instruction.deviceId);
      const area = device?.kind === 'display' && validDisplayConfig(device.config) ? displayTargets(device.config).find(area => area.id === instruction.areaId) : undefined;
      if (!area || device?.kind !== 'display')
        return `${comment}\n        // Destino inválido: revisar el diagnóstico #error.\n        ${pc} = ${nextPc};\n        break;`;
      const effect = instruction.effect === 'scroll' ? 1 : instruction.effect === 'blink' ? 2 : 0;
      return `${comment}\n        capiDisplayStartText(${area.column}, ${area.row}, ${area.columns}, ${area.rows}, ${cppString(layoutDisplayText(instruction.text, area).cells)}, ${effect}, ${displayAnimationMs(device.config.animationSpeed)}, ${Math.max(0, Math.min(100, Math.round(instruction.repeatCount)))}U, now);\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'displayArtwork': {
      const device = context.scene.devices.find(device => device.id === instruction.deviceId);
      const artwork = device?.kind === 'display' ? displayArtworkById(displayArtworks(device.config), instruction.artworkId) : undefined;
      if (!artwork || device?.kind !== 'display')
        return `${comment}\n        // Dibujo inválido: revisar el diagnóstico #error.\n        ${pc} = ${nextPc};\n        break;`;
      const effect = instruction.effect === 'slide' ? 1 : instruction.effect === 'blink' ? 2 : 0;
      return `${comment}\n        capiDisplayStartArtwork(DISPLAY_ART_${deviceSymbol(context, instruction.deviceId)}_${cppIdentifier(artwork.id)}, ${effect}, ${displayAnimationMs(device.config.animationSpeed)}, ${Math.max(0, Math.min(100, Math.round(instruction.repeatCount)))}U, now);\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'visualWait': {
      const device = context.scene.devices.find(device => device.id === instruction.deviceId);
      const active = device?.kind === 'display'
        ? 'capiDisplayAnimationActive()'
        : device?.kind === 'ledMatrix'
          ? 'capiMatrixAnimationActive()'
          : 'false';
      return `${comment}\n        if (${active}) return;\n        ${pc} = ${nextPc};\n        break;`;
    }
    case 'matrixClear':
      return `${comment}\n        capiMatrixClear();\n        ${pc} = ${nextPc};\n        break;`;
    case 'matrixPixel':
      return `${comment}\n        capiMatrixPixel(${Math.round(instruction.x)}, ${Math.round(instruction.y)}, ${instruction.enabled ? 'true' : 'false'});\n        ${pc} = ${nextPc};\n        break;`;
    case 'matrixPattern':
      return `${comment}\n        capiMatrixPattern(PATTERN_${deviceSymbol(context, instruction.deviceId)}_${cppIdentifier(instruction.patternId)});\n        ${pc} = ${nextPc};\n        break;`;
    case 'matrixScroll':
      return `${comment}\n        capiMatrixStartScroll(${cppString(normalizedMatrixTextLiteral(instruction.text))}, ${Math.max(40, Math.min(1000, Math.round(instruction.speedMs)))}, ${Math.max(0, Math.min(100, Math.round(instruction.repeatCount)))}U, now);\n        ${pc} = ${nextPc};\n        break;`;
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

export function programUsesWifi(program: CompiledProgram) {
  let usesWifi = false;
  visitProgram(program, (node) => {
    if (node.op === 'wifi' || node.op === 'wifiMessageSend' || node.op === 'wifiMessageReceive') usesWifi = true;
    if (node.op === 'if' && node.condition.kind === 'wifiConnected') {
      usesWifi = true;
    }
    const expressions: ValueExpression[] = [];
    if (node.op === 'variableSet') expressions.push(node.value);
    if (node.op === 'variableChange') expressions.push(node.delta);
    if ((node.op === 'serial' || node.op === 'messageSend' || node.op === 'wifiMessageSend' || node.op === 'displayWrite') && node.expression) expressions.push(node.expression);
    if (node.op === 'if' && node.condition.kind === 'value') expressions.push(node.condition.expression);
    if (node.op === 'if' && node.condition.kind === 'valueCompare') expressions.push(node.condition.left, node.condition.right);
    expressions.forEach(expression => visitValueExpression(expression, value => { if (value.kind === 'wifiValue' || (value.kind === 'componentValue' && (value.property === 'connected' || value.property === 'status' || value.property.startsWith('lastWifi')))) usesWifi = true; }));
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
  const messageDevices = scene.devices.filter(device => device.kind === 'messages');
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
        case 'otto':
          return `OttoDevice DEV_${symbol}{{${gpioOrPlaceholder(device.pins.leftLeg)}, ${gpioOrPlaceholder(device.pins.rightLeg)}, ${gpioOrPlaceholder(device.pins.leftFoot)}, ${gpioOrPlaceholder(device.pins.rightFoot)}, ${gpioOrPlaceholder(device.pins.leftArm)}, ${gpioOrPlaceholder(device.pins.rightArm)}}, {${device.config.centers.join(', ')}}, {${device.config.reversed.map(Boolean).join(', ')}}, ${gpioOrPlaceholder(device.pins.buzzer)}, ${gpioOrPlaceholder(device.pins.trigger)}, ${gpioOrPlaceholder(device.pins.echo)}, ${gpioOrPlaceholder(device.pins.matrixDin)}, ${gpioOrPlaceholder(device.pins.matrixClk)}, ${gpioOrPlaceholder(device.pins.matrixCs)}, ${device.config.matrixBrightness}, -1, 0, 5, 0, 0, 0, 0, 0}; // ${cppLineComment(device.name)}`;
        case 'motor':
          return `constexpr MotorDevice DEV_${symbol}{${gpioOrPlaceholder(device.pins.in1)}, ${gpioOrPlaceholder(device.pins.in2)}}; // ${cppLineComment(device.name)}`;
        case 'wifiNode':
          return `// ${cppLineComment(device.name)}: radio Wi-Fi integrada, sin GPIO externo.`;
        case 'display': {
          const profile = displayProfiles[device.config.profile];
          if (!profile.graphic) return '// Pantalla configurada en capiScreen.';
          return [...BUILTIN_DISPLAY_ARTWORKS, ...displayArtworks(device.config)]
            .map(artwork => `constexpr uint16_t DISPLAY_ART_${symbol}_${cppIdentifier(artwork.id)}[8] = { ${artwork.rows.map(row => `${row}U`).join(', ')} }; // ${cppLineComment(artwork.name)}`)
            .join('\n');
        }
        case 'ledMatrix': return device.config.patterns.map(pattern => `constexpr uint32_t PATTERN_${symbol}_${cppIdentifier(pattern.id)}[8] = { ${pattern.rows.map(row => `${row >>> 0}UL`).join(', ')} }; // ${cppLineComment(pattern.name)}`).join('\n');
        case 'messages': return `constexpr MessageDevice DEV_${symbol}{${messageDevices.findIndex(item => item.id === device.id) + 1}, ${gpioOrPlaceholder(device.pins.tx)}, ${gpioOrPlaceholder(device.pins.rx)}, ${device.config.baudRate}}; // ${cppLineComment(device.name)}`;
        default:
          return `constexpr uint8_t PIN_${symbol} = ${label(device.pins.signal)}`;
      }
    })
    .join('\n');
}

function componentStateDeclarations(scene: SceneDefinition) {
  return scene.devices.flatMap(device => {
    switch (device.kind) {
      case 'trafficLight': return [`char ${componentStateSymbol(device.id, 'color')}[121] = "OFF";`];
      case 'led': return [`int32_t ${componentStateSymbol(device.id, 'brightness')} = 0;`];
      case 'robot': return [`char ${componentStateSymbol(device.id, 'motion')}[121] = "STOP";`];
      case 'motor': return [`int32_t ${componentStateSymbol(device.id, 'power')} = 0;`];
      case 'servo': return [`int32_t ${componentStateSymbol(device.id, 'angle')} = ${Math.max(0, Math.min(180, Math.round(device.config.angle)))};`];
      case 'otto': return [
        `char ${componentStateSymbol(device.id, 'motion')}[121] = "HOME";`,
        ...(['biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile) ? [`char ${componentStateSymbol(device.id, 'expression')}[121] = "SMILE";`] : []),
      ];
      default: return [];
    }
  }).join('\n');
}

function dashboardFirmwareSupport(scene: SceneDefinition) {
  const ids = [...dashboardDeviceIds(scene)];
  const devices = ids.map(id => scene.devices.find(device => device.id === id)).filter((device): device is SceneDevice => !!device);
  if (!devices.length) return '';
  const programCases = devices.map((device, index) => {
    const state = (property: string) => componentStateSymbol(device.id, property);
    if (device.kind === 'trafficLight') return `    case ${index}: return !strcmp(${state('color')}, "RED") ? 1 : !strcmp(${state('color')}, "YELLOW") ? 2 : !strcmp(${state('color')}, "GREEN") ? 3 : 0;`;
    if (device.kind === 'robot') return `    case ${index}: return !strcmp(${state('motion')}, "FORWARD") ? 1 : !strcmp(${state('motion')}, "BACKWARD") ? 2 : !strcmp(${state('motion')}, "LEFT") ? 3 : !strcmp(${state('motion')}, "RIGHT") ? 4 : 0;`;
    if (device.kind === 'motor') return `    case ${index}: return ${state('power')};`;
    if (device.kind === 'led') return `    case ${index}: return ${state('brightness')};`;
    return `    case ${index}: return ${state('angle')};`;
  }).join('\n');
  const nextCases = devices.map((device, index) => {
    if (device.kind === 'trafficLight') return `    case ${index}: return (value + 1) % 4;`;
    if (device.kind === 'robot') return `    case ${index}: return (value + 1) % 5;`;
    if (device.kind === 'motor') return `    case ${index}: return value <= -100 ? 0 : value == 0 ? 100 : -100;`;
    if (device.kind === 'led') return `    case ${index}: return value >= 100 ? 0 : value + 25;`;
    return `    case ${index}: return value >= 180 ? 0 : value + 45;`;
  }).join('\n');
  const labelCases = devices.map((device, index) => {
    if (device.kind === 'trafficLight') return `    case ${index}: snprintf(out, size, "%s", value == 1 ? "ROJO" : value == 2 ? "AMARILLO" : value == 3 ? "VERDE" : "APAGADO"); break;`;
    if (device.kind === 'robot') return `    case ${index}: snprintf(out, size, "%s", value == 1 ? "AVANZA" : value == 2 ? "RETROCEDE" : value == 3 ? "IZQUIERDA" : value == 4 ? "DERECHA" : "DETENIDO"); break;`;
    if (device.kind === 'servo') return `    case ${index}: snprintf(out, size, "%ld grados", (long)value); break;`;
    return `    case ${index}: snprintf(out, size, "%ld%%", (long)value); break;`;
  }).join('\n');
  const names = devices.map(device => cppString(device.name.slice(0, 18))).join(', ');
  return `constexpr uint8_t CAPI_DASHBOARD_COUNT = ${devices.length};
const char* CAPI_DASHBOARD_NAMES[CAPI_DASHBOARD_COUNT] = { ${names} };
bool capiDashboardManual[CAPI_DASHBOARD_COUNT] = {};
int32_t capiDashboardManualValue[CAPI_DASHBOARD_COUNT] = {};
int32_t capiDashboardProgramValue(uint8_t id) {
  switch (id) {
${programCases}
    default: return 0;
  }
}
int32_t capiDashboardNextValue(uint8_t id, int32_t value) {
  switch (id) {
${nextCases}
    default: return value;
  }
}
void capiDashboardValueLabel(uint8_t id, int32_t value, char* out, size_t size) {
  switch (id) {
${labelCases}
    default: snprintf(out, size, "-"); break;
  }
}
void capiDashboardWriteRow(uint8_t row, const char* text) {
  char cells[CAPI_DISPLAY_COLUMNS]; memset(cells, ' ', sizeof(cells));
  const size_t count = strlen(text) < sizeof(cells) ? strlen(text) : sizeof(cells);
  memcpy(cells, text, count); capiDisplayWriteCells(0, row, CAPI_DISPLAY_COLUMNS, 1, cells);
}
void capiDashboardService(uint32_t now) {
  static bool wasDown = false; static uint32_t nextPaint = 0;
  if (capiTouchDown && !wasDown && capiTouchY >= 48) {
    const uint8_t id = (uint8_t)((capiTouchY - 48) / 64);
    if (id < CAPI_DASHBOARD_COUNT) {
      if (capiTouchX >= 600) capiDashboardManual[id] = false;
      else {
        const int32_t current = capiDashboardManual[id] ? capiDashboardManualValue[id] : capiDashboardProgramValue(id);
        capiDashboardManualValue[id] = capiDashboardNextValue(id, current); capiDashboardManual[id] = true;
      }
      nextPaint = 0;
    }
  }
  wasDown = capiTouchDown;
  if ((int32_t)(now - nextPaint) < 0) return; nextPaint = now + 120U;
  capiDashboardWriteRow(0, "TABLERO LOCAL - ESTADOS LOGICOS");
  capiDashboardWriteRow(1, "Toca izquierda: cambiar | derecha: programa");
  capiDashboardWriteRow(2, "No hay salidas fisicas conectadas");
  for (uint8_t id = 0; id < CAPI_DASHBOARD_COUNT; ++id) {
    char value[20] = {}, line[64] = {};
    const int32_t effective = capiDashboardManual[id] ? capiDashboardManualValue[id] : capiDashboardProgramValue(id);
    capiDashboardValueLabel(id, effective, value, sizeof(value));
    snprintf(line, sizeof(line), "%u. %-18s | %-8s | %s", id + 1, CAPI_DASHBOARD_NAMES[id], capiDashboardManual[id] ? "MANUAL" : "PROGRAMA", value);
    const uint8_t row = 3 + id * 4; capiDashboardWriteRow(row, line);
    capiDashboardWriteRow(row + 1, capiDashboardManual[id] ? "[ cambiar ]                         [ programa ]" : "[ tomar control manual ]            [ programa ]");
    capiDashboardWriteRow(row + 2, ""); capiDashboardWriteRow(row + 3, "");
  }
}
`;
}

function messageRuntimeSupport(scene: SceneDefinition, native: boolean) {
  if (!scene.devices.some(device => device.kind === 'messages')) return '';
  const stream = native
    ? `int count = uart_read_bytes((uart_port_t)device.port, &byte, 1, 0); if (count != 1) break;`
    : `if (!port.available()) break; byte = (uint8_t)port.read();`;
  const portLine = native ? '' : `HardwareSerial& port = device.port == 1 ? CAPI_UART_1 : CAPI_UART_2;`;
  const writePacket = native
    ? `uart_write_bytes((uart_port_t)device.port, (const char*)packet, total)`
    : `capiMessagePort(device).write(packet, total)`;
  return `${native ? '' : 'HardwareSerial CAPI_UART_1(1);\nHardwareSerial CAPI_UART_2(2);\nHardwareSerial& capiMessagePort(const MessageDevice& device) { return device.port == 1 ? CAPI_UART_1 : CAPI_UART_2; }'}
struct CapiMessageParser { uint8_t state = 0; uint16_t length = 0; uint16_t position = 0; uint16_t crc = 0xFFFF; uint16_t receivedCrc = 0; char text[121] = {}; };
CapiMessageParser capiMessageParsers[2];
// Explicit prototypes keep Arduino's sketch preprocessor from moving declarations
// that use CapiMessageParser ahead of the struct definition.
uint16_t capiMessageCrcByte(uint16_t crc, uint8_t value);
void capiMessageReset(CapiMessageParser& parser);
int capiMessageConsume(CapiMessageParser& parser, uint8_t byte, char* output);
int capiMessagePoll(const MessageDevice& device, char* output);
bool capiMessageSend(const MessageDevice& device, const char* text);
uint16_t capiMessageCrcByte(uint16_t crc, uint8_t value) {
  crc ^= (uint16_t)value << 8;
  for (uint8_t bit = 0; bit < 8; ++bit) crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);
  return crc;
}
void capiMessageReset(CapiMessageParser& parser) { parser = CapiMessageParser{}; }
int capiMessageConsume(CapiMessageParser& parser, uint8_t byte, char* output) {
  switch (parser.state) {
    case 0: if (byte == 0x43) parser.state = 1; return 0;
    case 1: if (byte == 0x42) parser.state = 2; else parser.state = byte == 0x43 ? 1 : 0; return 0;
    case 2: if (byte != 1) { capiMessageReset(parser); return -1; } parser.crc = capiMessageCrcByte(0xFFFF, byte); parser.state = 3; return 0;
    case 3: parser.length = byte; parser.crc = capiMessageCrcByte(parser.crc, byte); parser.state = 4; return 0;
    case 4: parser.length |= (uint16_t)byte << 8; parser.crc = capiMessageCrcByte(parser.crc, byte); if (!parser.length || parser.length > 120) { capiMessageReset(parser); return -1; } parser.position = 0; parser.state = 5; return 0;
    case 5: parser.text[parser.position++] = (char)byte; parser.crc = capiMessageCrcByte(parser.crc, byte); if (parser.position == parser.length) { parser.text[parser.position] = 0; parser.state = 6; } return 0;
    case 6: parser.receivedCrc = byte; parser.state = 7; return 0;
    case 7: parser.receivedCrc |= (uint16_t)byte << 8; parser.state = 8; return 0;
    case 8: if (byte != 0x0D) { capiMessageReset(parser); return -1; } parser.state = 9; return 0;
    case 9: { bool valid = byte == 0x0A && parser.receivedCrc == parser.crc; if (valid) memcpy(output, parser.text, parser.length + 1); capiMessageReset(parser); return valid ? 1 : -1; }
  }
  capiMessageReset(parser); return -1;
}
int capiMessagePoll(const MessageDevice& device, char* output) {
  CapiMessageParser& parser = capiMessageParsers[device.port - 1];
  ${portLine}
  for (uint8_t budget = 0; budget < 64; ++budget) {
    uint8_t byte = 0; ${stream}
    const int result = capiMessageConsume(parser, byte, output);
    if (result != 0) return result;
  }
  return 0;
}
bool capiMessageSend(const MessageDevice& device, const char* text) {
  const size_t length = strlen(text); if (!length || length > 120) return false;
  uint8_t packet[129] = { 0x43, 0x42, 1, (uint8_t)(length & 0xFF), (uint8_t)(length >> 8) };
  memcpy(packet + 5, text, length);
  uint16_t crc = 0xFFFF; for (size_t index = 2; index < 5 + length; ++index) crc = capiMessageCrcByte(crc, packet[index]);
  packet[5 + length] = (uint8_t)(crc & 0xFF); packet[6 + length] = (uint8_t)(crc >> 8); packet[7 + length] = 0x0D; packet[8 + length] = 0x0A;
  const size_t total = length + 9; return ${writePacket} == ${native ? '(int)total' : 'total'};
}`;
}

function messageSetupLines(scene: SceneDefinition, symbols: Map<string, string>, native: boolean) {
  return scene.devices.filter(device => device.kind === 'messages').map(device => {
    const symbol = symbols.get(device.id) ?? cppIdentifier(device.id);
    if (native) return `  { uart_config_t config = {}; config.baud_rate = DEV_${symbol}.baud; config.data_bits = UART_DATA_8_BITS; config.parity = UART_PARITY_DISABLE; config.stop_bits = UART_STOP_BITS_1; config.flow_ctrl = UART_HW_FLOWCTRL_DISABLE; config.source_clk = UART_SCLK_DEFAULT; ESP_ERROR_CHECK(uart_param_config((uart_port_t)DEV_${symbol}.port, &config)); ESP_ERROR_CHECK(uart_set_pin((uart_port_t)DEV_${symbol}.port, DEV_${symbol}.tx == 255 ? UART_PIN_NO_CHANGE : DEV_${symbol}.tx, DEV_${symbol}.rx == 255 ? UART_PIN_NO_CHANGE : DEV_${symbol}.rx, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE)); ESP_ERROR_CHECK(uart_driver_install((uart_port_t)DEV_${symbol}.port, 512, 512, 0, nullptr, 0)); }`;
    return `  capiMessagePort(DEV_${symbol}).begin(DEV_${symbol}.baud, SERIAL_8N1, DEV_${symbol}.rx == 255 ? -1 : DEV_${symbol}.rx, DEV_${symbol}.tx == 255 ? -1 : DEV_${symbol}.tx);`;
  }).join('\n');
}

function wifiMessageRuntimeSupport(scene: SceneDefinition, native: boolean) {
  const device = scene.devices.find(item => item.kind === 'wifiNode');
  if (device?.kind !== 'wifiNode') return '';
  const sender = cppString(device.config.boardName);
  const socketDeclarations = native
    ? '#include "lwip/sockets.h"\n#include "lwip/inet.h"\n#include <fcntl.h>\nint CAPI_WIFI_SOCKET = -1;'
    : 'WiFiUDP CAPI_WIFI_UDP;';
  const begin = native
    ? `if (CAPI_WIFI_SOCKET >= 0) return true; CAPI_WIFI_SOCKET = socket(AF_INET, SOCK_DGRAM, IPPROTO_IP); if (CAPI_WIFI_SOCKET < 0) return false; int yes = 1; setsockopt(CAPI_WIFI_SOCKET, SOL_SOCKET, SO_BROADCAST, &yes, sizeof(yes)); sockaddr_in local{}; local.sin_family = AF_INET; local.sin_port = htons(4217); local.sin_addr.s_addr = htonl(INADDR_ANY); if (bind(CAPI_WIFI_SOCKET, (sockaddr*)&local, sizeof(local)) != 0) { close(CAPI_WIFI_SOCKET); CAPI_WIFI_SOCKET = -1; return false; } fcntl(CAPI_WIFI_SOCKET, F_SETFL, O_NONBLOCK); return true;`
    : 'static bool ready = false; if (!ready) ready = CAPI_WIFI_UDP.begin(4217); return ready;';
  const send = native
    ? `sockaddr_in remote{}; remote.sin_family=AF_INET; remote.sin_port=htons(4217); remote.sin_addr.s_addr=inet_addr("255.255.255.255"); return sendto(CAPI_WIFI_SOCKET, packet, total, 0, (sockaddr*)&remote, sizeof(remote)) == total;`
    : 'if (!CAPI_WIFI_UDP.beginPacket(IPAddress(255,255,255,255), 4217)) return false; CAPI_WIFI_UDP.write(packet, total); return CAPI_WIFI_UDP.endPacket() == 1;';
  const receive = native
    ? 'const int size = recv(CAPI_WIFI_SOCKET, packet, sizeof(packet), 0); if (size <= 0) return 0;'
    : 'const int size = CAPI_WIFI_UDP.parsePacket(); if (size <= 0) return 0; if (size > (int)sizeof(packet) || CAPI_WIFI_UDP.read(packet, size) != size) return -1;';
  return `${socketDeclarations}
char CAPI_WIFI_LAST_MESSAGE[121] = {};
char CAPI_WIFI_LAST_SENDER[25] = {};
uint32_t CAPI_WIFI_SEQUENCE = 0;
struct CapiWifiSeen { char sender[25] = {}; uint32_t sequence = 0; };
CapiWifiSeen CAPI_WIFI_SEEN[8];
uint16_t capiWifiMessageCrc(const uint8_t* data, size_t size) { uint16_t crc=0xFFFF; for(size_t i=0;i<size;++i){crc^=(uint16_t)data[i]<<8;for(uint8_t bit=0;bit<8;++bit)crc=(crc&0x8000)?(uint16_t)((crc<<1)^0x1021):(uint16_t)(crc<<1);}return crc; }
bool capiWifiMessageBegin() { ${begin} }
bool capiWifiMessageSend(const char* target,const char* text) {
  if (!capiWifiMessageBegin() || !target || !text) return false; const size_t senderSize=strlen(${sender}),targetSize=strlen(target),textSize=strlen(text);
  if (!senderSize || senderSize>24 || !targetSize || targetSize>24 || !textSize || textSize>120) return false;
  uint8_t packet[184]={0x43,0x42,0x57,1}; const uint32_t sequence=++CAPI_WIFI_SEQUENCE; memcpy(packet+4,&sequence,4); packet[8]=(uint8_t)senderSize;packet[9]=(uint8_t)targetSize;packet[10]=(uint8_t)(textSize&0xFF);packet[11]=(uint8_t)(textSize>>8);
  memcpy(packet+12,${sender},senderSize);memcpy(packet+12+senderSize,target,targetSize);memcpy(packet+12+senderSize+targetSize,text,textSize);const size_t crcAt=12+senderSize+targetSize+textSize;const uint16_t crc=capiWifiMessageCrc(packet+3,crcAt-3);memcpy(packet+crcAt,&crc,2);const size_t total=crcAt+2;${send}
}
int capiWifiMessagePoll(const char* expectedSender,char* outText,char* outSender) {
  if (!capiWifiMessageBegin()) return 0; uint8_t packet[184]={}; ${receive}
  if (size<17||packet[0]!=0x43||packet[1]!=0x42||packet[2]!=0x57||packet[3]!=1) return -1;uint32_t sequence=0;memcpy(&sequence,packet+4,4);const size_t senderSize=packet[8],targetSize=packet[9],textSize=(size_t)packet[10]|((size_t)packet[11]<<8),crcAt=12+senderSize+targetSize+textSize;
  if(!senderSize||senderSize>24||!targetSize||targetSize>24||!textSize||textSize>120||crcAt+2!=(size_t)size)return -1;uint16_t received=0;memcpy(&received,packet+crcAt,2);if(received!=capiWifiMessageCrc(packet+3,crcAt-3))return -1;
  char senderName[25]={},targetName[25]={};memcpy(senderName,packet+12,senderSize);memcpy(targetName,packet+12+senderSize,targetSize);if(strcmp(targetName,"*")&&strcmp(targetName,${sender}))return 0;if(expectedSender&&strcmp(expectedSender,"*")&&strcmp(expectedSender,senderName))return 0;
  CapiWifiSeen* slot=nullptr;for(auto &seen:CAPI_WIFI_SEEN)if(!strcmp(seen.sender,senderName)){slot=&seen;break;}else if(!slot&&!seen.sender[0])slot=&seen;if(!slot||sequence<=slot->sequence)return 0;snprintf(slot->sender,sizeof(slot->sender),"%s",senderName);slot->sequence=sequence;
  memcpy(outText,packet+12+senderSize+targetSize,textSize);outText[textSize]=0;snprintf(outSender,25,"%s",senderName);snprintf(CAPI_WIFI_LAST_MESSAGE,sizeof(CAPI_WIFI_LAST_MESSAGE),"%s",outText);snprintf(CAPI_WIFI_LAST_SENDER,sizeof(CAPI_WIFI_LAST_SENDER),"%s",outSender);return 1;
}`;
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

function setupLines(scene: SceneDefinition, symbols: Map<string, string>, servoResolutionBits = 16) {
  const lines: string[] = [];
  const logical = dashboardDeviceIds(scene);
  for (const device of scene.devices) {
    if (logical.has(device.id)) continue;
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
          `  ledcAttach(PIN_${symbol}, 50, ${servoResolutionBits});`,
          `  setServoAngle(PIN_${symbol}, ${Math.max(0, Math.min(180, Math.round(device.config.angle)))});`,
        );
        break;
      case 'otto':
        for (const pin of [device.pins.leftLeg, device.pins.rightLeg, device.pins.leftFoot, device.pins.rightFoot, ...(device.config.profile === 'humanoid6-expressive' ? [device.pins.leftArm, device.pins.rightArm] : [])]) lines.push(`  ledcAttach(${gpioOrPlaceholder(pin)}, 50, ${servoResolutionBits});`);
        if (device.config.profile !== 'biped4') lines.push(`  ledcAttach(DEV_${symbol}.buzzer, 1100, 8);`, `  ledcWrite(DEV_${symbol}.buzzer, 0);`);
        if (['biped4-explorer', 'biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile)) lines.push(`  pinMode(DEV_${symbol}.trigger, OUTPUT);`, `  pinMode(DEV_${symbol}.echo, INPUT);`);
        if (['biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile)) lines.push(`  pinMode(DEV_${symbol}.matrixDin, OUTPUT);`, `  pinMode(DEV_${symbol}.matrixClk, OUTPUT);`, `  pinMode(DEV_${symbol}.matrixCs, OUTPUT);`);
        lines.push(`  ottoBegin(DEV_${symbol});`);
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
      case 'infraredBarrier':
        lines.push(`  pinMode(PIN_${symbol}, INPUT);`);
        break;
      case 'lightSensor':
      case 'potentiometer':
      case 'wifiNode':
      case 'display':
      case 'ledMatrix':
      case 'messages':
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
  framework: FirmwareFramework = 'arduino',
) {
  return scene.devices
    .filter(
      (device) =>
        device.kind === 'activeBuzzer' || device.kind === 'passiveBuzzer',
    )
    .map((device) => {
      const symbol = symbols.get(device.id) ?? cppIdentifier(device.id);
      return `  if (BUZZER_STOP_${symbol} != 0 && (int32_t)(now - BUZZER_STOP_${symbol}) >= 0) {
    ${framework === 'esp-idf' ? 'capiTone' : 'ledcWriteTone'}(PIN_${symbol}, 0);
    ${framework === 'esp-idf' ? 'capiPwmWrite' : 'ledcWrite'}(PIN_${symbol}, 0);
    BUZZER_STOP_${symbol} = 0;
  }`;
    })
    .join('\n');
}

export interface CodeGenerationResult {
  framework: FirmwareFramework;
  boardProfile: BoardProfileId;
  code: string;
  diagnostics: CapiDiagnostic[];
  program: CompiledProgram;
  scene: SceneDefinition;
}

export function generateEsp32CodeResult(
  input: CompiledProgram | ProgramNode[],
  title: string,
  sourceScene?: SceneDefinition,
  framework: FirmwareFramework = 'arduino',
  profileId: BoardProfileId = 'wemos-d1-r32',
): CodeGenerationResult {
  const native = framework === 'esp-idf';
  const scene = sourceScene
    ? cloneScene(sourceScene)
    : inferSceneForProgram(input);
  const program = normalizeCompiledProgram(input, scene);
  const programVariables = new Map((program.variables ?? []).map(variable => [variable.id, variable]));
  const programTimers = new Map((program.timers ?? []).map((timer, index) => [timer.id, index]));
  const profile = boardProfile(profileId);
  const diagnostics = validateProgramForScene(program, scene, profileId);
  if (native && !allocateIdfPwm(scene, profileId)) diagnostics.push({ severity: 'error', code: 'idf-pwm-timer-limit', message: 'No hay una combinación de canales y temporizadores PWM disponible para esta escena. Reducí componentes PWM antes de exportar ESP-IDF.' });
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
  const usesWifiMessages = JSON.stringify(program).includes('wifiMessage') || JSON.stringify(program).includes('lastWifi');
  const displaySupport = native ? displayIdfSupport(scene) : displayArduinoSupport(scene);
  const dashboardSupport = dashboardFirmwareSupport(scene);
  const matrixSupport = matrixFirmwareSupport(scene, native);
  const wifiDevice = scene.devices.find(device => device.kind === 'wifiNode');
  const wifiHeader = usesWifi && !native
    ? `#include <WiFi.h>
#include <WiFiUdp.h>

const char* WIFI_SSID = "TU_RED";
const char* WIFI_PASSWORD = "TU_CLAVE";
bool capiWifiConnected() { return ${wifiDevice?.kind === 'wifiNode' && wifiDevice.config.role === 'create' ? 'WiFi.getMode() == WIFI_AP' : 'WiFi.status() == WL_CONNECTED'}; }
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

  let flattened: ExecutableTask[] = [];
  try { flattened = compileTaskGraph(program); } catch { /* Validation above emits #error; never emit a partial graph. */ }
  const threadGlobals = flattened
    .map(({ loopSlots, initial }, index) => {
      const suffix = `T${index}`;
      const loopSlotCount = Math.max(1, loopSlots);
      return `uint16_t pc_${suffix} = 0;
bool active_${suffix} = ${initial ? 'true' : 'false'};
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
      const context: GeneratorContext = { scene, symbols, threadIndex, usesWifi, framework, variables: programVariables, timers: programTimers };
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
    Math.floor(32 / Math.max(1, flattened.length)),
  );
  const runThreads = flattened.length
    ? flattened
        .map((_, index) => `  runThread${index}(now, ${threadBudget});`)
        .join('\n')
    : '  // No hay programas “al comenzar”.';

  const valueRuntime = `#include <stdio.h>
#include <string.h>
constexpr size_t CAPI_VALUE_TEXT_MAX = 120;
struct CapiTextValue { char data[CAPI_VALUE_TEXT_MAX + 1] = {}; };
CapiTextValue capiText(const char* value);
CapiTextValue capiText(int32_t value);
CapiTextValue capiText(bool value);
CapiTextValue capiJoin(CapiTextValue left, CapiTextValue right);
void capiAssignText(char* target, const char* value);
int32_t capiSafeDivide(int32_t left, int32_t right);
CapiTextValue capiLayoutText(CapiTextValue input, uint16_t columns, uint16_t rows);
CapiTextValue capiText(const char* value) { CapiTextValue out; snprintf(out.data, sizeof(out.data), "%s", value ? value : ""); return out; }
CapiTextValue capiText(int32_t value) { CapiTextValue out; snprintf(out.data, sizeof(out.data), "%ld", (long)value); return out; }
CapiTextValue capiText(bool value) { return capiText(value ? "sí" : "no"); }
CapiTextValue capiJoin(CapiTextValue left, CapiTextValue right) { strncat(left.data, right.data, CAPI_VALUE_TEXT_MAX - strlen(left.data)); return left; }
void capiAssignText(char* target, const char* value) { snprintf(target, CAPI_VALUE_TEXT_MAX + 1, "%s", value ? value : ""); }
int32_t capiSafeDivide(int32_t left, int32_t right) { return right == 0 ? 0 : left / right; }
CapiTextValue capiLayoutText(CapiTextValue input, uint16_t columns, uint16_t rows) {
  CapiTextValue out; size_t source = 0, target = 0;
  for (uint16_t row = 0; row < rows && target < CAPI_VALUE_TEXT_MAX; ++row) {
    for (uint16_t column = 0; column < columns && target < CAPI_VALUE_TEXT_MAX; ++column) {
      const char value = input.data[source];
      if (!value || value == '\\n') out.data[target++] = ' ';
      else { out.data[target++] = value; ++source; }
    }
    while (input.data[source] && input.data[source] != '\\n') ++source;
    if (input.data[source] == '\\n') ++source;
  }
  return out;
}`;
  const variableDeclarations = (program.variables ?? []).map(variable => {
    const symbol = variableSymbol(variable.id);
    if (variable.type === 'text') return `char ${symbol}[CAPI_VALUE_TEXT_MAX + 1] = {}; // ${cppLineComment(variable.name)}`;
    if (variable.type === 'boolean') return `bool ${symbol} = false; // ${cppLineComment(variable.name)}`;
    return `int32_t ${symbol} = 0; // ${cppLineComment(variable.name)}`;
  }).join('\n');
  const timerCount = Math.max(1, program.timers?.length ?? 0);
  const timerRuntime = `enum class CapiTimerStatus : uint8_t { STOPPED, RUNNING, PAUSED, EXPIRED };
struct CapiTimer { CapiTimerStatus status = CapiTimerStatus::STOPPED; uint32_t duration = 0; uint32_t remaining = 0; uint32_t lastUpdate = 0; uint64_t elapsed = 0; uint16_t pending = 0; bool repeat = false; bool cancelled = false; };
CapiTimer capiTimers[${timerCount}];${(program.timers ?? []).map((timer, index) => `\n// temporizador ${index}: ${cppLineComment(timer.name)}`).join('')}
void capiTimerStart(uint8_t id, uint32_t duration, bool repeat, uint32_t now) { CapiTimer &timer = capiTimers[id]; timer.status = CapiTimerStatus::RUNNING; timer.duration = duration; timer.remaining = duration; timer.lastUpdate = now; timer.elapsed = 0; timer.pending = 0; timer.repeat = repeat; timer.cancelled = false; }
void capiTimerStop(uint8_t id) { CapiTimer &timer = capiTimers[id]; timer.status = CapiTimerStatus::STOPPED; timer.remaining = 0; timer.elapsed = 0; timer.pending = 0; timer.cancelled = true; }
void capiTimerRestart(uint8_t id, uint32_t now) { CapiTimer &timer = capiTimers[id]; if (!timer.duration) return; timer.status = CapiTimerStatus::RUNNING; timer.remaining = timer.duration; timer.lastUpdate = now; timer.elapsed = 0; timer.pending = 0; timer.cancelled = false; }
void capiTimerPause(uint8_t id) { if (capiTimers[id].status == CapiTimerStatus::RUNNING) capiTimers[id].status = CapiTimerStatus::PAUSED; }
void capiTimerResume(uint8_t id, uint32_t now) { CapiTimer &timer = capiTimers[id]; if (timer.status == CapiTimerStatus::PAUSED) { timer.status = CapiTimerStatus::RUNNING; timer.lastUpdate = now; } }
bool capiTimerConsume(uint8_t id) { CapiTimer &timer = capiTimers[id]; if (timer.cancelled) { timer.cancelled = false; return true; } if (!timer.pending) return false; --timer.pending; return true; }
int32_t capiTimerElapsed(uint8_t id) { const uint64_t seconds = capiTimers[id].elapsed / 1000U; return seconds > INT32_MAX ? INT32_MAX : (int32_t)seconds; }
int32_t capiTimerRemaining(uint8_t id) { return (int32_t)((capiTimers[id].remaining + 999U) / 1000U); }
void capiTimerService(uint32_t now) {
${(program.timers?.length ?? 0) === 0 ? '  (void)now;' : `  for (uint8_t id = 0; id < ${program.timers?.length ?? 0}; ++id) {
    CapiTimer &timer = capiTimers[id]; if (timer.status != CapiTimerStatus::RUNNING || !timer.duration) continue;
    uint32_t delta = (uint32_t)(now - timer.lastUpdate); timer.lastUpdate = now; if (!delta) continue;
    if (delta < timer.remaining) { timer.elapsed += delta; timer.remaining -= delta; continue; }
    if (!timer.repeat) { timer.elapsed = timer.duration; timer.remaining = 0; if (timer.pending < UINT16_MAX) ++timer.pending; timer.status = CapiTimerStatus::EXPIRED; continue; }
    timer.elapsed += delta; uint32_t afterFirst = delta - timer.remaining; uint32_t expirations = 1U + afterFirst / timer.duration;
    timer.pending = ((uint32_t)timer.pending + expirations > 65535U) ? 65535U : (uint16_t)(timer.pending + expirations);
    uint32_t remainder = afterFirst % timer.duration; timer.remaining = remainder ? timer.duration - remainder : timer.duration;
  }`}
}`;
  const messageValueDeclarations = scene.devices
    .filter(device => device.kind === 'messages')
    .map(device => `char MESSAGE_LAST_${symbols.get(device.id) ?? cppIdentifier(device.id)}[CAPI_VALUE_TEXT_MAX + 1] = {}; // último mensaje recibido`)
    .join('\n');

  const servoResolutionBits = profile.family === 'esp32-s3' ? 14 : 16;
  const servoMaxDuty = (1 << servoResolutionBits) - 1;
  const code = `// ${cppLineComment(projectTitle(title))}
// Generado por CapiBloques para ${profile.name}
// ${native ? `ESP-IDF ${IDF_VERSION} | Target: ${profile.idfTarget} | CapiBloques generator 8.1` : `Arduino-ESP32 3.3.11 | FQBN: ${profile.fqbn}`}
// Scheduler cooperativo con ${program.threads.length} programa(s) y esperas no bloqueantes.

${native ? idfRuntimeSupport(scene, usesWifi, profileId) : '#include <Arduino.h>'}
${wifiHeader}${diagnosticHeader}
struct TrafficDevice { uint8_t red; uint8_t yellow; uint8_t green; };
struct RobotDevice { uint8_t leftIn1; uint8_t leftIn2; uint8_t rightIn1; uint8_t rightIn2; };
struct OttoDevice { uint8_t pins[6]; uint8_t centers[6]; bool reversed[6]; uint8_t buzzer; uint8_t trigger; uint8_t echo; uint8_t matrixDin; uint8_t matrixClk; uint8_t matrixCs; uint8_t matrixBrightness; int8_t owner; uint8_t soundPreset; uint8_t soundStep; uint32_t soundAt; uint8_t sonarState; uint64_t sonarAt; uint64_t echoStarted; uint16_t distanceCm; };
struct MotorDevice { uint8_t in1; uint8_t in2; };
struct MessageDevice { uint8_t port; uint8_t tx; uint8_t rx; uint32_t baud; };
enum class TrafficColor { RED, YELLOW, GREEN, OFF };

${displaySupport}

${matrixSupport}

${deviceDeclarations(scene, symbols)}
${componentStateDeclarations(scene)}
${dashboardSupport}

${messageRuntimeSupport(scene, native)}

${valueRuntime}
${usesWifiMessages ? wifiMessageRuntimeSupport(scene, native) : ''}
${variableDeclarations}
${timerRuntime}
${messageValueDeclarations}
int32_t counterValue = 0;
uint32_t lastSchedulerTick = 0;
constexpr uint32_t SCHEDULER_QUANTUM_MS = 16;
${buzzerDeclarations(scene, symbols)}
${threadGlobals}

void setTraffic(const TrafficDevice& device, TrafficColor color) {
  ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.red, color == TrafficColor::RED ? ${native ? '1 : 0' : 'HIGH : LOW'});
  ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.yellow, color == TrafficColor::YELLOW ? ${native ? '1 : 0' : 'HIGH : LOW'});
  ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.green, color == TrafficColor::GREEN ? ${native ? '1 : 0' : 'HIGH : LOW'});
}

int32_t addCounter(int32_t current, int32_t delta) {
  const int64_t result = (int64_t)current + (int64_t)delta;
  if (result > INT32_MAX) return INT32_MAX;
  if (result < INT32_MIN) return INT32_MIN;
  return (int32_t)result;
}

void motorWrite(uint8_t in1, uint8_t in2, int speedPercent) {
  speedPercent = ${native ? 'std::clamp' : 'constrain'}(speedPercent, -100, 100);
  const uint8_t duty = (uint8_t)((abs(speedPercent) * 255 + 50) / 100);
  if (speedPercent >= 0) {
    ${native ? 'capiPwmWrite' : 'ledcWrite'}(in1, duty);
    ${native ? 'capiPwmWrite' : 'ledcWrite'}(in2, 0);
  } else {
    ${native ? 'capiPwmWrite' : 'ledcWrite'}(in1, 0);
    ${native ? 'capiPwmWrite' : 'ledcWrite'}(in2, duty);
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
  angle = ${native ? 'std::clamp' : 'constrain'}(angle, 0, 180);
  const uint32_t pulseMicros = 500U + ((uint32_t)angle * 2000U) / 180U;
  const uint32_t duty = (pulseMicros * ${servoMaxDuty}U) / 20000U;
  ${native ? 'capiPwmWrite' : 'ledcWrite'}(pin, duty);
}

void setOttoPose(OttoDevice& device, int a, int b, int c, int d) {
  const int offsets[4] = {a, b, c, d};
  for (uint8_t i = 0; i < 4; ++i) setServoAngle(device.pins[i], device.centers[i] + (device.reversed[i] ? -offsets[i] : offsets[i]));
}
void ottoHome(OttoDevice& device) { setOttoPose(device, 0, 0, 0, 0); }
void ottoMove(OttoDevice& device, uint8_t action, uint8_t phase) {
  static const int8_t poses[17][4][4] = {
    {{-18,18,12,12},{18,-18,12,12},{18,-18,-12,-12},{-18,18,-12,-12}},
    {{18,-18,12,12},{-18,18,12,12},{-18,18,-12,-12},{18,-18,-12,-12}},
    {{-22,-8,14,-14},{8,22,14,-14},{8,22,-14,14},{-22,-8,-14,14}},
    {{8,22,14,-14},{-22,-8,14,-14},{-22,-8,-14,14},{8,22,-14,14}},
    {{-25,25,-18,18},{25,-25,18,-18},{-25,25,18,-18},{25,-25,-18,18}},
    {{0,0,28,-28},{0,0,-28,28},{0,0,28,-28},{0,0,0,0}},
    {{-20,-20,0,0},{20,20,0,0},{-20,-20,0,0},{20,20,0,0}},
    {{0,0,18,18},{0,0,-18,-18},{0,0,18,18},{0,0,-18,-18}},
    {{-8,8,-8,8},{8,-8,8,-8},{-8,8,-8,8},{8,-8,8,-8}},
    {{-18,-6,22,-8},{8,18,-8,22},{18,6,-22,8},{-8,-18,8,-22}},
    {{6,18,-8,22},{-18,-6,22,-8},{-6,-18,8,-22},{18,6,-22,8}},
    {{-28,0,18,0},{-28,0,-18,0},{0,0,0,0},{0,0,0,0}},
    {{0,28,0,-18},{0,28,0,18},{0,0,0,0},{0,0,0,0}},
    {{-25,0,25,0},{8,0,-8,0},{-25,0,25,0},{0,0,0,0}},
    {{0,25,0,-25},{0,-8,0,8},{0,25,0,-25},{0,0,0,0}},
    {{-18,18,25,25},{18,-18,-25,-25},{-18,18,25,25},{18,-18,-25,-25}},
    {{18,-18,25,25},{-18,18,-25,-25},{18,-18,25,25},{-18,18,-25,-25}}
  };
  const int8_t* pose = poses[action < 17 ? action : 0][phase % 4];
  setOttoPose(device, pose[0], pose[1], pose[2], pose[3]);
}

void ottoArms(OttoDevice& device, uint8_t pose) {
  if (device.pins[4] == 255 || device.pins[5] == 255) return;
  static const int8_t arms[5][2] = {{0,0},{-65,65},{-65,0},{0,65},{-45,45}};
  pose = pose < 5 ? pose : 0;
  for (uint8_t i = 0; i < 2; ++i) setServoAngle(device.pins[i + 4], device.centers[i + 4] + (device.reversed[i + 4] ? -arms[pose][i] : arms[pose][i]));
}

void ottoMatrixSend(OttoDevice& device, uint8_t address, uint8_t value) {
  if (device.matrixDin == 255 || device.matrixClk == 255 || device.matrixCs == 255) return;
  ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.matrixCs, 0);
  uint16_t packet = ((uint16_t)address << 8) | value;
  for (int bit = 15; bit >= 0; --bit) { ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.matrixClk, 0); ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.matrixDin, (packet >> bit) & 1); ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.matrixClk, 1); }
  ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.matrixCs, 1);
}
void ottoExpression(OttoDevice& device, uint8_t expression) {
  static const uint8_t faces[7][8] = {
    {0x00,0x42,0x00,0x00,0x42,0x24,0x18,0x00}, {0x00,0x42,0x00,0x00,0x18,0x24,0x42,0x00},
    {0x00,0x66,0x00,0x00,0x3C,0x42,0x00,0x00}, {0x00,0x42,0x00,0x18,0x24,0x24,0x18,0x00},
    {0x00,0x00,0x66,0x00,0x00,0x3C,0x00,0x00}, {0x00,0x66,0xFF,0xFF,0x7E,0x3C,0x18,0x00},
    {0,0,0,0,0,0,0,0}
  };
  expression = expression < 7 ? expression : 6;
  for (uint8_t row = 0; row < 8; ++row) ottoMatrixSend(device, row + 1, faces[expression][row]);
}
void ottoStartSound(OttoDevice& device, uint8_t preset, uint32_t now) { if (device.buzzer != 255) { device.soundPreset = preset % 8; device.soundStep = 0; device.soundAt = now; } }
void ottoService(OttoDevice& device, uint32_t now) {
  if (device.buzzer != 255 && device.soundStep < 5 && (int32_t)(now - device.soundAt) >= 0) {
    static const uint16_t notes[8][4] = {{523,659,784,1047},{392,330,262,196},{784,1047,1319,0},{659,523,659,392},{262,220,196,0},{880,0,0,0},{523,659,784,0},{110,98,82,0}};
    const uint16_t frequency = device.soundStep < 4 ? notes[device.soundPreset][device.soundStep] : 0;
    ${native ? 'capiTone' : 'ledcWriteTone'}(device.buzzer, frequency);
    device.soundStep++; device.soundAt = now + 140U;
  }
  if (device.trigger == 255 || device.echo == 255) return;
  const uint64_t us = ${native ? '(uint64_t)esp_timer_get_time()' : '(uint64_t)micros()'};
  const int echo = ${native ? 'capiDigitalRead' : 'digitalRead'}(device.echo);
  switch (device.sonarState) {
    case 0: if (us - device.sonarAt >= 60000U) { ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.trigger, 0); device.sonarAt = us; device.sonarState = 1; } break;
    case 1: if (us - device.sonarAt >= 2U) { ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.trigger, 1); device.sonarAt = us; device.sonarState = 2; } break;
    case 2: if (us - device.sonarAt >= 10U) { ${native ? 'capiDigitalWrite' : 'digitalWrite'}(device.trigger, 0); device.sonarAt = us; device.sonarState = 3; } break;
    case 3: if (echo) { device.echoStarted = us; device.sonarState = 4; } else if (us - device.sonarAt > 30000U) { device.distanceCm = 0; device.sonarAt = us; device.sonarState = 0; } break;
    case 4: if (!echo) { const uint64_t measured = (us - device.echoStarted) / 58U; device.distanceCm = (uint16_t)(measured > 500U ? 500U : measured); device.sonarAt = us; device.sonarState = 0; } else if (us - device.echoStarted > 30000U) { device.distanceCm = 0; device.sonarAt = us; device.sonarState = 0; } break;
  }
}
void ottoBegin(OttoDevice& device) {
  ottoHome(device); ottoArms(device, 0);
  if (device.matrixCs != 255) { ottoMatrixSend(device, 0x0F, 0); ottoMatrixSend(device, 0x0C, 1); ottoMatrixSend(device, 0x0B, 7); ottoMatrixSend(device, 0x0A, device.matrixBrightness); ottoExpression(device, 0); }
}

${threadFunctions}

${native ? `extern "C" void app_main() {
  capiHardwareBegin();
${messageSetupLines(scene, symbols, true)}
${scene.devices.filter((device): device is Extract<SceneDevice, { kind: 'servo' }> => device.kind === 'servo' && !dashboardDeviceIds(scene).has(device.id)).map(device => `  setServoAngle(PIN_${symbols.get(device.id)}, ${Math.max(0, Math.min(180, Math.round(device.config.angle)))});`).join('\n')}
${scene.devices.filter(device => device.kind === 'otto').map(device => {
  const symbol = symbols.get(device.id);
  const lines = [`  ottoBegin(DEV_${symbol});`];
  if (['biped4-explorer', 'biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile)) lines.unshift(`  capiOutput(DEV_${symbol}.trigger); capiInput(DEV_${symbol}.echo, false);`);
  if (['biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile)) lines.unshift(`  capiOutput(DEV_${symbol}.matrixDin); capiOutput(DEV_${symbol}.matrixClk); capiOutput(DEV_${symbol}.matrixCs);`);
  return lines.join('\n');
}).join('\n')}
${displaySupport ? '  capiDisplayBegin();' : ''}
${matrixSupport ? '  capiMatrixBegin();' : ''}
  for (;;) {
    const uint32_t now = capiMillis();
    capiTimerService(now);
${serviceBuzzerLines(scene, symbols, framework)}
${displaySupport ? '    capiDisplayService(now);' : ''}
${dashboardSupport ? '    capiDashboardService(now);' : ''}
${matrixSupport ? '    capiMatrixService(now);' : ''}
${scene.devices.filter(device => device.kind === 'otto').map(device => `    ottoService(DEV_${symbols.get(device.id)}, now);`).join('\n')}
    if ((uint32_t)(now - lastSchedulerTick) >= SCHEDULER_QUANTUM_MS) {
      lastSchedulerTick = now;
${runThreads}
    }
    vTaskDelay(1); // one OS tick; logical block waits never sleep this task
  }
}` : `void setup() {
  Serial.begin(115200);
${profile.family === 'esp32-s3' ? '  if (!psramFound() || ESP.getPsramSize() < 8U * 1024U * 1024U) { Serial.println("CapiBloques: este perfil requiere 8 MB de PSRAM."); while (true) delay(1000); }' : ''}
${setupLines(scene, symbols, servoResolutionBits)}
${messageSetupLines(scene, symbols, false)}
${displaySupport ? '  capiDisplayBegin();' : ''}
${matrixSupport ? '  capiMatrixBegin();' : ''}
}

void loop() {
  const uint32_t now = millis();
  capiTimerService(now);
${serviceBuzzerLines(scene, symbols)}
${displaySupport ? '  capiDisplayService(now);' : ''}
${dashboardSupport ? '  capiDashboardService(now);' : ''}
${matrixSupport ? '  capiMatrixService(now);' : ''}
${scene.devices.filter(device => device.kind === 'otto').map(device => `  ottoService(DEV_${symbols.get(device.id)}, now);`).join('\n')}
  if ((uint32_t)(now - lastSchedulerTick) < SCHEDULER_QUANTUM_MS) {
    yield();
    return;
  }
  lastSchedulerTick = now;
${runThreads}
  yield();
}`}
`;
  return { framework, boardProfile: profileId, code, diagnostics, program, scene };
}

export function generateEspIdfCodeResult(input: CompiledProgram | ProgramNode[], title: string, scene?: SceneDefinition, profileId: BoardProfileId = 'wemos-d1-r32') {
  return generateEsp32CodeResult(input, title, scene, 'esp-idf', profileId);
}

export function generateEsp32Code(
  input: CompiledProgram | ProgramNode[],
  title: string,
  scene?: SceneDefinition,
  profileId: BoardProfileId = 'wemos-d1-r32',
) {
  return generateEsp32CodeResult(input, title, scene, 'arduino', profileId).code;
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
