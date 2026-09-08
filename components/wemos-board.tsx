'use client';

// An SVG grouping contains keyboard-operable contacts; HTML fieldset cannot replace it.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */

import { useId } from 'react';
import { wemosBottom, wemosTop, type BoardContact } from '@/lib/wemos-board';
import { wemosD1R32Pins } from '@/lib/scene-model';

export type WiringConnection = { id: string; deviceId: string; deviceName: string; signal: string; pin: number | null | undefined; boardLabel?: string };

export default function WemosBoard({ connections, selectedPin, selectedDevice, onSelect }: { connections: WiringConnection[]; selectedPin?: number; selectedDevice?: string; onSelect: (pin: number) => void }) {
  const titleId = useId();
  const contact = (pin: BoardContact, index: number, bottom: boolean) => {
    const x = (bottom ? 248 : 85) + index * 40 + (index >= (bottom ? 8 : 10) ? 18 : 0);
    const y = bottom ? 278 : 66;
    const matches = connections.map((row, i) => ({ ...row, number: i + 1 })).filter(row => pin.gpio !== undefined && row.pin === pin.gpio);
    const supported = wemosD1R32Pins.some(candidate => candidate.gpio === pin.gpio);
    const selected = matches.length > 0 && (selectedPin === pin.gpio || matches.some(row => row.deviceId === selectedDevice));
    const label = `${pin.label}${pin.gpio !== undefined ? ` · GPIO ${pin.gpio}` : ''}${pin.alias ? ` · alias ${pin.alias}` : ''} · ${matches.length ? matches.map(row => `${row.number}. ${row.deviceName}: ${row.signal}`).join('; ') : 'Sin conexión asignada'}${!supported && pin.gpio !== undefined ? ' · No habilitado por este perfil' : ''}`;
    return <g key={`${bottom}-${index}`} className={`board-contact${matches.length ? ' used' : ''}${selected ? ' selected' : ''}${matches.length && !supported ? ' invalid' : ''}`} data-gpio={pin.gpio} data-used={Boolean(matches.length)} role={matches.length ? 'button' : undefined} tabIndex={matches.length ? 0 : undefined} aria-label={matches.length ? label : undefined} aria-pressed={matches.length ? selected : undefined}
      onClick={() => { if (matches.length && pin.gpio !== undefined) onSelect(pin.gpio); }}
      onKeyDown={event => { if (matches.length && pin.gpio !== undefined && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(pin.gpio); } }}>
      <title>{label}</title>
      <rect x={x - 18} y={y - 24} width={36} height={48} rx={6} className="board-contact-target" />
      <circle cx={x} cy={y} r={9} />
      <text x={x} y={bottom ? y + 37 : y - 29} textAnchor="middle" className="board-physical-label">{pin.label}</text>
      {pin.alias && <text x={x} y={bottom ? y + 54 : y - 39} textAnchor="middle" className="board-alias">{pin.alias}</text>}
      {matches.length > 0 && <text x={x} y={bottom ? y - 22 : y + 31} textAnchor="middle" className="board-wire-number">{matches.map(row => row.number).join(',')}</text>}
    </g>;
  };
  return <figure className="wemos-figure">
    <div className="wemos-image-scroll"><svg className="wemos-image" viewBox="0 0 850 352" role="group" aria-labelledby={titleId}>
      <title id={titleId}>Wemos D1 R32 vista superior, USB a la izquierda. GPIO de esta escena.</title>
      <path d="M45 54 Q45 42 59 42 H812 V302 H59 Q45 302 45 288Z" fill="#1768a0" stroke="#10466d" strokeWidth={3}/>
      <rect x={21} y={101} width={84} height={59} rx={5} fill="#cbd5e1" stroke="#536377" strokeWidth={3}/>
      <text x={63} y={137} textAnchor="middle" fill="#142437" fontSize={19} fontWeight={800}>USB</text>
      <rect x={28} y={222} width={78} height={48} rx={6} fill="#172434"/>
      <text x={67} y={251} textAnchor="middle" fill="white" fontSize={13}>DC</text>
      <rect x={558} y={119} width={164} height={114} rx={6} fill="#cbd5e1" stroke="#93a5b7" strokeWidth={3}/>
      <rect x={722} y={119} width={56} height={114} fill="#163848"/>
      <path d="M730 219V132h10v74h10v-74h10v74h10" stroke="#e1c16c" strokeWidth={3} fill="none"/>
      <text x={640} y={171} textAnchor="middle" fill="#172434" fontSize={19} fontWeight={800}>ESP32</text>
      <text x={640} y={193} textAnchor="middle" fill="#324253" fontSize={13}>WROOM-32</text>
      <text x={280} y={157} fill="white" fontSize={25} fontWeight={800}>WEMOS D1 R32</text>
      <text x={280} y={181} fill="#dceffc" fontSize={16}>Señales: 3,3 V · GND común</text>
      <text x={280} y={208} fill="#dceffc" fontSize={13}>GPIO ≠ número de alias D / A</text>
      {wemosTop.map((pin, index) => contact(pin, index, false))}
      {wemosBottom.map((pin, index) => contact(pin, index, true))}
    </svg></div>
    <figcaption>Vista superior esquemática, no a escala. IO26 significa GPIO 26; D2 es su alias Arduino. Los números violetas corresponden a las filas. Seleccioná una fila o un pin para relacionarlos.</figcaption>
    <p className="wemos-caution">Compará la serigrafía con tu placa antes de conectar: hay variantes. Este dibujo localiza señales, no reemplaza el circuito, resistencias, drivers ni la revisión adulta. Pines no usados se muestran sólo como referencia; no habilitan nuevas salidas.</p>
  </figure>;
}
