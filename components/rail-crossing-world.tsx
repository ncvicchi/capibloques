'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import { createRailWorldState, railBindings, railCarPosition, railTrainBounds, type RailWorldState } from '@/lib/rail-world';

export default function RailCrossingWorld({ scene, state }: { scene: SceneDefinition; state?: RailWorldState }) {
  const bindings = railBindings(scene);
  const initialAngle = (id: string | undefined) => {
    const device = scene.devices.find(candidate => candidate.id === id);
    return device?.kind === 'servo' ? device.config.angle : 0;
  };
  const world = state ?? createRailWorldState(initialAngle(bindings.northGate), initialAngle(bindings.southGate));
  const bounds = world.train && railTrainBounds(world.train);
  return <div className="scene-world scene-world-railCrossing">
    <svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-label="Paso a nivel virtual: calle vertical de doble mano y vía horizontal">
      <rect width="960" height="540" fill="#9ed385" />
      <path d="M35 45h190v85H35z" fill="#f8e6b7" /><path d="m25 45 105-32 105 32" fill="#bc5b45" />
      <text x="57" y="98" fontSize="22" fontWeight="800" fill="#3d3d45">PASO A NIVEL</text>
      <g fill="#4b9254"><circle cx="800" cy="420" r="42" /><circle cx="860" cy="450" r="30" /></g>
      <rect x="390" width="180" height="540" fill="#505663" />
      <path d="M480 0V195M480 345V540" stroke="#f8dc6a" strokeWidth="6" strokeDasharray="35 24" />
      <path d="M0 238H960V302H0Z" fill="#a98a68" />
      <g stroke="#654d3e" strokeWidth="10">{Array.from({ length: 40 }, (_, i) => <path key={i} d={`M${i * 25} 237v66`} />)}</g>
      <path d="M0 250H960M0 290H960" stroke="#d3dae0" strokeWidth="7" />
      <path d="M398 180H472M488 360H562" stroke="white" strokeWidth="5" />
      <g fill="white" fontSize="32" fontWeight="900"><text x="423" y="55">↓</text><text x="513" y="510">↑</text></g>
      <path d="m640 400 20 20m-20 0 20-20m-345-300 20 20m-20 0 20-20" stroke="#fff" strokeWidth="10" />
      <path d="m640 400 20 20m-20 0 20-20m-345-300 20 20m-20 0 20-20" stroke="#b63d43" strokeWidth="4" />
      {(['westDetector', 'eastDetector'] as const).map(role => {
        const x = role === 'westDetector' ? 140 : 820;
        const name = scene.devices.find(device => device.id === bindings[role])?.name ?? 'Detector ausente';
        const interrupted = world.detectors[role];
        return <g key={role} data-rail-detector={role} data-interrupted={interrupted}>
          <title>{name}: {interrupted ? 'Haz interrumpido' : 'Haz libre'}. Entrada del tren virtual.</title>
          <path d={`M${x} 220v100`} stroke={interrupted ? '#b32942' : '#206852'} strokeWidth="3" strokeDasharray="5 5" />
          <text x={x} y="350" textAnchor="middle" fontSize="18" fontWeight="700" fill="#203f36">{interrupted ? 'Interrumpido' : 'Libre'}</text>
        </g>;
      })}
      {(['northGate', 'southGate'] as const).map(role => {
        const north = role === 'northGate';
        const x = north ? 395 : 565, y = north ? 185 : 355;
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
      {world.train && bounds && <g data-rail-train={world.train.id} data-direction={world.train.direction} data-involved={!!world.collision}>
        <title>Tren hacia {world.train.direction === 1 ? 'la derecha' : 'la izquierda'}; el último vagón también activa los detectores.</title>
        <rect x={bounds.left} y="262" width={world.train.length} height="16" fill="#343f4a" />
        {Array.from({ length: Math.ceil(world.train.length / 58) }, (_, index) => {
          const width = Math.min(54, world.train!.length - index * 58);
          const locomotive = world.train!.direction === 1 ? index === Math.ceil(world.train!.length / 58) - 1 : index === 0;
          return <g key={index}>
            <rect x={bounds.left + index * 58} y="251" width={width} height="38" rx="6" fill={locomotive ? '#4563a2' : '#dcaf61'} stroke={world.collision ? '#b32942' : '#283443'} strokeWidth={world.collision ? 4 : 2} />
            <rect x={bounds.left + index * 58 + 8} y="259" width={Math.max(8, width - 16)} height="12" fill="#bce9ed" rx="2" />
          </g>;
        })}
      </g>}
    </svg>
    {world.collision && <strong className="traffic-crash" role="alert">⚠️ Choque auto–tren. La escena está detenida. Reiniciá programa y escena para volver a probar.</strong>}
  </div>;
}
