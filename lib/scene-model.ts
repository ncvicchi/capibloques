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
  };
}

export function createStableDeviceId(
  kind: SceneDeviceKind,
  usedIds: Iterable<string>,
) {
  const used = new Set(usedIds);
  const base = kindIdBases[kind];
  let sequence = 1;
  while (used.has(`${base}-${sequence}`)) sequence += 1;
  return `${base}-${sequence}`;
}

function createStableId(base: string, usedIds: Iterable<string>) {
  const used = new Set(usedIds);
  let sequence = 1;
  while (used.has(`${base}-${sequence}`)) sequence += 1;
  return `${base}-${sequence}`;
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
  let sequence = hasSafeSuffix ? parsedSuffix + 1 : 2;

  while (true) {
    const suffix = ` ${sequence}`;
    const candidate = `${stem.slice(0, 60 - suffix.length).trimEnd()}${suffix}`;
    if (!used.has(visibleNameKey(candidate))) return candidate;
    sequence += 1;
  }
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
  const device = createSceneDevice(kind, scene.devices, options);
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

  const scene = cloneScene(source);
  const widget: SceneWidget = {
    ...cloneWidget(original),
    id: createStableId(
      original.kind,
      scene.widgets.map((item) => item.id),
    ),
    name: createUniqueVisibleName(
      original.name,
      sceneItemNames(scene),
      'Contador',
    ),
    position: {
      x: clamp(original.position.x + offset.x, 0, source.canvas.width),
      y: clamp(original.position.y + offset.y, 0, source.canvas.height),
    },
  };
  scene.widgets.push(widget);
  return { scene, widget };
}

export function removeDeviceFromScene(
  source: SceneDefinition,
  deviceId: string,
) {
  const scene = cloneScene(source);
  scene.devices = scene.devices.filter((device) => device.id !== deviceId);
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

  for (const templateItem of template.devices) {
    const pins = Object.fromEntries(
      Object.keys(templateItem.pins).map((key) => [key, null]),
    );
    const device = createSceneDevice(templateItem.kind, scene.devices, {
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
    scene.widgets.push({
      ...cloneWidget(widget),
      id: createStableId(
        widget.kind,
        scene.widgets.map((item) => item.id),
      ),
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
  return { ...assigned, addedDeviceIds };
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
  | 'invalid-device-name'
  | 'duplicate-device-id'
  | 'invalid-position'
  | 'missing-pin'
  | 'unsupported-pin'
  | 'pin-conflict';

export interface SceneValidationIssue {
  code: SceneValidationIssueCode;
  severity: 'error' | 'warning';
  message: string;
  deviceId?: string;
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

/**
 * Validates both editor identity and physical wiring. Missing/conflicting pins
 * are warnings: they disable hardware readiness, never browser simulation.
 */
export function validateScene(scene: SceneDefinition): SceneValidationResult {
  const issues: SceneValidationIssue[] = [];
  if (!nameIsValid(scene.name)) {
    issues.push({
      code: 'invalid-scene-name',
      severity: 'error',
      message: 'La escena necesita un nombre de entre 1 y 60 caracteres.',
    });
  }

  const ids = new Set<string>();
  const occupied = new Map<number, PinSlot>();
  for (const device of scene.devices) {
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
    if (
      !Number.isFinite(device.position.x) ||
      !Number.isFinite(device.position.y) ||
      device.position.x < 0 ||
      device.position.x > scene.canvas.width ||
      device.position.y < 0 ||
      device.position.y > scene.canvas.height
    ) {
      issues.push({
        code: 'invalid-position',
        severity: 'warning',
        message: `${device.name} está fuera del lienzo y puede reubicarse.`,
        deviceId: device.id,
      });
    }
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

  const hasErrors = issues.some((issue) => issue.severity === 'error');
  const hasHardwareIssues = issues.some((issue) =>
    ['missing-pin', 'unsupported-pin', 'pin-conflict'].includes(issue.code),
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

function hasFiniteNumber(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'number' && Number.isFinite(record[key]);
}

function validDeviceConfig(kind: SceneDeviceKind, config: Record<string, unknown>) {
  switch (kind) {
    case 'trafficLight':
      return ['redBrightness', 'yellowBrightness', 'greenBrightness'].every(
        (key) => hasFiniteNumber(config, key),
      );
    case 'robot':
      return (
        hasFiniteNumber(config, 'speed') &&
        hasFiniteNumber(config, 'heading') &&
        typeof config.color === 'string'
      );
    case 'motor':
      return hasFiniteNumber(config, 'power') && config.driver === 'DRV8833';
    case 'led':
      return (
        hasFiniteNumber(config, 'brightness') && typeof config.color === 'string'
      );
    case 'servo':
      return hasFiniteNumber(config, 'angle');
    case 'activeBuzzer':
      return typeof config.enabled === 'boolean';
    case 'passiveBuzzer':
      return (
        hasFiniteNumber(config, 'frequency') &&
        hasFiniteNumber(config, 'durationMs')
      );
    case 'button':
      return (
        typeof config.pressed === 'boolean' && typeof config.pullup === 'boolean'
      );
    case 'lightSensor':
    case 'potentiometer':
      return hasFiniteNumber(config, 'value');
    case 'wifiNode':
      return (
        ['idle', 'connecting', 'connected', 'error'].includes(
          String(config.status),
        ) && typeof config.ssid === 'string'
      );
  }
}

function isSceneDevice(value: unknown): value is SceneDevice {
  if (!isRecord(value)) return false;
  const kind = value.kind;
  if (
    typeof kind !== 'string' ||
    !sceneDeviceKinds.includes(kind as SceneDeviceKind) ||
    value.schemaVersion !== SCENE_SCHEMA_VERSION ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !isRecord(value.position) ||
    !hasFiniteNumber(value.position, 'x') ||
    !hasFiniteNumber(value.position, 'y') ||
    !hasFiniteNumber(value, 'rotation') ||
    !isRecord(value.pins) ||
    !isRecord(value.config)
  )
    return false;
  const typedKind = kind as SceneDeviceKind;
  const pins = value.pins;
  const pinsAreValid = requirementsByKind[typedKind].every((requirement) => {
    const pin = pins[requirement.key];
    return pin === null || (typeof pin === 'number' && Number.isInteger(pin));
  });
  return pinsAreValid && validDeviceConfig(typedKind, value.config);
}

export function isSceneDefinition(value: unknown): value is SceneDefinition {
  if (!isRecord(value)) return false;
  const candidate = value as Record<string, unknown>;
  const canvas = candidate.canvas;
  const devices = candidate.devices;
  const widgets = candidate.widgets;
  return (
    candidate.schemaVersion === SCENE_SCHEMA_VERSION &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    isRecord(canvas) &&
    hasFiniteNumber(canvas, 'width') &&
    hasFiniteNumber(canvas, 'height') &&
    Number(canvas.width) > 0 &&
    Number(canvas.height) > 0 &&
    ['park', 'workshop', 'home', 'pond', 'blank'].includes(
      String(canvas.background),
    ) &&
    hasFiniteNumber(canvas, 'gridSize') &&
    Number(canvas.gridSize) > 0 &&
    typeof canvas.snapToGrid === 'boolean' &&
    Array.isArray(devices) &&
    devices.every(isSceneDevice) &&
    Array.isArray(widgets) &&
    widgets.every(
      (widget) =>
        isRecord(widget) &&
        widget.schemaVersion === SCENE_SCHEMA_VERSION &&
        widget.kind === 'counter' &&
        typeof widget.id === 'string' &&
        typeof widget.name === 'string' &&
        isRecord(widget.position) &&
        hasFiniteNumber(widget.position, 'x') &&
        hasFiniteNumber(widget.position, 'y') &&
        isRecord(widget.config) &&
        hasFiniteNumber(widget.config, 'value') &&
        typeof widget.config.mascot === 'string',
    ) &&
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
