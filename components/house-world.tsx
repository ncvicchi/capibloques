'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import { createHouseWorldState, houseBindings, houseSlots, type HouseWorldState } from '@/lib/house-world';
export default function HouseWorld({ scene, state }: { scene: SceneDefinition; state?: HouseWorldState }) {
  const bindings = houseBindings(scene), door = scene.devices.find(d => d.id === bindings.door);
  const w = state ?? createHouseWorldState(scene.canvas.houseEnvironment, door?.kind === 'servo' ? door.config.angle : 0);
  const inside = w.people.filter(p => p.phase === 'inside');
  return <div className="scene-world scene-world-smartHouse" data-house-night={w.environment.night} data-house-door-angle={w.doorAngle.toFixed(1)} data-house-inside-lux={Math.round(w.insideLux)}>
    <svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-label="Casa inteligente con entrada, puerta e interior visibles">
      <rect width="960" height="540" fill={w.environment.night ? '#304464' : '#c7e8ed'} /><rect y="195" width="960" height="345" fill={w.environment.night ? '#57755c' : '#a6ce8c'} />
      <circle cx="65" cy="55" r="25" fill={w.environment.night ? '#e0e5f3' : '#ffd46a'} />
      {(['outsideLight', 'insideLight'] as const).map(role => { const d = scene.devices.find(d => d.id === bindings[role]); return d ? <circle key={role} cx={d.position.x} cy={d.position.y} r="35" fill="#ffe379" opacity={w[role] / 100 * 0.8} /> : null; })}
      <path d="M0 310H650V367H0Z" fill="#d7c7b1" /><path d="M90 338H395" stroke="#f5eee0" strokeDasharray="12 15" strokeWidth="3" />
      <rect x="450" y="85" width="470" height="350" rx="12" fill={w.insideLight ? '#fff0ba' : w.environment.night ? '#b5b3aa' : '#f0e3cb'} />
      <path d="M450 300V85H920V435H450V375" fill="none" stroke="#9c776b" strokeWidth="12" /><path d="M580 100H700" stroke="#89bbce" strokeWidth="12" />
      <rect x="805" y="320" width="75" height="70" rx="12" fill="#a087af" /><rect x="800" y="322" width="12" height="65" rx="4" fill="#7d668e" />
      <path d="M450 305v65" transform={`rotate(${-w.doorAngle} 450 305)`} stroke="#79583e" strokeWidth="12" /><path d="M450 310v60" stroke={w.passage ? '#ee9b42' : '#73ccd6'} strokeWidth="3" strokeDasharray="5 5" />
      <text x="230" y="65" textAnchor="middle" fontSize="21" fontWeight="900" fill={w.environment.night ? '#fff4d5' : '#344856'}>ENTRADA</text><text x="745" y="65" textAnchor="middle" fontSize="21" fontWeight="900" fill={w.environment.night ? '#fff4d5' : '#344856'}>CASA INTELIGENTE</text>
      <text x="670" y="285" fontSize="16" fill="#344856">Luz interior: {Math.round(w.insideLux)} / 4095</text>
      {w.people.map(p => <g key={p.id} data-house-person={p.id} data-phase={p.phase} data-card={p.card} transform={`translate(${p.phase === 'inside' ? 620 + inside.findIndex(person => person.id === p.id) * 70 : p.x} ${p.phase === 'inside' ? 380 : 340})`}>
        <title>Visitante {p.id}, {p.card === 'ninguna' ? 'sin tarjeta' : `tarjeta ${p.card}`}, {p.phase === 'waiting' ? 'esperando afuera' : p.phase === 'exitWaiting' ? 'pide salir' : p.phase === 'inside' ? 'dentro' : 'en recorrido'}</title>
        <circle cy="-16" r="10" fill="#f2c39a" /><rect x="-12" y="-6" width="24" height="23" rx="7" fill={['#db877d', '#7098cd', '#ccaa58'][p.id % 3]} /><path d="m-6 17-4 12m16-12 4 12" stroke="#455463" strokeWidth="5" />
        {p.phase === 'waiting' && <text x="0" y="-36" textAnchor="middle" fontSize="13" fill="#263d51">{p.card === 'ninguna' ? 'Sin tarjeta' : `Tarjeta ${p.card}`}</text>}
      </g>)}
      {houseSlots.filter(slot => slot.kind !== 'led' && slot.kind !== 'button').map(slot => {
        const name = scene.devices.find(d => d.id === bindings[slot.role])?.name ?? `${slot.name} · falta`, lines = [''];
        for (const word of name.split(' ')) { if (lines[lines.length - 1].length + word.length > 18) lines.push(''); lines[lines.length - 1] += `${lines[lines.length - 1] ? ' ' : ''}${word}`; }
        return <text key={slot.role} x={slot.x} y={slot.y + 29} textAnchor="middle" fontSize="11" fontWeight="800" fill={w.environment.night && slot.x < 450 && slot.y < 195 ? '#f4ead5' : '#263d51'}><title>{name}</title>{lines.slice(0, 2).map((line, i) => <tspan key={i} x={slot.x} dy={i ? 12 : 0}>{line.slice(0, 19)}</tspan>)}</text>;
      })}
      <text x="45" y="410" fontSize="15" fill="#263d51">Dentro: {w.people.filter(p => p.x >= 450).length} · Salidas: {w.exits}</text>
      {w.closeWarnings > 0 && <g><rect x="300" y="10" width="625" height="35" rx="8" fill="#ffe9bc" /><text x="612" y="33" textAnchor="middle" fontSize="14" fontWeight="800" fill="#8b443b">Cierre durante el paso: dejá terminar y revisá el programa.</text></g>}
    </svg>
    {w.closeWarnings > 0 && <output className="sr-only">Se ordenó cerrar durante un paso ({w.closeWarnings}). Quien empezó termina; revisá el detector de paso.</output>}
  </div>;
}
