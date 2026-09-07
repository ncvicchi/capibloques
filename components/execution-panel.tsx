'use client';

import { useEffect, useRef, useState } from 'react';
import type { SimulatorState } from '@/lib/capiblocks';

export default function ExecutionPanel({
  state,
  post,
  onFollow,
}: {
  state?: SimulatorState | null;
  post: (message: Record<string, unknown>) => void;
  onFollow: (blockId: string) => void;
}) {
  const [follow, setFollow] = useState(false);
  const lastFollowed = useRef(0);
  const execution = state?.execution;
  const latest = execution?.trace.at(-1);
  const awaiting = execution?.awaitingFrame;
  useEffect(() => {
    if (awaiting == null) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() =>
        post({ type: 'FRAME_SHOWN', seq: awaiting }),
      );
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [awaiting, post]);
  useEffect(() => {
    if (follow && latest && lastFollowed.current !== latest.seq) {
      lastFollowed.current = latest.seq;
      onFollow(latest.blockId);
    }
  }, [follow, latest, onFollow]);
  const labels = {
    ready: 'Listo',
    waiting: 'Esperando',
    joining: 'Espera a los otros caminos',
    done: 'Terminó',
    inactive: 'Aún no comenzó',
  };
  return (
    <section className="execution-panel" aria-label="Qué se está ejecutando">
      <div className="execution-options">
        <label>
          Cómo mirar la ejecución{' '}
          <select
            aria-label="Modo de ejecución"
            value={execution?.mode ?? 'normal'}
            onChange={(event) =>
              post({ type: 'SET_MODE', mode: event.target.value })
            }
          >
            <option value="normal">Normal</option>
            <option value="guided">Guiado: ver cada paso</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={follow}
            onChange={(event) => {
              lastFollowed.current = 0;
              setFollow(event.target.checked);
            }}
          />{' '}
          Seguir el bloque en pantalla
        </label>
      </div>
      <div
        className="execution-now"
        aria-live={
          execution?.mode === 'guided' || state?.status === 'paused'
            ? 'polite'
            : 'off'
        }
        aria-atomic="true"
      >
        <strong>{state?.status === 'stopped' ? '■ Detenido' : state?.status === 'done' ? '✓ Terminado' : '➜ Ahora'}</strong>
        <span>
          {latest?.message ??
            'Presioná Ejecutar o Paso para ver qué hace tu programa.'}
        </span>
        {latest && (
          <small>
            {latest.label} · {(latest.now / 1000).toFixed(3)} s
          </small>
        )}
      </div>
      {execution && execution.tasks.length > 0 && (
        <ul className="execution-paths" aria-label="Estado de los caminos">
          {execution.tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.label}</strong>: {labels[task.status]}
              {task.remainingMs !== undefined
                ? ` · ${(task.remainingMs / 1000).toFixed(2)} s restantes`
                : ''}
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary>
          Últimos {execution?.trace.length ?? 0} pasos (máximo 30)
        </summary>
        <p className="execution-help">Un solo «Al comenzar». Usá «Al mismo tiempo» para abrir caminos. Lo que sigue debajo espera a que todos terminen. En modo guiado, Ejecutar muestra cada paso y Paso avanza con cada clic. El reloj simulado y el código de la placa no reciben pausas extra.</p>
        <ol className="execution-trace">
          {execution?.trace.map((item) => (
            <li key={item.seq}>
              <button type="button" onClick={() => onFollow(item.blockId)}>
                {(item.now / 1000).toFixed(3)} s · {item.label}: {item.message}
              </button>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
