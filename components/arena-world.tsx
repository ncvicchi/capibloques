'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import { arenaBindings, arenaPose, arenaStations, createArenaWorldState, defaultArenaEnvironment, type ArenaWorldState } from '@/lib/robot-arena';
export default function ArenaWorld({ scene, state }: { scene: SceneDefinition; state?: ArenaWorldState }) {
  const pose = arenaPose(scene), w = state ?? createArenaWorldState(pose.position, pose.angle), env = scene.canvas.arenaEnvironment ?? defaultArenaEnvironment, b = arenaBindings(scene);
  const name = (kind: 'distanceSensor' | 'colorSensor' | 'infraredBarrier') => scene.devices.find(d => d.id === b[kind])?.name;
  return <div className="scene-world" data-arena-contact={w.contact} data-arena-visits={w.visits.A + w.visits.B} data-arena-goal={w.goalReached} data-arena-x={w.x.toFixed(1)} data-arena-y={w.y.toFixed(1)}>
    <svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-label="Pista de exploración con estaciones A y B, obstáculos y meta">
      <rect width="960" height="540" fill="#c9dfae" /><rect x="20" y="50" width="920" height="460" rx="18" fill="#e1e9c9" stroke="#96ac83" strokeWidth="5" />
      <path d="M90 420H400V180H860" fill="none" stroke="#c6bca3" strokeWidth="110" strokeLinejoin="round" />
      <path d="M90 420H400V180H860" fill="none" stroke="#f9efcd" strokeWidth="3" strokeDasharray="12 12" />
      {[{ x: 65, y: 245 }, { x: 510, y: 450 }, { x: 890, y: 300 }].map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="18" fill="#9abb78" /><circle cx={p.x + 12} cy={p.y - 10} r="17" fill="#83ac6c" /></g>)}
      <text x="42" y="32" fontSize="21" fontWeight="900" fill="#314b48">PISTA DE EXPLORACIÓN</text>
      <circle cx="120" cy="420" r="36" fill="#edf1e1" stroke="#6d9689" strokeWidth="3" /><text x="120" y="480" textAnchor="middle" fill="#314b48" fontSize="15">BASE</text>
      {arenaStations.map(s => <g key={s.id}><circle cx={s.x} cy={s.y} r="43" fill={s.color === 'red' ? '#e89083' : '#88b5df'} stroke="#f4f3e2" strokeWidth="5" /><text x={s.x} y={s.y + 6} textAnchor="middle" fontSize="24" fontWeight="900" fill="#293e4f">{s.id}</text><text x={s.x + 70} y={s.y + 5} fontSize="14" fill="#293e4f">Visitas: {w.visits[s.id]}</text>{env.guides && <circle cx={s.x} cy={s.y} r="47" fill="none" stroke="#577b69" strokeDasharray="4 5" />}</g>)}
      <rect x="765" y="120" width="70" height="120" rx="10" fill="#99c28d" />
      <path d="M800 120V240" stroke={w.goalBeam ? '#f19b4d' : '#526d79'} strokeWidth="4" strokeDasharray="7 5" />
      <text x="800" y="95" textAnchor="middle" fontSize="18" fontWeight="900" fill="#314b48">META</text><text x="800" y="272" textAnchor="middle" fontSize="12" fill="#314b48">{name('infraredBarrier') ?? 'Falta barrera de meta'}</text>
      {env.obstacles.map((o, i) => <g key={i}><circle cx={o.x} cy={o.y} r={o.radius} fill="#b38461" stroke="#77563f" strokeWidth="4" /><path d={`M${o.x - 15} ${o.y - 15}l30 30m0-30-30 30`} stroke="#dfc096" strokeWidth="5" /><title>Obstáculo {i + 1}</title></g>)}
      {env.guides && <polyline points={w.trail.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#8b70b5" strokeWidth="3" strokeDasharray="3 5" />}
      <g transform={`translate(${w.x} ${w.y}) rotate(${w.angle})`}>{b.distanceSensor && <g><title>{name('distanceSensor')} · montado al frente</title>{env.guides && <path d={`M22 0H${22 + w.distance}`} stroke="#d29442" strokeWidth="2" strokeDasharray="5 6" />}<circle cx="29" r="5" fill="#f6d069" /></g>}{b.colorSensor && <g><title>{name('colorSensor')} · mira al suelo</title><circle cx="-18" cy="24" r="6" fill="#bb85c6" stroke="#fff" /></g>}</g>
      <text x={w.x} y={w.y + 49} textAnchor="middle" fontSize="12" fontWeight="800" fill="#314b48">{scene.devices.find(d => d.id === b.robot)?.name ?? 'Falta robot'}</text>
      <text x="35" y="532" fontSize="14" fill="#314b48">{name('distanceSensor') ?? 'Sin sensor frontal'}: {w.distance.toFixed(0)} cm · {name('colorSensor') ?? 'Sin sensor de suelo'}: {({ red: 'rojo', blue: 'azul', green: 'verde', ground: 'suelo' })[w.floor]}</text>
      {(w.contact || w.offPath) && <g><rect x="410" y="8" width="525" height="32" rx="8" fill={w.contact ? '#f4c4af' : '#fff0bd'} /><text x="672" y="29" textAnchor="middle" fontSize="14" fill="#714738">{w.contact ? 'Contacto: retrocedé o girá para salir. El programa continúa.' : 'Fuera del recorrido: podés maniobrar y regresar.'}</text></g>}
      {env.guides && <text x="610" y="475" fontSize="13" fill="#41564c">Dorado: distancia frontal · Violeta: sensor de suelo</text>}
    </svg>
  </div>;
}
