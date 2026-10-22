'use client';
import {
  advanceLineWorld,
  createLineWorld,
  defaultLineCircuit,
  lineBindings,
  lineSensorPoints,
  type LineWorldState,
} from '@/lib/line-world';
import { arenaPose } from '@/lib/robot-arena';
import type { SceneDefinition } from '@/lib/scene-model';
export default function LineWorld({
  scene,
  state,
}: {
  scene: SceneDefinition;
  state?: LineWorldState;
}) {
  const pose = arenaPose(scene),
    c = scene.canvas.lineCircuit ?? defaultLineCircuit,
    w =
      state ??
      advanceLineWorld(createLineWorld(pose.position, pose.angle), c, 0, 0, 0),
    b = lineBindings(scene),
    values = [w.left, w.center, w.right];
  return (
    <div
      className="scene-world"
      data-line-x={w.x.toFixed(1)}
      data-line-y={w.y.toFixed(1)}
      data-line-pattern={values.map((v) => (v ? '1' : '0')).join('')}
      data-line-contact={w.contact}
      data-line-distance={w.distance.toFixed(1)}
    >
      <svg
        viewBox="0 0 960 540"
        preserveAspectRatio="none"
        aria-label="Mesa del vehículo seguidor de línea"
      >
        <rect width="960" height="540" fill="#e0ebeb" />
        <rect
          x="20"
          y="50"
          width="920"
          height="460"
          rx="15"
          fill="#fffdf3"
          stroke="#789393"
          strokeWidth="4"
        />
        <text x="35" y="31" fontSize="21" fontWeight="900" fill="#314b48">
          LABORATORIO DE LÍNEAS
        </text>
        {c.strokes.map((s, i) => (
          <polyline
            key={i}
            points={s.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#222733"
            strokeWidth={c.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <polyline
          points={w.trail.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#a370b5"
          strokeWidth="2"
          strokeDasharray="3 5"
        />
        {b.sensors &&
          lineSensorPoints(w.x, w.y, w.angle).map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="6"
                fill={values[i] ? '#e2a348' : '#64abb4'}
                stroke="#fff"
                strokeWidth="2"
              />
              <title>
                {['Izquierdo', 'Central', 'Derecho'][i]}:{' '}
                {values[i] ? 'sobre línea' : 'fuera de línea'}
              </title>
            </g>
          ))}
        <text
          x={w.x}
          y={w.y + 43}
          textAnchor="middle"
          fontSize="13"
          fontWeight="800"
          fill="#314b48"
        >
          {scene.devices.find((d) => d.id === b.robot)?.name ?? 'Falta robot'}
        </text>
        <text x="35" y="532" fontSize="14" fill="#314b48">
          {b.sensors
            ? `${scene.devices.find((d) => d.id === b.sensors)?.name ?? 'Sensores'} I / C / D: ${values.map((v) => (v ? 'LÍNEA' : 'fuera')).join(' / ')}`
            : 'Falta la barra de sensores'}{' '}
          · Recorrido {Math.round(w.distance)} cm · Fuera{' '}
          {(w.offMs / 1000).toFixed(1)} s
        </text>
        {(w.contact || (!w.left && !w.center && !w.right)) && (
          <text x="925" y="31" textAnchor="end" fill="#854c36" fontSize="15">
            {w.contact
              ? 'Contacto: podés retroceder o girar'
              : 'Sin línea: el programa decide cómo buscarla'}
          </text>
        )}
      </svg>
    </div>
  );
}
