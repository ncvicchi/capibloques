'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import { createGardenWorldState, gardenBindings, gardenCauseLabel, gardenPlantStatus, gardenSlots, type GardenWorldState } from '@/lib/garden-world';

export default function GardenWorld({ scene, state }: { scene: SceneDefinition; state?: GardenWorldState }) {
  const bindings = gardenBindings(scene);
  const window = scene.devices.find(device => device.id === bindings.window);
  const world = state ?? createGardenWorldState(scene.canvas.gardenEnvironment, window?.kind === 'servo' ? window.config.angle : 0);
  const display = scene.devices.find(device => device.kind === 'display');
  return <div className="scene-world scene-world-greenhouse">
    <svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-label="Huerta exterior e invernadero con plantas, tierra, riego y ventilación">
      <rect width="960" height="540" fill="#c7e8ef" />
      <rect y="200" width="960" height="340" fill="#a5cf83" />
      <path d="M0 455Q180 425 400 460T960 455V540H0Z" fill="#e4d1a4" />
      <circle cx="110" cy="67" r={world.environment.sun === 'strong' ? 35 : 28} fill={world.environment.sun === 'low' ? '#e7e4ac' : '#ffd15c'} />
      <g fill="#fff" opacity={world.environment.rain ? 0.9 : 0.6}><ellipse cx="235" cy="65" rx="67" ry="20" /><ellipse cx="210" cy="47" rx="32" ry="23" /><ellipse cx="265" cy="50" rx="26" ry="20" /></g>
      <text x="315" y="47" fontSize="17" fill="#334b57">Exterior: {world.outsideTemperature.toFixed(1)} °C · Luz: {world.light}%</text>
      {world.environment.rain && <g stroke="#479ac3" strokeWidth="4">{Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${70 + i * 25} ${100 + i % 3 * 23}l-6 17`} />)}</g>}
      <path d="M500 165 710 78 925 165V405H500Z" fill="#e7f4e2" fillOpacity="0.55" stroke="#658d85" strokeWidth="8" />
      <path d="M710 78V310M500 165H925" stroke="#7eaaa1" strokeWidth="4" />
      <g transform={`translate(865 205) rotate(${-world.windowAngle * 0.6})`}><rect x="-25" y="-18" width="50" height="40" fill="#b4e4f4" stroke="#517e79" strokeWidth="5" /></g>
      <text x="710" y="215" textAnchor="middle" fontSize="17" fill="#304c4e">{world.temperature.toFixed(1)} °C · Aire {Math.round(world.humidity)}%</text>
      <text x="245" y="175" textAnchor="middle" fontSize="22" fontWeight="900" fill="#304c4e">HUERTA EXTERIOR</text>
      <text x="710" y="108" textAnchor="middle" fontSize="20" fontWeight="900" fill="#304c4e">INVERNADERO</text>
      {(['outside', 'inside'] as const).map((key, index) => {
        const bed = world[key], left = index ? 530 : 65, center = left + 170;
        const power = index ? world.insidePower : world.outsidePower;
        return <g key={key} data-garden-bed={key} data-health={bed.health.toFixed(1)} data-moisture={bed.moisture.toFixed(1)} data-cause={bed.cause ?? 'none'}>
          <rect x={left} y="292" width="340" height="48" rx="13" fill={bed.moisture > 80 ? '#665144' : bed.moisture < 25 ? '#ba946b' : '#896649'} stroke="#72523d" strokeWidth="5" />
          {[0, 1, 2, 3].map(plant => <g key={plant} transform={`translate(${left + 50 + plant * 80} 298)`}>
            <path d={`M0 0Q${bed.health < 35 ? 22 : 0} -25 0 -${30 + bed.growth * 0.25}`} fill="none" stroke={bed.health < 35 ? '#a3944c' : '#4e8d49'} strokeWidth="6" />
            <ellipse cx="-12" cy="-28" rx="17" ry="8" transform="rotate(28 -12 -28)" fill={bed.health < 35 ? '#bba768' : '#5ca659'} />
            <ellipse cx="12" cy="-42" rx="17" ry="8" transform="rotate(-28 12 -42)" fill={bed.health < 35 ? '#bba768' : '#70b961'} />
          </g>)}
          <text x={center} y="238" textAnchor="middle" fontSize="17" fontWeight="800" fill="#304c4e">{gardenPlantStatus(bed)}</text>
          <text x={center} y="425" textAnchor="middle" fontSize="15" fontWeight="700" fill="#304c4e">{!bed.cause && bed.health < 70 ? '🌱 Recuperándose' : gardenCauseLabel(bed.cause)}</text>
          <rect x={left + 16} y="311" width="308" height="15" rx="7" fill="#dfc7a3" />
          <rect x={left + 16} y="311" width={308 * bed.moisture / 100} height="15" rx="7" fill="#479ec0" />
          <text x={center} y="449" textAnchor="middle" fontSize="16" fill="#304c4e">Tierra {Math.round(bed.moisture)}% · Riego {Math.round(power)}%</text>
          {power > 0 && <g fill="#4eafe1" data-garden-watering={key}>{[0, 1, 2, 3, 4].map(i => <circle key={i} cx={left + 30 + i * 70} cy={276 + i % 2 * 10} r="4" />)}</g>}
        </g>;
      })}
      {gardenSlots.map(slot => {
        const name = scene.devices.find(device => device.id === bindings[slot.role])?.name ?? `${slot.name} · falta`;
        const words = name.split(' '), lines = [''];
        for (const word of words) { if (lines[lines.length - 1].length + word.length > 19) lines.push(''); lines[lines.length - 1] += `${lines[lines.length - 1] ? ' ' : ''}${word}`; }
        return <text key={slot.role} x={slot.x} y={slot.role === 'light' ? 120 : slot.y + 29} textAnchor="middle" fontSize="11" fontWeight="800" fill="#243e44"><title>{name}</title>{lines.slice(0, 2).map((line, index) => <tspan key={index} x={slot.x} dy={index ? 12 : 0}>{line.slice(0, 20)}{index === 1 && lines.length > 2 ? '…' : ''}</tspan>)}</text>;
      })}
      {display && <text x={display.position.x} y={Math.min(537, display.position.y + 70)} textAnchor="middle" fontSize="12" fontWeight="800" fill="#243e44">{display.name}</text>}
    </svg>
  </div>;
}
