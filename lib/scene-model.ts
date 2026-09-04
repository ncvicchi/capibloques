/**
 * Versioned, serializable model for the scene builder.
 *
 * The model deliberately contains no React, Blockly or browser APIs. A scene can
 * therefore live inside the project JSON, be tested in Node and be migrated
 * without loading the visual editor.
 */

export const SCENE_SCHEMA_VERSION = 1 as const;

export const legacySceneIds = ['traffic', 'robot', 'wifi', 'counter'] as const;

export type LegacySceneId = (typeof legacySceneIds)[number];

export const sceneDeviceKinds = [
  'trafficLight',
  'robot',
  'motor',
  'led',
  'servo',
  'activeBuzzer',
  'passiveBuzzer',
  'button',
  'lightSensor',
  'potentiometer',
  'wifiNode',
] as const;

export type SceneDeviceKind = (typeof sceneDeviceKinds)[number];
export type SceneBackground = 'park' | 'workshop' | 'home' | 'pond' | 'blank';
export type PinNumber = number | null;
export type PinCapability = 'pwmOutput' | 'digitalInput' | 'analogInput';

export interface ScenePosition {
  x: number;
  y: number;
}

export interface SceneCanvas {
  width: number;
  height: number;
  background: SceneBackground;
  gridSize: number;
  snapToGrid: boolean;
}

interface SceneDeviceBase<
  Kind extends SceneDeviceKind,
  Pins extends Record<string, PinNumber>,
  Configuration extends Record<string, unknown>,
> {
  schemaVersion: typeof SCENE_SCHEMA_VERSION;
  id: string;
  kind: Kind;
  name: string;
  position: ScenePosition;
  rotation: number;
  pins: Pins;
  config: Configuration;
}

export type TrafficLightDevice = SceneDeviceBase<
  'trafficLight',
  { red: PinNumber; yellow: PinNumber; green: PinNumber },
  {
    redBrightness: number;
    yellowBrightness: number;
    greenBrightness: number;
  }
>;

export type RobotDevice = SceneDeviceBase<
  'robot',
  {
    leftIn1: PinNumber;
    leftIn2: PinNumber;
    rightIn1: PinNumber;
    rightIn2: PinNumber;
  },
  { speed: number; heading: number; color: string }
>;

export type MotorDevice = SceneDeviceBase<
  'motor',
  { in1: PinNumber; in2: PinNumber },
  { power: number; driver: 'DRV8833' }
>;

export type LedDevice = SceneDeviceBase<
  'led',
  { signal: PinNumber },
  { brightness: number; color: string }
>;

export type ServoDevice = SceneDeviceBase<
  'servo',
  { signal: PinNumber },
  { angle: number }
>;

export type ActiveBuzzerDevice = SceneDeviceBase<
  'activeBuzzer',
  { signal: PinNumber },
  { enabled: boolean }
>;

export type PassiveBuzzerDevice = SceneDeviceBase<
  'passiveBuzzer',
  { signal: PinNumber },
  { frequency: number; durationMs: number }
>;

export type ButtonDevice = SceneDeviceBase<
  'button',
  { signal: PinNumber },
  { pressed: boolean; pullup: boolean }
>;

export type LightSensorDevice = SceneDeviceBase<
  'lightSensor',
  { signal: PinNumber },
  { value: number }
>;

export type PotentiometerDevice = SceneDeviceBase<
  'potentiometer',
  { signal: PinNumber },
  { value: number }
>;

export type WifiNodeDevice = SceneDeviceBase<
  'wifiNode',
  Record<never, never>,
  {
    status: 'idle' | 'connecting' | 'connected' | 'error';
    ssid: string;
  }
>;

export interface SceneDeviceByKind {
  trafficLight: TrafficLightDevice;
  robot: RobotDevice;
  motor: MotorDevice;
  led: LedDevice;
  servo: ServoDevice;
  activeBuzzer: ActiveBuzzerDevice;
  passiveBuzzer: PassiveBuzzerDevice;
  button: ButtonDevice;
  lightSensor: LightSensorDevice;
  potentiometer: PotentiometerDevice;
  wifiNode: WifiNodeDevice;
}

export type SceneDevice = SceneDeviceByKind[SceneDeviceKind];

export interface CounterWidget {
  schemaVersion: typeof SCENE_SCHEMA_VERSION;
  id: string;
  kind: 'counter';
  name: string;
  position: ScenePosition;
  config: { value: number; mascot: string };
}

export type SceneWidget = CounterWidget;

export interface SceneDefinition {
  schemaVersion: typeof SCENE_SCHEMA_VERSION;
  id: string;
  name: string;
  description: string;
  canvas: SceneCanvas;
  devices: SceneDevice[];
  widgets: SceneWidget[];
  /**
   * Device identities that were removed from this scene. They are kept in the
   * project file so an orphan Blockly block can never start controlling a new
   * physical component merely because its old id was recycled.
   *
   * Optional for backwards compatibility with scene schema v1 files created
   * before identity tombstones were introduced.
   */
  retiredDeviceIds?: string[];
  sourceTemplate?: LegacySceneId;
}

export interface PinRequirement {
  key: string;
  label: string;
  capability: PinCapability;
}

export interface SceneComponentCatalogEntry {
  kind: SceneDeviceKind;
  icon: string;
  name: string;
  description: string;
  childFriendlyControl: string;
  pinRequirements: readonly PinRequirement[];
}

export interface WemosPinDefinition {
  gpio: number;
  label: string;
  capabilities: readonly PinCapability[];
  recommended: boolean;
  note?: string;
}

/**
 * Conservative pin set for the Wemos D1 R32. Boot-strapping pins are excluded
 * from automatic output allocation. GPIO 34–39 are input-only and are used for
 * ADC sensors. Explicit advanced-mode assignments can still be validated.
 */
export const wemosD1R32Pins: readonly WemosPinDefinition[] = [
  {
    gpio: 26,
    label: 'D2',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 25,
    label: 'D3',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 17,
    label: 'D4',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 16,
    label: 'D5',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 27,
    label: 'D6',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 14,
    label: 'D7',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 13,
    label: 'D9',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 23,
    label: 'D11',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 19,
    label: 'D12',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 18,
    label: 'D13',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
  },
  {
    gpio: 4,
    label: 'A1',
    capabilities: ['pwmOutput', 'digitalInput'],
    recommended: true,
    note: 'Preferido para botón; su ADC pertenece a ADC2.',
  },
  {
    gpio: 35,
    label: 'A2',
    capabilities: ['digitalInput', 'analogInput'],
    recommended: true,
    note: 'ADC1, solo entrada y sin resistencia pull-up interna.',
  },
  {
    gpio: 34,
    label: 'A3',
    capabilities: ['digitalInput', 'analogInput'],
    recommended: true,
    note: 'ADC1, solo entrada y sin resistencia pull-up interna.',
  },
  {
    gpio: 36,
    label: 'A4',
    capabilities: ['digitalInput', 'analogInput'],
    recommended: true,
    note: 'ADC1, solo entrada y sin resistencia pull-up interna.',
  },
  {
    gpio: 39,
    label: 'A5',
    capabilities: ['digitalInput', 'analogInput'],
    recommended: true,
    note: 'ADC1, solo entrada y sin resistencia pull-up interna.',
  },
] as const;

export const safeWemosOutputPins = [
  26, 25, 27, 17, 16, 23, 19, 18, 14, 13,
] as const;
export const safeWemosDigitalInputPins = [
  4, 26, 25, 27, 17, 16, 23, 19, 18, 14, 13,
] as const;
export const safeWemosAnalogInputPins = [35, 34, 36, 39] as const;

const requirementsByKind: Record<SceneDeviceKind, readonly PinRequirement[]> = {
  trafficLight: [
    { key: 'red', label: 'LED rojo', capability: 'pwmOutput' },
    { key: 'yellow', label: 'LED amarillo', capability: 'pwmOutput' },
    { key: 'green', label: 'LED verde', capability: 'pwmOutput' },
  ],
  robot: [
    { key: 'leftIn1', label: 'Motor izquierdo IN1', capability: 'pwmOutput' },
    { key: 'leftIn2', label: 'Motor izquierdo IN2', capability: 'pwmOutput' },
    { key: 'rightIn1', label: 'Motor derecho IN1', capability: 'pwmOutput' },
    { key: 'rightIn2', label: 'Motor derecho IN2', capability: 'pwmOutput' },
  ],
  motor: [
    { key: 'in1', label: 'DRV8833 IN1', capability: 'pwmOutput' },
    { key: 'in2', label: 'DRV8833 IN2', capability: 'pwmOutput' },
  ],
  led: [{ key: 'signal', label: 'LED', capability: 'pwmOutput' }],
  servo: [{ key: 'signal', label: 'Señal', capability: 'pwmOutput' }],
  activeBuzzer: [{ key: 'signal', label: 'Señal', capability: 'pwmOutput' }],
  passiveBuzzer: [
    { key: 'signal', label: 'Señal PWM', capability: 'pwmOutput' },
  ],
  button: [
    { key: 'signal', label: 'Entrada del botón', capability: 'digitalInput' },
  ],
  lightSensor: [
    { key: 'signal', label: 'Lectura de luz', capability: 'analogInput' },
  ],
  potentiometer: [
    { key: 'signal', label: 'Lectura de posición', capability: 'analogInput' },
  ],
  wifiNode: [],
};

export const sceneComponentCatalog: readonly SceneComponentCatalogEntry[] = [
  {
    kind: 'trafficLight',
    icon: '🚦',
    name: 'Semáforo',
    description: 'Tres luces que pueden encenderse y regular su brillo.',
    childFriendlyControl: 'Rojo, amarillo, verde o apagado',
    pinRequirements: requirementsByKind.trafficLight,
  },
  {
    kind: 'robot',
    icon: '🤖',
    name: 'Robot con dos motores',
    description: 'Robot móvil conectado a un controlador DRV8833.',
    childFriendlyControl: 'Dirección y velocidad',
    pinRequirements: requirementsByKind.robot,
  },
  {
    kind: 'motor',
    icon: '⚙️',
    name: 'Motor DC',
    description: 'Un motor conectado a un canal del DRV8833.',
    childFriendlyControl: 'Potencia de −100 a 100%',
    pinRequirements: requirementsByKind.motor,
  },
  {
    kind: 'led',
    icon: '💡',
    name: 'LED',
    description: 'Una luz de color con brillo regulable.',
    childFriendlyControl: 'Color y brillo',
    pinRequirements: requirementsByKind.led,
  },
  {
    kind: 'servo',
    icon: '🦾',
    name: 'Servo',
    description: 'Brazo que apunta a un ángulo entre 0 y 180 grados.',
    childFriendlyControl: 'Ángulo',
    pinRequirements: requirementsByKind.servo,
  },
  {
    kind: 'activeBuzzer',
    icon: '📣',
    name: 'Buzzer activo',
    description: 'Emite un sonido fijo al encenderlo.',
    childFriendlyControl: 'Encender o apagar',
    pinRequirements: requirementsByKind.activeBuzzer,
  },
  {
    kind: 'passiveBuzzer',
    icon: '🎵',
    name: 'Buzzer pasivo',
    description: 'Crea notas con distintas frecuencias y duraciones.',
    childFriendlyControl: 'Nota y duración',
    pinRequirements: requirementsByKind.passiveBuzzer,
  },
  {
    kind: 'button',
    icon: '🔘',
    name: 'Botón',
    description: 'Entrada digital para iniciar acciones.',
    childFriendlyControl: 'Presionado o libre',
    pinRequirements: requirementsByKind.button,
  },
  {
    kind: 'lightSensor',
    icon: '☀️',
    name: 'Sensor de luz',
    description: 'Mide el nivel de iluminación con una LDR.',
    childFriendlyControl: 'Nivel de 0 a 4095',
    pinRequirements: requirementsByKind.lightSensor,
  },
  {
    kind: 'potentiometer',
    icon: '🎚️',
    name: 'Potenciómetro',
    description: 'Perilla que entrega un valor analógico.',
    childFriendlyControl: 'Posición de 0 a 4095',
    pinRequirements: requirementsByKind.potentiometer,
  },
  {
    kind: 'wifiNode',
    icon: '📶',
    name: 'Conexión Wi-Fi',
    description: 'Representa la conexión inalámbrica integrada del ESP32.',
    childFriendlyControl: 'Conectar y consultar estado',
    pinRequirements: requirementsByKind.wifiNode,
  },
] as const;

const kindLabels: Record<SceneDeviceKind, string> = Object.fromEntries(
  sceneComponentCatalog.map((entry) => [entry.kind, entry.name]),
) as Record<SceneDeviceKind, string>;

const kindIdBases: Record<SceneDeviceKind, string> = {
  trafficLight: 'traffic-light',
  robot: 'robot',
  motor: 'motor',
  led: 'led',
  servo: 'servo',
  activeBuzzer: 'active-buzzer',
  passiveBuzzer: 'passive-buzzer',
  button: 'button',
  lightSensor: 'light-sensor',
  potentiometer: 'potentiometer',
  wifiNode: 'wifi-node',
};

const defaultCanvas: SceneCanvas = {
  width: 960,
  height: 540,
  background: 'blank',
  gridSize: 20,
  snapToGrid: true,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeRotation(rotation: number) {
  if (!Number.isFinite(rotation)) return 0;
  return ((rotation % 360) + 360) % 360;
}

function cloneDevice(device: SceneDevice): SceneDevice {
  return {
    ...device,
    position: { ...device.position },
    pins: { ...device.pins },
    config: { ...device.config },
  } as SceneDevice;
}

function cloneWidget(widget: SceneWidget): SceneWidget {
  return {
    ...widget,
    position: { ...widget.position },
    config: { ...widget.config },
  };
}

export function cloneScene(
  scene: SceneDefinition,
  overrides: Partial<
    Pick<SceneDefinition, 'id' | 'name' | 'description' | 'sourceTemplate'>
  > = {},
): SceneDefinition {
  return {
    ...scene,
    ...overrides,
    canvas: { ...scene.canvas },
    devices: scene.devices.map(cloneDevice),
    widgets: scene.widgets.map(cloneWidget),
    retiredDeviceIds: [...(scene.retiredDeviceIds ?? [])],
  };
}

const MAX_SCENE_ITEMS = 256;
const MAX_RETIRED_DEVICE_IDS = 4096;
const MAX_GENERATED_ID_SEQUENCE = MAX_SCENE_ITEMS + MAX_RETIRED_DEVICE_IDS + 1;

function createUnusedId(base: string, usedIds: Iterable<string>) {
  const used = new Set(usedIds);
  // A valid scene contains at most MAX_SCENE_ITEMS live items. Even after many
  // deletions this bounded search cannot freeze the editor on hostile input.
  for (let sequence = 1; sequence <= MAX_GENERATED_ID_SEQUENCE; sequence += 1) {
    const candidate = `${base}-${sequence}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(
    'La escena agotó sus identificadores seguros. Guarda una copia y crea una escena nueva.',
  );
}

export function createStableDeviceId(
  kind: SceneDeviceKind,
  usedIds: Iterable<string>,
) {
  return createUnusedId(kindIdBases[kind], usedIds);
}

function createStableId(base: string, usedIds: Iterable<string>) {
  return createUnusedId(base, usedIds);
}

function visibleNameKey(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');
}

/**
 * Keeps an item's preferred visible name when possible and only numbers the new
 * item when it would be confused with one already in the scene. Numeric suffixes
 * continue naturally: "Semáforo principal 2" becomes "Semáforo principal 3".
 */
function createUniqueVisibleName(
  preferredName: string,
  existingNames: Iterable<string>,
  fallback: string,
) {
  const preferred = normalizeName(preferredName, fallback);
  const used = new Set(Array.from(existingNames, visibleNameKey));
  if (!used.has(visibleNameKey(preferred))) return preferred;

  const match = preferred.match(/^(.*?)(?:\s+(\d+))?$/);
  const parsedSuffix = match?.[2] ? Number(match[2]) : undefined;
  const hasSafeSuffix =
    parsedSuffix !== undefined &&
    Number.isSafeInteger(parsedSuffix) &&
    parsedSuffix >= 1;
  const stem = normalizeName(
    hasSafeSuffix ? (match?.[1] ?? preferred) : preferred,
    fallback,
  );
  let sequence =
    hasSafeSuffix && parsedSuffix < Number.MAX_SAFE_INTEGER - MAX_SCENE_ITEMS
      ? parsedSuffix + 1
      : 2;

  // There are more candidates than live scene items, so a valid scene always
  // finds a free name. The explicit bound also makes this safe for malformed
  // programmatic callers and numbers at JavaScript's precision limit.
  const attemptLimit = Math.min(
    MAX_GENERATED_ID_SEQUENCE,
    Math.max(MAX_SCENE_ITEMS + 1, used.size + 1),
  );
  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    const suffix = ` ${sequence}`;
    const candidate = `${stem.slice(0, 60 - suffix.length).trimEnd()}${suffix}`;
    if (!used.has(visibleNameKey(candidate))) return candidate;
    sequence += 1;
  }
  throw new Error(
    'No se pudo crear un nombre único. Cambia el nombre de algún componente.',
  );
}

function sceneItemNames(scene: SceneDefinition) {
  return [
    ...scene.devices.map((device) => device.name),
    ...scene.widgets.map((widget) => widget.name),
  ];
}

function suggestedPosition(
  index: number,
  canvas = defaultCanvas,
): ScenePosition {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: clamp(120 + column * 200, 40, canvas.width - 40),
    y: clamp(130 + row * 160, 40, canvas.height - 40),
  };
}

export interface DeviceCreationOptions<K extends SceneDeviceKind> {
  id?: string;
  name?: string;
  position?: ScenePosition;
  rotation?: number;
  pins?: Partial<SceneDeviceByKind[K]['pins']>;
  config?: Partial<SceneDeviceByKind[K]['config']>;
  autoAssignPins?: boolean;
}

function unassignedDevice<K extends SceneDeviceKind>(
  kind: K,
  existingDevices: readonly SceneDevice[],
  options: DeviceCreationOptions<K>,
): SceneDeviceByKind[K] {
  const sameKindCount = existingDevices.filter(
    (device) => device.kind === kind,
  ).length;
  const base = {
    schemaVersion: SCENE_SCHEMA_VERSION,
    id:
      options.id ??
      createStableDeviceId(
        kind,
        existingDevices.map((device) => device.id),
      ),
    name: createUniqueVisibleName(
      options.name ?? `${kindLabels[kind]} ${sameKindCount + 1}`,
      existingDevices.map((device) => device.name),
      kindLabels[kind],
    ),
    position: options.position
      ? { ...options.position }
      : suggestedPosition(existingDevices.length),
    rotation: normalizeRotation(options.rotation ?? 0),
  };

  let device: SceneDevice;
  switch (kind) {
    case 'trafficLight':
      device = {
        ...base,
        kind,
        pins: { red: null, yellow: null, green: null },
        config: {
          redBrightness: 0,
          yellowBrightness: 0,
          greenBrightness: 0,
        },
      };
      break;
    case 'robot':
      device = {
        ...base,
        kind,
        pins: {
          leftIn1: null,
          leftIn2: null,
          rightIn1: null,
          rightIn2: null,
        },
        config: { speed: 0, heading: 0, color: '#38bdf8' },
      };
      break;
    case 'motor':
      device = {
        ...base,
        kind,
        pins: { in1: null, in2: null },
        config: { power: 0, driver: 'DRV8833' },
      };
      break;
    case 'led':
      device = {
        ...base,
        kind,
        pins: { signal: null },
        config: { brightness: 0, color: '#facc15' },
      };
      break;
    case 'servo':
      device = {
        ...base,
        kind,
        pins: { signal: null },
        config: { angle: 90 },
      };
      break;
    case 'activeBuzzer':
      device = {
        ...base,
        kind,
        pins: { signal: null },
        config: { enabled: false },
      };
      break;
    case 'passiveBuzzer':
      device = {
        ...base,
        kind,
        pins: { signal: null },
        config: { frequency: 440, durationMs: 250 },
      };
      break;
    case 'button':
      device = {
        ...base,
        kind,
        pins: { signal: null },
        config: { pressed: false, pullup: true },
      };
      break;
    case 'lightSensor':
      device = {
        ...base,
        kind,
        pins: { signal: null },
        config: { value: 2048 },
      };
      break;
    case 'potentiometer':
      device = {
        ...base,
        kind,
        pins: { signal: null },
        config: { value: 2048 },
      };
      break;
    case 'wifiNode':
      device = {
        ...base,
        kind,
        pins: {},
        config: { status: 'idle', ssid: 'CapiRed' },
      };
      break;
  }

  return {
    ...device,
    pins: { ...device.pins, ...options.pins },
    config: { ...device.config, ...options.config },
  } as SceneDeviceByKind[K];
}

function pinRecord(device: SceneDevice) {
  return device.pins as Record<string, PinNumber>;
}

function candidatePins(capability: PinCapability): readonly number[] {
  switch (capability) {
    case 'pwmOutput':
      return safeWemosOutputPins;
    case 'digitalInput':
      return safeWemosDigitalInputPins;
    case 'analogInput':
      return safeWemosAnalogInputPins;
  }
}

function pinSupports(pin: number, capability: PinCapability) {
  return wemosD1R32Pins.some(
    (definition) =>
      definition.gpio === pin && definition.capabilities.includes(capability),
  );
}

export function pinLabel(pin: PinNumber) {
  if (pin === null) return 'Sin asignar';
  const definition = wemosD1R32Pins.find((item) => item.gpio === pin);
  return definition ? `${definition.label} (GPIO ${pin})` : `GPIO ${pin}`;
}

interface PinSlot {
  deviceIndex: number;
  deviceId: string;
  deviceName: string;
  key: string;
  label: string;
  capability: PinCapability;
  pin: PinNumber;
}

function collectPinSlots(devices: readonly SceneDevice[]): PinSlot[] {
  return devices.flatMap((device, deviceIndex) =>
    requirementsByKind[device.kind].map((requirement) => ({
      deviceIndex,
      deviceId: device.id,
      deviceName: device.name,
      key: requirement.key,
      label: requirement.label,
      capability: requirement.capability,
      pin: pinRecord(device)[requirement.key] ?? null,
    })),
  );
}

export interface PinAssignmentOptions {
  reassignAll?: boolean;
}

export interface PinAssignmentResult {
  scene: SceneDefinition;
  warnings: string[];
}

/**
 * Assigns conservative board pins without making hardware availability a
 * simulation requirement. Valid existing assignments are preserved; duplicate
 * or invalid assignments are moved when another safe pin exists.
 */
export function assignSafePins(
  source: SceneDefinition,
  options: PinAssignmentOptions = {},
): PinAssignmentResult {
  const scene = cloneScene(source);
  const warnings: string[] = [];
  const used = new Map<number, PinSlot>();
  const slots = collectPinSlots(scene.devices);

  for (const slot of slots) {
    if (options.reassignAll || slot.pin === null) continue;
    if (!pinSupports(slot.pin, slot.capability)) continue;
    if (!used.has(slot.pin)) used.set(slot.pin, slot);
  }

  for (const slot of slots) {
    const current = options.reassignAll ? null : slot.pin;
    const owner = current === null ? undefined : used.get(current);
    const currentIsUsable =
      current !== null &&
      pinSupports(current, slot.capability) &&
      owner?.deviceId === slot.deviceId &&
      owner.key === slot.key;

    if (currentIsUsable) continue;

    if (current !== null && !pinSupports(current, slot.capability)) {
      warnings.push(
        `${slot.deviceName}: ${pinLabel(current)} no sirve para ${slot.label}; se intentará reasignar.`,
      );
    } else if (current !== null && owner) {
      warnings.push(
        `${slot.deviceName}: ${pinLabel(current)} ya está usado por ${owner.deviceName}; se intentará reasignar.`,
      );
    }

    const selected = candidatePins(slot.capability).find(
      (candidate) => !used.has(candidate),
    );
    const device = scene.devices[slot.deviceIndex];
    device.pins = {
      ...device.pins,
      [slot.key]: selected ?? null,
    } as SceneDevice['pins'];

    if (selected === undefined) {
      warnings.push(
        `${slot.deviceName}: no quedan pines seguros para ${slot.label}. Puede seguir simulándose, pero necesita resolver el cableado antes de cargarlo en la Wemos.`,
      );
    } else {
      used.set(selected, { ...slot, pin: selected });
    }
  }

  return { scene, warnings };
}

export function createSceneDevice<K extends SceneDeviceKind>(
  kind: K,
  existingDevices: readonly SceneDevice[] = [],
  options: DeviceCreationOptions<K> = {},
): SceneDeviceByKind[K] {
  const device = unassignedDevice(kind, existingDevices, options);
  if (options.autoAssignPins === false || kind === 'wifiNode') return device;

  const temporaryScene: SceneDefinition = {
    schemaVersion: SCENE_SCHEMA_VERSION,
    id: 'pin-allocation',
    name: 'Asignación temporal',
    description: '',
    canvas: { ...defaultCanvas },
    devices: [...existingDevices.map(cloneDevice), device],
    widgets: [],
  };
  const assigned = assignSafePins(temporaryScene).scene.devices.at(-1);
  return (assigned ?? device) as SceneDeviceByKind[K];
}

export interface CreateSceneOptions {
  id?: string;
  description?: string;
  canvas?: Partial<SceneCanvas>;
}

export function createEmptyScene(
  name = 'Mi aventura',
  options: CreateSceneOptions = {},
): SceneDefinition {
  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
    id: options.id ?? `scene-${slugify(name) || 'adventure'}`,
    name: normalizeName(name, 'Mi aventura'),
    description: options.description ?? '',
    canvas: { ...defaultCanvas, ...options.canvas },
    devices: [],
    widgets: [],
    retiredDeviceIds: [],
  };
}

export interface AddDeviceResult extends PinAssignmentResult {
  device: SceneDevice;
}

export function addDeviceToScene<K extends SceneDeviceKind>(
  source: SceneDefinition,
  kind: K,
  options: DeviceCreationOptions<K> = {},
): AddDeviceResult {
  const scene = cloneScene(source);
  if (scene.devices.length + scene.widgets.length >= MAX_SCENE_ITEMS) {
    throw new Error(
      `Una escena admite hasta ${MAX_SCENE_ITEMS} componentes para mantener el editor fluido.`,
    );
  }
  const reservedIds = [
    ...scene.devices.map((item) => item.id),
    ...scene.widgets.map((item) => item.id),
    ...(scene.retiredDeviceIds ?? []),
  ];
  const device = createSceneDevice(kind, scene.devices, {
    ...options,
    id: options.id ?? createStableDeviceId(kind, reservedIds),
  });
  device.name = createUniqueVisibleName(
    device.name,
    sceneItemNames(scene),
    kindLabels[kind],
  );
  scene.devices.push(device);
  const assigned = assignSafePins(scene);
  return {
    ...assigned,
    device:
      assigned.scene.devices.find((item) => item.id === device.id) ?? device,
  };
}

export function duplicateSceneDevice(
  source: SceneDefinition,
  deviceId: string,
  offset: ScenePosition = { x: 30, y: 30 },
): AddDeviceResult | null {
  const original = source.devices.find((device) => device.id === deviceId);
  if (!original) return null;
  const pins = Object.fromEntries(
    Object.keys(original.pins).map((key) => [key, null]),
  );
  return addDeviceToScene(source, original.kind, {
    name: original.name,
    position: {
      x: clamp(original.position.x + offset.x, 0, source.canvas.width),
      y: clamp(original.position.y + offset.y, 0, source.canvas.height),
    },
    rotation: original.rotation,
    pins,
    config: original.config,
  });
}

export interface DuplicateWidgetResult {
  scene: SceneDefinition;
  widget: SceneWidget;
}

export function duplicateSceneWidget(
  source: SceneDefinition,
  widgetId: string,
  offset: ScenePosition = { x: 30, y: 30 },
): DuplicateWidgetResult | null {
  const original = source.widgets.find((widget) => widget.id === widgetId);
  if (!original) return null;

  // The program model intentionally has one global counter. Rendering a second
  // counter made two controls look independent while showing the same value.
  void offset;
  return null;
}

export function removeDeviceFromScene(
  source: SceneDefinition,
  deviceId: string,
) {
  const scene = cloneScene(source);
  const removed = scene.devices.find((device) => device.id === deviceId);
  scene.devices = scene.devices.filter((device) => device.id !== deviceId);
  if (removed && !(scene.retiredDeviceIds ?? []).includes(removed.id)) {
    scene.retiredDeviceIds = [...(scene.retiredDeviceIds ?? []), removed.id];
    if (scene.retiredDeviceIds.length > MAX_RETIRED_DEVICE_IDS) {
      throw new Error(
        'La escena alcanzó el límite de componentes eliminados. Guarda una copia y crea una escena nueva para continuar.',
      );
    }
  }
  return scene;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function isControlCharacter(character: string) {
  const code = character.charCodeAt(0);
  return code <= 31 || code === 127;
}

function normalizeName(value: string, fallback: string) {
  const normalized = value
    .split('')
    .filter((character) => !isControlCharacter(character))
    .join('')
    .trim();
  return normalized.slice(0, 60) || fallback;
}

function templateDevice<K extends SceneDeviceKind>(
  kind: K,
  devices: readonly SceneDevice[],
  options: DeviceCreationOptions<K>,
) {
  return createSceneDevice(kind, devices, {
    ...options,
    autoAssignPins: false,
  });
}

const trafficTemplate = createEmptyScene('Semáforo de la plaza', {
  id: 'scene-traffic',
  description: 'Una calle con un semáforo programable.',
  canvas: { background: 'park' },
});
trafficTemplate.sourceTemplate = 'traffic';
trafficTemplate.devices.push(
  templateDevice('trafficLight', trafficTemplate.devices, {
    id: 'traffic-light-1',
    name: 'Semáforo principal',
    position: { x: 300, y: 220 },
    pins: { red: 26, yellow: 25, green: 27 },
  }),
);

const robotTemplate = createEmptyScene('Robot explorador', {
  id: 'scene-robot',
  description: 'Un robot que recorre el taller y esquiva obstáculos.',
  canvas: { background: 'workshop' },
});
robotTemplate.sourceTemplate = 'robot';
robotTemplate.devices.push(
  templateDevice('robot', robotTemplate.devices, {
    id: 'robot-1',
    name: 'Robot explorador',
    position: { x: 430, y: 280 },
    pins: { leftIn1: 17, leftIn2: 16, rightIn1: 23, rightIn2: 19 },
  }),
);

const wifiTemplate = createEmptyScene('Señal Wi-Fi', {
  id: 'scene-wifi',
  description: 'Una casa conectada con luces de estado.',
  canvas: { background: 'home' },
});
wifiTemplate.sourceTemplate = 'wifi';
wifiTemplate.devices.push(
  templateDevice('wifiNode', wifiTemplate.devices, {
    id: 'wifi-node-1',
    name: 'Router de la casa',
    position: { x: 430, y: 170 },
  }),
  templateDevice('led', wifiTemplate.devices, {
    id: 'led-1',
    name: 'Luz sin conexión',
    position: { x: 360, y: 310 },
    pins: { signal: 26 },
    config: { color: '#ef4444' },
  }),
  templateDevice('led', wifiTemplate.devices, {
    id: 'led-2',
    name: 'Luz conectado',
    position: { x: 500, y: 310 },
    pins: { signal: 27 },
    config: { color: '#22c55e' },
  }),
);

const counterTemplate = createEmptyScene('Contador de saltos', {
  id: 'scene-counter',
  description: 'Una rana cuenta sus saltos y celebra con una nota.',
  canvas: { background: 'pond' },
});
counterTemplate.sourceTemplate = 'counter';
counterTemplate.widgets.push({
  schemaVersion: SCENE_SCHEMA_VERSION,
  id: 'counter-1',
  kind: 'counter',
  name: 'Contador de saltos',
  position: { x: 430, y: 130 },
  config: { value: 0, mascot: '🐸' },
});
counterTemplate.devices.push(
  templateDevice('passiveBuzzer', counterTemplate.devices, {
    id: 'passive-buzzer-1',
    name: 'Buzzer de celebración',
    position: { x: 650, y: 320 },
    pins: { signal: 13 },
  }),
);

export const sceneTemplates: Readonly<Record<LegacySceneId, SceneDefinition>> =
  {
    traffic: trafficTemplate,
    robot: robotTemplate,
    wifi: wifiTemplate,
    counter: counterTemplate,
  };

export function createSceneFromTemplate(templateId: LegacySceneId) {
  return cloneScene(sceneTemplates[templateId]);
}

/** Backward-compatible migration for the old four-value SceneId field. */
export function migrateLegacyScene(sceneId: LegacySceneId) {
  return createSceneFromTemplate(sceneId);
}

export interface AppendTemplateOptions {
  offset?: ScenePosition;
}

export interface SceneCompositionResult extends PinAssignmentResult {
  addedDeviceIds: string[];
}

export function appendTemplateToScene(
  source: SceneDefinition,
  templateId: LegacySceneId,
  options: AppendTemplateOptions = {},
): SceneCompositionResult {
  const scene = cloneScene(source);
  const template = sceneTemplates[templateId];
  const offset = options.offset ?? { x: 40, y: 40 };
  const addedDeviceIds: string[] = [];
  const warnings: string[] = [];

  if (
    template.widgets.some((widget) => widget.kind === 'counter') &&
    scene.widgets.some((widget) => widget.kind === 'counter')
  ) {
    const assigned = assignSafePins(scene);
    return {
      ...assigned,
      warnings: [
        'La escena ya tiene el contador global; la plantilla no se agregó otra vez.',
        ...assigned.warnings,
      ],
      addedDeviceIds,
    };
  }

  for (const templateItem of template.devices) {
    if (scene.devices.length + scene.widgets.length >= MAX_SCENE_ITEMS) {
      warnings.push(
        `No se agregaron más componentes: la escena alcanzó el límite de ${MAX_SCENE_ITEMS}.`,
      );
      break;
    }
    const pins = Object.fromEntries(
      Object.keys(templateItem.pins).map((key) => [key, null]),
    );
    const reservedIds = [
      ...scene.devices.map((item) => item.id),
      ...scene.widgets.map((item) => item.id),
      ...(scene.retiredDeviceIds ?? []),
    ];
    const device = createSceneDevice(templateItem.kind, scene.devices, {
      id: createStableDeviceId(templateItem.kind, reservedIds),
      name: createUniqueVisibleName(
        templateItem.name,
        sceneItemNames(scene),
        kindLabels[templateItem.kind],
      ),
      position: {
        x: clamp(templateItem.position.x + offset.x, 0, scene.canvas.width),
        y: clamp(templateItem.position.y + offset.y, 0, scene.canvas.height),
      },
      rotation: templateItem.rotation,
      pins,
      config: templateItem.config,
      autoAssignPins: false,
    });
    scene.devices.push(device);
    addedDeviceIds.push(device.id);
  }

  for (const widget of template.widgets) {
    if (
      widget.kind === 'counter' &&
      scene.widgets.some((item) => item.kind === 'counter')
    ) {
      warnings.push(
        'La escena ya tiene el contador global; no se agregó un segundo indicador idéntico.',
      );
      continue;
    }
    if (scene.devices.length + scene.widgets.length >= MAX_SCENE_ITEMS) {
      warnings.push(
        `No se agregaron más componentes: la escena alcanzó el límite de ${MAX_SCENE_ITEMS}.`,
      );
      break;
    }
    scene.widgets.push({
      ...cloneWidget(widget),
      id: createStableId(widget.kind, [
        ...scene.devices.map((item) => item.id),
        ...scene.widgets.map((item) => item.id),
        ...(scene.retiredDeviceIds ?? []),
      ]),
      name: createUniqueVisibleName(
        widget.name,
        sceneItemNames(scene),
        'Contador',
      ),
      position: {
        x: clamp(widget.position.x + offset.x, 0, scene.canvas.width),
        y: clamp(widget.position.y + offset.y, 0, scene.canvas.height),
      },
    });
  }

  const assigned = assignSafePins(scene);
  return {
    ...assigned,
    warnings: [...new Set([...warnings, ...assigned.warnings])],
    addedDeviceIds,
  };
}

export function composeSceneTemplates(
  templateIds: readonly LegacySceneId[],
  name = 'Escena combinada',
): SceneCompositionResult {
  let scene = createEmptyScene(name);
  const warnings: string[] = [];
  const addedDeviceIds: string[] = [];

  templateIds.forEach((templateId, index) => {
    const result = appendTemplateToScene(scene, templateId, {
      offset: { x: index * 70, y: index * 30 },
    });
    scene = result.scene;
    warnings.push(...result.warnings);
    addedDeviceIds.push(...result.addedDeviceIds);
  });

  return { scene, warnings: [...new Set(warnings)], addedDeviceIds };
}

export type SceneValidationIssueCode =
  | 'invalid-scene-name'
  | 'invalid-scene-id'
  | 'too-many-items'
  | 'invalid-device-id'
  | 'invalid-device-name'
  | 'duplicate-device-id'
  | 'invalid-widget-id'
  | 'invalid-widget-name'
  | 'duplicate-item-id'
  | 'duplicate-item-name'
  | 'multiple-counter-widgets'
  | 'invalid-retired-device-id'
  | 'active-id-is-retired'
  | 'invalid-position'
  | 'invalid-rotation'
  | 'missing-pin'
  | 'unsupported-pin'
  | 'pin-conflict'
  | 'pwm-channel-limit'
  | 'passive-buzzer-limit'
  | 'button-pullup-unavailable'
  | 'external-motor-power'
  | 'external-servo-power'
  | 'led-resistor-required';

export interface SceneValidationIssue {
  code: SceneValidationIssueCode;
  severity: 'error' | 'warning';
  message: string;
  deviceId?: string;
  itemId?: string;
  pin?: number;
}

export interface SceneValidationResult {
  valid: boolean;
  canSimulate: boolean;
  hardwareReady: boolean;
  issues: SceneValidationIssue[];
}

function nameIsValid(name: string) {
  const trimmed = name.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 60 &&
    !trimmed.split('').some(isControlCharacter)
  );
}

function itemIdIsValid(id: string) {
  const trimmed = id.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 128 &&
    !trimmed.split('').some(isControlCharacter)
  );
}

function positionIsInsideCanvas(position: ScenePosition, canvas: SceneCanvas) {
  return (
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.x >= 0 &&
    position.x <= canvas.width &&
    position.y >= 0 &&
    position.y <= canvas.height
  );
}

function pwmChannelCount(devices: readonly SceneDevice[]) {
  return devices.reduce((total, device) => {
    switch (device.kind) {
      case 'robot':
        return total + 4;
      case 'motor':
        return total + 2;
      case 'led':
      case 'servo':
      case 'activeBuzzer':
      case 'passiveBuzzer':
        return total + 1;
      default:
        return total;
    }
  }, 0);
}

/**
 * Validates both editor identity and physical wiring. Missing/conflicting pins
 * are warnings: they disable hardware readiness, never browser simulation.
 */
export function validateScene(scene: SceneDefinition): SceneValidationResult {
  const issues: SceneValidationIssue[] = [];
  if (!itemIdIsValid(scene.id)) {
    issues.push({
      code: 'invalid-scene-id',
      severity: 'error',
      message: 'La identidad interna de la escena está dañada.',
      itemId: scene.id,
    });
  }
  if (!nameIsValid(scene.name)) {
    issues.push({
      code: 'invalid-scene-name',
      severity: 'error',
      message: 'La escena necesita un nombre de entre 1 y 60 caracteres.',
    });
  }

  if (scene.devices.length + scene.widgets.length > MAX_SCENE_ITEMS) {
    issues.push({
      code: 'too-many-items',
      severity: 'error',
      message: `La escena tiene demasiados elementos. El máximo es ${MAX_SCENE_ITEMS}.`,
    });
  }

  const ids = new Set<string>();
  const visibleNames = new Map<string, string>();
  const occupied = new Map<number, PinSlot>();
  for (const device of scene.devices) {
    if (!itemIdIsValid(device.id)) {
      issues.push({
        code: 'invalid-device-id',
        severity: 'error',
        message: `${device.name}: su identidad interna no es válida.`,
        deviceId: device.id,
      });
    }
    if (!nameIsValid(device.name)) {
      issues.push({
        code: 'invalid-device-name',
        severity: 'error',
        message: `${device.id}: el nombre debe tener entre 1 y 60 caracteres.`,
        deviceId: device.id,
      });
    }
    if (ids.has(device.id)) {
      issues.push({
        code: 'duplicate-device-id',
        severity: 'error',
        message: `El identificador ${device.id} está repetido.`,
        deviceId: device.id,
      });
    }
    ids.add(device.id);
    const nameKey = visibleNameKey(device.name);
    const previousNameOwner = visibleNames.get(nameKey);
    if (previousNameOwner) {
      issues.push({
        code: 'duplicate-item-name',
        severity: 'error',
        message: `“${device.name}” está repetido. Usa nombres distintos para reconocer cada componente en los bloques.`,
        deviceId: device.id,
      });
    } else {
      visibleNames.set(nameKey, device.id);
    }
    if (!positionIsInsideCanvas(device.position, scene.canvas)) {
      issues.push({
        code: 'invalid-position',
        severity: 'error',
        message: `${device.name} está fuera del lienzo. Reubícalo antes de guardar la escena.`,
        deviceId: device.id,
      });
    }
    if (
      !Number.isFinite(device.rotation) ||
      device.rotation < 0 ||
      device.rotation >= 360
    ) {
      issues.push({
        code: 'invalid-rotation',
        severity: 'error',
        message: `${device.name} tiene un giro no válido. Usa un ángulo entre 0 y 359 grados.`,
        deviceId: device.id,
      });
    }

    if (device.kind === 'robot' || device.kind === 'motor') {
      issues.push({
        code: 'external-motor-power',
        severity: 'warning',
        message: `${device.name} necesita un DRV8833, alimentación externa y masa común con la Wemos.`,
        deviceId: device.id,
      });
    }
    if (device.kind === 'servo') {
      issues.push({
        code: 'external-servo-power',
        severity: 'warning',
        message: `${device.name} debe usar una alimentación adecuada y masa común; no lo alimentes desde un GPIO.`,
        deviceId: device.id,
      });
    }
    if (device.kind === 'led' || device.kind === 'trafficLight') {
      issues.push({
        code: 'led-resistor-required',
        severity: 'warning',
        message: `${device.name} necesita una resistencia limitadora por cada LED físico.`,
        deviceId: device.id,
      });
    }
    if (
      device.kind === 'button' &&
      device.config.pullup &&
      [34, 35, 36, 39].includes(device.pins.signal ?? -1)
    ) {
      issues.push({
        code: 'button-pullup-unavailable',
        severity: 'warning',
        message: `${device.name} usa una entrada sin pull-up interno; elige otro GPIO o agrega una resistencia externa.`,
        deviceId: device.id,
        pin: device.pins.signal ?? undefined,
      });
    }
  }

  let counterCount = 0;
  for (const widget of scene.widgets) {
    if (!itemIdIsValid(widget.id)) {
      issues.push({
        code: 'invalid-widget-id',
        severity: 'error',
        message: `${widget.name}: la identidad interna del indicador no es válida.`,
        itemId: widget.id,
      });
    }
    if (!nameIsValid(widget.name)) {
      issues.push({
        code: 'invalid-widget-name',
        severity: 'error',
        message: `${widget.id}: el nombre debe tener entre 1 y 60 caracteres.`,
        itemId: widget.id,
      });
    }
    if (ids.has(widget.id)) {
      issues.push({
        code: 'duplicate-item-id',
        severity: 'error',
        message: `El identificador ${widget.id} está repetido entre los elementos de la escena.`,
        itemId: widget.id,
      });
    }
    ids.add(widget.id);
    const nameKey = visibleNameKey(widget.name);
    if (visibleNames.has(nameKey)) {
      issues.push({
        code: 'duplicate-item-name',
        severity: 'error',
        message: `“${widget.name}” está repetido. Usa nombres distintos para cada elemento.`,
        itemId: widget.id,
      });
    } else {
      visibleNames.set(nameKey, widget.id);
    }
    if (!positionIsInsideCanvas(widget.position, scene.canvas)) {
      issues.push({
        code: 'invalid-position',
        severity: 'error',
        message: `${widget.name} está fuera del lienzo. Reubícalo antes de guardar la escena.`,
        itemId: widget.id,
      });
    }
    if (widget.kind === 'counter') counterCount += 1;
  }

  if (counterCount > 1) {
    issues.push({
      code: 'multiple-counter-widgets',
      severity: 'error',
      message:
        'Hay más de un indicador de contador, pero el programa tiene un solo contador global. Conserva únicamente uno.',
    });
  }

  const retiredIds = new Set<string>();
  if ((scene.retiredDeviceIds?.length ?? 0) > MAX_RETIRED_DEVICE_IDS) {
    issues.push({
      code: 'invalid-retired-device-id',
      severity: 'error',
      message: `El historial de identidades eliminadas supera el máximo de ${MAX_RETIRED_DEVICE_IDS}.`,
    });
  }
  for (const retiredId of scene.retiredDeviceIds ?? []) {
    if (!itemIdIsValid(retiredId) || retiredIds.has(retiredId)) {
      issues.push({
        code: 'invalid-retired-device-id',
        severity: 'error',
        message: 'El historial de identidades eliminadas está dañado.',
        itemId: retiredId,
      });
      continue;
    }
    retiredIds.add(retiredId);
    if (ids.has(retiredId)) {
      issues.push({
        code: 'active-id-is-retired',
        severity: 'error',
        message: `La identidad ${retiredId} pertenece a un componente eliminado y no puede reutilizarse.`,
        itemId: retiredId,
      });
    }
  }

  const requiredPwmChannels = pwmChannelCount(scene.devices);
  if (requiredPwmChannels > 16) {
    issues.push({
      code: 'pwm-channel-limit',
      severity: 'warning',
      message: `La escena necesita ${requiredPwmChannels} canales PWM; la Wemos D1 R32 dispone de 16.`,
    });
  }

  const passiveBuzzers = scene.devices.filter(
    (device) => device.kind === 'passiveBuzzer',
  );
  if (passiveBuzzers.length > 1) {
    issues.push({
      code: 'passive-buzzer-limit',
      severity: 'warning',
      message:
        'Esta versión admite un solo buzzer pasivo por placa para garantizar que cada nota conserve su frecuencia.',
    });
  }

  for (const slot of collectPinSlots(scene.devices)) {
    if (slot.pin === null) {
      issues.push({
        code: 'missing-pin',
        severity: 'warning',
        message: `${slot.deviceName}: falta asignar ${slot.label}. La simulación seguirá funcionando.`,
        deviceId: slot.deviceId,
      });
      continue;
    }
    if (!pinSupports(slot.pin, slot.capability)) {
      issues.push({
        code: 'unsupported-pin',
        severity: 'warning',
        message: `${slot.deviceName}: ${pinLabel(slot.pin)} no es compatible con ${slot.label}.`,
        deviceId: slot.deviceId,
        pin: slot.pin,
      });
      continue;
    }
    const previous = occupied.get(slot.pin);
    if (previous) {
      issues.push({
        code: 'pin-conflict',
        severity: 'warning',
        message: `${slot.deviceName} y ${previous.deviceName} usan ${pinLabel(slot.pin)}. La simulación funciona, pero el cableado debe corregirse.`,
        deviceId: slot.deviceId,
        pin: slot.pin,
      });
    } else {
      occupied.set(slot.pin, slot);
    }
  }

  const hardwareBlockingCodes: readonly SceneValidationIssueCode[] = [
    'missing-pin',
    'unsupported-pin',
    'pin-conflict',
    'pwm-channel-limit',
    'passive-buzzer-limit',
    'button-pullup-unavailable',
  ];
  issues.sort((left, right) => {
    const priority = (issue: SceneValidationIssue) => {
      if (issue.severity === 'error') return 0;
      if (hardwareBlockingCodes.includes(issue.code)) return 1;
      return 2;
    };
    return priority(left) - priority(right);
  });
  const hasErrors = issues.some((issue) => issue.severity === 'error');
  const hasHardwareIssues = issues.some((issue) =>
    hardwareBlockingCodes.includes(issue.code),
  );
  return {
    valid: !hasErrors,
    canSimulate: !hasErrors,
    hardwareReady: !hasErrors && !hasHardwareIssues,
    issues,
  };
}

export function isLegacySceneId(value: unknown): value is LegacySceneId {
  return (
    typeof value === 'string' && legacySceneIds.includes(value as LegacySceneId)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(
  record: Record<string, unknown>,
  allowedKeys: readonly string[],
) {
  const allowed = new Set(allowedKeys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function hasFiniteNumber(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'number' && Number.isFinite(record[key]);
}

function validDeviceConfig(
  kind: SceneDeviceKind,
  config: Record<string, unknown>,
) {
  switch (kind) {
    case 'trafficLight':
      return (
        hasOnlyKeys(config, [
          'redBrightness',
          'yellowBrightness',
          'greenBrightness',
        ]) &&
        ['redBrightness', 'yellowBrightness', 'greenBrightness'].every(
          (key) =>
            hasFiniteNumber(config, key) &&
            Number(config[key]) >= 0 &&
            Number(config[key]) <= 100,
        )
      );
    case 'robot':
      return (
        hasOnlyKeys(config, ['speed', 'heading', 'color']) &&
        hasFiniteNumber(config, 'speed') &&
        Number(config.speed) >= 0 &&
        Number(config.speed) <= 100 &&
        hasFiniteNumber(config, 'heading') &&
        Math.abs(Number(config.heading)) <= 360_000 &&
        typeof config.color === 'string' &&
        config.color.length <= 64
      );
    case 'motor':
      return (
        hasOnlyKeys(config, ['power', 'driver']) &&
        hasFiniteNumber(config, 'power') &&
        Number(config.power) >= 0 &&
        Number(config.power) <= 100 &&
        config.driver === 'DRV8833'
      );
    case 'led':
      return (
        hasOnlyKeys(config, ['brightness', 'color']) &&
        hasFiniteNumber(config, 'brightness') &&
        Number(config.brightness) >= 0 &&
        Number(config.brightness) <= 100 &&
        typeof config.color === 'string' &&
        config.color.length <= 64
      );
    case 'servo':
      return (
        hasOnlyKeys(config, ['angle']) &&
        hasFiniteNumber(config, 'angle') &&
        Number(config.angle) >= 0 &&
        Number(config.angle) <= 180
      );
    case 'activeBuzzer':
      return (
        hasOnlyKeys(config, ['enabled']) && typeof config.enabled === 'boolean'
      );
    case 'passiveBuzzer':
      return (
        hasOnlyKeys(config, ['frequency', 'durationMs']) &&
        hasFiniteNumber(config, 'frequency') &&
        Number(config.frequency) >= 20 &&
        Number(config.frequency) <= 20_000 &&
        hasFiniteNumber(config, 'durationMs') &&
        Number(config.durationMs) >= 10 &&
        Number(config.durationMs) <= 60_000
      );
    case 'button':
      return (
        hasOnlyKeys(config, ['pressed', 'pullup']) &&
        typeof config.pressed === 'boolean' &&
        typeof config.pullup === 'boolean'
      );
    case 'lightSensor':
    case 'potentiometer':
      return (
        hasOnlyKeys(config, ['value']) &&
        hasFiniteNumber(config, 'value') &&
        Number(config.value) >= 0 &&
        Number(config.value) <= 4095
      );
    case 'wifiNode':
      return (
        hasOnlyKeys(config, ['status', 'ssid']) &&
        ['idle', 'connecting', 'connected', 'error'].includes(
          String(config.status),
        ) &&
        typeof config.ssid === 'string' &&
        config.ssid.length <= 64
      );
  }
}

function isSceneDevice(value: unknown): value is SceneDevice {
  if (!isRecord(value)) return false;
  if (
    !hasOnlyKeys(value, [
      'schemaVersion',
      'id',
      'kind',
      'name',
      'position',
      'rotation',
      'pins',
      'config',
    ])
  )
    return false;
  const kind = value.kind;
  if (
    typeof kind !== 'string' ||
    !sceneDeviceKinds.includes(kind as SceneDeviceKind) ||
    value.schemaVersion !== SCENE_SCHEMA_VERSION ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !isRecord(value.position) ||
    !hasOnlyKeys(value.position, ['x', 'y']) ||
    !hasFiniteNumber(value.position, 'x') ||
    !hasFiniteNumber(value.position, 'y') ||
    !hasFiniteNumber(value, 'rotation') ||
    !isRecord(value.pins) ||
    !isRecord(value.config)
  )
    return false;
  const typedKind = kind as SceneDeviceKind;
  const pins = value.pins;
  if (
    !hasOnlyKeys(
      pins,
      requirementsByKind[typedKind].map((requirement) => requirement.key),
    )
  )
    return false;
  const pinsAreValid = requirementsByKind[typedKind].every((requirement) => {
    const pin = pins[requirement.key];
    return pin === null || (typeof pin === 'number' && Number.isInteger(pin));
  });
  return pinsAreValid && validDeviceConfig(typedKind, value.config);
}

export function isSceneDefinition(value: unknown): value is SceneDefinition {
  if (!isRecord(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasOnlyKeys(candidate, [
      'schemaVersion',
      'id',
      'name',
      'description',
      'canvas',
      'devices',
      'widgets',
      'retiredDeviceIds',
      'sourceTemplate',
    ])
  )
    return false;
  const canvas = candidate.canvas;
  const devices = candidate.devices;
  const widgets = candidate.widgets;
  return (
    candidate.schemaVersion === SCENE_SCHEMA_VERSION &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    isRecord(canvas) &&
    hasOnlyKeys(canvas, [
      'width',
      'height',
      'background',
      'gridSize',
      'snapToGrid',
    ]) &&
    hasFiniteNumber(canvas, 'width') &&
    hasFiniteNumber(canvas, 'height') &&
    Number(canvas.width) > 0 &&
    Number(canvas.width) <= 4096 &&
    Number(canvas.height) > 0 &&
    Number(canvas.height) <= 4096 &&
    ['park', 'workshop', 'home', 'pond', 'blank'].includes(
      String(canvas.background),
    ) &&
    hasFiniteNumber(canvas, 'gridSize') &&
    Number(canvas.gridSize) > 0 &&
    Number(canvas.gridSize) <= 512 &&
    typeof canvas.snapToGrid === 'boolean' &&
    Array.isArray(devices) &&
    devices.length <= MAX_SCENE_ITEMS &&
    devices.every(isSceneDevice) &&
    Array.isArray(widgets) &&
    widgets.length <= MAX_SCENE_ITEMS &&
    widgets.every(
      (widget) =>
        isRecord(widget) &&
        hasOnlyKeys(widget, [
          'schemaVersion',
          'id',
          'kind',
          'name',
          'position',
          'config',
        ]) &&
        widget.schemaVersion === SCENE_SCHEMA_VERSION &&
        widget.kind === 'counter' &&
        typeof widget.id === 'string' &&
        typeof widget.name === 'string' &&
        isRecord(widget.position) &&
        hasOnlyKeys(widget.position, ['x', 'y']) &&
        hasFiniteNumber(widget.position, 'x') &&
        hasFiniteNumber(widget.position, 'y') &&
        isRecord(widget.config) &&
        hasOnlyKeys(widget.config, ['value', 'mascot']) &&
        hasFiniteNumber(widget.config, 'value') &&
        typeof widget.config.mascot === 'string' &&
        widget.config.mascot.length <= 32,
    ) &&
    (candidate.retiredDeviceIds === undefined ||
      (Array.isArray(candidate.retiredDeviceIds) &&
        candidate.retiredDeviceIds.length <= MAX_RETIRED_DEVICE_IDS &&
        candidate.retiredDeviceIds.every(
          (id) => typeof id === 'string' && id.length <= 128,
        ))) &&
    (candidate.sourceTemplate === undefined ||
      isLegacySceneId(candidate.sourceTemplate))
  );
}

export interface SceneMigrationResult {
  scene: SceneDefinition;
  migrated: boolean;
  warnings: string[];
}

/**
 * Accepts a current SceneDefinition, an old SceneId string, or the two legacy
 * project shapes that stored it under `scene` / `simulation.scene`.
 */
export function migrateSceneDefinition(
  value: unknown,
  fallback: LegacySceneId = 'traffic',
): SceneMigrationResult {
  if (isSceneDefinition(value)) {
    return { scene: cloneScene(value), migrated: false, warnings: [] };
  }
  if (isLegacySceneId(value)) {
    return {
      scene: migrateLegacyScene(value),
      migrated: true,
      warnings: [
        `La escena antigua “${value}” se convirtió al formato editable.`,
      ],
    };
  }
  if (value && typeof value === 'object') {
    const legacy = value as {
      scene?: unknown;
      simulation?: { scene?: unknown };
    };
    const sceneId = legacy.scene ?? legacy.simulation?.scene;
    if (isLegacySceneId(sceneId)) {
      return {
        scene: migrateLegacyScene(sceneId),
        migrated: true,
        warnings: [
          `El proyecto antiguo usaba la escena “${sceneId}”; ahora contiene componentes editables.`,
        ],
      };
    }
  }
  return {
    scene: migrateLegacyScene(fallback),
    migrated: true,
    warnings: [
      `No se reconoció la escena guardada. Se cargó la plantilla “${fallback}” sin perder el programa de bloques.`,
    ],
  };
}

export function getPinRequirements(kind: SceneDeviceKind) {
  return requirementsByKind[kind];
}
