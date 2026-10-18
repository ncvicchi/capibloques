'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import { createRailWorldState, railBindings, railCarPosition, railTrainBounds, railTrackCount, railTrackY, railGateY, railSlotsFor, type RailWorldState } from '@/lib/rail-world';

export default function RailCrossingWorld({ scene, state }: { scene: SceneDefinition; state?: RailWorldState }) {
  const bindings = railBindings(scene);
  const initialAngle = (id: string | undefined) => {
    const device = scene.devices.find(candidate => candidate.id === id);
    return device?.kind === 'servo' ? device.config.angle : 0;
  };
  const count = railTrackCount(scene);
  const world = state ?? createRailWorldState(initialAngle(bindings.northGate), initialAngle(bindings.southGate), count);
  return <div className="scene-world scene-world-railCrossing" data-rail-tracks={count}>
    <svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-label={`Paso a nivel virtual: ${count} ${count === 1 ? 'vía' : 'vías'} y calle de doble mano`}>
      <rect width="960" height="540" fill="#9ed385" />
      <path d="M35 45h190v85H35z" fill="#f8e6b7" /><path d="m25 45 105-32 105 32" fill="#bc5b45" />
      <text x="57" y="98" fontSize="22" fontWeight="800" fill="#3d3d45">PASO A NIVEL</text>
      <g fill="#4b9254"><circle cx="800" cy="420" r="42" /><circle cx="860" cy="450" r="30" /></g>
      <rect x="390" width="180" height="540" fill="#505663" />
      <path d="M480 0V195M480 345V540" stroke="#f8dc6a" strokeWidth="6" strokeDasharray="35 24" />
      {Array.from({ length: count }, (_, track) => <g key={track} data-rail-track={track + 1} transform={`translate(0 ${railTrackY(count, track) - 270})`}>
        <path d="M0 242H960V298H0Z" fill="#a98a68" />
        <g stroke="#654d3e" strokeWidth="8">{Array.from({ length: 40 }, (_, i) => <path key={i} d={`M${i * 25} 243v54`} />)}</g>
        <path d="M0 250H960M0 290H960" stroke="#d3dae0" strokeWidth="6" />
        <text x={count === 1 ? 35 : 260} y="275" fontSize="18" fontWeight="800" fill="#243247">{track + 1} {count === 1 ? '↔' : track % 2 === 0 ? '→' : '←'}</text>
      </g>)}
      <path d={`M398 ${railGateY(count, true) - 5}H472M488 ${railGateY(count, false) + 5}H562`} stroke="white" strokeWidth="5" />
      <g fill="white" fontSize="32" fontWeight="900"><text x="423" y="55">↓</text><text x="513" y="510">↑</text></g>
      <path d="m640 400 20 20m-20 0 20-20m-345-300 20 20m-20 0 20-20" stroke="#fff" strokeWidth="10" />
      <path d="m640 400 20 20m-20 0 20-20m-345-300 20 20m-20 0 20-20" stroke="#b63d43" strokeWidth="4" />
      {railSlotsFor(count).filter(slot => slot.kind === 'infraredBarrier').map(({ role, x, y }) => {
        const name = scene.devices.find(device => device.id === bindings[role])?.name ?? 'Detector ausente';
        const interrupted = world.detectors[role];
        return <g key={role} data-rail-detector={role} data-interrupted={interrupted}>
          <title>{name}: {interrupted ? 'Haz interrumpido' : 'Haz libre'}. Entrada del tren virtual.</title>
          <path d={`M${x} ${y - 25}v50`} stroke={interrupted ? '#b32942' : '#206852'} strokeWidth="3" strokeDasharray="5 5" />
          {count > 1 && <text x={x + (x < 480 ? -20 : 20)} y={y - 9} textAnchor={x < 480 ? 'end' : 'start'} fontSize="11" fontWeight="700" fill="#203f36" stroke="#f4ffea" strokeWidth="3" paintOrder="stroke">{name}</text>}
          <text x={x + (x < 480 ? -20 : 20)} y={y + (count > 1 ? 10 : 5)} textAnchor={x < 480 ? 'end' : 'start'} fontSize="12" fontWeight="700" fill="#203f36" stroke="#f4ffea" strokeWidth="3" paintOrder="stroke">{interrupted ? 'Ocupado' : 'Libre'}</text>
        </g>;
      })}
      {(['northGate', 'southGate'] as const).map(role => {
        const north = role === 'northGate';
        const x = north ? 395 : 565, y = railGateY(count, north);
        const radians = world.gates[role] * Math.PI / 180;
        return <g key={role} data-rail-gate={role} data-angle={world.gates[role].toFixed(2)}>
          <title>{north ? 'Barrera norte' : 'Barrera sur'}: {Math.round(world.gates[role])} grados; {world.gates[role] >= 90 ? 'abierta' : 'cerrada o en movimiento'}.</title>
          <path d={`M${x} ${y}L${x + (north ? 1 : -1) * 84 * Math.cos(radians)} ${y + (north ? -1 : 1) * 84 * Math.sin(radians)}`} stroke="white" strokeWidth="10" />
          <path d={`M${x} ${y}L${x + (north ? 1 : -1) * 84 * Math.cos(radians)} ${y + (north ? -1 : 1) * 84 * Math.sin(radians)}`} stroke="#be3845" strokeWidth="8" strokeDasharray="12 12" />
          <circle cx={x} cy={y} r="9" fill="#344052" />
        </g>;
      })}
      {world.cars.map(car => {
        const at = railCarPosition(car), involved = car.id === world.collision?.carId;
        return <g key={car.id} data-rail-car={car.id} data-involved={involved} transform={`translate(${at.x} ${at.y})`}>
          <rect x="-13" y="-20" width="26" height="40" rx="7" fill={involved ? '#ffd166' : car.lane === 'northbound' ? '#47a7cd' : '#ea8260'} stroke={involved ? '#b32942' : '#233242'} strokeWidth={involved ? 4 : 2} />
          <rect x="-9" y={car.lane === 'northbound' ? -12 : 5} width="18" height="7" rx="2" fill="#ddf6ff" />
          <title>Auto {car.lane === 'northbound' ? 'hacia arriba' : 'hacia abajo'}{involved ? ', involucrado en el choque' : ''}</title>
        </g>;
      })}
      {world.trains.map(train => { const bounds = railTrainBounds(train); const involved = world.collision?.trainId === train.id; return <g key={train.id} data-rail-train={train.id} data-track={train.track + 1} data-direction={train.direction} data-involved={involved} transform={`translate(0 ${railTrackY(count, train.track) - 270})`}>
        <title>Tren en vía {train.track + 1} hacia {train.direction === 1 ? 'la derecha' : 'la izquierda'}; el último vagón también activa los detectores.</title>
        <rect x={bounds.left} y="262" width={train.length} height="16" fill="#343f4a" />
        {Array.from({ length: Math.ceil(train.length / 58) }, (_, index) => {
          const width = Math.min(54, train.length - index * 58);
          const locomotive = train.direction === 1 ? index === Math.ceil(train.length / 58) - 1 : index === 0;
          return <g key={index}>
            <rect x={bounds.left + index * 58} y="251" width={width} height="38" rx="6" fill={locomotive ? '#4563a2' : '#dcaf61'} stroke={involved ? '#b32942' : '#283443'} strokeWidth={involved ? 4 : 2} />
            <rect x={bounds.left + index * 58 + 8} y="259" width={Math.max(8, width - 16)} height="12" fill="#bce9ed" rx="2" />
          </g>;
        })}
      </g>; })}
    </svg>
    {world.collision && <strong className="traffic-crash" role="alert">⚠️ Choque auto–tren. La escena está detenida. Reiniciá programa y escena para volver a probar.</strong>}
  </div>;
}
