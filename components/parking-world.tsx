'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import { createParkingWorldState, parkingBindings, parkingCapacity, parkingSlots, parkingSpacePosition, type ParkingWorldState } from '@/lib/parking-world';

export default function ParkingWorld({ scene, state }: { scene: SceneDefinition; state?: ParkingWorldState }) {
  const bindings = parkingBindings(scene);
  const angle = (id?: string) => { const device = scene.devices.find(item => item.id === id); return device?.kind === 'servo' ? device.config.angle : 0; };
  const world = state ?? createParkingWorldState(parkingCapacity(scene), angle(bindings.entryGate), angle(bindings.exitGate));
  return <div className="scene-world scene-world-parking" data-parking-capacity={world.capacity} data-parking-jammed={world.jammed}>
    <svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-label={`Estacionamiento virtual de ${world.capacity} plazas, entrada y salida independientes`}>
      <rect width="960" height="540" fill="#a6d69b" />
      <rect x="110" y="65" width="740" height="325" rx="22" fill="#626f80" stroke="#e2dec7" strokeWidth="9" />
      <path d="M160 540V230H760M800 270V540" fill="none" stroke="#626f80" strokeWidth="82" />
      <path d="M160 540V375M800 450V540" fill="none" stroke="white" strokeWidth="3" strokeDasharray="14 14" />
      <g fill="#f5e295" fontSize="30" fontWeight="900"><text x="142" y="425">↑</text><text x="784" y="460">↓</text><text x="460" y="250">→</text></g>
      <rect x="370" y="8" width="220" height="38" rx="12" fill="#fff9e6" />
      <text x="480" y="34" textAnchor="middle" fontSize="22" fontWeight="900" fill="#334565">ESTACIONAMIENTO</text>
      {Array.from({ length: world.capacity }, (_, space) => {
        const p = parkingSpacePosition(world.capacity, space);
        const occupied = world.cars.some(car => car.space === space);
        return <g key={space} data-parking-space={space + 1} data-occupied={occupied}>
          <rect x={p.x - 30} y={p.y - 40} width="60" height="80" rx="5" fill={occupied ? '#4b6275' : '#466d65'} stroke="#fff6d1" strokeWidth="3" />
          <text x={p.x} y={p.y + 8} textAnchor="middle" fill="#e5edd8" fontSize="22" fontWeight="700">{space + 1}</text>
        </g>;
      })}
      <g fill="#459258"><circle cx="55" cy="92" r="29" /><circle cx="904" cy="90" r="32" /><circle cx="890" cy="285" r="23" /></g>
      <g fill="#f4f0da" stroke="#273e53" strokeWidth="2">
        <rect x="52" y="340" width="50" height="56" rx="6" /><path d="m46 342 32-24 31 24" fill="#cc795f" />
      </g>
      {parkingSlots.map(slot => {
        const name = scene.devices.find(item => item.id === bindings[slot.role])?.name ?? `${slot.name} · falta`;
        if (slot.kind === 'servo') {
          const entry = slot.role === 'entryGate', direction = entry ? 1 : -1;
          return <g key={slot.role} data-parking-gate={slot.role}>
            <circle cx={slot.x} cy={slot.y} r="9" fill="#35435b" />
            <path d={`M${slot.x} ${slot.y}h${direction * 105}`} transform={`rotate(${-direction * world.gates[slot.role]} ${slot.x} ${slot.y})`} stroke="#fff5e4" strokeWidth="10" />
            <path d={`M${slot.x} ${slot.y}h${direction * 105}`} transform={`rotate(${-direction * world.gates[slot.role]} ${slot.x} ${slot.y})`} stroke="#d95d61" strokeDasharray="12 12" strokeWidth="8" />
            <text x={entry ? 28 : 932} y="410" textAnchor={entry ? 'start' : 'end'} fontSize="14" fontWeight="800" fill="#243b4b">{name}</text>
          </g>;
        }
        const active = world.detectors[slot.role];
        return <g key={slot.role} data-parking-detector={slot.role} data-interrupted={active}>
          <path d={`M${slot.x - 37} ${slot.y}h74`} stroke={active ? '#faad4f' : '#91e2ed'} strokeWidth="4" strokeDasharray="6 4" />
          <text x={slot.x < 480 ? slot.x + 43 : slot.x - 43} y={slot.y - 7} textAnchor={slot.x < 480 ? 'start' : 'end'} fontSize="13" fontWeight="700" fill="#243b4b">{name}</text>
        </g>;
      })}
      {world.cars.map(car => <g key={car.id} data-parking-car={car.id} data-phase={car.phase} transform={`translate(${car.x} ${car.y}) rotate(${car.angle})`}>
        <title>Auto {car.id}: {car.phase === 'jammed' ? 'sin plaza, obstruye la entrada' : car.phase === 'parked' ? 'estacionado' : 'en recorrido'}</title>
        <rect x="-18" y="-22" width="36" height="44" rx="8" fill={['#ffd270', '#f08070', '#6ec6dc', '#bf9bdf'][car.id % 4]} stroke={car.phase === 'jammed' ? '#bf2945' : '#344052'} strokeWidth="3" />
        <rect x="-12" y="-14" width="24" height="10" rx="3" fill="#dbf4f4" />
        <path d="M-19-12v10m38-10v10m-38 12v10m38-10v10" stroke="#303e4b" strokeWidth="4" />
      </g>)}
      {world.jammed && <g><rect x="275" y="365" width="410" height="43" rx="10" fill="#fff0c4" stroke="#c65b45" strokeWidth="2" /><text x="480" y="392" textAnchor="middle" fontSize="18" fontWeight="800" fill="#863d37">¡Entró un auto sin plaza! Entrada atascada.</text></g>}
    </svg>
    {world.jammed && <output className="sr-only">Entró un auto sin plaza. Entrada atascada: se recupera cuando se libera una plaza.</output>}
  </div>;
}
