'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import {
  createGorillaTrack,
  gorillaStations,
  gorillaDistance, gorillaBindings,
  type GorillaTrackState,
} from '@/lib/gorilla-track';
export default function GorillaTrack({
  scene,
  state,
}: {
  scene: SceneDefinition;
  state?: GorillaTrackState;
}) {
  const w = state ?? createGorillaTrack(scene),
    maneuvers = scene.canvas.gorillaTrack === 'maneuvers';
  return (
    <div
      className="scene-world"
      data-gorilla-x={w.x.toFixed(2)}
      data-gorilla-y={w.y.toFixed(2)}
      data-gorilla-distance={gorillaDistance(w,scene).distance}
      data-gorilla-valid={gorillaDistance(w,scene).valid}
      data-gorilla-contact={w.contact}
      data-gorilla-visits={w.visited.join(',')}
    >
      <svg
        viewBox="0 0 960 540"
        preserveAspectRatio="none"
        aria-label="Pista GorillaBot: salida, estación A y zona de maniobras"
      >
        <rect width="960" height="540" fill="#c9dfba" />
        <rect
          x="22"
          y="65"
          width="916"
          height="438"
          rx="24"
          fill="#e8e4cd"
          stroke="#98b784"
          strokeWidth="5"
        />
        <text x="30" y="32" fontSize="23" fontWeight="900" fill="#35534a">
          PISTA GORILLABOT
        </text>
        <text x="30" y="54" fontSize="13" fill="#35534a">
          Marcha de cuatro tiempos · desplazamiento y giros idealizados, sin
          equilibrio físico
        </text>
        <path
          d={
            maneuvers
              ? 'M120 355H480Q600 355 600 230Q600 190 680 190H820'
              : 'M100 355H800'
          }
          fill="none"
          stroke="#c1b295"
          strokeWidth="110"
          strokeLinecap="round"
        />
        <path
          d={
            maneuvers
              ? 'M120 355H480Q600 355 600 230Q600 190 680 190H820'
              : 'M100 355H800'
          }
          fill="none"
          stroke="#fff7d9"
          strokeWidth="3"
          strokeDasharray="10 12"
        />
        {gorillaStations
          .filter((s) => s.id !== 'B' || maneuvers)
          .map((s) => (
            <g key={s.id}>
              <circle
                cx={s.x}
                cy={s.y}
                r="27"
                fill={w.visited.includes(s.id) ? '#9ecba1' : '#ede1b2'}
                stroke="#536f63"
                strokeWidth="3"
              />
              <text
                x={s.x}
                y={s.y + 5}
                fontSize="16"
                textAnchor="middle"
                fill="#35534a"
              >
                {s.id === 'base' ? 'BASE' : s.id}
              </text>
              <text
                x={s.x}
                y={s.y + 78}
                fontSize="12"
                textAnchor="middle"
                fill="#35534a"
              >
                {s.id === 'base' ? 'Salida / regreso' : 'Estación ' + s.id}
              </text>
            </g>
          ))}
        {(w.obstaclesRemoved?[]:scene.canvas.arenaEnvironment?.obstacles ?? []).map((o, i) => (
          <g key={i}>
            <circle
              cx={o.x}
              cy={o.y}
              r={o.radius}
              fill="#b1875f"
              stroke="#795b40"
              strokeWidth="3"
            />
            <path
              d={`M${o.x - 12} ${o.y - 12}l24 24m0-24-24 24`}
              stroke="#ebc796"
              strokeWidth="4"
            />
          </g>
        ))}
        {scene.canvas.arenaEnvironment?.guides && (
          <polyline
            points={w.trail.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#9474ac"
            strokeWidth="3"
          />
        )}
        <rect
          x="40"
          y="85"
          width="860"
          height="45"
          rx="10"
          fill={w.contact ? '#f3c2a2' : '#f8f3e0'}
        />
        <text x="55" y="104" fontSize="13" fill="#35534a">
          {w.contact
            ? 'Contacto: el cuerpo no avanza, las patas pueden seguir. Retrocedé para salir.'
            : w.swing < 0
              ? 'Apoyo previsto de las cuatro patas. No es una lectura de contacto.'
              : 'Recupera: ' +
                [
                  'delantera izquierda',
                  'delantera derecha',
                  'trasera izquierda',
                  'trasera derecha',
                ][w.swing]}
        </text>
        <text x="55" y="122" fontSize="12" fill="#35534a">
          Visitas: {w.visited.join(' → ') || 'ninguna'} · Contactos:{' '}
          {w.contacts} · Las estaciones se registran al detenerse 0,5 s
        </text>
        {gorillaBindings(scene).sensor&&<g transform={`translate(${w.x} ${w.y}) rotate(${w.angle})`}><circle cx="42" cy="0" r="5" fill={gorillaDistance(w,scene).valid?'#f3bc52':'#ed685f'}/><path d={`M42 0h${Math.min(250,gorillaDistance(w,scene).distance*40)}`} stroke="#d08b25" strokeWidth="2" strokeDasharray="5 5"/></g>}
        {gorillaBindings(scene).sensor&&<text x="430" y="475" fontSize="13" fill="#35534a">{scene.devices.find(d=>d.id===gorillaBindings(scene).sensor)?.name}: {gorillaDistance(w,scene).valid?gorillaDistance(w,scene).distance+' cm virtuales':'lectura inválida / vencida'}</text>}
        <text x="35" y="527" fontSize="13" fill="#35534a">
          El camino no guía al robot. Sin sensores ni piloto automático.
          Reiniciar restablece toda la pista.
        </text>
      </svg>
    </div>
  );
}
