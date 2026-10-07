import type { RuntimeDeviceState } from './capiblocks';
import type { SceneDevice } from './scene-model';

export interface SimulatedPinState { label: string; color: string; intensity: number }
const level = (on: boolean, color = '#c62d39'): SimulatedPinState => ({ label: on ? '1 · encendido' : '0 · apagado', color: on ? color : '#365a9c', intensity: on ? 1 : 0 });
const proportion = (value: number, label: string): SimulatedPinState => ({ label, color: '#7c3aed', intensity: Math.max(0, Math.min(1, value / 100)) });

/** Logical simulation only. Never infer bus waveforms or physical feedback. */
export function simulatedPinState(device: SceneDevice, key: string, runtime?: RuntimeDeviceState): SimulatedPinState | undefined {
  if (!runtime) return undefined;
  switch (runtime.kind) {
    case 'trafficLight': {
      const channels = { red: ['RED', '#c62d39'], yellow: ['YELLOW', '#b57700'], green: ['GREEN', '#168146'] } as const;
      const channel = channels[key as keyof typeof channels];
      return channel ? level(runtime.color === channel[0], channel[1]) : undefined;
    }
    case 'led': return proportion(runtime.brightness, `PWM · brillo ${Math.round(runtime.brightness)}%`);
    case 'servo': return { label: `PWM · ángulo ${Math.round(runtime.angle)}°`, color: '#7c3aed', intensity: 1 };
    case 'activeBuzzer': return level(runtime.playing);
    case 'passiveBuzzer': return { label: runtime.playing ? `Tono · ${runtime.frequency} Hz` : 'Sin tono', color: '#7c3aed', intensity: runtime.playing ? 1 : 0 };
    case 'lightSensor': case 'potentiometer': return proportion(runtime.value / 4095 * 100, `Entrada analógica · ${Math.round(runtime.value)} de 4095`);
    case 'button': return { label: runtime.pressed ? 'Pulsado' : 'Sin pulsar', color: '#168146', intensity: runtime.pressed ? 1 : 0 };
    case 'infraredBarrier': return device.kind === 'infraredBarrier' ? { label: runtime.interrupted ? 'Haz interrumpido' : 'Haz libre', color: '#168146', intensity: runtime.interrupted ? 1 : 0 } : undefined;
    default: return undefined;
  }
}

export const rawSimulatedPinState = (on: boolean) => level(on);
