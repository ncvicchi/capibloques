'use client';

/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useId } from 'react';
import { s3Left, s3Right } from '@/lib/s3-board';
import { boardProfile } from '@/lib/board-profiles';
import type { BoardContact } from '@/lib/wemos-board';
import type { WiringConnection } from '@/components/wemos-board';

export default function S3Board({ connections, selectedPin, selectedDevice, onSelect }: { connections: WiringConnection[]; selectedPin?: number; selectedDevice?: string; onSelect: (pin: number) => void }) {
  const titleId = useId();
  const supportedPins = boardProfile('diymall-esp32-s3-devkitc-v1-n16r8').pins;
  const contact = (pin: BoardContact, index: number, right: boolean) => {
    const x = right ? 548 : 102;
    const y = 55 + index * 28;
    const matches = connections.map((row, i) => ({ ...row, number: i + 1 })).filter(row => pin.gpio !== undefined && row.pin === pin.gpio);
    const supported = supportedPins.some(candidate => candidate.gpio === pin.gpio);
    const selected = matches.length > 0 && (selectedPin === pin.gpio || matches.some(row => row.deviceId === selectedDevice));
    const label = `${pin.label}${pin.gpio !== undefined ? ` · GPIO ${pin.gpio}` : ''} · ${matches.length ? matches.map(row => `${row.number}. ${row.deviceName}: ${row.signal}`).join('; ') : 'Sin conexión asignada'}${!supported && pin.gpio !== undefined ? ' · Reservado o no habilitado por este perfil' : ''}`;
    return <g key={`${right}-${index}`} className={`board-contact${matches.length ? ' used' : ''}${selected ? ' selected' : ''}${matches.length && !supported ? ' invalid' : ''}`} role={matches.length ? 'button' : undefined} tabIndex={matches.length ? 0 : undefined} aria-label={matches.length ? label : undefined} aria-pressed={matches.length ? selected : undefined}
      onClick={() => { if (matches.length && pin.gpio !== undefined) onSelect(pin.gpio); }}
      onKeyDown={event => { if (matches.length && pin.gpio !== undefined && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(pin.gpio); } }}>
      <title>{label}</title>
      <rect x={x - 25} y={y - 12} width={50} height={24} rx={5} className="board-contact-target" />
      <circle cx={x} cy={y} r={7} />
      <text x={right ? x + 19 : x - 19} y={y + 4} textAnchor={right ? 'start' : 'end'} className="board-physical-label">{pin.label}</text>
      {matches.length > 0 && <text x={right ? x - 18 : x + 18} y={y + 4} textAnchor={right ? 'end' : 'start'} className="board-wire-number">{matches.map(row => row.number).join(',')}</text>}
    </g>;
  };
  return <figure className="wemos-figure">
    <div className="wemos-image-scroll"><svg className="wemos-image" viewBox="0 0 650 680" role="group" aria-labelledby={titleId}>
      <title id={titleId}>DIYmall ESP32-S3-DevKitC V1.0 N16R8 vista superior, conectores USB abajo.</title>
      <rect x={72} y={25} width={506} height={620} rx={22} fill="#197663" stroke="#0d4f43" strokeWidth={4}/>
      <rect x={188} y={65} width={274} height={190} rx={10} fill="#cbd5e1" stroke="#8a9bab" strokeWidth={3}/>
      <rect x={212} y={91} width={226} height={115} rx={6} fill="#263746"/>
      <text x={325} y={139} textAnchor="middle" fill="white" fontSize={25} fontWeight={800}>ESP32-S3</text>
      <text x={325} y={172} textAnchor="middle" fill="#d9f5ef" fontSize={18}>16 MB flash · 8 MB PSRAM</text>
      <text x={325} y={315} textAnchor="middle" fill="white" fontSize={24} fontWeight={800}>DIYMALL DEVKITC V1.0</text>
      <text x={325} y={347} textAnchor="middle" fill="#d9f5ef" fontSize={16}>N16R8 · señales de 3,3 V</text>
      <circle cx={242} cy={414} r={28} fill="#172434"/><text x={242} y={420} textAnchor="middle" fill="white" fontSize={13}>BOOT</text>
      <circle cx={407} cy={414} r={28} fill="#172434"/><text x={407} y={420} textAnchor="middle" fill="white" fontSize={13}>RST</text>
      <rect x={171} y={568} width={120} height={77} rx={8} fill="#cbd5e1"/><text x={231} y={610} textAnchor="middle" fontWeight={800}>USB-UART</text>
      <rect x={359} y={568} width={120} height={77} rx={8} fill="#cbd5e1"/><text x={419} y={603} textAnchor="middle" fontWeight={800}>USB</text><text x={419} y={622} textAnchor="middle" fontSize={12}>nativo</text>
      {s3Left.map((pin, index) => contact(pin, index, false))}
      {s3Right.map((pin, index) => contact(pin, index, true))}
    </svg></div>
    <figcaption>Vista superior esquemática, conectores USB hacia abajo. Los números violetas enlazan cada pin con la tabla.</figcaption>
    <p className="wemos-caution">GPIO35, 36 y 37 se muestran para reconocer la serigrafía, pero quedan deshabilitados porque la PSRAM Octal N16R8 los utiliza. Para programar normalmente usá USB-UART; no intercambies ambos conectores por intuición.</p>
  </figure>;
}
