'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import { conveyorBindings, conveyorSlots, createConveyorWorldState, type ConveyorWorldState } from '@/lib/conveyor-world';
export default function ConveyorWorld({ scene, state }: { scene: SceneDefinition; state?: ConveyorWorldState }) {
  const bindings = conveyorBindings(scene), w = state ?? createConveyorWorldState(scene.canvas.conveyorEnvironment);
  const colors = { red: '#e66c65', blue: '#6399db', green: '#6cae78' };
  const colorNames = { red: 'rojo', blue: 'azul', green: 'verde' };
  return <div className="scene-world" data-conveyor-jammed={w.jammed} data-conveyor-delivered={w.deliveredA + w.deliveredB} data-conveyor-valid={w.readingValid}>
    <svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-label="Taller con cinta, zona de lectura, desviador y bandejas A y B">
      <rect width="960" height="540" fill="#e8e7db" /><path d="M0 100H960M0 440H960" stroke="#cecdbf" strokeWidth="4" />
      {[70, 200, 330, 460, 590, 720, 850].map(x => <path key={x} d={`M${x} 100V440`} stroke="#d8d7ca" />)}
      <text x="40" y="52" fontSize="24" fontWeight="900" fill="#3d4f5a">TALLER DE PAQUETES</text>
      <path d="M25 270H640L875 185M640 270L875 355" fill="none" stroke="#667b83" strokeWidth="84" strokeLinejoin="round" />
      <path d="M25 270H640L875 185M640 270L875 355" fill="none" stroke="#abbab8" strokeWidth="65" strokeDasharray="8 13" />
      <rect x="295" y="220" width="70" height="100" rx="9" fill="#ffe8a8" opacity=".65" />
      <text x="330" y="210" textAnchor="middle" fill="#3d4f5a" fontSize="14">LECTURA</text>
      <path d="M350 315L420 345" fill="none" stroke="#a38e63" strokeDasharray="4 5" strokeWidth="2" />
      <path d="M640 270l55 -20" transform={`rotate(${w.angle * 0.44} 640 270)`} stroke="#d9a24b" strokeWidth="12" />
      {[['A', 185, w.deliveredA], ['B', 355, w.deliveredB]].map(([name, y, count]) => <g key={String(name)}><rect x="855" y={Number(y) - 42} width="90" height="84" rx="10" fill="#d8b78f" stroke="#936e50" strokeWidth="4" /><text x="900" y={Number(y) - 4} textAnchor="middle" fill="#483f37" fontWeight="900" fontSize="24">{name}</text><text x="900" y={Number(y) + 22} textAnchor="middle" fontSize="14">{count} entregas</text></g>)}
      {w.packages.map(p => { const y = p.route ? 270 + (p.route === 'A' ? -1 : 1) * (p.x - 640) * 85 / 235 : 270; return <g key={p.id} data-package={p.id} transform={`translate(${p.x} ${y})`}><title>Paquete {p.id}, {colorNames[p.color]}, {p.weight} g</title><rect x="-24" y="-23" width="48" height="46" rx="5" fill={colors[p.color]} stroke="#4b5960" strokeWidth="2" /><path d="M-24-9H24M0-23V23" stroke="#f1d7aa" strokeWidth="5" /><text y="39" textAnchor="middle" fontSize="12" fill="#263d51">{p.weight} g</text></g>; })}
      {conveyorSlots.map(slot => { const name = scene.devices.find(d => d.id === bindings[slot.role])?.name ?? `${slot.name} · falta`; return <text key={slot.role} x={slot.x} y={slot.y + 35} textAnchor="middle" fontSize="12" fontWeight="800" fill="#263d51"><title>{name}</title>{name.length > 23 ? name.slice(0, 22) + '…' : name}</text>; })}
      <text x="40" y="465" fontSize="16" fill="#263d51">Cinta: {Math.round(w.power)}% · {w.color ? `Paquete ${colorNames[w.color]} en lectura` : 'Sin paquete en lectura'}</text>
      <text x="40" y="495" fontSize="16" fill="#263d51">Balanza: {w.readingValid ? `${w.weight} g · lectura válida` : w.presence ? 'Detené la cinta y esperá a estabilizar' : 'Sin lectura (no es un peso de 0 g)'}</text>
      {(w.jammed || w.reverseRequested || w.entryBusy) && <g><rect x="420" y="18" width="525" height="42" rx="10" fill={w.jammed ? '#f8c9bd' : '#fff0bf'} /><text x="682" y="44" textAnchor="middle" fontSize="14" fill="#733c2f">{w.jammed ? 'Atasco: llegó un paquete mientras el desviador giraba. Reiniciá.' : w.reverseRequested ? 'Este taller no admite marcha atrás. Usá avance o detener.' : 'Ingreso ocupado: las llegadas esperan lugar.'}</text></g>}
    </svg>
  </div>;
}
