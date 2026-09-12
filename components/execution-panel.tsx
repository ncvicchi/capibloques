'use client';

import { useEffect } from 'react';
import type { SimulatorState } from '@/lib/capiblocks';

export default function ExecutionPanel({
  state,
  post,
  onFollow,
  compact = false,
}: {
  state?: SimulatorState | null;
  post: (message: Record<string, unknown>) => void;
  onFollow: (blockId: string) => void;
  compact?: boolean;
}) {
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
  const labels = {
    ready: 'Listo',
    waiting: 'Esperando',
    joining: 'Espera a los otros caminos',
    done: 'Terminó',
    inactive: 'Aún no comenzó',
  };
  const activeTasks = execution?.tasks.filter(
    task => task.status !== 'done' && task.status !== 'inactive',
  ) ?? [];
  const globalMessage =
    state?.status === 'stopped'
      ? 'Los indicadores del programa se limpiaron.'
      : state?.status === 'done'
        ? 'Todos los caminos terminaron.'
        : activeTasks.length > 1
          ? `${activeTasks.length} caminos activos`
          : activeTasks.length === 1
            ? '1 camino activo'
            : 'Presioná Ejecutar o Paso para comenzar.';
  return (
    <section className={`execution-panel${compact ? ' execution-compact' : ''}`} aria-label="Qué se está ejecutando">
      <div className="execution-options">
        <label>
          {compact ? 'Ejecución' : 'Cómo mirar la ejecución'}{' '}
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
          {globalMessage}
        </span>
        {latest && (
          <small>
            {(latest.now / 1000).toFixed(3)} s simulados
          </small>
        )}
      </div>
      <details className="execution-detail">
        <summary>Últimos {execution?.trace.length ?? 0} pasos (máximo 30)</summary>
        {latest && (
          <button
            className="execution-focus"
            type="button"
            onClick={() => onFollow(latest.blockId)}
          >
            Centrar el último bloque
          </button>
        )}
      {execution && execution.tasks.length > 0 && (
        <ul className="execution-paths" aria-label="Estado de los caminos">
          {execution.tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.label}</strong>: {labels[task.status]}
              {task.detail ? ` · ${task.detail}` : ''}
              {task.iteration !== undefined && task.totalIterations !== undefined
                ? ` · vuelta ${task.iteration} de ${task.totalIterations}`
                : ''}
            </li>
          ))}
        </ul>
      )}
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
