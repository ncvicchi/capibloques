export type SceneId = 'traffic' | 'robot' | 'wifi' | 'counter';

export type Condition =
  | {
      kind: 'counter';
      operator: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE';
      value: number;
    }
  | {
      kind: 'compare';
      operator: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE';
      left: number;
      right: number;
    }
  | { kind: 'buttonPressed' }
  | {
      kind: 'sensor';
      sensor: 'LIGHT' | 'POTENTIOMETER';
      operator: 'LT' | 'LTE' | 'GT' | 'GTE';
      value: number;
    }
  | { kind: 'wifiConnected' }
  | { kind: 'boolean'; value: boolean };

export type ProgramNode =
  | { op: 'wait'; ms: number; blockId: string }
  | {
      op: 'traffic';
      color: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
      blockId: string;
    }
  | { op: 'led'; brightness: number; blockId: string }
  | { op: 'pin'; pin: number; value: boolean; blockId: string }
  | {
      op: 'robot';
      action: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'STOP';
      speed: number;
      blockId: string;
    }
  | { op: 'servo'; angle: number; blockId: string }
  | {
      op: 'buzzer';
      kind: 'ACTIVE' | 'PASSIVE';
      frequency: number;
      durationMs: number;
      blockId: string;
    }
  | { op: 'wifi'; timeoutMs: number; blockId: string }
  | { op: 'counterSet'; value: number; blockId: string }
  | { op: 'counterChange'; delta: number; blockId: string }
  | { op: 'serial'; text: string; blockId: string }
  | { op: 'tone'; frequency: number; durationMs: number; blockId: string }
  | { op: 'repeat'; count: number; body: ProgramNode[]; blockId: string }
  | {
      op: 'if';
      condition: Condition;
      consequent: ProgramNode[];
      otherwise: ProgramNode[];
      blockId: string;
    };

export interface ProjectFile {
  application: 'CapiBloques';
  schemaVersion: 1;
  metadata: {
    title: string;
    locale: 'es-AR';
    updatedAt: string;
  };
  target: {
    family: 'esp32';
    framework: 'arduino';
    coreMajor: 3;
    coreVersion: '3.3.11';
    boardProfile: 'wemos-d1-r32';
    fqbn: 'esp32:esp32:d1_uno32';
    pinAssignments: {
      trafficRed: 26;
      trafficYellow: 25;
      trafficGreen: 27;
      robotLeftIn1: 17;
      robotLeftIn2: 16;
      robotRightIn1: 23;
      robotRightIn2: 19;
      ledPwm: 18;
      activeBuzzer: 13;
      passiveBuzzer: 13;
      servo: 14;
      button: 4;
      lightSensor: 35;
      potentiometer: 34;
    };
  };
  simulation: {
    scene: SceneId;
    speed: number;
  };
  workspace: Record<string, unknown>;
}

export interface ExampleDefinition {
  id: SceneId;
  title: string;
  mission: string;
  description: string;
  icon: string;
  level: 'Inicial' | 'Intermedio' | 'Avanzado';
  workspace: Record<string, unknown>;
}

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
        { type: 'capi_traffic', id: 'traffic-red', fields: { COLOR: 'RED' } },
        { type: 'capi_wait', id: 'traffic-wait-red', fields: { SECONDS: 3 } },
        {
          type: 'capi_traffic',
          id: 'traffic-green',
          fields: { COLOR: 'GREEN' },
        },
        { type: 'capi_wait', id: 'traffic-wait-green', fields: { SECONDS: 3 } },
        {
          type: 'capi_traffic',
          id: 'traffic-yellow',
          fields: { COLOR: 'YELLOW' },
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
          fields: { ACTION: 'FORWARD', SPEED: 70 },
        },
        { type: 'capi_wait', id: 'robot-wait-forward', fields: { SECONDS: 2 } },
        {
          type: 'capi_robot',
          id: 'robot-right',
          fields: { ACTION: 'RIGHT', SPEED: 65 },
        },
        { type: 'capi_wait', id: 'robot-wait-turn', fields: { SECONDS: 0.6 } },
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
              type: 'capi_traffic',
              id: 'wifi-green',
              fields: { COLOR: 'GREEN' },
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
            { type: 'capi_traffic', id: 'wifi-red', fields: { COLOR: 'RED' } },
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
              fields: { FREQUENCY: 660, DURATION: 120 },
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
          block: chain(
            {
              type: 'capi_traffic',
              id: 'counter-green',
              fields: { COLOR: 'GREEN' },
            },
            {
              type: 'capi_serial',
              id: 'counter-done',
              fields: { TEXT: '¡Llegamos a cinco!' },
            },
          ),
        },
      },
    },
  ),
);

export const examples: ExampleDefinition[] = [
  {
    id: 'traffic',
    title: 'Semáforo de la plaza',
    mission:
      'Enciende rojo, verde y amarillo sin detener el resto del programa.',
    description: 'Aprende secuencias, tiempos y bucles.',
    icon: '🚦',
    level: 'Inicial',
    workspace: trafficWorkspace,
  },
  {
    id: 'counter',
    title: 'Contador de saltos',
    mission: 'Cuenta cinco saltos y celebra cuando alcances la meta.',
    description: 'Usa contador, repetición y comparación.',
    icon: '🐸',
    level: 'Inicial',
    workspace: counterWorkspace,
  },
  {
    id: 'robot',
    title: 'Robot explorador',
    mission: 'Haz avanzar al robot y girar antes de chocar con el borde.',
    description: 'Combina movimiento, velocidad y espera.',
    icon: '🤖',
    level: 'Intermedio',
    workspace: robotWorkspace,
  },
  {
    id: 'wifi',
    title: 'Señal Wi-Fi',
    mission: 'Muestra una luz verde si hay red y roja si falla la conexión.',
    description: 'Prueba estados, timeout y condicionales.',
    icon: '📶',
    level: 'Avanzado',
    workspace: wifiWorkspace,
  },
];

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

export const componentCatalog = [
  {
    id: 'traffic',
    icon: '🚦',
    name: 'Semáforo (3 LED)',
    control: 'Encendido o brillo (PWM)',
    pins: 'D2, D3, D6',
    status: 'ready',
  },
  {
    id: 'led',
    icon: '💡',
    name: 'LED',
    control: 'Brillo 0–100% (PWM)',
    pins: 'D13',
    status: 'ready',
  },
  {
    id: 'buzzer-active',
    icon: '📣',
    name: 'Buzzer activo',
    control: 'Encender / apagar',
    pins: 'D9',
    status: 'ready',
  },
  {
    id: 'buzzer-passive',
    icon: '🎵',
    name: 'Buzzer pasivo',
    control: 'Nota y duración (PWM)',
    pins: 'D9',
    status: 'ready',
  },
  {
    id: 'motor',
    icon: '⚙️',
    name: 'Motor DC + DRV8833',
    control: 'Velocidad −100 a 100%',
    pins: 'D4, D5',
    status: 'ready',
  },
  {
    id: 'servo',
    icon: '🦾',
    name: 'Servo',
    control: 'Ángulo 0–180°',
    pins: 'D7',
    status: 'ready',
  },
  {
    id: 'button',
    icon: '🔘',
    name: 'Botón',
    control: 'Presionado / libre',
    pins: 'A1',
    status: 'ready',
  },
  {
    id: 'light',
    icon: '☀️',
    name: 'Sensor de luz (LDR)',
    control: 'Lectura 0–4095 (ADC1)',
    pins: 'A2',
    status: 'ready',
  },
  {
    id: 'pot',
    icon: '🎚️',
    name: 'Potenciómetro',
    control: 'Lectura 0–4095 (ADC1)',
    pins: 'A3',
    status: 'ready',
  },
  {
    id: 'distance',
    icon: '📏',
    name: 'Distancia ultrasónica',
    control: 'Centímetros',
    pins: 'Por configurar',
    status: 'planned',
  },
  {
    id: 'relay',
    icon: '🔌',
    name: 'Relé',
    control: 'Encender / apagar',
    pins: 'Por configurar',
    status: 'planned',
  },
  {
    id: 'display',
    icon: '🔢',
    name: 'Pantalla I²C',
    control: 'Texto y números',
    pins: 'SDA / SCL',
    status: 'planned',
  },
] as const;

export function makeProject(
  title: string,
  scene: SceneId,
  workspace: Record<string, unknown>,
  speed = 1,
): ProjectFile {
  return {
    application: 'CapiBloques',
    schemaVersion: 1,
    metadata: { title, locale: 'es-AR', updatedAt: new Date().toISOString() },
    target: {
      family: 'esp32',
      framework: 'arduino',
      coreMajor: 3,
      coreVersion: '3.3.11',
      boardProfile: 'wemos-d1-r32',
      fqbn: 'esp32:esp32:d1_uno32',
      pinAssignments: defaultPinAssignments,
    },
    simulation: { scene, speed },
    workspace,
  };
}

export function isProjectFile(value: unknown): value is ProjectFile {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<ProjectFile>;
  return (
    project.application === 'CapiBloques' &&
    project.schemaVersion === 1 &&
    project.target?.boardProfile === 'wemos-d1-r32' &&
    !!project.workspace &&
    typeof project.workspace === 'object' &&
    !!project.simulation &&
    ['traffic', 'robot', 'wifi', 'counter'].includes(
      project.simulation.scene as string,
    )
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
  `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;

function conditionToCpp(condition: Condition) {
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
    return 'digitalRead(PIN_BUTTON) == LOW';
  if (condition.kind === 'sensor') {
    const pin =
      condition.sensor === 'LIGHT' ? 'PIN_LIGHT_SENSOR' : 'PIN_POTENTIOMETER';
    return `analogRead(${pin}) ${operators[condition.operator]} ${Math.max(0, Math.min(4095, Math.round(condition.value)))}`;
  }
  if (condition.kind === 'boolean') return condition.value ? 'true' : 'false';
  if (condition.kind === 'counter')
    return `counterValue ${operators[condition.operator]} ${Math.trunc(condition.value)}`;
  return `${condition.left} ${operators[condition.operator]} ${condition.right}`;
}

function instructionToCpp(instruction: FlatInstruction, index: number) {
  const nextPc = index + 1;
  const comment = `        // bloque: ${instruction.blockId}`;
  switch (instruction.op) {
    case 'traffic':
      return `${comment}\n        setTraffic(TrafficColor::${instruction.color});\n        pc = ${nextPc};\n        break;`;
    case 'led': {
      const duty = Math.round(
        (Math.max(0, Math.min(100, instruction.brightness)) / 100) * 255,
      );
      return `${comment}\n        ledcWrite(PIN_LED_PWM, ${duty}); // ${Math.round(instruction.brightness)}% de brillo\n        pc = ${nextPc};\n        break;`;
    }
    case 'pin':
      return `${comment}\n        pinMode(${instruction.pin}, OUTPUT);\n        digitalWrite(${instruction.pin}, ${instruction.value ? 'HIGH' : 'LOW'});\n        pc = ${nextPc};\n        break;`;
    case 'wait':
      return `${comment}\n        if (!waiting) { waitStarted = now; waiting = true; return; }\n        if ((uint32_t)(now - waitStarted) < ${Math.max(0, Math.round(instruction.ms))}U) return;\n        waiting = false;\n        pc = ${nextPc};\n        break;`;
    case 'robot': {
      const speed = Math.max(0, Math.min(100, Math.round(instruction.speed)));
      const motorPairs = {
        FORWARD: `${speed}, ${speed}`,
        BACKWARD: `${-speed}, ${-speed}`,
        LEFT: `${-speed}, ${speed}`,
        RIGHT: `${speed}, ${-speed}`,
        STOP: '0, 0',
      };
      return `${comment}\n        driveRobot(${motorPairs[instruction.action]});\n        pc = ${nextPc};\n        break;`;
    }
    case 'servo': {
      const angle = Math.max(0, Math.min(180, Math.round(instruction.angle)));
      return `${comment}\n        setServoAngle(${angle});\n        pc = ${nextPc};\n        break;`;
    }
    case 'buzzer':
      if (instruction.kind === 'ACTIVE') {
        return `${comment}\n        ledcWrite(PIN_BUZZER, 255);\n        buzzerStopAt = now + ${Math.max(10, Math.round(instruction.durationMs))}U;\n        pc = ${nextPc};\n        break;`;
      }
      return `${comment}\n        ledcWriteTone(PIN_BUZZER, ${Math.max(20, Math.round(instruction.frequency))});\n        buzzerStopAt = now + ${Math.max(10, Math.round(instruction.durationMs))}U;\n        pc = ${nextPc};\n        break;`;
    case 'wifi':
      return `${comment}\n        if (!wifiAttemptActive) {\n          WiFi.mode(WIFI_STA);\n          WiFi.begin(WIFI_SSID, WIFI_PASSWORD);\n          wifiAttemptStarted = now;\n          wifiAttemptActive = true;\n          return;\n        }\n        if (WiFi.status() == WL_CONNECTED || (uint32_t)(now - wifiAttemptStarted) >= ${Math.max(1000, Math.round(instruction.timeoutMs))}U) {\n          wifiAttemptActive = false;\n          pc = ${nextPc};\n          break;\n        }\n        return;`;
    case 'counterSet':
      return `${comment}\n        counterValue = ${Math.trunc(instruction.value)};\n        pc = ${nextPc};\n        break;`;
    case 'counterChange':
      return `${comment}\n        counterValue += ${Math.trunc(instruction.delta)};\n        pc = ${nextPc};\n        break;`;
    case 'serial':
      return `${comment}\n        Serial.println(${cppString(instruction.text)});\n        pc = ${nextPc};\n        break;`;
    case 'tone':
      return `${comment}\n        ledcWriteTone(PIN_BUZZER, ${Math.max(20, Math.round(instruction.frequency))});\n        buzzerStopAt = now + ${Math.max(10, Math.round(instruction.durationMs))}U;\n        pc = ${nextPc};\n        break;`;
    case 'repeatStart':
      return `${comment}\n        if (loopCounters[${instruction.slot}] < 0) loopCounters[${instruction.slot}] = ${instruction.count};\n        if (loopCounters[${instruction.slot}] == 0) { loopCounters[${instruction.slot}] = -1; pc = ${instruction.end}; }\n        else { pc = ${nextPc}; }\n        break;`;
    case 'repeatNext':
      return `${comment}\n        --loopCounters[${instruction.slot}];\n        pc = ${instruction.target};\n        return; // cede al ESP32 al terminar cada vuelta`;
    case 'jumpIfFalse':
      return `${comment}\n        pc = (${conditionToCpp(instruction.condition)}) ? ${nextPc} : ${instruction.target};\n        break;`;
    case 'jump':
      return `${comment}\n        pc = ${instruction.target};\n        ${instruction.yieldAfter ? 'return; // bucle cooperativo: cede en cada vuelta' : 'break;'}`;
    case 'halt':
      return `${comment}\n        active = false;\n        return;`;
  }
}

export function generateEsp32Code(nodes: ProgramNode[], title: string) {
  const { output, loopSlots } = flattenProgram(nodes);
  const usesWifi = nodes.some(function hasWifi(node): boolean {
    if (node.op === 'wifi') return true;
    if (node.op === 'if')
      return (
        node.condition.kind === 'wifiConnected' ||
        node.consequent.some(hasWifi) ||
        node.otherwise.some(hasWifi)
      );
    if (node.op === 'repeat') return node.body.some(hasWifi);
    return false;
  });

  const cases = output
    .map(
      (instruction, index) =>
        `      case ${index}: {\n${instructionToCpp(instruction, index)}\n      }`,
    )
    .join('\n\n');

  const wifiHeader = usesWifi
    ? `#include <WiFi.h>

// Completa estas credenciales sólo en tu copia local.
const char* WIFI_SSID = "TU_RED";
const char* WIFI_PASSWORD = "TU_CLAVE";
`
    : '';

  return `// ${title}
// Generado por CapiBloques para WEMOS D1 R32
// Arduino-ESP32 3.3.11 | FQBN: esp32:esp32:d1_uno32
// Cooperativo: sin esperas bloqueantes y con cesión en cada bucle.

#include <Arduino.h>
${wifiHeader}
// Aliases físicos de la variante oficial WEMOS D1 R32.
constexpr uint8_t PIN_RED = D2;          // GPIO26
constexpr uint8_t PIN_YELLOW = D3;       // GPIO25
constexpr uint8_t PIN_GREEN = D6;        // GPIO27
constexpr uint8_t PIN_LEFT_IN1 = D4;     // GPIO17, DRV8833
constexpr uint8_t PIN_LEFT_IN2 = D5;     // GPIO16, DRV8833
constexpr uint8_t PIN_RIGHT_IN1 = D11;   // GPIO23, DRV8833
constexpr uint8_t PIN_RIGHT_IN2 = D12;   // GPIO19, DRV8833
constexpr uint8_t PIN_LED_PWM = D13;     // GPIO18
constexpr uint8_t PIN_SERVO = D7;        // GPIO14
constexpr uint8_t PIN_BUZZER = D9;       // GPIO13
constexpr uint8_t PIN_BUTTON = A1;       // GPIO4
constexpr uint8_t PIN_LIGHT_SENSOR = A2; // GPIO35, sólo entrada ADC1
constexpr uint8_t PIN_POTENTIOMETER = A3;// GPIO34, sólo entrada ADC1

enum class TrafficColor { RED, YELLOW, GREEN, OFF };

uint16_t pc = 0;
bool active = true;
bool waiting = false;
uint32_t waitStarted = 0;
int32_t counterValue = 0;
int32_t loopCounters[${loopSlots}] = { ${Array.from({ length: loopSlots }, () => '-1').join(', ')} };
uint32_t buzzerStopAt = 0;
${usesWifi ? 'bool wifiAttemptActive = false;\nuint32_t wifiAttemptStarted = 0;\n' : ''}
void setTraffic(TrafficColor color) {
  digitalWrite(PIN_RED, color == TrafficColor::RED ? HIGH : LOW);
  digitalWrite(PIN_YELLOW, color == TrafficColor::YELLOW ? HIGH : LOW);
  digitalWrite(PIN_GREEN, color == TrafficColor::GREEN ? HIGH : LOW);
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

void driveRobot(int leftSpeed, int rightSpeed) {
  // Se requiere un puente H DRV8833 y una fuente de motor separada.
  motorWrite(PIN_LEFT_IN1, PIN_LEFT_IN2, leftSpeed);
  motorWrite(PIN_RIGHT_IN1, PIN_RIGHT_IN2, rightSpeed);
}

void setServoAngle(int angle) {
  angle = constrain(angle, 0, 180);
  const uint32_t pulseMicros = 500U + ((uint32_t)angle * 2000U) / 180U;
  const uint32_t duty = (pulseMicros * 65535U) / 20000U;
  ledcWrite(PIN_SERVO, duty);
}

void runProgram(uint32_t now) {
  if (!active) return;

  for (uint8_t budget = 0; budget < 32; ++budget) {
    switch (pc) {
${cases}

      default:
        active = false;
        return;
    }
  }
  // Las acciones restantes continúan en el siguiente loop().
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RED, OUTPUT);
  pinMode(PIN_YELLOW, OUTPUT);
  pinMode(PIN_GREEN, OUTPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  analogReadResolution(12);
  ledcAttach(PIN_LEFT_IN1, 20000, 8);
  ledcAttach(PIN_LEFT_IN2, 20000, 8);
  ledcAttach(PIN_RIGHT_IN1, 20000, 8);
  ledcAttach(PIN_RIGHT_IN2, 20000, 8);
  ledcAttach(PIN_LED_PWM, 5000, 8);
  ledcAttach(PIN_SERVO, 50, 16);
  ledcAttach(PIN_BUZZER, 1000, 8);
  setTraffic(TrafficColor::OFF);
}

void loop() {
  const uint32_t now = millis();
  if (buzzerStopAt != 0 && (int32_t)(now - buzzerStopAt) >= 0) {
    ledcWriteTone(PIN_BUZZER, 0);
    ledcWrite(PIN_BUZZER, 0);
    buzzerStopAt = 0;
  }
  runProgram(now);
  yield();
}
`;
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
  return simplified || 'mi-proyecto';
}
