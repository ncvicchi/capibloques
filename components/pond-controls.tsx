'use client';
import { useState } from 'react';
import type { PondEnvironment } from '@/lib/pond-world';
export default function PondControls({
  value,
  onChange,
  onRefill,
  disabled = false,
  initial = false,
}: {
  value: PondEnvironment;
  onChange: (v: PondEnvironment) => void;
  onRefill?: () => void;
  disabled?: boolean;
  initial?: boolean;
}) {
  const [pending, setPending] = useState<PondEnvironment | null>(null);
  const acknowledged =
    pending && JSON.stringify(pending) === JSON.stringify(value);
  if (acknowledged) setPending(null);
  const current = pending && !acknowledged ? pending : value;
  const change = (key: keyof PondEnvironment, n: number) => {
    const next = { ...current, [key]: n };
    if (!initial) setPending(next);
    onChange(next);
  };
  return (
    <fieldset className="message-test-panel" disabled={disabled}>
      <legend>
        {initial ? 'Agua al comenzar' : 'Ensayos de agua virtual'}
      </legend>
      {initial && (
        <>
          <label>
            Laguna inicial (0–100 L)
            <input
              type="range"
              min="0"
              max="100"
              value={current.lagoon}
              onChange={(e) => change('lagoon', Number(e.target.value))}
            />
            <output>{current.lagoon} L</output>
          </label>
          <label>
            Reserva inicial (0–300 L)
            <input
              type="range"
              min="0"
              max="300"
              value={current.reserve}
              onChange={(e) => change('reserve', Number(e.target.value))}
            />
            <output>{current.reserve} L</output>
          </label>
          <label>
            Evaporación (L/s)
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={current.evaporation}
              onChange={(e) => change('evaporation', Number(e.target.value))}
            />
            <output>{current.evaporation} L/s</output>
          </label>
        </>
      )}
      <label>
        Lluvia sobre la laguna
        <input
          type="range"
          min="0"
          max="4"
          step="0.1"
          value={current.rain}
          onChange={(e) => change('rain', Number(e.target.value))}
        />
        <output>{current.rain} L/s</output>
      </label>
      <label>
        Fuga de la laguna
        <input
          type="range"
          min="0"
          max="4"
          step="0.1"
          value={current.leak}
          onChange={(e) => change('leak', Number(e.target.value))}
        />
        <output>{current.leak} L/s</output>
      </label>
      {!initial && (
        <button type="button" onClick={onRefill}>
          Recargar reserva a 300 L
        </button>
      )}
      <small>
        Modelo didáctico. Más agua significa menor distancia. Los ensayos no
        cambian el proyecto ni reemplazan sensores. La recarga se aplica al
        avanzar el reloj; Reiniciar restaura las condiciones guardadas.
      </small>
    </fieldset>
  );
}
