'use client';

// A labelled SVG schematic, not a replaceable bitmap image.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */

import { useId } from 'react';
import { sceneComponentCatalog, type SceneDevice } from '@/lib/scene-model';
import { displayProfiles } from '@/lib/display-model';

// Deliberately a schematic, not a claim about a vendor's connector order.
// Only the terminal for this step is shown; its label comes from the scene.
export default function WiringComponent({ device, signal, ground = false, connected = false }: {
  device: SceneDevice;
  signal?: string;
  ground?: boolean;
  connected?: boolean;
}) {
  const titleId = useId();
  const catalog = sceneComponentCatalog.find(item => item.kind === device.kind);
  const terminal = ground ? 'GND / −' : signal;
  const lamp = device.kind === 'trafficLight' && !ground && signal?.startsWith('LED ') ? ['LED rojo', 'LED amarillo', 'LED verde'].indexOf(signal) : -1;
  const resistor = !ground && Boolean(signal) && (device.kind === 'led' || lamp >= 0);
  const display = device.kind === 'display';
  const matrix = device.kind === 'ledMatrix' || (device.kind === 'trafficLight' && signal?.startsWith('Matrices'));
  return <figure className="wiring-component-figure">
    <svg viewBox="0 0 350 185" role="img" aria-labelledby={titleId} data-component-kind={device.kind}>
      <title id={titleId}>{device.name}{terminal ? `: contacto ${terminal}` : ''}. Ilustración de conexión.</title>
      {matrix ? <>
        <rect x="15" y="25" width="170" height="105" rx="7" fill="#172434" stroke="#364b62" strokeWidth="3" />
        {Array.from({ length: device.kind === 'trafficLight' ? 8 : 16 }, (_, x) => Array.from({ length: 8 }, (_, y) => <circle key={`${x}-${y}`} cx={23 + x * (device.kind === 'trafficLight' ? 21 : 10)} cy={36 + y * 12} r="3" fill="#ef5555" />))}
        <text x="100" y="155" textAnchor="middle">Matriz LED</text>
      </> : device.kind === 'trafficLight' ? <>
        <rect x="62" y="10" width="70" height="134" rx="16" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
        {['#ef4444', '#facc15', '#22c55e'].map((color, index) => <g key={color}>
          <circle cx="97" cy={35 + index * 40} r="15" fill={color} opacity={lamp < 0 || lamp === index ? 1 : .25} stroke={lamp === index ? '#fff' : '#475569'} strokeWidth={lamp === index ? 5 : 2} />
          {lamp === index && <path d={`M115 ${35 + index * 40}H190V85`} fill="none" stroke="#a74300" strokeWidth="3" />}
        </g>)}
        <path d="M97 144v18m-20 0h40" stroke="#334155" strokeWidth="6" />
      </> : device.kind === 'led' ? <>
        <path d="M62 101V57a31 31 0 0162 0v44Z" fill={device.config.color} stroke="#334155" strokeWidth="3" />
        <path d="M57 101h72M80 104v50m28-50v36" stroke="#334155" strokeWidth="4" />
        <text x="75" y="174">+</text><text x="104" y="159">−</text>
        <path d={ground ? 'M108 140H180V85H193' : 'M80 154H150V85H193'} fill="none" stroke="#a74300" strokeWidth="3" />
      </> : display ? <>
        <rect x="12" y="25" width="176" height="115" rx="8" fill="#13735b" stroke="#0b4839" strokeWidth="3" />
        <rect x="24" y="40" width="152" height="73" rx="3" fill="#102a43" stroke="#90cda5" strokeWidth="3" />
        <text x="100" y="83" textAnchor="middle" fill="#d5f3bd">¡Hola!</text>
        <text x="100" y="164" textAnchor="middle">{displayProfiles[device.config.profile].graphic ? 'Pantalla gráfica' : 'Pantalla de texto'}</text>
      </> : device.kind === 'servo' ? <>
        <rect x="34" y="62" width="118" height="76" rx="7" fill="#3075b9" stroke="#153c6b" strokeWidth="3" />
        <circle cx="89" cy="59" r="18" fill="#cbd5e1" stroke="#334155" strokeWidth="3" />
        <rect x="46" y="46" width="90" height="15" rx="7" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
        <circle cx="89" cy="53" r="5" fill="#334155" />
        <text x="92" y="164" textAnchor="middle">Servo</text>
      </> : device.kind === 'motor' || device.kind === 'robot' ? <>
        <rect x="22" y="58" width="89" height="60" rx="22" fill="#cbd5e1" stroke="#334155" strokeWidth="3" />
        <path d="M8 87h25" stroke="#334155" strokeWidth="7" />
        <rect x="126" y="57" width="59" height="65" rx="5" fill="#13735b" stroke="#0b4839" strokeWidth="3" />
        <rect x="141" y="74" width="28" height="28" fill="#172434" />
        <path d="M112 78h14m-14 20h14" stroke="#a74300" strokeWidth="3" />
        <text x="100" y="153" textAnchor="middle">Motor + driver</text>
      </> : device.kind === 'button' ? <>
        <rect x="40" y="40" width="112" height="99" rx="7" fill="#cbd5e1" stroke="#334155" strokeWidth="3" />
        <circle cx="96" cy="88" r="33" fill="#31527c" stroke="#0f172a" strokeWidth="4" />
        <path d="M25 55h15m-15 65h15m112-65h15m-15 65h15" stroke="#334155" strokeWidth="5" />
        <text x="96" y="164" textAnchor="middle">Botón</text>
      </> : <>
        <rect x="25" y="28" width="158" height="110" rx="12" fill="#dcecf3" stroke="#31527c" strokeWidth="3" />
        <text x="104" y="95" fontSize="44" textAnchor="middle">{catalog?.icon ?? '⚙'}</text>
        <text x="104" y="162" textAnchor="middle">{catalog?.name ?? 'Componente'}</text>
      </>}
      {terminal && <>
        <path d={resistor ? 'M193 85H202l4-7 8 14 8-14 8 14 8-14 4 7H319' : 'M193 85H319'} fill="none" stroke={connected ? '#a74300' : '#53657d'} strokeWidth="4" strokeDasharray={connected ? undefined : '6 5'} />
        {resistor && <text x="252" y="113" textAnchor="middle">220–330 Ω</text>}
        <rect x="190" y="41" width="151" height="30" rx="5" fill="#fff4ba" stroke="#674200" strokeWidth="2" />
        <foreignObject x="194" y="43" width="143" height="26"><div className="wiring-terminal-label">{terminal}</div></foreignObject>
        <circle className="wiring-component-terminal" cx="322" cy="85" r="8" fill="#ffdf32" stroke="#111827" strokeWidth="3" />
        {connected && <circle cx="322" cy="85" r="13" fill="none" stroke="#ff8a00" strokeWidth="3" />}
      </>}
    </svg>
    <figcaption>Esquema de {device.name}. Los contactos se identifican por su nombre; su posición puede variar según el módulo.</figcaption>
  </figure>;
}
