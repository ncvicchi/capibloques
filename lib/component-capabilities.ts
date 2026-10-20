import type { VariableType } from './capiblocks.ts';
import type { SceneDevice, SceneDeviceKind } from './scene-model.ts';
// @ts-expect-error Node strip-types tests import the source extension.
import { educationalModuleSpecs, isEducationalModuleKind } from './educational-modules.ts';

export type ComponentValueSource = 'measured' | 'ordered' | 'service';
export interface ComponentValueCapability { key: string; label: string; type: VariableType; source: ComponentValueSource; help: string; choices?: readonly string[] }

const common: Partial<Record<SceneDeviceKind, ComponentValueCapability[]>> = {
  trafficLight: [{ key:'color', label:'color actual ordenado', type:'text', source:'ordered', help:'Indica apagado, rojo, amarillo o verde según la última orden del programa; no mide las lámparas.' }],
  led: [{ key:'brightness', label:'brillo ordenado', type:'number', source:'ordered', help:'Es el porcentaje pedido al LED.' }],
  smartLights: [{ key:'brightness', label:'brillo ordenado', type:'number', source:'ordered', help:'Es el último límite de brillo pedido a las luces RGB.' }],
  ledMatrix: [{ key:'brightness', label:'brillo ordenado', type:'number', source:'ordered', help:'Es el último porcentaje pedido a la matriz; el MAX7219 lo convierte a 16 niveles.' }],
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
  if(device.kind==='distanceSensor'&&device.config.profile==='HC-SR04')return [...educationalModuleSpecs.distanceSensor.values.map(value=>({key:value.key,label:value.label,type:value.type,source:'measured' as const,help:value.help})),{key:'valid',label:'lectura válida y reciente',type:'boolean',source:'measured',help:'Hay un eco válido reciente. Sin eco no significa camino libre.'}];
  if(device.kind==='gorilla')return [...(device.config.remote ? [
    ...[['remoteConnected','mando conectado'],['remoteArmed','mando habilitado'],['remoteStopped','detención solicitada']].map(([key,label])=>({key,label,type:'boolean' as const,source:'service' as const,help:'Control remoto local con renovación cada 100 ms y caducidad de 500 ms.'})),
    ...[['remoteDirection','dirección solicitada'],['remoteMode','modo solicitado']].map(([key,label])=>({key,label,type:'text' as const,source:'service' as const,help:'Solicitud del mando, no movimiento medido.'})),
    ...[['remoteRhythm','ritmo solicitado'],['remoteMission','misión solicitada (0 = ninguna)']].map(([key,label])=>({key,label,type:'number' as const,source:'service' as const,help:'Solicitud tipada del mando. Las misiones se numeran desde 1.'})),
  ] : []),...educationalModuleSpecs.gorilla.values.map(value=>({key:value.key,label:value.label,type:value.type,source:'ordered' as const,help:value.help})),{key:'walkOutcome',label:'resultado de la marcha autónoma',type:'text',source:'ordered',help:'ninguno, condición, tiempo máximo, solicitado o error.',choices:['ninguno','condición','tiempo máximo','solicitado','error']}];
  if (isEducationalModuleKind(device.kind)) return educationalModuleSpecs[device.kind].values.map(value => ({ key: value.key, label: value.label, type: value.type, source: ['gorilla','powerSwitch','stepper'].includes(device.kind) ? 'ordered' : 'measured', help: value.help }));
  const values = (common[device.kind] ?? []).map(value => ({ ...value,
    ...(device.kind === 'trafficLight' && value.key === 'color' ? { choices: ['OFF', 'RED', 'YELLOW', 'GREEN'] } : {}),
    ...(device.kind === 'robot' && value.key === 'motion' ? { choices: ['STOP', 'FORWARD', 'BACKWARD', 'LEFT', 'RIGHT', 'WHEELS'] } : {}),
    ...(device.kind === 'wifiNode' && value.key === 'status' ? { choices: ['desconectado', 'conectando', 'conectado', 'error'] } : {}),
  }));
  if (device.kind === 'otto' && !['biped4-explorer','biped4-expressive','humanoid6-expressive'].includes(device.config.profile)) return values.filter(item => item.key !== 'distance' && item.key !== 'expression');
  if (device.kind === 'otto' && !['biped4-expressive','humanoid6-expressive'].includes(device.config.profile)) return values.filter(item => item.key !== 'expression');
  return values;
}

export function componentValueCapability(device: SceneDevice | undefined, key: string) {
  return device ? componentValueCapabilities(device).find(item => item.key === key) : undefined;
}
