import type { VariableType } from './capiblocks.ts';
import type { SceneDevice, SceneDeviceKind } from './scene-model.ts';

export type ComponentValueSource = 'measured' | 'ordered' | 'service';
export interface ComponentValueCapability { key: string; label: string; type: VariableType; source: ComponentValueSource; help: string }

const common: Partial<Record<SceneDeviceKind, ComponentValueCapability[]>> = {
  trafficLight: [{ key:'color', label:'color ordenado', type:'text', source:'ordered', help:'Es el color que pidió el programa; no mide las lámparas.' }],
  led: [{ key:'brightness', label:'brillo ordenado', type:'number', source:'ordered', help:'Es el porcentaje pedido al LED.' }],
  smartLights: [{ key:'brightness', label:'brillo ordenado', type:'number', source:'ordered', help:'Es el último límite de brillo pedido a las luces RGB.' }],
  robot: [{ key:'motion', label:'movimiento ordenado', type:'text', source:'ordered', help:'Es el último movimiento pedido; no confirma desplazamiento físico.' }],
  motor: [{ key:'power', label:'potencia ordenada', type:'number', source:'ordered', help:'Positivo avanza, negativo retrocede y cero detiene.' }],
  servo: [{ key:'angle', label:'ángulo ordenado', type:'number', source:'ordered', help:'Es el ángulo pedido; un servo común no informa su posición real.' }],
  button: [{ key:'pressed', label:'está presionado', type:'boolean', source:'measured', help:'Lee la entrada digital del botón.' }],
  infraredBarrier: [{ key:'interrupted', label:'está interrumpida', type:'boolean', source:'measured', help:'Lee la salida digital del detector.' }],
  lightSensor: [{ key:'value', label:'luz medida', type:'number', source:'measured', help:'Lee el valor analógico del sensor.' }],
  potentiometer: [{ key:'value', label:'posición medida', type:'number', source:'measured', help:'Lee el valor analógico del potenciómetro.' }],
  wifiNode: [
    { key:'connected', label:'está conectado', type:'boolean', source:'service', help:'Indica si Wi-Fi tiene conexión en este momento.' },
    { key:'status', label:'estado de conexión', type:'text', source:'service', help:'Devuelve desconectado, conectando, conectado o error.' },
    { key:'lastWifiMessage', label:'último mensaje Wi-Fi', type:'text', source:'service', help:'Es el último texto válido recibido desde otra placa.' },
    { key:'lastWifiSender', label:'placa que lo envió', type:'text', source:'service', help:'Es el nombre configurado por la placa remitente.' },
  ],
  messages: [{ key:'lastMessage', label:'último mensaje recibido', type:'text', source:'service', help:'Es el último texto válido recibido por Mensajes.' }],
  otto: [
    { key:'distance', label:'distancia medida', type:'number', source:'measured', help:'Lee el ultrasonido cuando esta configuración lo incluye.' },
    { key:'motion', label:'movimiento ordenado', type:'text', source:'ordered', help:'Es el último movimiento pedido.' },
    { key:'expression', label:'cara ordenada', type:'text', source:'ordered', help:'Es la última cara enviada a la matriz.' },
  ],
};

export function componentValueCapabilities(device: SceneDevice): ComponentValueCapability[] {
  const values = [...(common[device.kind] ?? [])];
  if (device.kind === 'otto' && !['biped4-explorer','biped4-expressive','humanoid6-expressive'].includes(device.config.profile)) return values.filter(item => item.key !== 'distance' && item.key !== 'expression');
  if (device.kind === 'otto' && !['biped4-expressive','humanoid6-expressive'].includes(device.config.profile)) return values.filter(item => item.key !== 'expression');
  return values;
}

export function componentValueCapability(device: SceneDevice | undefined, key: string) {
  return device ? componentValueCapabilities(device).find(item => item.key === key) : undefined;
}
