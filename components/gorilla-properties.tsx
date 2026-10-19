'use client';
import { useState } from 'react';
import {
  gorillaLegNames,
  gorillaValues,
  validGorillaSettings,
  type GorillaSettings,
} from '@/lib/gorilla-model';
import GorillaVisual from '@/components/gorilla-visual';
export default function GorillaProperties({
  settings,
  onChange,
}: {
  settings: GorillaSettings;
  onChange: (s: GorillaSettings) => void;
}) {
  const [leg, setLeg] = useState(0),
    [test, setTest] =
      useState<Record<string, number | string | boolean>>(gorillaValues());
  const change = (key: string, value: number | boolean) =>
    onChange({ ...settings, [key]: value });
  return (
    <section aria-label="Calibración de GorillaBot">
      <p>
        La vista previa no mueve motores físicos. Para probar un servo real usá
        el ejemplo, con el robot sostenido y una persona adulta. Primero
        verificá conexiones, centros y límites.
      </p>
      <label>
        Pata a calibrar
        <select
          value={leg}
          onChange={(e) => {
            setLeg(Number(e.target.value));
            setTest(gorillaValues());
          }}
        >
          {gorillaLegNames.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {[0, 1].map((offset) => {
        const i = leg * 2 + offset;
        return (
          <fieldset key={i}>
            <legend>
              Motor {offset ? 'B' : 'A'} · {gorillaLegNames[leg]}
            </legend>
            {[
              ['channel', 'Canal PCA9685', 0, 15],
              ['center', 'Centro', 70, 110],
              ['min', 'Límite mínimo', 50, 110],
              ['max', 'Límite máximo', 70, 130],
            ].map(([key, label, min, max]) => (
              <label key={key}>
                {' '}
                {label}
                <input
                  type="number"
                  min={min}
                  max={max}
                  step="1"
                  value={Number(settings[`${key}${i}`])}
                  onChange={(e) => change(`${key}${i}`, Number(e.target.value))}
                />
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={!!settings[`reversed${i}`]}
                onChange={(e) => change(`reversed${i}`, e.target.checked)}
              />{' '}
              Invertir sentido de este motor
            </label>
            <label>
              Vista previa motor {offset ? 'B' : 'A'} (−20° a +20°)
              <input
                type="range"
                min="-20"
                max="20"
                value={Number(test[`j${i}`])}
                onChange={(e) =>
                  setTest({ ...test, [`j${i}`]: Number(e.target.value) })
                }
              />
              <output>{Number(test[`j${i}`])}°</output>
            </label>
          </fieldset>
        );
      })}
      <label>
        Dirección I²C (decimal)
        <input
          type="number"
          min="64"
          max="119"
          value={Number(settings.address)}
          onChange={(e) => change('address', Number(e.target.value))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={!!settings.verified}
          onChange={(e) => change('verified', e.target.checked)}
        />{' '}
        Una persona adulta revisó canales, centros, límites y montaje sostenido
        para la prueba física
      </label>
      {!validGorillaSettings(settings) && (
        <p role="alert">
          Revisá límites (mínimo ≤ centro ≤ máximo) y canales únicos de 0 a 15.
          No se puede guardar una calibración inválida.
        </p>
      )}
      <GorillaVisual
        values={test}
        preview
        selectedLeg={leg}
        onSelectLeg={(next) => {
          setLeg(next);
          setTest(gorillaValues());
        }}
      />
    </section>
  );
}
