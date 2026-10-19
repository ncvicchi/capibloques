'use client';
import type { SceneDefinition } from '@/lib/scene-model';
import {
  createPondWorld,
  pondBindings,
  pondSlots,
  waterDistance,
  type PondWorldState,
} from '@/lib/pond-world';
export default function PondWorld({
  scene,
  state,
}: {
  scene: SceneDefinition;
  state?: PondWorldState;
}) {
  const b = pondBindings(scene),
    gate = scene.devices.find((d) => d.id === b.drain);
  const w =
    state ??
    createPondWorld(
      scene.canvas.pondEnvironment,
      gate?.kind === 'servo' ? gate.config.angle : 0,
    );
  const reserveY = 365 - (w.reserve / 300) * 180,
    lagoonY = 400 - w.lagoon * 1.8;
  return (
    <div
      className="scene-world"
      data-pond-lagoon={w.lagoon.toFixed(2)}
      data-pond-reserve={w.reserve.toFixed(2)}
      data-pond-dry={w.dryPump}
      data-pond-spilled={w.spilled.toFixed(2)}
    >
      <svg
        viewBox="0 0 960 540"
        preserveAspectRatio="none"
        aria-label="Laguna con depósito de reserva, bomba, desagüe y detector de derrame"
      >
        <rect width="960" height="540" fill="#d9edf2" />
        <path d="M0 160Q150 60 340 170T680 160T960 150V540H0Z" fill="#bdd4a3" />
        <path d="M0 405Q300 380 500 420T960 420V540H0Z" fill="#9ebb86" />
        <text x="30" y="35" fontSize="23" fontWeight="900" fill="#294c4b">
          LAGUNA Y RESERVA
        </text>
        <text x="30" y="60" fontSize="13" fill="#294c4b">
          Modelo didáctico · el programa decide cuándo bombear y desagotar
        </text>
        <rect
          x="100"
          y="175"
          width="220"
          height="195"
          rx="12"
          fill="#edf4ee"
          stroke="#638c92"
          strokeWidth="6"
        />
        <rect
          x="105"
          y={reserveY}
          width="210"
          height={365 - reserveY}
          fill="#66b6ce"
        />
        <path d={`M105 ${reserveY}h210`} stroke="#e6ffff" strokeWidth="3" />
        <path
          d="M500 210H795V405H500Z"
          fill="#f1e2bd"
          stroke="#9a8b65"
          strokeWidth="6"
        />
        <rect
          x="505"
          y={lagoonY}
          width="285"
          height={400 - lagoonY}
          fill="#57b3cb"
        />
        <path d={`M505 ${lagoonY}h285`} stroke="#e6ffff" strokeWidth="3" />
        <path
          d="M320 340H470V245H500"
          fill="none"
          stroke="#738b8c"
          strokeWidth="16"
        />
        <path
          d="M320 340H470V245H500"
          fill="none"
          stroke={w.pumpFlow > 0 ? '#9ae6ef' : '#c2cecb'}
          strokeWidth="7"
          strokeDasharray="12 9"
          strokeDashoffset={w.pumpFlow > 0 ? -w.timeMs / 40 : 0}
        />
        <text x="350" y="315" fontSize="17" fill="#285a67">
          Reserva → laguna
        </text>
        <path
          d="M795 375H910V450"
          fill="none"
          stroke="#738b8c"
          strokeWidth="15"
        />
        <path
          d="M795 375H910V450"
          fill="none"
          stroke="#9ae6ef"
          strokeWidth="6"
          strokeDasharray="9 8"
          strokeDashoffset={w.drainFlow > 0 ? -w.timeMs / 40 : 0}
          opacity={w.drainFlow > 0 ? 1 : 0}
        />
        <path
          d="M825 364l20 22"
          stroke="#c38155"
          strokeWidth="8"
          transform={`rotate(${-w.gateAngle} 835 375)`}
        />
        <rect x="490" y="460" width="310" height="12" rx="5" fill="#8d9b9a" />
        <ellipse
          cx="640"
          cy="457"
          rx={Math.max(1, w.wetness * 1.4)}
          ry="8"
          fill="#4caaca"
          opacity={w.wetness / 100}
        />
        {w.environment.rain > 0 &&
          Array.from({ length: 16 }, (_, i) => (
            <path
              key={i}
              d={`M${510 + i * 18} ${110 + ((i * 29 + w.timeMs * 0.08) % 90)}l-3 9`}
              stroke="#438dab"
              strokeWidth="2"
            />
          ))}
        <text x="210" y="397" textAnchor="middle" fontSize="17" fill="#294c4b">
          Reserva: {w.reserve.toFixed(1)} / 300 L
        </text>
        <text x="640" y="428" textAnchor="middle" fontSize="17" fill="#294c4b">
          Laguna: {w.lagoon.toFixed(1)} / 100 L
        </text>
        {[
          ['reserveSensor', 210, waterDistance(w.reserve, 300)],
          ['lagoonSensor', 640, waterDistance(w.lagoon, 100)],
        ].map(([role, x, d]) => (
          <text
            key={role}
            x={Number(x)}
            y={role === 'reserveSensor' ? 115 : 155}
            textAnchor="middle"
            fontSize="14"
            fill="#294c4b"
          >
            {b[role as 'reserveSensor' | 'lagoonSensor']
              ? `${Number(d).toFixed(1)} cm`
              : 'Sin sensor'}
          </text>
        ))}
        {pondSlots.map((s) => {
          const name =
            scene.devices.find((d) => d.id === b[s.role])?.name ??
            `${s.name} · falta`;
          return (
            <text
              key={s.role}
              x={s.x}
              y={s.y + 28}
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fill="#294c4b"
            >
              <title>{name}</title>
              {name.length > 29 ? name.slice(0, 28) + '…' : name}
            </text>
          );
        })}
        <text
          x="30"
          y="500"
          fontSize="15"
          fill={w.dryPump ? '#a52e2e' : '#294c4b'}
        >
          {w.dryPump
            ? '⚠ Bomba funcionando sin agua'
            : `Bombeo: ${w.pumpFlow.toFixed(1)} L/s`}{' '}
          · Desagüe: {w.drainFlow.toFixed(1)} L/s
        </text>
        <text x="30" y="524" fontSize="13" fill="#294c4b">
          Derramado: {w.spilled.toFixed(1)} L · Bandeja mojada:{' '}
          {w.wetness.toFixed(0)}% · Agua fuera del sistema:{' '}
          {(w.drained + w.leaked + w.evaporated + w.spilled).toFixed(1)} L
        </text>
      </svg>
    </div>
  );
}
