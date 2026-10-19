/**
 * Versioned, serializable model for the scene builder.
 *
 * The model deliberately contains no React, Blockly or browser APIs. A scene can
 * therefore live inside the project JSON, be tested in Node and be migrated
 * without loading the visual editor.
 */

// @ts-expect-error Node strip-types tests import the source extension.
import { displayConfig, displayPins, displayPinKeys, requiredDisplayPins, validDisplayConfig, type DisplayConfig, type DisplayPinKey } from './display-model.ts';
// @ts-expect-error Node strip-types tests import the source extension.
import { ledMatrixConfig, validMatrixConfig, type LedMatrixConfig } from './led-matrix.ts';
// @ts-expect-error Node strip-types tests import the source extension.
import { boardProfile, WAVESHARE_TOUCH_LCD_5_PROFILE_ID, type BoardPinDefinition, type BoardProfileId, type PinCapability } from './board-profiles.ts';
// @ts-expect-error Node strip-types tests import the source extension.
import { educationalModuleKinds, educationalModulePins, educationalModuleSpecs, isEducationalModuleKind, validEducationalModuleConfig, type EducationalModuleKind } from './educational-modules.ts';
// @ts-expect-error Node strip-types runner.
import { nearestRailSlot, railSlots, railSlotsFor, railTrackCount, type RailTrackCount } from './rail-world.ts';
// @ts-expect-error Node strip-types runner.
import { nearestParkingSlot, parkingSlots, type ParkingCapacity } from './parking-world.ts';
// @ts-expect-error Node strip-types runner.
import { nearestGardenSlot, gardenSlots, validGardenEnvironment, defaultGardenEnvironment, type GardenEnvironment } from './garden-world.ts';
// @ts-expect-error Node strip-types runner.
import { nearestHouseSlot, houseSlots, houseBindings, houseFreeRoles, validHouseEnvironment, defaultHouseEnvironment, type HouseEnvironment, type HouseFreeRole } from './house-world.ts';

// @ts-expect-error Node strip-types runner.
import { arenaKinds, arenaStartAllowed, validArenaEnvironment, defaultArenaEnvironment, type ArenaEnvironment } from './robot-arena.ts';

// @ts-expect-error Node strip-types runner.
import { weatherSlots, nearestWeatherSlot, defaultWeatherEnvironment, validWeatherEnvironment, type WeatherEnvironment } from './weather-world.ts';

// @ts-expect-error Node strip-types runner.
import { theaterSlots, defaultTheaterEnvironment, validTheaterEnvironment, type TheaterEnvironment } from './theater-world.ts';

// @ts-expect-error Node strip-types runner.
import { validLineCircuit, defaultLineCircuit, lineStartAllowed, type LineCircuit } from './line-world.ts';
// @ts-expect-error Node strip-types runner.
import { pondSlots, nearestPondSlot, pondBindings, defaultPondEnvironment, validPondEnvironment, type PondEnvironment } from './pond-world.ts';
export const SCENE_SCHEMA_VERSION = 1 as const;

// @ts-expect-error Node strip-types runner.
import { conveyorSlots, nearestConveyorSlot, validConveyorEnvironment, defaultConveyorEnvironment, type ConveyorEnvironment } from './conveyor-world.ts';

export const legacySceneIds = [
  'traffic',
  'robot',
  'wifi',
  'counter',
  'intersection',
  'robotCourse',
  'smartGarden',
  'securityGate',
  'weatherStation',
  'railCrossing',
  'parking',
  'greenhouse',
  'smartHouse',
  'conveyor',
  'robotArena',
  'weatherLab',
  'ottoTheater',
  'lineTrack',
  'pondLab',
] as const;

export type LegacySceneId = (typeof legacySceneIds)[number];

export const sceneDeviceKinds = [
  'trafficLight',
  'robot',
  'otto',
  'motor',
  'led',
  'smartLights',
  'servo',
  'activeBuzzer',
  'passiveBuzzer',
  'button',
  'infraredBarrier',
  'lightSensor',
  'potentiometer',
  'wifiNode',
  'display',
  'ledMatrix',
  'messages',
  ...educationalModuleKinds,
] as const;

export type SceneDeviceKind = (typeof sceneDeviceKinds)[number];
export const sceneBackgrounds = [
  'park',
  'workshop',
  'home',
  'pond',
  'crossroads',
  'robotTrack',
  'garden',
  'schoolGate',
  'weatherYard',
  'railCrossing',
  'parking',
  'greenhouse',
  'smartHouse',
  'conveyor',
  'robotArena',
  'weatherLab',
  'ottoTheater',
  'lineTrack',
  'pondLab',
  'blank',
] as const;
export type SceneBackground = (typeof sceneBackgrounds)[number];
export type PinNumber = number | null;
export const trafficDirections = [
  'eastbound',
  'westbound',
  'southbound',
  'northbound',
] as const;
export type TrafficDirection = (typeof trafficDirections)[number];

export type { BoardProfileId, PinCapability };

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
  trafficDirections?: TrafficDirection[];
  /** Ausente en proyectos anteriores: una vía bidireccional. */
  railTracks?: RailTrackCount;
  /** Ausente: ocho plazas. Los autos y sus cuadros no se guardan en JSON. */
  parkingCapacity?: ParkingCapacity;
  gardenEnvironment?: GardenEnvironment;
  houseEnvironment?: HouseEnvironment;
  conveyorEnvironment?: ConveyorEnvironment;
  arenaEnvironment?: ArenaEnvironment;
  weatherEnvironment?: WeatherEnvironment;
  pondEnvironment?: PondEnvironment;
  lineCircuit?: LineCircuit;
  theaterEnvironment?: TheaterEnvironment;
  houseAssignments?: Partial<Record<HouseFreeRole, string>>;
  /** Identificadores de atrás hacia adelante; ausente en proyectos anteriores. */
  itemOrder?: string[];
}

export interface SceneTrafficSlot extends ScenePosition {
  id: 'north' | 'east' | 'south' | 'west';
  lane: 'horizontal' | 'vertical';
  direction: TrafficDirection;
  rotation: number;
}

/**
 * The first useful scene worlds are deliberately derived from the background.
 * Old JSON projects therefore gain richer scenery without a migration and a
 * saved scene still has a single source of truth for editor and simulator.
 */
export const crossroadsTrafficSlots: readonly SceneTrafficSlot[] = [
  { id: 'north', lane: 'vertical', direction: 'northbound', x: 620, y: 135, rotation: 270 },
  { id: 'east', lane: 'horizontal', direction: 'eastbound', x: 620, y: 405, rotation: 0 },
  { id: 'south', lane: 'vertical', direction: 'southbound', x: 340, y: 405, rotation: 90 },
  { id: 'west', lane: 'horizontal', direction: 'westbound', x: 340, y: 135, rotation: 180 },
] as const;

export function enabledTrafficDirections(scene: SceneDefinition) {
  return scene.canvas.background === 'crossroads'
    ? scene.canvas.trafficDirections ?? [...trafficDirections]
    : [];
}

export function closestCrossroadsTrafficSlot(position: ScenePosition) {
  return crossroadsTrafficSlots.reduce((closest, slot) => {
    const distance = (slot.x - position.x) ** 2 + (slot.y - position.y) ** 2;
    const closestDistance =
      (closest.x - position.x) ** 2 + (closest.y - position.y) ** 2;
    return distance < closestDistance ? slot : closest;
  });
}

export function constrainSceneItemPosition(
  scene: SceneDefinition,
  item: Pick<SceneDevice | SceneWidget, 'id' | 'kind'>,
  position: ScenePosition,
): ScenePosition {
  if (scene.canvas.background === 'pondLab') {
    const slot=nearestPondSlot(item.kind,position);
    if(slot){if(scene.devices.some(d=>d.id!==item.id&&nearestPondSlot(d.kind,d.position)?.role===slot.role))return scene.devices.find(d=>d.id===item.id)?.position??position;return {x:slot.x,y:slot.y};}
  }
  if (scene.canvas.background === 'lineTrack') {
    if(item.kind==='lineSensors')return {x:165,y:420};
    if(item.kind==='robot'&&!lineStartAllowed(position))return scene.devices.find(d=>d.id===item.id)?.position??position;
  }
  if (scene.canvas.background === 'ottoTheater') { const slot = theaterSlots.find(s => s.kind === item.kind); if (slot) return { x: slot.x, y: slot.y }; }
  if (scene.canvas.background === 'weatherLab') {
    const slot = nearestWeatherSlot(item.kind, position);
    if (slot) return { x: slot.x, y: slot.y };
  }
  if (scene.canvas.background === 'robotArena') {
    if (item.kind === 'robot' && !arenaStartAllowed(position, scene.canvas.arenaEnvironment ?? defaultArenaEnvironment)) return scene.devices.find(d => d.id === item.id)?.position ?? position;
    if (['distanceSensor', 'colorSensor', 'infraredBarrier'].includes(item.kind)) return scene.devices.find(d => d.id === item.id)?.position ?? position;
  }
  if (scene.canvas.background === 'conveyor') {
    const slot = nearestConveyorSlot(item.kind, position);
    if (slot) {
      if (scene.devices.some(d => d.id !== item.id && nearestConveyorSlot(d.kind, d.position)?.role === slot.role)) return scene.devices.find(d => d.id === item.id)?.position ?? position;
      return { x: slot.x, y: slot.y };
    }
  }
  if (scene.canvas.background === 'smartHouse') {
    const slot = nearestHouseSlot(item.kind, position);
    if (slot) {
      if (scene.devices.some(device => device.id !== item.id && nearestHouseSlot(device.kind, device.position)?.role === slot.role)) return scene.devices.find(device => device.id === item.id)?.position ?? position;
      return { x: slot.x, y: slot.y };
    }
  }
  if (scene.canvas.background === 'greenhouse') {
    const slot = nearestGardenSlot(item.kind, position);
    if (slot) {
      if (scene.devices.some(device => device.id !== item.id && nearestGardenSlot(device.kind, device.position)?.role === slot.role)) return scene.devices.find(device => device.id === item.id)?.position ?? position;
      return { x: slot.x, y: slot.y };
    }
  }
  if (scene.canvas.background === 'parking') {
    const slot = nearestParkingSlot(item.kind, position);
    if (slot) {
      if (scene.devices.some(device => device.id !== item.id && nearestParkingSlot(device.kind, device.position)?.role === slot.role)) return scene.devices.find(device => device.id === item.id)?.position ?? position;
      return { x: slot.x, y: slot.y };
    }
  }
  if (scene.canvas.background === 'railCrossing') {
    const slot = nearestRailSlot(item.kind, position, railTrackCount(scene));
    if (slot) {
      const occupied = scene.devices.some(device => device.id !== item.id && nearestRailSlot(device.kind, device.position, railTrackCount(scene))?.role === slot.role);
      if (occupied) return scene.devices.find(device => device.id === item.id)?.position ?? position;
      return { x: slot.x, y: slot.y };
    }
  }
  if (
    scene.canvas.background === 'crossroads' &&
    item.kind === 'trafficLight'
  ) {
    const slot = closestCrossroadsTrafficSlot(position);
    const occupied = scene.devices.some(device =>
      device.kind === 'trafficLight' &&
      device.id !== item.id &&
      closestCrossroadsTrafficSlot(device.position).id === slot.id,
    );
    if (occupied) {
      const current = scene.devices.find(device => device.id === item.id);
      const currentSlot = closestCrossroadsTrafficSlot(
        current?.position ?? position,
      );
      return { x: currentSlot.x, y: currentSlot.y };
    }
    return { x: slot.x, y: slot.y };
  }
  return position;
}

export function arrangeCrossroadsTrafficLights(source: SceneDefinition) {
  const scene = cloneScene(source);
  let slotIndex = 0;
  scene.devices = scene.devices.map(device => {
    if (device.kind !== 'trafficLight') return device;
    const slot = crossroadsTrafficSlots[slotIndex % crossroadsTrafficSlots.length];
    slotIndex += 1;
    return { ...device, position: { x: slot.x, y: slot.y } };
  });
  return scene;
}

export function arrangeRailDevices(source: SceneDefinition) {
  const scene = cloneScene(source);
  const occupied = new Set<string>();
  scene.devices = scene.devices.map(device => {
    const slot = railSlotsFor(railTrackCount(scene)).find(candidate => candidate.kind === device.kind && !occupied.has(candidate.role));
    if (!slot) return device;
    occupied.add(slot.role);
    return { ...device, position: { x: slot.x, y: slot.y }, rotation: 0 };
  });
  return scene;
}

export function arrangeParkingDevices(source: SceneDefinition) {
  const scene = cloneScene(source);
  const occupied = new Set<string>();
  scene.devices = scene.devices.map(device => {
    const slot = parkingSlots.find(candidate => candidate.kind === device.kind && !occupied.has(candidate.role));
    if (!slot) return device;
    occupied.add(slot.role);
    return { ...device, position: { x: slot.x, y: slot.y }, rotation: 0 };
  });
  return scene;
}

export function arrangeGardenDevices(source: SceneDefinition) {
  const scene = cloneScene(source), occupied = new Set<string>();
  scene.devices = scene.devices.map(device => {
    const slot = gardenSlots.find(candidate => candidate.kind === device.kind && !occupied.has(candidate.role));
    if (!slot) return device;
    occupied.add(slot.role);
    return { ...device, position: { x: slot.x, y: slot.y }, rotation: 0 };
  });
  return scene;
}

export function arrangeTheaterDevices(source: SceneDefinition) { const scene = cloneScene(source); scene.devices = scene.devices.map(d => { const slot = theaterSlots.find(s => s.kind === d.kind); return slot ? { ...d, position: { x: slot.x, y: slot.y }, rotation: 0 } : d; }); return scene; }

export function arrangePondDevices(source: SceneDefinition) {
  const scene=cloneScene(source),used=new Set<string>();
  for(const d of scene.devices){const slot=pondSlots.find(s=>s.kind===d.kind&&!used.has(s.role));if(slot){d.position={x:slot.x,y:slot.y};d.rotation=0;used.add(slot.role);}}
  return scene;
}
export function arrangeWeatherDevices(source: SceneDefinition) {
  const scene = cloneScene(source);
  scene.devices = scene.devices.map(d => { const slot = nearestWeatherSlot(d.kind, d.position); return slot ? { ...d, position: { x: slot.x, y: slot.y }, rotation: 0 } : d; });
  return scene;
}

export function arrangeConveyorDevices(source: SceneDefinition) {
  const scene = cloneScene(source), occupied = new Set<string>();
  scene.devices = scene.devices.map(d => { const slot = conveyorSlots.find(s => s.kind === d.kind && !occupied.has(s.role)); if (!slot) return d; occupied.add(slot.role); return { ...d, position: { x: slot.x, y: slot.y }, rotation: 0 }; });
  return scene;
}

export function arrangeHouseDevices(source: SceneDefinition) {
  const scene = cloneScene(source), occupied = new Set<string>();
  scene.devices = scene.devices.map(device => {
    const slot = houseSlots.find(candidate => candidate.kind === device.kind && !occupied.has(candidate.role));
    if (!slot) return device;
    occupied.add(slot.role); return { ...device, position: { x: slot.x, y: slot.y }, rotation: 0 };
  });
  scene.canvas.houseAssignments = Object.fromEntries(houseFreeRoles.flatMap(role => { const slot = houseSlots.find(s => s.role === role)!; const d = scene.devices.find(d => d.kind === slot.kind && d.position.x === slot.x && d.position.y === slot.y); return d ? [[role, d.id]] : []; }));
  return scene;
}

/** Cambia sólo el borrador: conserva identidades existentes y retira sensores sobrantes. */
export function configureRailTracks(source: SceneDefinition, count: RailTrackCount, boardProfile?: BoardProfileId) {
  if (source.canvas.background !== 'railCrossing' || ![1, 2, 4].includes(count)) throw new Error('Elegí 1, 2 o 4 vías en una escena Paso a nivel.');
  let scene = cloneScene(source);
  const previous = railTrackCount(source);
  const oldSlots = railSlotsFor(previous);
  const slots = railSlotsFor(count);
  const removed = scene.devices.filter(device => {
    const role = nearestRailSlot(device.kind, device.position, previous)?.role;
    return role && !slots.some(slot => slot.role === role);
  }).map(device => device.id);
  for (const id of removed) scene = removeDeviceFromScene(scene, id);
  scene.canvas.railTracks = count;
  scene.devices = scene.devices.map(device => {
    const old = nearestRailSlot(device.kind, device.position, previous);
    const slot = old && slots.find(candidate => candidate.role === old.role);
    return slot ? { ...device, name: device.name === old?.name ? slot.name : device.name, position: { x: slot.x, y: slot.y } } : device;
  });
  for (const slot of slots.filter(slot => slot.kind === 'infraredBarrier' && !oldSlots.some(old => old.role === slot.role))) {
    scene = addDeviceToScene(scene, 'infraredBarrier', { name: slot.name, position: { x: slot.x, y: slot.y }, boardProfile }).scene;
  }
  return scene;
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
  {
    red: PinNumber;
    yellow: PinNumber;
    green: PinNumber;
    matrixDin: PinNumber;
    matrixClk: PinNumber;
    matrixCs: PinNumber;
  },
  {
    redBrightness: number;
    yellowBrightness: number;
    greenBrightness: number;
    vehicleDisplay: boolean;
    pedestrianDisplay: boolean;
    matrixBrightness: number;
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

export type OttoDevice = SceneDeviceBase<
  'otto',
  {
    leftLeg: PinNumber; rightLeg: PinNumber; leftFoot: PinNumber; rightFoot: PinNumber;
    leftArm: PinNumber; rightArm: PinNumber; buzzer: PinNumber; trigger: PinNumber;
    echo: PinNumber; matrixDin: PinNumber; matrixClk: PinNumber; matrixCs: PinNumber;
  },
  {
    profile: 'biped4' | 'biped4-sound' | 'biped4-explorer' | 'biped4-expressive' | 'humanoid6-expressive';
    centers: [number, number, number, number, number, number];
    reversed: [boolean, boolean, boolean, boolean, boolean, boolean];
    matrixBrightness: number;
  }
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

export type SmartLightsDevice = SceneDeviceBase<
  'smartLights',
  { signal: PinNumber },
  {
    profile: 'WS2812B' | 'SK6812_RGB';
    geometry: 'strip' | 'ring' | 'matrix';
    count: number;
    width: number;
    height: number;
    layout: 'progressive' | 'zigzag';
    origin: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    colorOrder: 'GRB' | 'RGB';
    brightness: number;
  }
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

export type InfraredBarrierDevice = SceneDeviceBase<
  'infraredBarrier',
  { signal: PinNumber },
  { interrupted: boolean; interruptedLevel: 'HIGH' | 'LOW' }
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
    role: 'create' | 'join';
    boardName: string;
    peers: string[];
    messages: string[];
  }
>;

export type MessagesMode = 'send' | 'receive' | 'both';
export type MessagesDevice = SceneDeviceBase<
  'messages',
  { tx: PinNumber; rx: PinNumber },
  {
    mode: MessagesMode;
    baudRate: 9600 | 19200 | 38400 | 57600 | 115200;
    messages: string[];
  }
>;

export type LedMatrixDevice = SceneDeviceBase<
  'ledMatrix',
  { din: PinNumber; clk: PinNumber; cs: PinNumber },
  LedMatrixConfig
>;

export type EducationalModuleDevice<K extends EducationalModuleKind = EducationalModuleKind> = SceneDeviceBase<
  K,
  Record<string, PinNumber>,
  { profile: string; values: Record<string, number | string | boolean>; settings: Record<string, number | string | boolean> }
>;

export interface SceneDeviceByKind {
  lineSensors: EducationalModuleDevice<'lineSensors'>;
  display: DisplayDevice;
  ledMatrix: LedMatrixDevice;
  trafficLight: TrafficLightDevice;
  robot: RobotDevice;
  otto: OttoDevice;
  motor: MotorDevice;
  led: LedDevice;
  smartLights: SmartLightsDevice;
  servo: ServoDevice;
  activeBuzzer: ActiveBuzzerDevice;
  passiveBuzzer: PassiveBuzzerDevice;
  button: ButtonDevice;
  infraredBarrier: InfraredBarrierDevice;
  lightSensor: LightSensorDevice;
  potentiometer: PotentiometerDevice;
  wifiNode: WifiNodeDevice;
  messages: MessagesDevice;
  distanceSensor: EducationalModuleDevice<'distanceSensor'>;
  pirSensor: EducationalModuleDevice<'pirSensor'>;
  joystick: EducationalModuleDevice<'joystick'>;
  powerSwitch: EducationalModuleDevice<'powerSwitch'>;
  rotaryEncoder: EducationalModuleDevice<'rotaryEncoder'>;
  environmentSensor: EducationalModuleDevice<'environmentSensor'>;
  soilMoisture: EducationalModuleDevice<'soilMoisture'>;
  colorSensor: EducationalModuleDevice<'colorSensor'>;
  soundLevel: EducationalModuleDevice<'soundLevel'>;
  waterSensor: EducationalModuleDevice<'waterSensor'>;
  motionSensor: EducationalModuleDevice<'motionSensor'>;
  cardReader: EducationalModuleDevice<'cardReader'>;
  keypad: EducationalModuleDevice<'keypad'>;
  stepper: EducationalModuleDevice<'stepper'>;
  scale: EducationalModuleDevice<'scale'>;
  gps: EducationalModuleDevice<'gps'>;
}

export type SceneDevice = SceneDeviceByKind[SceneDeviceKind];
export type DisplayDevice = SceneDeviceBase<'display', Record<DisplayPinKey, PinNumber>, DisplayConfig>;

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

export const dashboardDeviceKinds = ['trafficLight', 'robot', 'motor', 'led', 'servo'] as const;
export type DashboardDeviceKind = (typeof dashboardDeviceKinds)[number];
export function dashboardDeviceIds(scene: SceneDefinition) {
  const display = scene.devices.find((device): device is DisplayDevice => device.kind === 'display' && device.config.profile === 'waveshare5');
  return new Set(display?.config.dashboard?.enabled ? display.config.dashboard.deviceIds : []);
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

export type WemosPinDefinition = BoardPinDefinition;

/* Kept as a public alias for existing imports and saved Wemos tests. */
// @ts-expect-error Node strip-types tests import the source extension.
export { wemosD1R32Pins } from './board-profiles.ts';

export const safeWemosOutputPins = boardProfile('wemos-d1-r32').safeOutputPins;
export const safeWemosDigitalInputPins = boardProfile('wemos-d1-r32').safeDigitalInputPins;
export const safeWemosAnalogInputPins = boardProfile('wemos-d1-r32').safeAnalogInputPins;

const requirementsByKind: Record<SceneDeviceKind, readonly PinRequirement[]> = {
  trafficLight: [
    { key: 'red', label: 'LED rojo', capability: 'pwmOutput' },
    { key: 'yellow', label: 'LED amarillo', capability: 'pwmOutput' },
    { key: 'green', label: 'LED verde', capability: 'pwmOutput' },
    { key: 'matrixDin', label: 'Matrices · datos (DIN)', capability: 'pwmOutput' },
    { key: 'matrixClk', label: 'Matrices · reloj (CLK)', capability: 'pwmOutput' },
    { key: 'matrixCs', label: 'Matrices · selección (CS/LOAD)', capability: 'pwmOutput' },
  ],
  robot: [
    { key: 'leftIn1', label: 'Motor izquierdo IN1', capability: 'pwmOutput' },
    { key: 'leftIn2', label: 'Motor izquierdo IN2', capability: 'pwmOutput' },
    { key: 'rightIn1', label: 'Motor derecho IN1', capability: 'pwmOutput' },
    { key: 'rightIn2', label: 'Motor derecho IN2', capability: 'pwmOutput' },
  ],
  otto: [
    { key: 'leftLeg', label: 'Pierna izquierda', capability: 'pwmOutput' },
    { key: 'rightLeg', label: 'Pierna derecha', capability: 'pwmOutput' },
    { key: 'leftFoot', label: 'Pie izquierdo', capability: 'pwmOutput' },
    { key: 'rightFoot', label: 'Pie derecho', capability: 'pwmOutput' },
    { key: 'leftArm', label: 'Brazo izquierdo', capability: 'pwmOutput' },
    { key: 'rightArm', label: 'Brazo derecho', capability: 'pwmOutput' },
    { key: 'buzzer', label: 'Buzzer', capability: 'pwmOutput' },
    { key: 'trigger', label: 'Ultrasonido TRIG', capability: 'pwmOutput' },
    { key: 'echo', label: 'Ultrasonido ECHO', capability: 'digitalInput' },
    { key: 'matrixDin', label: 'Matriz DIN', capability: 'pwmOutput' },
    { key: 'matrixClk', label: 'Matriz CLK', capability: 'pwmOutput' },
    { key: 'matrixCs', label: 'Matriz CS', capability: 'pwmOutput' },
  ],
  motor: [
    { key: 'in1', label: 'DRV8833 IN1', capability: 'pwmOutput' },
    { key: 'in2', label: 'DRV8833 IN2', capability: 'pwmOutput' },
  ],
  led: [{ key: 'signal', label: 'LED', capability: 'pwmOutput' }],
  smartLights: [{ key: 'signal', label: 'Datos (DIN)', capability: 'pwmOutput' }],
  servo: [{ key: 'signal', label: 'Señal', capability: 'pwmOutput' }],
  activeBuzzer: [{ key: 'signal', label: 'Señal', capability: 'pwmOutput' }],
  passiveBuzzer: [
    { key: 'signal', label: 'Señal PWM', capability: 'pwmOutput' },
  ],
  button: [
    { key: 'signal', label: 'Entrada del botón', capability: 'digitalInput' },
  ],
  infraredBarrier: [
    { key: 'signal', label: 'Salida digital del detector', capability: 'digitalInput' },
  ],
  lightSensor: [
    { key: 'signal', label: 'Lectura de luz', capability: 'analogInput' },
  ],
  potentiometer: [
    { key: 'signal', label: 'Lectura de posición', capability: 'analogInput' },
  ],
  wifiNode: [],
  display: displayPinKeys.map(key => ({
    key,
    label: key === 'keys' ? 'Botones (ADC)' : key === 'backlight' ? 'Luz de fondo' : key.toUpperCase(),
    capability: key === 'keys' ? 'analogInput' : 'pwmOutput',
  })),
  ledMatrix: [
    { key: 'din', label: 'Datos (DIN)', capability: 'pwmOutput' },
    { key: 'clk', label: 'Reloj (CLK)', capability: 'pwmOutput' },
    { key: 'cs', label: 'Selección (CS/LOAD)', capability: 'pwmOutput' },
  ],
  messages: [
    { key: 'tx', label: 'Enviar', capability: 'pwmOutput' },
    { key: 'rx', label: 'Recibir', capability: 'digitalInput' },
  ],
  ...Object.fromEntries(educationalModuleKinds.map(kind => [kind, educationalModuleSpecs[kind].pins])) as Record<EducationalModuleKind, readonly PinRequirement[]>,
};

export const sceneComponentCatalog: readonly SceneComponentCatalogEntry[] = [
  ...educationalModuleKinds.map(kind => {
    const spec = educationalModuleSpecs[kind];
    return { kind, icon: spec.icon, name: spec.name, description: spec.description, childFriendlyControl: spec.values.map(value => value.label).join(', '), pinRequirements: requirementsByKind[kind] };
  }),
  { kind: 'ledMatrix', icon: '🟨', name: 'Matriz LED', description: 'Panel de 32 × 8 luces con cuatro MAX7219.', childFriendlyControl: 'Píxeles, dibujos y texto en movimiento', pinRequirements: requirementsByKind.ledMatrix },
  { kind: 'messages', icon: '↔️', name: 'Mensajes', description: 'Envía y recibe mensajes de texto protegidos por cable.', childFriendlyControl: 'Enviar, recibir o ambas cosas', pinRequirements: requirementsByKind.messages },
  { kind: 'display', icon: '📺', name: 'Pantalla de texto', description: 'LCD, OLED o TFT para escribir mensajes.', childFriendlyControl: 'Escribir y borrar mensajes', pinRequirements: requirementsByKind.display },
  {
    kind: 'trafficLight',
    icon: '🚦',
    name: 'Semáforo',
    description:
      'Tres luces y, si querés, matrices para autos y peatones.',
    childFriendlyControl: 'Luces, número, alto, avance, caminar o esperar',
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
    kind: 'otto',
    icon: '🕺',
    name: 'Robot Otto',
    description: 'Familia de robots bípedos de cuatro o seis servos, ampliable con sonido, distancia y expresiones.',
    childFriendlyControl: 'Caminar, bailar, expresarse, escuchar distancia y mover brazos',
    pinRequirements: requirementsByKind.otto,
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
    kind: 'smartLights',
    icon: '🌈',
    name: 'Luces RGB inteligentes',
    description: 'Tiras, aros y matrices donde cada luz puede tener su propio color.',
    childFriendlyControl: 'Color, brillo, píxeles y animaciones',
    pinRequirements: requirementsByKind.smartLights,
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
    kind: 'infraredBarrier',
    icon: '🚧',
    name: 'Barrera infrarroja',
    description: 'Detecta si un objeto interrumpe el haz infrarrojo.',
    childFriendlyControl: 'Libre o interrumpida',
    pinRequirements: requirementsByKind.infraredBarrier,
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
  otto: 'otto',
  motor: 'motor',
  led: 'led',
  smartLights: 'smart-lights',
  servo: 'servo',
  activeBuzzer: 'active-buzzer',
  passiveBuzzer: 'passive-buzzer',
  button: 'button',
  infraredBarrier: 'infrared-barrier',
  lightSensor: 'light-sensor',
  potentiometer: 'potentiometer',
  wifiNode: 'wifi-node',
  display: 'display',
  ledMatrix: 'led-matrix',
  messages: 'messages',
  ...Object.fromEntries(educationalModuleKinds.map(kind => [kind, kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)])) as Record<EducationalModuleKind, string>,
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
    config: structuredClone(device.config),
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
    canvas: {
      ...scene.canvas,
      trafficDirections: scene.canvas.trafficDirections
        ? [...scene.canvas.trafficDirections]
        : undefined,
      itemOrder: scene.canvas.itemOrder ? [...scene.canvas.itemOrder] : undefined,
    },
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
 * continue naturally: "Sensor 2" becomes "Sensor 3".
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

function nextAvailableNumberedName(
  label: string,
  existingNames: Iterable<string>,
) {
  const used = new Set(Array.from(existingNames, visibleNameKey));
  for (let sequence = 1; sequence <= MAX_SCENE_ITEMS + 1; sequence += 1) {
    const candidate = `${label} ${sequence}`;
    if (!used.has(visibleNameKey(candidate))) return candidate;
  }
  throw new Error(`No se pudo crear un nombre libre para ${label}.`);
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
  boardProfile?: BoardProfileId;
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
      options.name ??
        (kind === 'trafficLight'
          ? nextAvailableNumberedName(
              'Semáforo',
              existingDevices.map(device => device.name),
            )
          : `${kindLabels[kind]} ${sameKindCount + 1}`),
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
    case 'ledMatrix':
      device = { ...base, kind, pins: { din: null, clk: null, cs: null }, config: ledMatrixConfig() };
      break;
    case 'display':
      device = { ...base, kind, pins: displayPins(), config: displayConfig(
        (options.config as Partial<DisplayConfig> | undefined)?.profile ??
        (options.boardProfile === 'waveshare-esp32-s3-touch-lcd-5-28117' ? 'waveshare5' : undefined),
      ) };
      break;
    case 'trafficLight':
      device = {
        ...base,
        kind,
        pins: {
          red: null,
          yellow: null,
          green: null,
          matrixDin: null,
          matrixClk: null,
          matrixCs: null,
        },
        config: {
          redBrightness: 0,
          yellowBrightness: 0,
          greenBrightness: 0,
          vehicleDisplay: false,
          pedestrianDisplay: false,
          matrixBrightness: 5,
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
    case 'otto':
      device = {
        ...base,
        kind,
        pins: { leftLeg: null, rightLeg: null, leftFoot: null, rightFoot: null, leftArm: null, rightArm: null, buzzer: null, trigger: null, echo: null, matrixDin: null, matrixClk: null, matrixCs: null },
        config: { profile: 'biped4', centers: [90, 90, 90, 90, 90, 90], reversed: [false, true, false, true, false, true], matrixBrightness: 4 },
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
    case 'smartLights':
      device = {
        ...base,
        kind,
        pins: { signal: null },
        config: { profile: 'WS2812B', geometry: 'strip', count: 8, width: 8, height: 1, layout: 'progressive', origin: 'top-left', colorOrder: 'GRB', brightness: 40 },
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
    case 'infraredBarrier':
      device = {
        ...base,
        kind,
        pins: { signal: null },
        config: { interrupted: false, interruptedLevel: 'LOW' },
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
        config: { status: 'idle', ssid: 'CapiRed', role: 'join', boardName: 'mi-placa', peers: ['central'], messages: ['HOLA', 'AVANZAR', 'DETENER'] },
      };
      break;
    case 'messages':
      {
      const mode = (options.config as Partial<MessagesDevice['config']> | undefined)?.mode ?? 'both';
      const modeName = mode === 'send' ? 'Enviar' : mode === 'receive' ? 'Recibir' : 'Enviar y recibir';
      device = {
        ...base,
        name: options.name ?? createUniqueVisibleName(`${modeName} ${sameKindCount + 1}`, existingDevices.map(item => item.name), modeName),
        kind,
        pins: { tx: null, rx: null },
        config: {
          mode,
          baudRate: 9600,
          messages: ['AVANZAR', 'DETENER', 'IZQUIERDA', 'DERECHA'],
        },
      };
      break;
      }
    default:
      if (isEducationalModuleKind(kind)) {
        const spec = educationalModuleSpecs[kind];
        device = { ...base, kind, pins: educationalModulePins(kind), config: structuredClone(spec.defaults) } as SceneDeviceByKind[K];
        break;
      }
      throw new Error(`Componente desconocido: ${String(kind)}`);
  }

  return {
    ...device,
    pins: { ...device.pins, ...options.pins },
    config: structuredClone({ ...device.config, ...options.config }),
  } as SceneDeviceByKind[K];
}

function pinRecord(device: SceneDevice) {
  return device.pins as Record<string, PinNumber>;
}

function candidatePins(capability: PinCapability, profileId: BoardProfileId): readonly number[] {
  const profile = boardProfile(profileId);
  switch (capability) {
    case 'pwmOutput':
      return profile.safeOutputPins;
    case 'digitalInput':
      return profile.safeDigitalInputPins;
    case 'analogInput':
      return profile.safeAnalogInputPins;
  }
}

function pinSupports(pin: number, capability: PinCapability, profileId: BoardProfileId) {
  return boardProfile(profileId).pins.some(
    (definition) =>
      definition.gpio === pin && definition.capabilities.includes(capability),
  );
}

export function pinLabel(pin: PinNumber, profileId: BoardProfileId = 'wemos-d1-r32') {
  if (pin === null) return 'Sin asignar';
  const definition = boardProfile(profileId).pins.find((item) => item.gpio === pin);
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
    getPinRequirements(device).map((requirement) => ({
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
  boardProfile?: BoardProfileId;
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
  const profileId = options.boardProfile ?? 'wemos-d1-r32';
  // La Waveshare es una superficie de simulación/control. Conservamos los GPIO
  // guardados para poder volver a una placa física, pero no los reasignamos ni
  // inventamos conexiones sobre sus bornes especializados.
  if (profileId === WAVESHARE_TOUCH_LCD_5_PROFILE_ID) return { scene, warnings: [] };
  const warnings: string[] = [];
  const used = new Map<number, PinSlot>();
  const slots = collectPinSlots(scene.devices);

  for (const slot of slots) {
    if (options.reassignAll || slot.pin === null) continue;
    if (!pinSupports(slot.pin, slot.capability, profileId)) continue;
    if (!used.has(slot.pin)) used.set(slot.pin, slot);
  }

  for (const slot of slots) {
    const current = options.reassignAll ? null : slot.pin;
    const owner = current === null ? undefined : used.get(current);
    const currentIsUsable =
      current !== null &&
      pinSupports(current, slot.capability, profileId) &&
      owner?.deviceId === slot.deviceId && owner.key === slot.key;

    if (currentIsUsable) continue;

    if (current !== null && !pinSupports(current, slot.capability, profileId)) {
      warnings.push(
        `${slot.deviceName}: ${pinLabel(current, profileId)} no sirve para ${slot.label}; se intentará reasignar.`,
      );
    } else if (current !== null && owner) {
      warnings.push(
        `${slot.deviceName}: ${pinLabel(current, profileId)} ya está usado por ${owner.deviceName}; se intentará reasignar.`,
      );
    }

    const selected = candidatePins(slot.capability, profileId).find(
      (candidate) => !used.has(candidate),
    );
    const device = scene.devices[slot.deviceIndex];
    device.pins = {
      ...device.pins,
      [slot.key]: selected ?? null,
    } as SceneDevice['pins'];

    if (selected === undefined) {
      warnings.push(
        `${slot.deviceName}: no quedan pines seguros para ${slot.label}. Puede seguir simulándose, pero necesita resolver el cableado antes de cargarlo en ${boardProfile(profileId).shortName}.`,
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
  const assigned = assignSafePins(temporaryScene, {
    boardProfile: options.boardProfile,
  }).scene.devices.at(-1);
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
  if ((kind === 'display' || kind === 'ledMatrix') && scene.devices.some(device => device.kind === 'display' || device.kind === 'ledMatrix')) throw new Error('Cada proyecto admite una sola pantalla o matriz. Configurá la existente.');
  if (source.canvas.background === 'railCrossing' && (kind === 'servo' || kind === 'infraredBarrier') && source.devices.filter(device => device.kind === kind).length >= (kind === 'servo' ? 2 : 2 * railTrackCount(source))) throw new Error('Los lugares de este componente ya están ocupados: dos barreras y dos detectores por vía.');
  if (source.canvas.background === 'parking' && parkingSlots.some(slot => slot.kind === kind) && source.devices.filter(device => device.kind === kind).length >= (kind === 'servo' ? 2 : 4)) throw new Error('El estacionamiento tiene dos lugares para barreras y cuatro para detectores.');
  if (source.canvas.background === 'greenhouse' && gardenSlots.some(slot => slot.kind === kind) && source.devices.filter(device => device.kind === kind).length >= gardenSlots.filter(slot => slot.kind === kind).length) throw new Error('Los lugares de este componente en la huerta e invernadero están ocupados.');
  if (source.canvas.background === 'lineTrack' && (kind === 'robot' || kind === 'lineSensors') && source.devices.some(d => d.kind === kind)) throw new Error('La pista admite un robot y una barra de tres sensores.');
  if (source.canvas.background === 'ottoTheater' && theaterSlots.some(s => s.kind === kind) && source.devices.some(d => d.kind === kind)) throw new Error('El teatro tiene un Otto y un botón de petición.');
  if (source.canvas.background === 'weatherLab' && weatherSlots.some(s => s.kind === kind) && source.devices.some(d => d.kind === kind)) throw new Error('Este puesto admite un sensor de cada tipo y un techo.');
  if(source.canvas.background==='pondLab'&&pondSlots.some(s=>s.kind===kind)&&source.devices.filter(d=>d.kind===kind).length>=pondSlots.filter(s=>s.kind===kind).length)throw new Error('Los lugares de este componente en la instalación de agua están ocupados.');
  if (source.canvas.background === 'robotArena' && arenaKinds.includes(kind as typeof arenaKinds[number]) && source.devices.some(d => d.kind === kind)) throw new Error('La pista admite un robot y un sensor de cada tipo, montados sobre él; una barrera fija de meta.');
  if (source.canvas.background === 'conveyor' && conveyorSlots.some(s => s.kind === kind) && source.devices.filter(d => d.kind === kind).length >= conveyorSlots.filter(s => s.kind === kind).length) throw new Error('Los lugares de este componente en la cinta están ocupados.');
  if (source.canvas.background === 'smartHouse' && kind !== 'led' && kind !== 'button' && houseSlots.some(slot => slot.kind === kind) && source.devices.filter(device => device.kind === kind).length >= houseSlots.filter(slot => slot.kind === kind).length) throw new Error('Los lugares de este componente en la casa están ocupados.');
  if (kind === 'messages' && scene.devices.filter(device => device.kind === 'messages').length >= 2) throw new Error('La placa admite hasta dos componentes Mensajes.');
  if (kind === 'trafficLight') {
    if (scene.canvas.background !== 'crossroads') {
      throw new Error(
        'Los semáforos sólo se pueden agregar en la escena Cruce con tránsito.',
      );
    }
    if (
      scene.devices.filter(device => device.kind === 'trafficLight').length >=
      crossroadsTrafficSlots.length
    ) {
      throw new Error(
        'El cruce tiene cuatro lugares seguros para semáforos y ya están ocupados.',
      );
    }
  }
  const reservedIds = [
    ...scene.devices.map((item) => item.id),
    ...scene.widgets.map((item) => item.id),
    ...(scene.retiredDeviceIds ?? []),
  ];
  const device = createSceneDevice(kind, scene.devices, {
    ...options,
    ...((kind === 'display' || kind === 'ledMatrix') && !options.position ? { position: { x: scene.canvas.width * 0.7, y: scene.canvas.height * 0.55 } } : {}),
    id: options.id ?? createStableDeviceId(kind, reservedIds),
  });
  if (scene.canvas.background === 'conveyor') {
    const slot = conveyorSlots.find(s => s.kind === kind && !scene.devices.some(d => nearestConveyorSlot(d.kind, d.position)?.role === s.role));
    if (slot) { device.position = { x: slot.x, y: slot.y }; device.rotation = 0; }
  }
  if(scene.canvas.background==='pondLab'){const b=pondBindings(scene),slot=pondSlots.find(s=>s.kind===kind&&!b[s.role]);if(slot){device.position={x:slot.x,y:slot.y};device.rotation=0;}}
  if (scene.canvas.background === 'lineTrack' && kind === 'lineSensors') device.position={x:165,y:420};
  if (scene.canvas.background === 'robotArena' && ['distanceSensor', 'colorSensor', 'infraredBarrier'].includes(kind)) device.position = kind === 'infraredBarrier' ? { x: 800, y: 110 } : kind === 'distanceSensor' ? { x: 165, y: 420 } : { x: 120, y: 465 };
  if (scene.canvas.background === 'weatherLab') { const slot = nearestWeatherSlot(kind, device.position); if (slot) { device.position = { x: slot.x, y: slot.y }; device.rotation = 0; } }
  if (scene.canvas.background === 'ottoTheater') { const slot = theaterSlots.find(s => s.kind === kind); if (slot) device.position = { x: slot.x, y: slot.y }; }
  if (scene.canvas.background === 'smartHouse') {
    if (kind === 'led' || kind === 'button') {
      const bindings = houseBindings(scene);
      scene.canvas.houseAssignments = Object.fromEntries(houseFreeRoles.flatMap(role => bindings[role] ? [[role, bindings[role]]] : []));
      const free = houseSlots.find(slot => slot.kind === kind && !bindings[slot.role]);
      if (free) { scene.canvas.houseAssignments[free.role as HouseFreeRole] = device.id; device.position = { x: free.x, y: free.y }; }
    }
    const slot = houseSlots.find(candidate => candidate.kind === kind && !scene.devices.some(item => nearestHouseSlot(item.kind, item.position)?.role === candidate.role));
    if (slot && kind !== 'led' && kind !== 'button') { device.position = { x: slot.x, y: slot.y }; device.rotation = 0; }
  }
  if (scene.canvas.background === 'greenhouse') {
    const slot = gardenSlots.find(candidate => candidate.kind === kind && !scene.devices.some(item => nearestGardenSlot(item.kind, item.position)?.role === candidate.role));
    if (slot) { device.position = { x: slot.x, y: slot.y }; device.rotation = 0; }
  }
  if (scene.canvas.background === 'parking') {
    const slot = parkingSlots.find(candidate => candidate.kind === kind && !scene.devices.some(item => nearestParkingSlot(item.kind, item.position)?.role === candidate.role));
    if (slot) { device.position = { x: slot.x, y: slot.y }; device.rotation = 0; }
  }
  if (scene.canvas.background === 'railCrossing') {
    const slot = railSlotsFor(railTrackCount(scene)).find(candidate => candidate.kind === kind && !scene.devices.some(item => nearestRailSlot(item.kind, item.position, railTrackCount(scene))?.role === candidate.role));
    if (slot) device.position = { x: slot.x, y: slot.y };
  }
  if (kind === 'trafficLight' && scene.canvas.background === 'crossroads') {
    const occupied = new Set(
      scene.devices
        .filter(item => item.kind === 'trafficLight')
        .map(item => closestCrossroadsTrafficSlot(item.position).id),
    );
    const preferred = closestCrossroadsTrafficSlot(device.position);
    const slot = !occupied.has(preferred.id)
      ? preferred
      : crossroadsTrafficSlots.find(candidate => !occupied.has(candidate.id)) ??
        preferred;
    device.position = { x: slot.x, y: slot.y };
  }
  device.name = createUniqueVisibleName(
    device.name,
    sceneItemNames(scene),
    kindLabels[kind],
  );
  scene.devices.push(device);
  const assigned = assignSafePins(scene, { boardProfile: options.boardProfile });
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
  if (original.kind === 'display' || original.kind === 'ledMatrix') return null;
  if (source.canvas.background === 'lineTrack' && ['robot','lineSensors'].includes(original.kind)) return null;
  if (source.canvas.background === 'ottoTheater' && theaterSlots.some(s => s.kind === original.kind)) return null;
  if (source.canvas.background === 'weatherLab' && weatherSlots.some(s => s.kind === original.kind)) return null;
  if(source.canvas.background==='pondLab'&&pondSlots.some(s=>s.kind===original.kind)&&source.devices.filter(d=>d.kind===original.kind).length>=pondSlots.filter(s=>s.kind===original.kind).length)return null;
  if (source.canvas.background === 'robotArena' && arenaKinds.includes(original.kind as typeof arenaKinds[number])) return null;
  const pins = Object.fromEntries(
    Object.keys(original.pins).map((key) => [key, null]),
  );
  return addDeviceToScene(source, original.kind, {
    name: original.kind === 'trafficLight' ? undefined : original.name,
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
  if (scene.canvas.houseAssignments) scene.canvas.houseAssignments = Object.fromEntries(Object.entries(scene.canvas.houseAssignments).filter(([, id]) => id !== deviceId));
  if (scene.canvas.itemOrder) {
    scene.canvas.itemOrder = scene.canvas.itemOrder.filter(id => id !== deviceId);
  }
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
  canvas: { background: 'crossroads', trafficDirections: ['eastbound'] },
});
trafficTemplate.sourceTemplate = 'traffic';
trafficTemplate.devices.push(
  templateDevice('trafficLight', trafficTemplate.devices, {
    id: 'traffic-light-1',
    name: 'Semáforo 1',
    position: { x: 620, y: 405 },
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

const intersectionTemplate = createEmptyScene('Cruce de la escuela', {
  id: 'scene-intersection',
  description:
    'Dos calles con autos que esperan, forman filas o chocan si los semáforos se contradicen.',
  canvas: { background: 'crossroads' },
});
intersectionTemplate.sourceTemplate = 'intersection';
intersectionTemplate.devices.push(
  templateDevice('trafficLight', intersectionTemplate.devices, {
    id: 'traffic-light-1',
    name: 'Semáforo 1',
    position: { x: 340, y: 135 },
    pins: { red: 26, yellow: 25, green: 27 },
  }),
  templateDevice('trafficLight', intersectionTemplate.devices, {
    id: 'traffic-light-2',
    name: 'Semáforo 2',
    position: { x: 620, y: 135 },
    pins: { red: 18, yellow: 19, green: 23 },
  }),
);

const robotCourseTemplate = createEmptyScene('Pista de reparto', {
  id: 'scene-robot-course',
  description:
    'Un camino con curvas y estaciones para practicar avance, giros y detenciones.',
  canvas: { background: 'robotTrack' },
});
robotCourseTemplate.sourceTemplate = 'robotCourse';
robotCourseTemplate.devices.push(
  templateDevice('robot', robotCourseTemplate.devices, {
    id: 'robot-1',
    name: 'Robot repartidor',
    position: { x: 155, y: 390 },
    rotation: 0,
    pins: { leftIn1: 17, leftIn2: 16, rightIn1: 23, rightIn2: 19 },
  }),
  templateDevice('infraredBarrier', robotCourseTemplate.devices, {
    id: 'infrared-barrier-1',
    name: 'Meta',
    position: { x: 785, y: 145 },
    pins: { signal: 4 },
  }),
);

const smartGardenTemplate = createEmptyScene('Huerta inteligente', {
  id: 'scene-smart-garden',
  description:
    'Mide la tierra y decide cuándo encender una bomba o una luz de aviso.',
  canvas: { background: 'garden' },
});
smartGardenTemplate.sourceTemplate = 'smartGarden';
smartGardenTemplate.devices.push(
  templateDevice('soilMoisture', smartGardenTemplate.devices, {
    id: 'soil-moisture-1',
    name: 'Humedad de la huerta',
    position: { x: 315, y: 330 },
    pins: { signal: 34 },
  }),
  templateDevice('powerSwitch', smartGardenTemplate.devices, {
    id: 'power-switch-1',
    name: 'Bomba de agua',
    position: { x: 635, y: 350 },
    pins: { signal: 26 },
  }),
  templateDevice('led', smartGardenTemplate.devices, {
    id: 'led-1',
    name: 'Aviso de riego',
    position: { x: 485, y: 170 },
    pins: { signal: 27 },
    config: { color: '#38bdf8' },
  }),
);

const securityGateTemplate = createEmptyScene('Entrada segura', {
  id: 'scene-security-gate',
  description:
    'Detecta un paso, abre la barrera y avisa con luz y sonido.',
  canvas: { background: 'schoolGate' },
});
securityGateTemplate.sourceTemplate = 'securityGate';
securityGateTemplate.devices.push(
  templateDevice('infraredBarrier', securityGateTemplate.devices, {
    id: 'infrared-barrier-1',
    name: 'Sensor de entrada',
    position: { x: 355, y: 345 },
    pins: { signal: 4 },
  }),
  templateDevice('servo', securityGateTemplate.devices, {
    id: 'servo-1',
    name: 'Barrera',
    position: { x: 555, y: 335 },
    pins: { signal: 14 },
  }),
  templateDevice('activeBuzzer', securityGateTemplate.devices, {
    id: 'active-buzzer-1',
    name: 'Alarma',
    position: { x: 700, y: 190 },
    pins: { signal: 13 },
  }),
);

const weatherStationTemplate = createEmptyScene('Estación del clima', {
  id: 'scene-weather-station',
  description:
    'Observa temperatura, humedad y lluvia y muestra una señal fácil de entender.',
  canvas: { background: 'weatherYard' },
});
weatherStationTemplate.sourceTemplate = 'weatherStation';
weatherStationTemplate.devices.push(
  templateDevice('environmentSensor', weatherStationTemplate.devices, {
    id: 'environment-sensor-1',
    name: 'Clima exterior',
    position: { x: 350, y: 305 },
    pins: { sda: 21, scl: 22 },
  }),
  templateDevice('waterSensor', weatherStationTemplate.devices, {
    id: 'water-sensor-1',
    name: 'Sensor de lluvia',
    position: { x: 590, y: 350 },
    pins: { signal: 34 },
  }),
  templateDevice('led', weatherStationTemplate.devices, {
    id: 'led-1',
    name: 'Estado del tiempo',
    position: { x: 480, y: 170 },
    pins: { signal: 26 },
    config: { color: '#fbbf24' },
  }),
);

const railTemplate = createEmptyScene('Paso a nivel', {
  id: 'scene-rail-crossing',
  description: 'Un tren, dos detectores infrarrojos y dos barreras: programá los avisos y el cierre seguro.',
  canvas: { background: 'railCrossing' },
});
railTemplate.sourceTemplate = 'railCrossing';
for (const [index, slot] of railSlots.entries()) {
  railTemplate.devices.push(templateDevice(slot.kind, railTemplate.devices, {
    id: `rail-${slot.role}`, name: slot.name, position: { x: slot.x, y: slot.y },
    pins: { signal: [14, 27, 34, 35][index] },
    config: slot.kind === 'servo' ? { angle: 90 } : { interrupted: false, interruptedLevel: 'LOW' },
  }));
}
for (const [index, x] of [345, 615].entries()) railTemplate.devices.push(templateDevice('led', railTemplate.devices, {
  id: `rail-warning-${index + 1}`, name: `Luz de aviso ${index + 1}`, position: { x, y: 100 }, pins: { signal: [26, 25][index] }, config: { color: '#ef4444', brightness: 0 },
}));
railTemplate.devices.push(templateDevice('activeBuzzer', railTemplate.devices, {
  id: 'rail-alarm', name: 'Aviso sonoro', position: { x: 720, y: 110 }, pins: { signal: 13 },
}));

const parkingTemplate = createEmptyScene('Estacionamiento', {
  id: 'scene-parking', description: 'Controlá entrada, salida y plazas libres. Los autos activan cuatro detectores; tu programa lleva la cuenta.',
  canvas: { background: 'parking', parkingCapacity: 8 },
});
parkingTemplate.sourceTemplate = 'parking';
for (const [index, slot] of parkingSlots.entries()) parkingTemplate.devices.push(templateDevice(slot.kind, parkingTemplate.devices, {
  id: `parking-${slot.role}`, name: slot.name, position: { x: slot.x, y: slot.y },
  pins: { signal: [14, 27, 34, 35, 36, 39][index] },
  config: slot.kind === 'servo' ? { angle: 0 } : { interrupted: false, interruptedLevel: 'LOW' },
}));
parkingTemplate.devices.push(templateDevice('display', parkingTemplate.devices, {
  id: 'parking-display', name: 'Plazas disponibles', position: { x: 480, y: 465 },
  config: displayConfig('lcd1602'), pins: { sda: 26, scl: 25 },
}));

const greenhouseTemplate = createEmptyScene('Huerta e invernadero', {
  id: 'scene-greenhouse', description: 'Dos canteros, riego independiente y ventilación. Programá el cuidado de las plantas con sensores del mundo virtual.',
  canvas: { background: 'greenhouse', gardenEnvironment: { ...defaultGardenEnvironment } },
});
greenhouseTemplate.sourceTemplate = 'greenhouse';
for (const [index, slot] of gardenSlots.entries()) greenhouseTemplate.devices.push(templateDevice(slot.kind, greenhouseTemplate.devices, {
  id: `garden-${slot.role}`, name: slot.name, position: { x: slot.x, y: slot.y },
  pins: slot.kind === 'environmentSensor' ? { sda: 18, scl: 19 } : { signal: [34, 35, 26, 27, 0, 14, 36][index] },
  ...(slot.kind === 'servo' ? { config: { angle: 0 } } : {}),
}));
greenhouseTemplate.devices.push(templateDevice('display', greenhouseTemplate.devices, {
  id: 'garden-display', name: 'Estado de las plantas', position: { x: 480, y: 465 },
  config: displayConfig('lcd1602'), pins: { sda: 25, scl: 23 },
}));

const houseTemplate = createEmptyScene('Casa inteligente y entrada segura', { id: 'scene-smart-house', description: 'Atendé visitantes, tarjetas y salidas. Iluminá según presencia y oscuridad, sin permisos ocultos.', canvas: { background: 'smartHouse', houseEnvironment: { ...defaultHouseEnvironment } } });
houseTemplate.sourceTemplate = 'smartHouse';
houseTemplate.canvas.houseAssignments = Object.fromEntries(houseFreeRoles.map(role => [role, `house-${role}`]));
for (const [i, slot] of houseSlots.entries()) houseTemplate.devices.push(templateDevice(slot.kind, houseTemplate.devices, {
  id: `house-${slot.role}`, name: slot.name, position: { x: slot.x, y: slot.y },
  pins: slot.kind === 'cardReader' ? { sda: 18, scl: 19 } : { signal: [14, 4, 13, 34, 35, 16, 36, 39, 26, 27][i] },
  ...(slot.kind === 'servo' ? { config: { angle: 0 } } : {}),
}));
houseTemplate.devices.push(templateDevice('display', houseTemplate.devices, { id: 'house-display', name: 'Mensajes de la casa', position: { x: 730, y: 475 }, config: displayConfig('lcd1602'), pins: { sda: 25, scl: 23 } }));
houseTemplate.devices.push(templateDevice('activeBuzzer', houseTemplate.devices, { id: 'house-alarm', name: 'Aviso de entrada', position: { x: 235, y: 465 }, pins: { signal: 17 } }));

const conveyorTemplate = createEmptyScene('Taller y cinta transportadora', { id: 'scene-conveyor', description: 'Leé color y peso, orientá el desviador y confirmá cada entrega.', canvas: { background: 'conveyor', conveyorEnvironment: { ...defaultConveyorEnvironment } } });
conveyorTemplate.sourceTemplate = 'conveyor';
for (const slot of conveyorSlots) conveyorTemplate.devices.push(templateDevice(slot.kind, conveyorTemplate.devices, {
  id: `conveyor-${slot.role}`, name: slot.name, position: { x: slot.x, y: slot.y },
  pins: slot.kind === 'motor' ? { in1: 26, in2: 27 } : slot.kind === 'colorSensor' ? { sda: 18, scl: 19 } : slot.kind === 'scale' ? { data: 34, clock: 25 } : { signal: ({ presence: 35, gate: 14, outputA: 36, outputB: 39 } as Record<string, number>)[slot.role] },
  ...(slot.kind === 'servo' ? { config: { angle: 0 } } : {}),
}));

const arenaTemplate = createEmptyScene('Pista de exploración y reparto', { id: 'scene-robot-arena', description: 'Conducí, leé el suelo, visitá estaciones y evitá obstáculos sin piloto automático.', canvas: { background: 'robotArena', arenaEnvironment: structuredClone(defaultArenaEnvironment) } });
arenaTemplate.sourceTemplate = 'robotArena';
for (const item of [
  { kind: 'robot', id: 'arena-robot', name: 'Robot explorador', position: { x: 120, y: 420 }, pins: { leftIn1: 17, leftIn2: 16, rightIn1: 23, rightIn2: 19 }, config: { speed: 0, heading: 0, color: '#38bdf8' } },
  { kind: 'distanceSensor', id: 'arena-distance', name: 'Distancia frontal', position: { x: 165, y: 420 }, pins: { trigger: 26, echo: 34 } },
  { kind: 'colorSensor', id: 'arena-color', name: 'Color bajo el robot', position: { x: 120, y: 465 }, pins: { sda: 18, scl: 25 } },
  { kind: 'infraredBarrier', id: 'arena-goal', name: 'Paso por la meta', position: { x: 800, y: 110 }, pins: { signal: 35 } },
  { kind: 'led', id: 'arena-light', name: 'Aviso de estación', position: { x: 90, y: 160 }, pins: { signal: 27 } },
  { kind: 'activeBuzzer', id: 'arena-buzzer', name: 'Aviso de llegada', position: { x: 180, y: 160 }, pins: { signal: 14 } },
] as const) arenaTemplate.devices.push(templateDevice(item.kind, arenaTemplate.devices, item));

const pondTemplate = createEmptyScene('Laguna, depósito y bombeo',{id:'scene-pond-lab',description:'Medí distancias, regulá el agua y evitá derrames con tu programa.',canvas:{background:'pondLab',pondEnvironment:{...defaultPondEnvironment}}});
pondTemplate.sourceTemplate='pondLab';
for(const slot of pondSlots)pondTemplate.devices.push(templateDevice(slot.kind,pondTemplate.devices,{
 id:`pond-${slot.role}`,name:slot.name,position:{x:slot.x,y:slot.y},
 pins:slot.role==='reserveSensor'?{trigger:17,echo:34}:slot.role==='lagoonSensor'?{trigger:16,echo:35}:{signal:slot.role==='pump'?26:slot.role==='drain'?14:36},
 ...(slot.kind==='servo'?{config:{angle:0}}:{})
}));
pondTemplate.devices.push(templateDevice('led',pondTemplate.devices,{id:'pond-alert',name:'Aviso de agua',position:{x:420,y:85},pins:{signal:27},config:{brightness:0,color:'#ef7b54'}}));
pondTemplate.devices.push(templateDevice('activeBuzzer',pondTemplate.devices,{id:'pond-buzzer',name:'Aviso sonoro',position:{x:530,y:85},pins:{signal:19}}));
pondTemplate.devices.push(templateDevice('display',pondTemplate.devices,{id:'pond-display',name:'Informe del agua',position:{x:785,y:80},pins:{sda:18,scl:23},config:displayConfig('lcd2004')}));
const weatherLabTemplate = createEmptyScene('Estación meteorológica y puesto protegido', { id: 'scene-weather-lab', description: 'Medí el clima exterior, informá y protegé el puesto de la lluvia con tu programa.', canvas: { background: 'weatherLab', weatherEnvironment: { ...defaultWeatherEnvironment } } });
weatherLabTemplate.sourceTemplate = 'weatherLab';
for (const [i, slot] of weatherSlots.entries()) weatherLabTemplate.devices.push(templateDevice(slot.kind, weatherLabTemplate.devices, {
  id: `weather-${slot.role}`, name: slot.name, position: { x: slot.x, y: slot.y },
  pins: slot.kind === 'environmentSensor' ? { sda: 18, scl: 19 } : { signal: [0, 36, 34, 14][i] },
  ...(slot.kind === 'servo' ? { config: { angle: 90 } } : {}),
}));
weatherLabTemplate.devices.push(templateDevice('display', weatherLabTemplate.devices, { id: 'weather-display', name: 'Informe del clima', position: { x: 760, y: 400 }, config: displayConfig('lcd2004'), pins: { sda: 25, scl: 23 } }));
weatherLabTemplate.devices.push(templateDevice('led', weatherLabTemplate.devices, { id: 'weather-night-light', name: 'Luz del puesto', position: { x: 510, y: 440 }, pins: { signal: 26 } }));
weatherLabTemplate.devices.push(templateDevice('led', weatherLabTemplate.devices, { id: 'weather-alert-light', name: 'Aviso de lluvia', position: { x: 510, y: 335 }, pins: { signal: 27 }, config: { brightness: 0, color: '#ef7b54' } }));
weatherLabTemplate.devices.push(templateDevice('activeBuzzer', weatherLabTemplate.devices, { id: 'weather-buzzer', name: 'Aviso sonoro', position: { x: 870, y: 290 }, pins: { signal: 17 } }));

const lineTemplate = createEmptyScene('Vehículo seguidor de línea', { id:'scene-line-track', description:'Tu programa lee tres sensores de suelo y controla cada motor.', canvas:{background:'lineTrack',lineCircuit:structuredClone(defaultLineCircuit)} });
lineTemplate.sourceTemplate='lineTrack';
lineTemplate.devices.push(templateDevice('robot',lineTemplate.devices,{id:'line-robot',name:'Seguidor de línea',position:{x:300,y:390},pins:{leftIn1:17,leftIn2:16,rightIn1:23,rightIn2:19},config:{speed:0,heading:0,color:'#38bdf8'}}));
lineTemplate.devices.push(templateDevice('lineSensors',lineTemplate.devices,{id:'line-sensors',name:'Sensores del suelo',position:{x:165,y:420},pins:{left:34,center:35,right:36}}));
lineTemplate.devices.push(templateDevice('led',lineTemplate.devices,{id:'line-alert',name:'Aviso de línea perdida',position:{x:870,y:100},pins:{signal:27},config:{brightness:0,color:'#ed885a'}}));
const theaterTemplate = createEmptyScene('Teatro interactivo de Otto', { id: 'scene-otto-theater', description: 'Saludá al público, atendé peticiones y coordiná movimiento, caras, sonidos y luces.', canvas: { background: 'ottoTheater', theaterEnvironment: { ...defaultTheaterEnvironment } } });
theaterTemplate.sourceTemplate = 'ottoTheater';
theaterTemplate.devices.push(templateDevice('otto', theaterTemplate.devices, {
  id: 'theater-otto', name: 'Otto artista', position: { x: 480, y: 210 },
  config: { profile: 'biped4-expressive', centers: [90,90,90,90,90,90], reversed: [false,true,false,true,false,true], matrixBrightness: 4 },
  pins: { leftLeg: 13, rightLeg: 14, leftFoot: 16, rightFoot: 17, leftArm: null, rightArm: null, buzzer: 25, trigger: 26, echo: 34, matrixDin: 18, matrixClk: 19, matrixCs: 23 },
}));
theaterTemplate.devices.push(templateDevice('button', theaterTemplate.devices, { id: 'theater-request', name: 'Pedir actuación', position: { x: 760, y: 360 }, pins: { signal: 4 } }));
theaterTemplate.devices.push(templateDevice('led', theaterTemplate.devices, { id: 'theater-light-1', name: 'Luz del escenario 1', position: { x: 200, y: 155 }, pins: { signal: 27 }, config: { brightness: 0, color: '#ffce66' } }));

export const sceneTemplates: Readonly<Record<LegacySceneId, SceneDefinition>> =
  {
    traffic: trafficTemplate,
    robot: robotTemplate,
    wifi: wifiTemplate,
    counter: counterTemplate,
    intersection: intersectionTemplate,
    robotCourse: robotCourseTemplate,
    smartGarden: smartGardenTemplate,
    securityGate: securityGateTemplate,
    weatherStation: weatherStationTemplate,
    railCrossing: railTemplate,
    parking: parkingTemplate,
    greenhouse: greenhouseTemplate,
    smartHouse: houseTemplate,
    conveyor: conveyorTemplate,
    robotArena: arenaTemplate,
    weatherLab: weatherLabTemplate,
    pondLab: pondTemplate,
    ottoTheater: theaterTemplate,
    lineTrack: lineTemplate,
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
  boardProfile?: BoardProfileId;
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
  if (templateId === 'railCrossing' || templateId === 'parking' || templateId === 'greenhouse' || templateId === 'smartHouse' || templateId === 'conveyor' || templateId === 'robotArena' || templateId === 'weatherLab' || templateId === 'ottoTheater' || templateId === 'lineTrack' || templateId === 'pondLab') {
    if (scene.devices.length || scene.widgets.length) return { scene, warnings: ['Este mundo se agrega sobre una escena vacía para no reasignar componentes existentes.'], addedDeviceIds };
    const replacement = cloneScene(scene);
    replacement.canvas = structuredClone(template.canvas);
    replacement.sourceTemplate = templateId;
    replacement.description = template.description;
    for (const item of template.devices) {
      replacement.devices.push({ ...structuredClone(item),
        id: createStableDeviceId(item.kind, [...replacement.devices.map(device => device.id), ...(replacement.retiredDeviceIds ?? [])]),
        pins: Object.fromEntries(Object.keys(item.pins).map(key => [key, null])),
      } as SceneDevice);
    }
    if (templateId === 'smartHouse') replacement.canvas.houseAssignments = Object.fromEntries(houseFreeRoles.map(role => [role, replacement.devices[template.devices.findIndex(d => d.id === template.canvas.houseAssignments?.[role])].id]));
    const assigned = assignSafePins(replacement, { boardProfile: options.boardProfile });
    return { ...assigned, addedDeviceIds: replacement.devices.map(device => device.id) };
  }
  const templateHasTrafficLights = template.devices.some(
    device => device.kind === 'trafficLight',
  );

  if (templateHasTrafficLights && scene.canvas.background !== 'crossroads') {
    if (scene.devices.length === 0 && scene.widgets.length === 0) {
      scene.canvas.background = 'crossroads';
      scene.canvas.trafficDirections =
        template.canvas.trafficDirections ?? [...trafficDirections];
    } else {
      return {
        scene,
        warnings: [
          'Los semáforos sólo se pueden agregar en una escena Cruce con tránsito.',
        ],
        addedDeviceIds,
      };
    }
  }

  if (
    template.widgets.some((widget) => widget.kind === 'counter') &&
    scene.widgets.some((widget) => widget.kind === 'counter')
  ) {
    const assigned = assignSafePins(scene, { boardProfile: options.boardProfile });
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
    if (
      templateItem.kind === 'trafficLight' &&
      scene.devices.filter(device => device.kind === 'trafficLight').length >=
        crossroadsTrafficSlots.length
    ) {
      warnings.push('El cruce ya tiene sus cuatro semáforos.');
      continue;
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
      name:
        templateItem.kind === 'trafficLight'
          ? nextAvailableNumberedName(
              'Semáforo',
              scene.devices.map(device => device.name),
            )
          : createUniqueVisibleName(
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
      boardProfile: options.boardProfile,
    });
    if (device.kind === 'trafficLight') {
      const occupied = new Set(
        scene.devices
          .filter(item => item.kind === 'trafficLight')
          .map(item => closestCrossroadsTrafficSlot(item.position).id),
      );
      const slot =
        crossroadsTrafficSlots.find(candidate => !occupied.has(candidate.id)) ??
        crossroadsTrafficSlots[0];
      device.position = { x: slot.x, y: slot.y };
    }
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

  const assigned = assignSafePins(scene, { boardProfile: options.boardProfile });
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
  | 'traffic-light-scene'
  | 'traffic-light-limit'
  | 'traffic-light-slot'
  | 'rail-slot-conflict'
  | 'rail-slot-missing'
  | 'rail-slot-position'
  | 'parking-slot-position'
  | 'parking-slot-conflict'
  | 'parking-slot-missing'
  | 'garden-slot-position'
  | 'garden-slot-conflict'
  | 'garden-slot-missing'
  | 'house-slot-position'
  | 'line-layout'
  | 'theater-layout'
  | 'weather-layout'
  | 'pond-layout'
  | 'arena-layout'
  | 'conveyor-size'
  | 'conveyor-slot'
  | 'conveyor-missing'
  | 'house-slot-conflict'
  | 'house-slot-missing'
  | 'missing-pin'
  | 'unsupported-pin'
  | 'pin-conflict'
  | 'pwm-channel-limit'
  | 'passive-buzzer-limit'
  | 'button-pullup-unavailable'
  | 'button-external-bias-required'
  | 'external-motor-power'
  | 'external-servo-power'
  | 'led-resistor-required'
  | 'invalid-display'
  | 'display-board-mismatch'
  | 'display-limit'
  | 'invalid-led-matrix'
  | 'invalid-otto-pin'
  | 'messages-limit'
  | 'invalid-messages-pin';

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
      case 'otto':
        return total + 4 + (device.config.profile === 'humanoid6-expressive' ? 2 : 0) + (device.config.profile === 'biped4' ? 0 : 1);
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
export function validateScene(
  scene: SceneDefinition,
  profileId: BoardProfileId = 'wemos-d1-r32',
): SceneValidationResult {
  const profile = boardProfile(profileId);
  const virtualOnly = profileId === WAVESHARE_TOUCH_LCD_5_PROFILE_ID;
  const dashboardIds = virtualOnly
    ? new Set(scene.devices.map(device => device.id))
    : dashboardDeviceIds(scene);
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
  const displays = scene.devices.filter((device): device is DisplayDevice => device.kind === 'display');
  const visualOutputs = scene.devices.filter(device => device.kind === 'display' || device.kind === 'ledMatrix' || (device.kind === 'otto' && ['biped4-expressive', 'humanoid6-expressive'].includes(device.config.profile)));
  if (visualOutputs.length > 1) issues.push({ code: 'display-limit', severity: 'error', message: 'Cada proyecto admite una sola pantalla o matriz LED.' });
  const trafficLights = scene.devices.filter(
    device => device.kind === 'trafficLight',
  );
  if (scene.canvas.background === 'railCrossing') {
    if (scene.canvas.width !== 960 || scene.canvas.height !== 540) issues.push({ code: 'rail-slot-position', severity: 'error', message: 'El paso a nivel utiliza un lienzo de 960 × 540.' });
    for (const device of scene.devices) {
      const slot = nearestRailSlot(device.kind, device.position, railTrackCount(scene));
      if (slot && (device.position.x !== slot.x || device.position.y !== slot.y)) issues.push({ code: 'rail-slot-position', severity: 'error', deviceId: device.id, message: `${device.name}: elegí uno de los lugares marcados del paso a nivel.` });
    }
    const roles = scene.devices.map(device => nearestRailSlot(device.kind, device.position, railTrackCount(scene))?.role).filter(Boolean);
    if (new Set(roles).size !== roles.length) issues.push({ code: 'rail-slot-conflict', severity: 'error', message: 'Cada barrera y detector debe ocupar un lugar diferente del paso a nivel.' });
    for (const slot of railSlotsFor(railTrackCount(scene))) if (!roles.includes(slot.role)) issues.push({ code: 'rail-slot-missing', severity: 'warning', message: `Falta ${slot.name.toLowerCase()} en el paso a nivel. Una barrera ausente mantiene detenido su acceso.` });
  }
  if (scene.canvas.background === 'parking') {
    if (scene.canvas.width !== 960 || scene.canvas.height !== 540) issues.push({ code: 'parking-slot-position', severity: 'error', message: 'El estacionamiento utiliza un lienzo de 960 × 540.' });
    const roles = scene.devices.map(device => nearestParkingSlot(device.kind, device.position)?.role).filter(Boolean);
    if (new Set(roles).size !== roles.length) issues.push({ code: 'parking-slot-conflict', severity: 'error', message: 'Cada barrera y detector necesita un lugar diferente del estacionamiento.' });
    for (const device of scene.devices) {
      const slot = nearestParkingSlot(device.kind, device.position);
      if (slot && (device.position.x !== slot.x || device.position.y !== slot.y)) issues.push({ code: 'parking-slot-position', severity: 'error', deviceId: device.id, message: `${device.name}: elegí un lugar marcado del estacionamiento.` });
    }
    for (const slot of parkingSlots) if (!roles.includes(slot.role)) issues.push({ code: 'parking-slot-missing', severity: 'warning', message: `Falta ${slot.name.toLowerCase()}. Sin barrera, ese acceso permanece cerrado; sin detector, el programa no recibe esa señal.` });
  }
  if (scene.canvas.background === 'greenhouse') {
    if (scene.canvas.width !== 960 || scene.canvas.height !== 540) issues.push({ code: 'garden-slot-position', severity: 'error', message: 'La huerta e invernadero utiliza un lienzo de 960 × 540.' });
    const roles = scene.devices.map(device => nearestGardenSlot(device.kind, device.position)?.role).filter(Boolean);
    if (new Set(roles).size !== roles.length) issues.push({ code: 'garden-slot-conflict', severity: 'error', message: 'Cada componente de la huerta necesita un lugar diferente.' });
    for (const device of scene.devices) {
      const slot = nearestGardenSlot(device.kind, device.position);
      if (slot && (device.position.x !== slot.x || device.position.y !== slot.y)) issues.push({ code: 'garden-slot-position', severity: 'error', deviceId: device.id, message: `${device.name}: elegí un lugar marcado de la huerta e invernadero.` });
    }
    for (const slot of gardenSlots) if (!roles.includes(slot.role)) issues.push({ code: 'garden-slot-missing', severity: 'warning', message: `Falta ${slot.name.toLowerCase()}. Sin salida no actúa; sin sensor el programa no recibe esa lectura.` });
  }
  if (scene.canvas.background === 'lineTrack') {
    if(scene.canvas.width!==960||scene.canvas.height!==540||scene.devices.filter(d=>d.kind==='robot').length>1||scene.devices.filter(d=>d.kind==='lineSensors').length>1) issues.push({code:'line-layout',severity:'error',message:'La pista usa 960 × 540, un robot y una barra de sensores.'});
    const robot=scene.devices.find(d=>d.kind==='robot'); if(robot&&!lineStartAllowed(robot.position))issues.push({code:'theater-layout',severity:'error',message:'La posición inicial del robot debe quedar dentro de la mesa.'});
  }
  if (scene.canvas.background === 'ottoTheater') {
    if (scene.canvas.width !== 960 || scene.canvas.height !== 540) issues.push({ code: 'theater-layout', severity: 'error', message: 'El teatro utiliza un lienzo de 960 × 540.' });
    for (const slot of theaterSlots) { const devices = scene.devices.filter(d => d.kind === slot.kind); if (!devices.length) issues.push({ code: 'theater-layout', severity: 'warning', message: `Falta ${slot.name.toLowerCase()}.` }); if (devices.length > 1 || devices.some(d => d.position.x !== slot.x || d.position.y !== slot.y)) issues.push({ code: 'theater-layout', severity: 'error', message: `Usá el lugar marcado de ${slot.name === 'Otto artista' ? 'Otto' : 'la petición'}.` }); }
  }
  if(scene.canvas.background==='pondLab'){
    const occupied=new Set<string>();
    if(scene.canvas.width!==960||scene.canvas.height!==540)issues.push({code:'pond-layout',severity:'error',message:'La instalación de agua utiliza 960 × 540.'});
    for(const d of scene.devices){const slot=nearestPondSlot(d.kind,d.position);if(!slot)continue;if(occupied.has(slot.role)||d.position.x!==slot.x||d.position.y!==slot.y||d.rotation!==0)issues.push({code:'pond-layout',severity:'error',deviceId:d.id,message:'Elegí un lugar marcado libre para este componente de agua.'});occupied.add(slot.role);}
    for(const slot of pondSlots)if(!occupied.has(slot.role))issues.push({code:'pond-layout',severity:'warning',message:`Falta ${slot.name.toLowerCase()}. No se agrega ni se reemplaza automáticamente.`});
  }
  if (scene.canvas.background === 'weatherLab') {
    if (scene.canvas.width !== 960 || scene.canvas.height !== 540) issues.push({ code: 'weather-layout', severity: 'error', message: 'La estación utiliza un lienzo de 960 × 540.' });
    for (const slot of weatherSlots) {
      const devices = scene.devices.filter(d => d.kind === slot.kind);
      if (!devices.length) issues.push({ code: 'weather-layout', severity: 'warning', message: `Falta ${slot.name.toLowerCase()}; no se repone automáticamente.` });
      if (devices.length > 1 || devices.some(d => d.position.x !== slot.x || d.position.y !== slot.y)) issues.push({ code: 'weather-layout', severity: 'error', message: `Usá el único lugar marcado para ${slot.name.toLowerCase()}.` });
    }
  }
  if (scene.canvas.background === 'robotArena') {
    const env = scene.canvas.arenaEnvironment ?? defaultArenaEnvironment;
    if (scene.canvas.width !== 960 || scene.canvas.height !== 540) issues.push({ code: 'arena-layout', severity: 'error', message: 'La pista utiliza un lienzo de 960 × 540.' });
    for (const kind of arenaKinds) {
      const devices = scene.devices.filter(d => d.kind === kind);
      if (devices.length > 1) issues.push({ code: 'arena-layout', severity: 'error', message: 'La pista admite un robot y un sensor de cada tipo.' });
      if (!devices.length) issues.push({ code: 'arena-layout', severity: 'warning', message: `Falta ${kind === 'robot' ? 'el robot' : kind === 'distanceSensor' ? 'la distancia frontal' : kind === 'colorSensor' ? 'el sensor de color' : 'la barrera de meta'}.` });
    }
    const robot = scene.devices.find(d => d.kind === 'robot');
    if (robot && !arenaStartAllowed(robot.position, env)) issues.push({ code: 'arena-layout', severity: 'error', deviceId: robot.id, message: 'Ubicá el robot dentro de la pista y fuera de obstáculos.' });
    const goal = scene.devices.find(d => d.kind === 'infraredBarrier');
    if (goal && (goal.position.x !== 800 || goal.position.y !== 110)) issues.push({ code: 'arena-layout', severity: 'error', deviceId: goal.id, message: 'La barrera de meta ocupa su lugar fijo sobre el paso.' });
  }
  if (scene.canvas.background === 'conveyor') {
    const occupied = new Set<string>();
    if (scene.canvas.width !== 960 || scene.canvas.height !== 540) issues.push({ code: 'conveyor-size', severity: 'error', message: 'La cinta utiliza un lienzo de 960 × 540.' });
    for (const d of scene.devices) { const slot = nearestConveyorSlot(d.kind, d.position); if (!slot) continue; if (d.position.x !== slot.x || d.position.y !== slot.y || occupied.has(slot.role)) issues.push({ code: 'conveyor-slot', severity: 'error', deviceId: d.id, message: 'Cada componente de la cinta necesita un lugar marcado libre.' }); occupied.add(slot.role); }
    for (const slot of conveyorSlots) if (!occupied.has(slot.role)) issues.push({ code: 'conveyor-missing', severity: 'warning', message: `Falta ${slot.name.toLowerCase()}.` });
  }
  if (scene.canvas.background === 'smartHouse') {
    if (scene.canvas.width !== 960 || scene.canvas.height !== 540) issues.push({ code: 'house-slot-position', severity: 'error', message: 'La casa utiliza un lienzo de 960 × 540.' });
    const roles = Object.keys(houseBindings(scene));
    if (new Set(roles).size !== roles.length) issues.push({ code: 'house-slot-conflict', severity: 'error', message: 'Cada componente de la casa necesita un lugar diferente.' });
    for (const device of scene.devices) {
      const slot = nearestHouseSlot(device.kind, device.position);
      if (slot && (device.position.x !== slot.x || device.position.y !== slot.y)) issues.push({ code: 'house-slot-position', severity: 'error', deviceId: device.id, message: `${device.name}: elegí un lugar marcado de la casa.` });
    }
    for (const slot of houseSlots) if (!roles.includes(slot.role)) issues.push({ code: 'house-slot-missing', severity: 'warning', message: `Falta ${slot.name.toLowerCase()}. Sin salida no actúa; sin sensor el programa no recibe esa señal.` });
  }
  if (trafficLights.length && scene.canvas.background !== 'crossroads') {
    issues.push({
      code: 'traffic-light-scene',
      severity: 'error',
      message: 'Los semáforos sólo pueden usarse en la escena Cruce con tránsito.',
    });
  }
  if (trafficLights.length > crossroadsTrafficSlots.length) {
    issues.push({
      code: 'traffic-light-limit',
      severity: 'error',
      message: 'La escena admite como máximo cuatro semáforos.',
    });
  }
  if (scene.canvas.background === 'crossroads') {
    const occupiedTrafficSlots = trafficLights.map(device =>
      closestCrossroadsTrafficSlot(device.position),
    );
    if (new Set(occupiedTrafficSlots.map(slot => slot.id)).size !== trafficLights.length) {
      issues.push({
        code: 'traffic-light-slot',
        severity: 'error',
        message: 'Cada semáforo debe ocupar una esquina diferente del cruce.',
      });
    }
  }
  for (const device of displays) {
    if (!validDisplayConfig(device.config)) {
      issues.push({ code: 'invalid-display', severity: 'error', deviceId: device.id, message: `${device.name}: revisá el modelo, los nombres y las zonas de texto. Deben caber en pantalla, sin superponerse.` });
      continue;
    }
    if (device.config.profile === 'waveshare5' && profileId !== 'waveshare-esp32-s3-touch-lcd-5-28117') {
      issues.push({ code: 'display-board-mismatch', severity: 'error', deviceId: device.id, message: `${device.name}: la pantalla integrada sólo existe en la Waveshare ESP32-S3 Touch LCD 5.` });
    }
    if (profileId === 'waveshare-esp32-s3-touch-lcd-5-28117' && device.config.profile !== 'waveshare5') {
      issues.push({ code: 'display-board-mismatch', severity: 'error', deviceId: device.id, message: `${device.name}: elegí la pantalla integrada Waveshare; los conectores de esta placa no exponen un bus genérico para este perfil.` });
    }
    const required = requiredDisplayPins(device.config);
    if (displayPinKeys.some(key => !required.includes(key) && device.pins[key] !== null)) issues.push({ code: 'invalid-display', severity: 'error', deviceId: device.id, message: `${device.name}: hay pines configurados que no pertenecen a este modelo.` });
  }
  const dashboardDisplay = displays.find(device => device.config.profile === 'waveshare5');
  for (const deviceId of dashboardDisplay?.config.dashboard?.deviceIds ?? []) {
    const target = scene.devices.find(device => device.id === deviceId);
    if (!target || !dashboardDeviceKinds.includes(target.kind as DashboardDeviceKind)) {
      issues.push({ code: 'invalid-display', severity: 'error', deviceId: dashboardDisplay?.id, message: `${dashboardDisplay?.name ?? 'Pantalla'}: el tablero contiene un control retirado o incompatible.` });
    }
  }
  const messageLinks = scene.devices.filter((device): device is MessagesDevice => device.kind === 'messages');
  if (messageLinks.length > 2) issues.push({ code: 'messages-limit', severity: 'error', message: 'La placa admite hasta dos componentes Mensajes; la conexión de programación queda reservada.' });
  for (const device of messageLinks) {
    if (device.config.mode === 'send' && device.pins.rx !== null) issues.push({ code: 'invalid-messages-pin', severity: 'error', deviceId: device.id, message: `${device.name}: el pin de recibir debe quedar libre en modo Enviar.` });
    if (device.config.mode === 'receive' && device.pins.tx !== null) issues.push({ code: 'invalid-messages-pin', severity: 'error', deviceId: device.id, message: `${device.name}: el pin de enviar debe quedar libre en modo Recibir.` });
  }
  for (const device of scene.devices.filter(device => device.kind === 'ledMatrix')) {
    if (!validMatrixConfig(device.config)) issues.push({ code: 'invalid-led-matrix', severity: 'error', deviceId: device.id, message: `${device.name}: revisá brillo, orientación y dibujos guardados.` });
  }
  for (const device of scene.devices.filter((device): device is OttoDevice => device.kind === 'otto')) {
    const active = new Set(getPinRequirements(device).map(requirement => requirement.key));
    if (Object.entries(device.pins).some(([key, pin]) => !active.has(key) && pin !== null)) issues.push({ code: 'invalid-otto-pin', severity: 'error', deviceId: device.id, message: `${device.name}: hay conexiones guardadas que no pertenecen a la configuración elegida.` });
  }
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

    if (!virtualOnly && (device.kind === 'robot' || device.kind === 'motor')) {
      issues.push({
        code: 'external-motor-power',
        severity: 'warning',
        message: `${device.name} necesita un DRV8833, alimentación externa y masa común con ${profile.shortName}.`,
        deviceId: device.id,
      });
    }
    if (!virtualOnly && (device.kind === 'servo' || device.kind === 'otto')) {
      issues.push({
        code: 'external-servo-power',
        severity: 'warning',
        message: `${device.name} debe usar una alimentación adecuada y masa común; no lo alimentes desde un GPIO.`,
        deviceId: device.id,
      });
    }
    if (!virtualOnly && (device.kind === 'led' || device.kind === 'trafficLight')) {
      issues.push({
        code: 'led-resistor-required',
        severity: 'warning',
        message: `${device.name} necesita una resistencia limitadora por cada LED físico.`,
        deviceId: device.id,
      });
    }
    if (
      !virtualOnly &&
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
    if (!virtualOnly && device.kind === 'button' && !device.config.pullup) {
      issues.push({
        code: 'button-external-bias-required',
        severity: 'warning',
        message: `${device.name} tiene desactivado el pull-up interno. Para hardware hace falta definir una resistencia externa y la polaridad; la simulación puede continuar.`,
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

  const requiredPwmChannels = pwmChannelCount(scene.devices.filter(device => !dashboardIds.has(device.id)));
  if (requiredPwmChannels > profile.pwmChannels) {
    issues.push({
      code: 'pwm-channel-limit',
      severity: 'warning',
      message: `La escena necesita ${requiredPwmChannels} canales PWM; ${profile.name} dispone de ${profile.pwmChannels}.`,
    });
  }

  const passiveBuzzers = scene.devices.filter(
    (device) => device.kind === 'passiveBuzzer',
  );
  if (!virtualOnly && passiveBuzzers.length > 1) {
    issues.push({
      code: 'passive-buzzer-limit',
      severity: 'warning',
      message:
        'Esta versión admite un solo buzzer pasivo por placa para garantizar que cada nota conserve su frecuencia.',
    });
  }

  for (const slot of collectPinSlots(scene.devices).filter(slot => !dashboardIds.has(slot.deviceId))) {
    if (slot.pin === null) {
      issues.push({
        code: 'missing-pin',
        severity: 'warning',
        message: `${slot.deviceName}: falta asignar ${slot.label}. La simulación seguirá funcionando.`,
        deviceId: slot.deviceId,
      });
      continue;
    }
    if (!pinSupports(slot.pin, slot.capability, profileId)) {
      issues.push({
        code: 'unsupported-pin',
        severity: 'warning',
        message: `${slot.deviceName}: ${pinLabel(slot.pin, profileId)} no es compatible con ${slot.label} en ${profile.shortName}.`,
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
        message: `${slot.deviceName} y ${previous.deviceName} usan ${pinLabel(slot.pin, profileId)}. La simulación funciona, pero el cableado debe corregirse.`,
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
    'button-external-bias-required',
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
    case 'ledMatrix': return validMatrixConfig(config);
    case 'display': return validDisplayConfig(config);
    case 'trafficLight':
      return (
        hasOnlyKeys(config, [
          'redBrightness',
          'yellowBrightness',
          'greenBrightness',
          'vehicleDisplay',
          'pedestrianDisplay',
          'matrixBrightness',
        ]) &&
        ['redBrightness', 'yellowBrightness', 'greenBrightness'].every(
          (key) =>
            hasFiniteNumber(config, key) &&
            Number(config[key]) >= 0 &&
            Number(config[key]) <= 100,
        ) &&
        typeof config.vehicleDisplay === 'boolean' &&
        typeof config.pedestrianDisplay === 'boolean' &&
        hasFiniteNumber(config, 'matrixBrightness') &&
        Number(config.matrixBrightness) >= 0 &&
        Number(config.matrixBrightness) <= 15
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
    case 'otto':
      return (
        hasOnlyKeys(config, ['profile', 'centers', 'reversed', 'matrixBrightness']) &&
        ['biped4', 'biped4-sound', 'biped4-explorer', 'biped4-expressive', 'humanoid6-expressive'].includes(String(config.profile)) &&
        Array.isArray(config.centers) && config.centers.length === 6 &&
        config.centers.every(value => typeof value === 'number' && Number.isInteger(value) && value >= 45 && value <= 135) &&
        Array.isArray(config.reversed) && config.reversed.length === 6 &&
        config.reversed.every(value => typeof value === 'boolean') &&
        typeof config.matrixBrightness === 'number' && Number.isInteger(config.matrixBrightness) && config.matrixBrightness >= 0 && config.matrixBrightness <= 15
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
    case 'smartLights':
      return (
        hasOnlyKeys(config, ['profile', 'geometry', 'count', 'width', 'height', 'layout', 'origin', 'colorOrder', 'brightness']) &&
        ['WS2812B', 'SK6812_RGB'].includes(String(config.profile)) &&
        ['strip', 'ring', 'matrix'].includes(String(config.geometry)) &&
        ['GRB', 'RGB'].includes(String(config.colorOrder)) &&
        ['progressive', 'zigzag'].includes(String(config.layout)) &&
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(String(config.origin)) &&
        hasFiniteNumber(config, 'count') && Number.isInteger(config.count) && Number(config.count) >= 1 && Number(config.count) <= 256 &&
        hasFiniteNumber(config, 'width') && Number.isInteger(config.width) && Number(config.width) >= 1 && Number(config.width) <= 256 &&
        hasFiniteNumber(config, 'height') && Number.isInteger(config.height) && Number(config.height) >= 1 && Number(config.height) <= 32 &&
        (config.geometry === 'matrix'
          ? Number(config.width) * Number(config.height) === Number(config.count)
          : Number(config.width) === Number(config.count) && Number(config.height) === 1) &&
        hasFiniteNumber(config, 'brightness') && Number(config.brightness) >= 0 && Number(config.brightness) <= 100
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
    case 'infraredBarrier':
      return (
        hasOnlyKeys(config, ['interrupted', 'interruptedLevel']) &&
        typeof config.interrupted === 'boolean' &&
        ['HIGH', 'LOW'].includes(String(config.interruptedLevel))
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
        hasOnlyKeys(config, ['status', 'ssid', 'role', 'boardName', 'peers', 'messages']) &&
        ['idle', 'connecting', 'connected', 'error'].includes(
          String(config.status),
        ) &&
        typeof config.ssid === 'string' &&
        config.ssid.length >= 1 && config.ssid.length <= 32 &&
        ['create', 'join'].includes(String(config.role)) &&
        typeof config.boardName === 'string' && /^[a-zA-Z0-9_-]{1,24}$/.test(config.boardName) &&
        Array.isArray(config.peers) && config.peers.length <= 8 && config.peers.every(peer => typeof peer === 'string' && /^[a-zA-Z0-9_-]{1,24}$/.test(peer)) && new Set(config.peers).size === config.peers.length &&
        Array.isArray(config.messages) && config.messages.length >= 1 && config.messages.length <= 24 && config.messages.every(message => typeof message === 'string' && message.trim().length >= 1 && new TextEncoder().encode(message).length <= 120) && new Set(config.messages).size === config.messages.length
      );
    case 'messages':
      return (
        hasOnlyKeys(config, ['mode', 'baudRate', 'messages']) &&
        ['send', 'receive', 'both'].includes(String(config.mode)) &&
        [9600, 19200, 38400, 57600, 115200].includes(Number(config.baudRate)) &&
        Array.isArray(config.messages) &&
        config.messages.length >= 1 &&
        config.messages.length <= 24 &&
        config.messages.every(message =>
          typeof message === 'string' &&
          message.trim().length >= 1 &&
          new TextEncoder().encode(message).length <= 120
        ) &&
        new Set(config.messages).size === config.messages.length
      );
    default:
      return isEducationalModuleKind(kind) && validEducationalModuleConfig(kind, config);
  }
}

function isSceneDevice(value: unknown, incompleteDisplayLayout = false): value is SceneDevice {
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
  return pinsAreValid && (typedKind === 'display' ? validDisplayConfig(value.config, incompleteDisplayLayout) : validDeviceConfig(typedKind, value.config));
}

export function isSceneDefinition(value: unknown, incompleteDisplayLayout = false): value is SceneDefinition {
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
      'trafficDirections',
      'railTracks',
      'parkingCapacity',
      'gardenEnvironment',
      'houseEnvironment',
      'conveyorEnvironment',
      'arenaEnvironment',
      'weatherEnvironment',
      'pondEnvironment',
      'theaterEnvironment',
      'lineCircuit',
      'houseAssignments',
      'itemOrder',
    ]) &&
    hasFiniteNumber(canvas, 'width') &&
    hasFiniteNumber(canvas, 'height') &&
    Number(canvas.width) > 0 &&
    Number(canvas.width) <= 4096 &&
    Number(canvas.height) > 0 &&
    Number(canvas.height) <= 4096 &&
    sceneBackgrounds.includes(canvas.background as SceneBackground) &&
    hasFiniteNumber(canvas, 'gridSize') &&
    Number(canvas.gridSize) > 0 &&
    Number(canvas.gridSize) <= 512 &&
    typeof canvas.snapToGrid === 'boolean' &&
    (canvas.railTracks === undefined || [1, 2, 4].includes(canvas.railTracks as number)) &&
    (canvas.parkingCapacity === undefined || [4, 8, 12].includes(canvas.parkingCapacity as number)) &&
    (canvas.gardenEnvironment === undefined || validGardenEnvironment(canvas.gardenEnvironment)) &&
    (canvas.lineCircuit === undefined || validLineCircuit(canvas.lineCircuit)) &&
    (canvas.theaterEnvironment === undefined || validTheaterEnvironment(canvas.theaterEnvironment)) &&
    (canvas.weatherEnvironment === undefined || validWeatherEnvironment(canvas.weatherEnvironment)) &&
    (canvas.pondEnvironment === undefined || validPondEnvironment(canvas.pondEnvironment)) &&
    (canvas.arenaEnvironment === undefined || validArenaEnvironment(canvas.arenaEnvironment)) &&
    (canvas.conveyorEnvironment === undefined || validConveyorEnvironment(canvas.conveyorEnvironment)) &&
    (canvas.houseEnvironment === undefined || validHouseEnvironment(canvas.houseEnvironment)) &&
    (canvas.houseAssignments === undefined || (isRecord(canvas.houseAssignments) && Object.entries(canvas.houseAssignments).every(([role, id]) => houseFreeRoles.includes(role as HouseFreeRole) && typeof id === 'string' && Array.isArray(devices) && devices.some(d => isRecord(d) && d.id === id && d.kind === houseSlots.find(s => s.role === role)?.kind)) && new Set(Object.values(canvas.houseAssignments)).size === Object.keys(canvas.houseAssignments).length)) &&
    (canvas.trafficDirections === undefined ||
      (Array.isArray(canvas.trafficDirections) &&
        canvas.trafficDirections.length <= trafficDirections.length &&
        canvas.trafficDirections.every(direction =>
          trafficDirections.includes(direction as TrafficDirection),
        ) &&
        new Set(canvas.trafficDirections).size ===
          canvas.trafficDirections.length)) &&
    (canvas.itemOrder === undefined ||
      (Array.isArray(canvas.itemOrder) &&
        canvas.itemOrder.length <= MAX_SCENE_ITEMS * 2 &&
        canvas.itemOrder.every(id => typeof id === 'string' && id.length <= 128) &&
        new Set(canvas.itemOrder).size === canvas.itemOrder.length)) &&
    Array.isArray(devices) &&
    devices.length <= MAX_SCENE_ITEMS &&
    devices.every(device => isSceneDevice(device, incompleteDisplayLayout)) &&
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
    (canvas.itemOrder === undefined ||
      canvas.itemOrder.every(itemId =>
        [...devices, ...widgets].some(item =>
          isRecord(item) && item.id === itemId,
        ),
      )) &&
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
    const scene = cloneScene(value);
    const trafficLights = scene.devices.filter(
      device => device.kind === 'trafficLight',
    );
    let movedTrafficLights = false;
    let changedTrafficScene = false;
    let renamedTrafficLights = false;
    if (trafficLights.length && scene.canvas.background !== 'crossroads') {
      scene.canvas.background = 'crossroads';
      scene.canvas.trafficDirections ??= [...trafficDirections];
      changedTrafficScene = true;
    }
    if (trafficLights.length) {
      const occupied = new Set<SceneTrafficSlot['id']>();
      let trafficSequence = 0;
      scene.devices = scene.devices.map(device => {
        if (device.kind !== 'trafficLight') return device;
        trafficSequence += 1;
        const preferred = closestCrossroadsTrafficSlot(device.position);
        const slot = !occupied.has(preferred.id)
          ? preferred
          : crossroadsTrafficSlots.find(candidate => !occupied.has(candidate.id)) ??
            preferred;
        occupied.add(slot.id);
        const name = `Semáforo ${trafficSequence}`;
        if (device.position.x !== slot.x || device.position.y !== slot.y)
          movedTrafficLights = true;
        if (device.name !== name) renamedTrafficLights = true;
        return {
          ...device,
          name,
          position: { x: slot.x, y: slot.y },
        };
      });
    }
    return {
      scene,
      migrated:
        movedTrafficLights || changedTrafficScene || renamedTrafficLights,
      warnings:
        movedTrafficLights || changedTrafficScene || renamedTrafficLights
          ? [
              'Los semáforos se numeraron y acomodaron en las esquinas correctas del cruce.',
            ]
          : [],
    };
  }
  if (value && typeof value === 'object') {
    const expanded = structuredClone(value) as { devices?: unknown[] };
    if (Array.isArray(expanded.devices)) {
      let changed = false;
      for (const item of expanded.devices) {
        if (!isRecord(item) || !isRecord(item.pins)) continue;
        if (item.kind === 'trafficLight' && isRecord(item.config)) {
          for (const key of ['matrixDin', 'matrixClk', 'matrixCs']) if (!Object.hasOwn(item.pins, key)) {
            item.pins[key] = null; changed = true;
          }
          if (!Object.hasOwn(item.config, 'vehicleDisplay')) { item.config.vehicleDisplay = false; changed = true; }
          if (!Object.hasOwn(item.config, 'pedestrianDisplay')) { item.config.pedestrianDisplay = false; changed = true; }
          if (!Object.hasOwn(item.config, 'matrixBrightness')) { item.config.matrixBrightness = 5; changed = true; }
        }
        if (item.kind === 'display') for (const key of displayPinKeys) if (!Object.hasOwn(item.pins, key)) {
          item.pins[key] = null; changed = true;
        }
        if (item.kind === 'otto' && isRecord(item.config)) {
          for (const key of ['leftArm', 'rightArm', 'buzzer', 'trigger', 'echo', 'matrixDin', 'matrixClk', 'matrixCs']) if (!Object.hasOwn(item.pins, key)) { item.pins[key] = null; changed = true; }
          if (Array.isArray(item.config.centers) && item.config.centers.length === 4) { item.config.centers.push(90, 90); changed = true; }
          if (Array.isArray(item.config.reversed) && item.config.reversed.length === 4) { item.config.reversed.push(false, true); changed = true; }
          if (!Object.hasOwn(item.config, 'matrixBrightness')) { item.config.matrixBrightness = 4; changed = true; }
        }
        if (item.kind === 'wifiNode' && isRecord(item.config)) {
          if (!Object.hasOwn(item.config, 'role')) { item.config.role = 'join'; changed = true; }
          if (!Object.hasOwn(item.config, 'boardName')) { item.config.boardName = 'mi-placa'; changed = true; }
          if (!Object.hasOwn(item.config, 'peers')) { item.config.peers = ['central']; changed = true; }
          if (!Object.hasOwn(item.config, 'messages')) { item.config.messages = ['HOLA', 'AVANZAR', 'DETENER']; changed = true; }
        }
      }
      if (changed && isSceneDefinition(expanded)) return {
        scene: cloneScene(expanded),
        migrated: true,
        warnings: ['Se actualizó la estructura interna de componentes antiguos sin cambiar el cableado existente.'],
      };
    }
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

export function getPinRequirements(device: SceneDeviceKind | SceneDevice) {
  if (typeof device === 'string') return requirementsByKind[device];
  if (device.kind === 'trafficLight') {
    const matricesEnabled =
      device.config.vehicleDisplay || device.config.pedestrianDisplay;
    return requirementsByKind.trafficLight.filter(requirement =>
      matricesEnabled || !requirement.key.startsWith('matrix'),
    );
  }
  if (device.kind === 'messages') {
    return requirementsByKind.messages.filter(requirement =>
      device.config.mode === 'both' ||
      (device.config.mode === 'send' && requirement.key === 'tx') ||
      (device.config.mode === 'receive' && requirement.key === 'rx')
    );
  }
  if (device.kind === 'otto') {
    const profiles = {
      biped4: ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot'],
      'biped4-sound': ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot', 'buzzer'],
      'biped4-explorer': ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot', 'buzzer', 'trigger', 'echo'],
      'biped4-expressive': ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot', 'buzzer', 'trigger', 'echo', 'matrixDin', 'matrixClk', 'matrixCs'],
      'humanoid6-expressive': ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot', 'leftArm', 'rightArm', 'buzzer', 'trigger', 'echo', 'matrixDin', 'matrixClk', 'matrixCs'],
    } as const;
    const keys: readonly string[] = profiles[device.config.profile];
    return requirementsByKind.otto.filter(requirement => keys.includes(requirement.key));
  }
  if (device.kind !== 'display') return requirementsByKind[device.kind];
  if (!validDisplayConfig(device.config, true)) return [];
  const keys = requiredDisplayPins(device.config);
  return requirementsByKind.display.filter(requirement => keys.includes(requirement.key as DisplayPinKey));
}
