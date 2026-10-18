import type { SceneDefinition, ScenePosition } from './scene-model';

export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'heavyRain';
export interface WeatherEnvironment { condition: WeatherCondition; night: boolean; automatic: boolean }
export const defaultWeatherEnvironment: WeatherEnvironment = { condition: 'sunny', night: false, automatic: false };
export const weatherLabels: Record<WeatherCondition, string> = { sunny: 'Soleado', cloudy: 'Nublado', rain: 'Lluvia suave', heavyRain: 'Lluvia intensa' };
export function validWeatherEnvironment(value: unknown): value is WeatherEnvironment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 3 && typeof v.condition === 'string' && Object.hasOwn(weatherLabels, v.condition) && typeof v.night === 'boolean' && typeof v.automatic === 'boolean';
}
export const weatherSlots = [
  { role: 'climate', kind: 'environmentSensor', name: 'Clima exterior', x: 210, y: 220 },
  { role: 'light', kind: 'lightSensor', name: 'Luz exterior', x: 345, y: 220 },
  { role: 'rain', kind: 'waterSensor', name: 'Detector de lluvia', x: 370, y: 365 },
  { role: 'roof', kind: 'servo', name: 'Techo del puesto', x: 650, y: 245 },
] as const;
export type WeatherRole = typeof weatherSlots[number]['role'];
export function nearestWeatherSlot(kind: string, position: ScenePosition) {
  return weatherSlots.filter(s => s.kind === kind).reduce<typeof weatherSlots[number] | undefined>((best, s) => !best || Math.hypot(s.x - position.x, s.y - position.y) < Math.hypot(best.x - position.x, best.y - position.y) ? s : best, undefined);
}
export function weatherBindings(scene: SceneDefinition): Partial<Record<WeatherRole, string>> {
  return scene.canvas.background !== 'weatherLab' ? {} : Object.fromEntries(scene.devices.flatMap(d => { const slot = nearestWeatherSlot(d.kind, d.position); return slot ? [[slot.role, d.id]] : []; }));
}
const conditions = {
  sunny: { temperature: 28, humidity: 40, pressure: 1017, light: 3600, rain: 0 },
  cloudy: { temperature: 22, humidity: 65, pressure: 1011, light: 1600, rain: 0 },
  rain: { temperature: 19, humidity: 80, pressure: 1008, light: 950, rain: 0.45 },
  heavyRain: { temperature: 17, humidity: 92, pressure: 1003, light: 450, rain: 1 },
} as const;
// An explicit repeatable teaching scenario, not a weather forecast.
const scenario: WeatherEnvironment[] = [
  { condition: 'sunny', night: false, automatic: true },
  { condition: 'cloudy', night: false, automatic: true },
  { condition: 'rain', night: false, automatic: true },
  { condition: 'heavyRain', night: true, automatic: true },
  { condition: 'cloudy', night: true, automatic: true },
  { condition: 'sunny', night: false, automatic: true },
];
export interface WeatherWorldState {
  environment: WeatherEnvironment; temperature: number; humidity: number; pressure: number; light: number;
  detectorWater: number; tableWater: number; roofAngle: number; timeMs: number; phaseMs: number; phaseIndex: number;
}
export function createWeatherWorldState(environment: WeatherEnvironment = defaultWeatherEnvironment, roofAngle = 90): WeatherWorldState {
  const c = conditions[environment.condition];
  return { environment: { ...environment }, temperature: c.temperature - (environment.night ? 4 : 0), humidity: c.humidity, pressure: c.pressure,
    light: environment.night ? 100 : c.light, detectorWater: 0, tableWater: 0, roofAngle: Math.max(0, Math.min(90, roofAngle)), timeMs: 0, phaseMs: 0,
    phaseIndex: Math.max(0, scenario.findIndex(s => s.condition === environment.condition && s.night === environment.night)) };
}
export function advanceWeatherWorld(previous: WeatherWorldState, roofTarget: number, elapsedMs: number): WeatherWorldState {
  const w = { ...previous, environment: { ...previous.environment } };
  let remaining = Math.max(0, Math.min(2000, elapsedMs));
  while (remaining > 0) {
    const ms = Math.min(50, remaining), seconds = ms / 1000; remaining -= ms;
    w.timeMs += ms;
    if (w.environment.automatic) {
      w.phaseMs += ms;
      if (w.phaseMs >= 20000) { w.phaseMs -= 20000; w.phaseIndex = (w.phaseIndex + 1) % scenario.length; w.environment = { ...scenario[w.phaseIndex] }; }
    }
    const c = conditions[w.environment.condition];
    const approach = (value: number, target: number, tau: number) => value + (target - value) * (1 - Math.exp(-seconds / tau));
    w.temperature = approach(w.temperature, c.temperature - (w.environment.night ? 4 : 0), 15);
    w.humidity = approach(w.humidity, c.humidity, 12);
    w.pressure = approach(w.pressure, c.pressure, 30);
    w.light = approach(w.light, w.environment.night ? 100 : c.light, 1.5);
    const target = Math.max(0, Math.min(90, roofTarget));
    w.roofAngle += Math.sign(target - w.roofAngle) * Math.min(Math.abs(target - w.roofAngle), seconds * 75);
    // Detector is always exposed. Its wetness is NOT a rain-rate measurement.
    w.detectorWater = Math.max(0, Math.min(100, w.detectorWater + seconds * (c.rain ? c.rain * 12 : -2.5)));
    // Roof protects the table progressively, but cannot erase accumulated water.
    const exposure = w.roofAngle / 90;
    w.tableWater = Math.max(0, Math.min(100, w.tableWater + seconds * (c.rain ? c.rain * exposure * 9 : -(w.environment.night ? 0.35 : 0.8))));
  }
  return w;
}
