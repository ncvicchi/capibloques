'use client';

// A labelled SVG schematic, not a replaceable bitmap image.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */

import { useId } from 'react';
import { sceneComponentCatalog, type SceneDevice } from '@/lib/scene-model';
import { displayProfiles } from '@/lib/display-model';

// Traffic module connector order follows the owner's reference photo.
// Other modules remain generic schematics, not vendor connector pinouts.
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
  const trafficModule = device.kind === 'trafficLight' && !matrix;
  const activeTrafficPin = ground ? 0 : lamp >= 0 ? lamp + 1 : -1;
  return <figure className="wiring-component-figure">
    <svg viewBox="0 0 350 185" role="img" aria-labelledby={titleId} data-component-kind={device.kind}>
      <title id={titleId}>{device.name}{terminal ? `: contacto ${terminal}` : ''}. Ilustración de conexión.</title>
      {matrix ? <>
        <rect x="15" y="25" width="170" height="105" rx="7" fill="#172434" stroke="#364b62" strokeWidth="3" />
        {Array.from({ length: device.kind === 'trafficLight' ? 8 : 16 }, (_, x) => Array.from({ length: 8 }, (_, y) => <circle key={`${x}-${y}`} cx={23 + x * (device.kind === 'trafficLight' ? 21 : 10)} cy={36 + y * 12} r="3" fill="#ef5555" />))}
        <text x="100" y="155" textAnchor="middle">Matriz LED</text>
      </> : device.kind === 'trafficLight' ? <>
        <path d="M12 57H195Q203 57 203 65V78H263V28Q263 20 271 20H300Q308 20 308 28V157Q308 165 300 165H271Q263 165 263 157V111H203V122Q203 130 195 130H12Q5 130 5 123V64Q5 57 12 57Z" fill="#171d1c" stroke="#3b4743" strokeWidth="2" />
        <circle cx="284" cy="37" r="10" fill="white" stroke="#718078" strokeWidth="2" />
        <circle cx="284" cy="148" r="10" fill="white" stroke="#718078" strokeWidth="2" />
        {['#ef4444', '#facc15', '#22c55e'].map((color, index) => <g key={color}>
          <circle cx={40 + index * 66} cy="93" r="27" fill={color} opacity={lamp < 0 || lamp === index ? 1 : .4} stroke={lamp === index ? '#fff' : '#c4d1cb'} strokeWidth={lamp === index ? 4 : 2} />
          <ellipse cx={32 + index * 66} cy="82" rx="7" ry="11" fill="white" opacity=".45" transform={`rotate(30 ${32 + index * 66} 82)`} />
          <rect x={72 + index * 66} y="83" width="5" height="20" rx="1" fill="#e6d0ba" />
        </g>)}
        <rect x="299" y="54" width="13" height="78" rx="2" fill="#090d13" stroke="#a6afb4" />
        {['GND', 'R', 'Y', 'G'].map((label, index) => {
          const selected = index === activeTrafficPin;
          const y = 64 + index * 19;
          return <g key={label} data-module-pin={label} data-active={selected}>
            <text x="295" y={y + 4} textAnchor="end" fill={selected ? '#ffdf32' : '#fff'} style={{ fontSize: 12 }}>{label}</text>
            <path d={`M306 ${y}H340`} stroke="#090d13" strokeWidth="8" />
            <path d={`M306 ${y}H340`} stroke={selected ? '#ffdf32' : '#cbd5e1'} strokeWidth="4" />
            {selected && <>
              <circle cx="334" cy={y} r="10" fill="none" stroke="#ff8a00" strokeWidth="4" />
              <circle className="wiring-component-terminal" cx="334" cy={y} r="4" fill="#ffdf32" stroke="#111827" strokeWidth="2" />
            </>}
          </g>;
        })}
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
      {terminal && !trafficModule && <>
        <path d={resistor ? 'M193 85H202l4-7 8 14 8-14 8 14 8-14 4 7H319' : 'M193 85H319'} fill="none" stroke={connected ? '#a74300' : '#53657d'} strokeWidth="4" strokeDasharray={connected ? undefined : '6 5'} />
        {resistor && <text x="252" y="113" textAnchor="middle">220–330 Ω</text>}
        <rect x="190" y="41" width="151" height="30" rx="5" fill="#fff4ba" stroke="#674200" strokeWidth="2" />
        <foreignObject x="194" y="43" width="143" height="26"><div className="wiring-terminal-label">{terminal}</div></foreignObject>
        <circle className="wiring-component-terminal" cx="322" cy="85" r="8" fill="#ffdf32" stroke="#111827" strokeWidth="3" />
        {connected && <circle cx="322" cy="85" r="13" fill="none" stroke="#ff8a00" strokeWidth="3" />}
      </>}
    </svg>
    <figcaption>{trafficModule ? `Módulo de referencia de ${device.name}, según tu foto. Pines de arriba hacia abajo: GND, R (rojo), Y (amarillo), G (verde). Resistencias en la placa del módulo.` : `Esquema de ${device.name}. Los contactos se identifican por su nombre; su posición puede variar según el módulo.`}</figcaption>
  </figure>;
}
