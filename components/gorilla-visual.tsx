'use client';
import { useState } from 'react';
import {
  gorillaLegDiagram,
  gorillaLegNames,
  type GorillaPosture,
} from '@/lib/gorilla-model';
export default function GorillaVisual({
  values,
  postures,
  preview = false,
  selectedLeg,
  onSelectLeg,
  interactive = true,
}: {
  postures?: GorillaPosture[];
  values: Record<string, number | string | boolean>;
  interactive?: boolean;
  preview?: boolean;
  selectedLeg?: number;
  onSelectLeg?: (leg: number) => void;
}) {
  const [internal, setSelected] = useState(0);
  const selected = selectedLeg ?? internal;
  const activePosture =
    !values.moving && !values.error && values.ready
      ? postures?.find((p) =>
          p.angles.every(
            (a, i) => Math.abs(a - Number(values[`j${i}`] ?? 0)) < 0.01,
          ),
        )
      : undefined;
  const a = Number(values[`j${selected * 2}`] ?? 0),
    b = Number(values[`j${selected * 2 + 1}`] ?? 0),
    p = gorillaLegDiagram(a, b);
  const line = (
    u: { x: number; y: number },
    v: { x: number; y: number },
    color: string,
  ) => (
    <line
      x1={u.x}
      y1={u.y}
      x2={v.x}
      y2={v.y}
      stroke={color}
      strokeWidth="8"
      strokeLinecap="round"
    />
  );
  return (
    <div
      className="gorilla-bench"
      data-gorilla-posture={activePosture?.name ?? ''}
      data-gorilla-ready={!!values.ready}
      data-gorilla-moving={!!values.moving}
      data-gorilla-a={a.toFixed(1)}
      data-gorilla-b={b.toFixed(1)}
    >
      <div className="scene-toolbar" onPointerDown={(e) => e.stopPropagation()}>
        {gorillaLegNames.map((name, i) =>
          interactive ? (
            <button
              type="button"
              key={name}
              aria-pressed={i === selected}
              onClick={(e) => {
                e.stopPropagation();
                (onSelectLeg ?? setSelected)(i);
              }}
            >
              {i + 1}. {name}
            </button>
          ) : (
            <span
              key={name}
              className={i === selected ? 'gorilla-selected' : ''}
            >
              {i + 1}. {name}
            </span>
          ),
        )}
      </div>
      <svg
        viewBox="0 0 600 300"
        aria-label="GorillaBot articulado y detalle de pata con dos motores y cinco barras"
      >
        <rect
          x="100"
          y="85"
          width="150"
          height="95"
          rx="25"
          fill="#ce9062"
          stroke="#674f47"
          strokeWidth="5"
        />
        <rect x="122" y="50" width="106" height="70" rx="24" fill="#7e665b" />
        <circle cx="153" cy="75" r="8" fill="#fff5cf" />
        <circle cx="196" cy="75" r="8" fill="#fff5cf" />
        <path
          d="M150 94Q175 110 200 94"
          stroke="#edc391"
          strokeWidth="6"
          fill="none"
        />
        {gorillaLegNames.map((name, i) => {
          const d = gorillaLegDiagram(
              Number(values[`j${2 * i}`] ?? 0),
              Number(values[`j${2 * i + 1}`] ?? 0),
            ),
            x = i % 2 ? 265 : 85,
            y = i < 2 ? 110 : 190;
          return (
            <g
              key={name}
              transform={`translate(${x} ${y}) scale(${i % 2 ? 0.45 : -0.45} .45)`}
            >
              <title>{name}</title>
              {line(d.A, d.E, i === selected ? '#ec9855' : '#806253')}
              {line(d.B, d.F, i === selected ? '#56aab6' : '#806253')}
              {line(d.E, d.foot, '#98765f')}
              {line(d.F, d.foot, '#98765f')}
              <circle cx={d.foot.x} cy={d.foot.y} r="9" fill="#594a44" />
              <text
                x="0"
                y="-14"
                textAnchor="middle"
                fontSize="30"
                fill="#324a55"
                transform={`scale(${i % 2 ? 1 : -1} 1)`}
              >
                {i + 1}
              </text>
            </g>
          );
        })}
        <text x="175" y="285" textAnchor="middle" fontSize="14" fill="#3e5260">
          Banco: sostenido, sin marcha ni equilibrio simulado
        </text>
        <g transform="translate(455 65)">
          <path d="M-50 0H50" stroke="#596571" strokeWidth="8" />
          {line(p.A, p.E, '#ec9855')}
          {line(p.B, p.F, '#56aab6')}
          {line(p.E, p.foot, '#98765f')}
          {line(p.F, p.foot, '#98765f')}
          <circle cx={p.A.x} cy="0" r="9" fill="#ec9855" />
          <circle cx={p.B.x} cy="0" r="9" fill="#56aab6" />
          <circle cx={p.foot.x} cy={p.foot.y} r="8" fill="#594a44" />
          <text x="-44" y="-15" fontSize="16">
            A
          </text>
          <text x="24" y="-15" fontSize="16">
            B
          </text>
        </g>
        <text x="455" y="235" textAnchor="middle" fontSize="16" fill="#324a55">
          Motor A: {a.toFixed(1)}° · B: {b.toFixed(1)}°
        </text>
        <text x="455" y="259" textAnchor="middle" fontSize="12" fill="#324a55">
          Respecto al centro · posiciones ordenadas
        </text>
        <text x="455" y="280" textAnchor="middle" fontSize="12" fill="#324a55">
          Mecanismo ilustrativo, no medidas reales
        </text>
      </svg>
      <small>
        {preview
          ? 'Vista previa local · no mueve la placa'
          : values.error
            ? 'Orden rechazada: revisá preparación y límites'
            : values.moving
              ? 'Movimiento coordinado en curso'
              : values.ready
                ? activePosture
                  ? `Postura ordenada: ${activePosture.name}`
                  : 'Preparado · posición personalizada'
                : 'Sin preparar · agregá Preparar GorillaBot al programa'}
      </small>
    </div>
  );
}
