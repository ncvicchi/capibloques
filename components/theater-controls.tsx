'use client';
import type {
  TheaterEnvironment,
  TheaterWorldState,
} from '@/lib/theater-world';
export default function TheaterControls({
  value,
  onChange,
  onAction,
  state,
  disabled = false,
}: {
  value: TheaterEnvironment;
  onChange: (v: TheaterEnvironment) => void;
  onAction?: (action: 'arrive' | 'leave' | 'request') => void;
  state?: TheaterWorldState;
  disabled?: boolean;
}) {
  return (
    <fieldset className="message-test-panel" disabled={disabled}>
      <legend>Público del teatro</legend>
      <label>
        <input
          type="checkbox"
          checked={value.automaticArrivals}
          onChange={(e) =>
            onChange({ ...value, automaticArrivals: e.target.checked })
          }
        />{' '}
        Llegadas y petición automáticas
      </label>
      <label>
        Personas del próximo grupo manual{' '}
        <select
          aria-label="Personas del público"
          value={value.count}
          onChange={(e) =>
            onChange({ ...value, count: Number(e.target.value) })
          }
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cercanía del próximo grupo: {value.distance} cm{' '}
        <input
          type="range"
          aria-label="Cercanía del público"
          min="20"
          max="100"
          step="5"
          value={value.distance}
          onChange={(e) =>
            onChange({ ...value, distance: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Permanencia del próximo grupo: {value.staySeconds} s{' '}
        <input
          type="range"
          aria-label="Permanencia del público"
          min="12"
          max="40"
          step="2"
          value={value.staySeconds}
          onChange={(e) =>
            onChange({ ...value, staySeconds: Number(e.target.value) })
          }
        />
      </label>
      {onAction && (
        <div className="scene-toolbar">
          <button
            type="button"
            disabled={state?.phase !== 'empty' || state?.pendingArrival}
            onClick={() => onAction('arrive')}
          >
            Llega público
          </button>
          <button
            type="button"
            disabled={!state || state.phase === 'empty'}
            onClick={() => onAction('leave')}
          >
            Se retira el público
          </button>
          <button
            type="button"
            disabled={
              state?.phase !== 'watching' ||
              !!state?.requestMs ||
              !!state?.pendingRequest
            }
            onClick={() => onAction('request')}
          >
            Pedir actuación
          </button>
        </div>
      )}
      <small>
        Un grupo a la vez; las llegadas automáticas mezclan 1–4 personas y piden
        una actuación al acomodarse. La pulsación dura 2 s simulados. El
        programa decide qué hacer; no hay cola de espectáculos.
      </small>
    </fieldset>
  );
}
