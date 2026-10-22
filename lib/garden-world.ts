import type { SceneDefinition, ScenePosition } from './scene-model';

export interface GardenEnvironment {
  sun: 'low' | 'medium' | 'strong';
  outsideTemperature: number;
  rain: boolean;
  changingWeather: boolean;
}
export const defaultGardenEnvironment: GardenEnvironment = { sun: 'medium', outsideTemperature: 22, rain: false, changingWeather: false };
export function validGardenEnvironment(value: unknown): value is GardenEnvironment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 4 && ['low', 'medium', 'strong'].includes(String(v.sun)) && typeof v.sun === 'string' && typeof v.outsideTemperature === 'number' && Number.isFinite(v.outsideTemperature) && v.outsideTemperature >= 5 && v.outsideTemperature <= 40 && typeof v.rain === 'boolean' && typeof v.changingWeather === 'boolean';
}
export const gardenSlots = [
  { role: 'outsideSoil', kind: 'soilMoisture', name: 'Tierra de la huerta', x: 205, y: 365 },
  { role: 'insideSoil', kind: 'soilMoisture', name: 'Tierra del invernadero', x: 655, y: 365 },
  { role: 'outsidePump', kind: 'powerSwitch', name: 'Riego de la huerta', x: 345, y: 365 },
  { role: 'insidePump', kind: 'powerSwitch', name: 'Riego del invernadero', x: 795, y: 365 },
  { role: 'climate', kind: 'environmentSensor', name: 'Clima del invernadero', x: 680, y: 145 },
  { role: 'window', kind: 'servo', name: 'Ventana del invernadero', x: 865, y: 205 },
  { role: 'light', kind: 'lightSensor', name: 'Luz del sol', x: 375, y: 145 },
] as const;
export type GardenRole = typeof gardenSlots[number]['role'];
export function nearestGardenSlot(kind: string, position: ScenePosition) {
  return gardenSlots.filter(slot => slot.kind === kind).reduce<typeof gardenSlots[number] | undefined>((best, slot) => !best || Math.hypot(slot.x - position.x, slot.y - position.y) < Math.hypot(best.x - position.x, best.y - position.y) ? slot : best, undefined);
}
export function gardenBindings(scene: SceneDefinition): Partial<Record<GardenRole, string>> {
  if (scene.canvas.background !== 'greenhouse') return {};
  return Object.fromEntries(scene.devices.flatMap(device => { const slot = nearestGardenSlot(device.kind, device.position); return slot ? [[slot.role, device.id]] : []; }));
}
export interface GardenBed { moisture: number; health: number; growth: number; cause: 'dry' | 'wet' | 'hot' | null }
export interface GardenWorldState {
  environment: GardenEnvironment;
  outside: GardenBed;
  inside: GardenBed;
  temperature: number;
  outsideTemperature: number;
  humidity: number;
  light: number;
  windowAngle: number;
  outsidePower: number;
  insidePower: number;
  weatherInMs: number;
  randomState: number;
}
export function createGardenWorldState(environment: GardenEnvironment = defaultGardenEnvironment, windowAngle = 0): GardenWorldState {
  return { environment: { ...environment }, outside: { moisture: 55, health: 90, growth: 25, cause: null }, inside: { moisture: 55, health: 90, growth: 25, cause: null },
    temperature: environment.outsideTemperature + 3, outsideTemperature: environment.outsideTemperature, humidity: 50,
    light: { low: 25, medium: 60, strong: 100 }[environment.sun], windowAngle: Math.max(0, Math.min(90, windowAngle)), outsidePower: 0, insidePower: 0, weatherInMs: 45000, randomState: 0x68756572 };
}
const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
export function advanceGardenWorld(previous: GardenWorldState, targets: { outsidePower?: number; insidePower?: number; windowAngle?: number }, elapsedMs: number): GardenWorldState {
  let remaining = clamp(elapsedMs, 0, 2000);
  if (!remaining) return previous;
  const world: GardenWorldState = { ...previous, environment: { ...previous.environment }, outside: { ...previous.outside }, inside: { ...previous.inside } };
  world.outsidePower = clamp(targets.outsidePower ?? 0);
  world.insidePower = clamp(targets.insidePower ?? 0);
  const random = () => { world.randomState = (Math.imul(world.randomState, 1664525) + 1013904223) >>> 0; return world.randomState / 0x100000000; };
  while (remaining > 0) {
    const ms = Math.min(100, remaining), seconds = ms / 1000;
    remaining -= ms;
    if (world.environment.changingWeather) {
      world.weatherInMs -= ms;
      if (world.weatherInMs <= 0) {
        world.environment.sun = (['low', 'medium', 'strong'] as const)[Math.floor(random() * 3)];
        world.environment.rain = random() < 0.3;
        world.environment.outsideTemperature = 18 + Math.round(random() * 14);
        world.weatherInMs = 45000;
      }
    }
    const angleDifference = clamp(targets.windowAngle ?? 0, 0, 90) - world.windowAngle;
    world.windowAngle += Math.sign(angleDifference) * Math.min(Math.abs(angleDifference), 75 * seconds);
    world.light = { low: 25, medium: 60, strong: 100 }[world.environment.sun];
    const outsideTarget = world.environment.outsideTemperature - (world.environment.rain ? 2 : 0);
    world.outsideTemperature += (outsideTarget - world.outsideTemperature) * Math.min(1, seconds / 8);
    const insideTarget = world.outsideTemperature + world.light / 100 * (18 - 16 * world.windowAngle / 90);
    world.temperature += (insideTarget - world.temperature) * Math.min(1, seconds / 12);
    world.humidity += (clamp(45 + (world.inside.moisture - 50) * 0.35 - world.windowAngle / 90 * 12, 10, 95) - world.humidity) * Math.min(1, seconds / 10);
    for (const [key, power, temp] of [['outside', world.outsidePower, world.outsideTemperature], ['inside', world.insidePower, world.temperature]] as const) {
      const bed = world[key];
      const evaporation = 0.35 + world.light * 0.004 + Math.max(0, temp - 20) * 0.025;
      const rain = key === 'outside' && world.environment.rain ? 2 : 0;
      bed.moisture = clamp(bed.moisture + seconds * (power / 100 * 4 + rain - evaporation - (bed.moisture > 75 ? 0.4 : 0)));
      bed.cause = bed.moisture < 25 ? 'dry' : bed.moisture > 85 ? 'wet' : temp > 35 ? 'hot' : null;
      bed.health = clamp(bed.health + seconds * (bed.cause ? -2 : 0.8));
      if (!bed.cause) bed.growth = clamp(bed.growth + seconds * 0.2 * world.light / 100 * bed.health / 100);
    }
  }
  return world;
}
export function gardenPlantStatus(bed: GardenBed) { return bed.health < 35 ? 'Marchita' : bed.cause || bed.health < 70 ? 'Necesita atención' : 'Saludable'; }
export function gardenCauseLabel(cause: GardenBed['cause']) { return cause === 'dry' ? '💧 Falta agua' : cause === 'wet' ? '🌊 Sobra agua' : cause === 'hot' ? '🌡️ Demasiado calor' : '✓ Condiciones adecuadas'; }
