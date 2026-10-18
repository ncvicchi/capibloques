'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import {
  createTheaterWorldState,
  theaterHasDistance,
  type TheaterWorldState,
} from '@/lib/theater-world';
export default function TheaterWorld({
  scene,
  state,
}: {
  scene: SceneDefinition;
  state?: TheaterWorldState;
}) {
  const w = state ?? createTheaterWorldState(scene.canvas.theaterEnvironment);
  return (
    <div
      className="scene-world"
      data-theater-phase={w.phase}
      data-theater-groups={w.groups}
      data-theater-request={w.requestMs > 0}
      data-theater-distance={Math.round(w.distance)}
    >
      <svg
        viewBox="0 0 960 540"
        preserveAspectRatio="none"
        aria-label="Teatro de Otto con escenario y público frontal"
      >
        <rect width="960" height="540" fill="#e6dac8" />
        <rect x="30" y="40" width="900" height="275" rx="20" fill="#334866" />
        <path
          d="M30 40H230Q170 150 115 310H30ZM930 40H730Q790 150 845 310H930Z"
          fill="#b76677"
        />
        <path d="M30 50H930Q700 125 480 60Q250 125 30 50Z" fill="#cb8290" />
        <path d="M165 310H795L850 345H110Z" fill="#b29170" />
        <rect x="110" y="345" width="740" height="18" rx="4" fill="#8c6d56" />
        <text
          x="480"
          y="125"
          textAnchor="middle"
          fontSize="25"
          fontWeight="900"
          fill="#fff0bf"
        >
          EL TEATRO DE OTTO
        </text>
        {[240, 350, 460, 570, 680].map((x) => (
          <path
            key={x}
            d={`M${x} 315l-15 25`}
            stroke="#cfb18c"
            strokeWidth="3"
          />
        ))}
        <text x="480" y="381" textAnchor="middle" fontSize="14" fill="#4b535c">
          Escenario fijo: coreografía, no navegación ni equilibrio físico
        </text>
        {Array.from({ length: w.count }, (_, i) => (
          <g
            key={i}
            data-theater-person={i}
            transform={`translate(${400 + i * 55 - (w.count - 1) * 27} ${425 + (w.distance - 35) * 0.35})`}
          >
            <circle
              cy="-20"
              r="12"
              fill={['#efc59f', '#dca97e', '#edccac', '#bc8e6c'][i]}
            />
            <path
              d="M-14-5Q0-14 14-5L18 24H-18Z"
              fill={['#83a9c4', '#d6af62', '#a88dc3', '#8cb89c'][i]}
            />
            <path d="M-7 24v18m14-18v18" stroke="#536071" strokeWidth="6" />
            <title>
              Espectador {i + 1},{' '}
              {w.phase === 'watching'
                ? 'esperando la actuación'
                : w.phase === 'leaving'
                  ? 'se retira'
                  : 'se acerca'}
            </title>
          </g>
        ))}
        <text x="35" y="505" fontSize="15" fill="#414d58">
          {w.count
            ? `Público: ${w.count} · ${w.phase === 'watching' ? 'Acomodado' : w.phase === 'leaving' ? 'Retirándose' : 'Acercándose'}`
            : 'Esperando público'}
        </text>
        <text x="35" y="529" fontSize="13" fill="#414d58">
          {theaterHasDistance(scene)
            ? `Distancia frontal idealizada: ${Math.round(w.distance)} cm`
            : 'Este perfil no incluye sensor de distancia: adaptá el programa.'}
        </text>
        {w.requestMs > 0 && (
          <g>
            <rect
              x="620"
              y="445"
              width="290"
              height="40"
              rx="10"
              fill="#fff2ba"
            />
            <text
              x="765"
              y="470"
              textAnchor="middle"
              fontSize="15"
              fontWeight="800"
              fill="#68523d"
            >
              ¡Queremos una actuación!
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
