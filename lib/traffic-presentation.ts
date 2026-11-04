import type { SceneDefinition, SceneDevice } from './scene-model';
// @ts-expect-error Node source runner.
import { closestCrossroadsTrafficSlot } from './scene-model.ts';
// @ts-expect-error Node source runner.
import { sceneItemBounds, TRAFFIC_CARD } from './scene-layout.ts';
export { TRAFFIC_CARD };

// Logical coordinates, never viewport pixels. Both renderers consume these tuples.
export type TrafficPrimitive =
  | ['r', number, number, number, number, string]
  | ['c', number, number, number, string]
  | ['p', number[], string]
  | ['t', number, number, string, string, number]
  | ['lamp', number, number, number, string, string, string]
  | ['matrix', number, number, 'vehicleDisplay' | 'pedestrianDisplay'];
export type TrafficLabel = { id: string; x: number; y: number; width: number; height: number; lines: string[]; fontScale:number; lineHeight:number };
export type TrafficPresentation = { version: 1; width: number; height: number; background: TrafficPrimitive[];
  signals: { id: string; x: number; y: number; lane:number; crossing:number; primitives: TrafficPrimitive[] }[]; labels: TrafficLabel[];
  cars:TrafficPrimitive[][]; people:TrafficPrimitive[][]; conflict:TrafficPrimitive[];
  boxes:{id:string;x:number;y:number;width:number;height:number}[] };

export function fitTrafficScene(width: number, height: number, viewport = { x: 12, y: 62, width: 776, height: 354 }) {
  const scale = Math.min(viewport.width / width, viewport.height / height);
  return { scale, x: viewport.x + (viewport.width - width * scale) / 2, y: viewport.y + (viewport.height - height * scale) / 2 };
}

export function trafficAscii(value: string) {
  return Array.from(value.normalize('NFC'), character => {
    const parts=character.normalize('NFD');const base=parts.charCodeAt(0);
    return base>=32&&base<=126&&(!parts[1]||['\u0301','\u0303','\u0308'].includes(parts[1]))?character:'?';
  }).join('');
}

function labelLines(name: string) {
  const text = trafficAscii(name).replace(/\s+/g, ' ').trim() || 'Componente';
  const lines: string[] = [];
  let rest = text;
  while (rest && lines.length < 2) {
    const limit = 13;
    if (rest.length <= limit) { lines.push(rest); rest = ''; break; }
    const space = rest.lastIndexOf(' ', limit);
    const take = space >= 5 ? space : limit;
    lines.push(rest.slice(0, take)); rest = rest.slice(take).trimStart();
  }
  if (rest) lines[1] = lines[1].slice(0, 10) + '...';
  return lines;
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x &&
  a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y;

export function trafficLabels(scene: SceneDefinition): TrafficLabel[] {
  const all = [...scene.devices, ...scene.widgets];
  const occupied: Box[] = all.map(item => {
    const box = item.kind === 'trafficLight' ? TRAFFIC_CARD : sceneItemBounds(item, scene);
    return { x: item.position.x - box.width / 2, y: item.position.y - box.height / 2, width: box.width, height: box.height };
  });
  occupied.push({x:160,y:484,width:640,height:48});
  occupied.push({x:0,y:180,width:960,height:180},{x:390,y:0,width:180,height:540},{x:83,y:88,width:126,height:21});
  const labels: TrafficLabel[] = [];
  // Stable IDs make placement independent of drawing order; never move project objects.
  for (const item of [...scene.devices].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    const lines = labelLines(item.name);
    const width = Math.max(...lines.map(line => line.length)) * 18 + 12;
    const height = lines.length * 26 + 10;
    const size = item.kind === 'trafficLight' ? TRAFFIC_CARD : sceneItemBounds(item, scene);
    const { x, y } = item.position;
    const candidates: Box[] = [
      { x: x - width / 2, y: y + size.height / 2 + 7, width, height },
      { x: x - width / 2, y: y - size.height / 2 - height - 7, width, height },
      { x: x + size.width / 2 + 7, y: y - height / 2, width, height },
      { x: x - size.width / 2 - width - 7, y: y - height / 2, width, height },
    ];
    const free = (box: Box) => box.x >= 6 && box.y >= 6 && box.x + width <= scene.canvas.width - 6 &&
      box.y + height <= scene.canvas.height - 6 && !occupied.some(other => overlaps(box, other));
    let chosen = candidates.find(free);
    if (!chosen) {
      const alternatives: Box[] = [];
      for (let top = 6; top + height <= scene.canvas.height - 6; top += 12)
        for (let left = 6; left + width <= scene.canvas.width - 6; left += 12) alternatives.push({ x: left, y: top, width, height });
      chosen = alternatives.filter(free).sort((a, b) => Math.hypot(a.x + width / 2 - x, a.y + height / 2 - y) - Math.hypot(b.x + width / 2 - x, b.y + height / 2 - y))[0];
    }
    // Dense arbitrary scenes have finite room. Compact names still retain their full accessible title.
    if (!chosen) continue;
    occupied.push(chosen); labels.push({ ...chosen, id: item.id, lines, fontScale:3, lineHeight:26 });
  }
  return labels;
}

export function trafficBackground(): TrafficPrimitive[] {
  const out: TrafficPrimitive[] = [
    ['r',0,0,960,540,'#86c978'], ['r',0,180,960,180,'#505663'], ['r',390,0,180,540,'#505663'],
    ...[0,155,690,845].map(x => ['r',x,266,115,8,'#f8dc6a'] as TrafficPrimitive),
    ...[[0,80],[120,60],[360,65],[465,75]].map(([y,h]) => ['r',476,y,8,h,'#f8dc6a'] as TrafficPrimitive),
  ];
  for (let i=0;i<12;i++) out.push(['r',365,183+i*15,20,8,'#ffffff'], ['r',575,183+i*15,20,8,'#ffffff'],
    ['r',393+i*15,155,8,20,'#ffffff'], ['r',393+i*15,365,8,20,'#ffffff']);
  out.push(['r',35,35,220,105,'#f6efd0'], ['p',[25,45,145,10,265,45,251,73,39,73],'#e76962'],
    ['t',83,88,'ESCUELA','#34445b',3], ['c',805,75,42,'#397d46'], ['c',885,115,35,'#397d46']);
  for (const [x,y,angle] of [[200,320,0],[760,210,180],[435,90,90],[525,460,270]]) {
    const points = [-17,-5,0,-5,0,-13,19,0,0,13,0,5,-17,5];
    const radians=angle*Math.PI/180;
    out.push(['p',points.map((value,index) => index%2===0 ? x+value*Math.cos(radians)-points[index+1]*Math.sin(radians) : y+points[index-1]*Math.sin(radians)+value*Math.cos(radians)),'#ffffff']);
  }
  return out;
}

export function trafficSignalPrimitives(device: Extract<SceneDevice, {kind:'trafficLight'}>): TrafficPrimitive[] {
  const primitives: TrafficPrimitive[] = [['r',-50,-44,100,88,'#ffffff'],['r',-43,-36,28,72,'#29324a'],
    ['lamp',-29,-24,8,'#532c30','#ff3741','RED'], ['lamp',-29,-2,8,'#53492a','#ffc92d','YELLOW'], ['lamp',-29,20,8,'#284c3a','#2ad270','GREEN']];
  const angle=closestCrossroadsTrafficSlot(device.position).rotation*Math.PI/180;
  const arrow=[-17,-4,3,-4,3,-10,18,0,3,10,3,4,-17,4];
  primitives.push(['p',arrow.map((value,index) => index%2===0 ? 14+value*Math.cos(angle)-arrow[index+1]*Math.sin(angle) : -19+arrow[index-1]*Math.sin(angle)+value*Math.cos(angle)),'#29324a']);
  if(device.config.vehicleDisplay)primitives.push(['matrix',-5,6,'vehicleDisplay']);
  if(device.config.pedestrianDisplay)primitives.push(['matrix',23,6,'pedestrianDisplay']);
  return primitives;
}

export function createTrafficPresentation(scene: SceneDefinition): TrafficPresentation {
  const directions=['eastbound','westbound','southbound','northbound'];
  const crossings=['north','east','south','west'];
  return { version:1, width:scene.canvas.width, height:scene.canvas.height, background:trafficBackground(), labels:trafficLabels(scene),
    boxes:scene.devices.map(device=>{const box=sceneItemBounds(device,scene);return {id:device.id,...device.position,width:box.width,height:box.height};}),
    signals:scene.devices.filter((device):device is Extract<SceneDevice,{kind:'trafficLight'}>=>device.kind==='trafficLight').map(device=>{
      const slot=closestCrossroadsTrafficSlot(device.position);
      return {id:device.id,...device.position,lane:directions.indexOf(slot.direction),crossing:crossings.indexOf(slot.id),primitives:trafficSignalPrimitives(device)};
    }),cars:[0,1,2,3].map(trafficCarPrimitives),people:[1,-1].map(trafficPersonPrimitives),conflict:trafficConflictPrimitives() };
}

export function trafficCarPrimitives(index:number):TrafficPrimitive[]{
  return [['r',-20,-10,40,20,['#4f84eb','#ee5b67','#ecc052','#3d9b90'][index%4]],['r',2,-7,11,14,'#d9edff'],
    ['r',-13,-12,8,3,'#29324a'],['r',-13,9,8,3,'#29324a'],['r',9,-12,8,3,'#29324a'],['r',9,9,8,3,'#29324a'],['r',17,-6,3,3,'#fff2a2'],['r',17,3,3,3,'#fff2a2']];
}
export function trafficPersonPrimitives(direction:number):TrafficPrimitive[]{
  const ink=direction===1?'#334ea3':'#9e3673';
  return [['c',0,-8,5,'#f0bd8e'],['r',-2,-2,4,11,ink],['p',[-2,1,-8,5,-7,7,0,4,7,7,8,5,2,1],ink],['p',[-2,6,-6,15,-3,16,0,10,3,16,6,15,2,6],ink]];
}
export function trafficConflictPrimitives():TrafficPrimitive[]{
  return [['r',160,484,640,48,'#fff3cd'],['t',184,500,'CHOQUE - REINICIA PROGRAMA Y ESCENA','#722735',2]];
}
