'use client';
import type { GorillaTrackState } from '@/lib/gorilla-track';
export default function GorillaAutonomyControls({
  state,
  disabled,
  onChange,
  onButton,
}: {
  state?: GorillaTrackState;
  disabled: boolean;
  onButton: () => void;
  onChange: (value: object) => void;
}) {
  return (
    <fieldset disabled={disabled} className="message-test-panel">
      <legend>Ensayos de autonomía · sólo simulador</legend>
      <button type="button" onClick={onButton}>
        Pulsar y soltar botón de misión
      </button>
      <details>
        <summary>Ensayos de sensor y obstáculos</summary>
        <label>
          Sensor frontal{' '}
          <select
            aria-label="Ensayo de distancia frontal"
            value={state?.sonarMode ?? 'normal'}
            onChange={(e) => onChange({ sonarMode: e.target.value })}
          >
            <option value="normal">Lecturas normales</option>
            <option value="missing">Sin eco / sensor desconectado</option>
            <option value="stale">Lectura vencida</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() =>
            onChange({ obstaclesRemoved: !state?.obstaclesRemoved })
          }
        >
          {state?.obstaclesRemoved
            ? 'Restituir obstáculos de prueba'
            : 'Retirar obstáculos de prueba'}
        </button>
        <small>
          La distancia viene de la pista y gira con el robot, no de un
          deslizador. Usá el botón de la escena para iniciar y pedir terminar.
          Sin eco no significa camino libre. Estos ensayos no cambian el
          proyecto ni se envían a la placa.
        </small>
      </details>
    </fieldset>
  );
}
