'use client';
import { useState } from 'react';
import {
  gorillaLegNames,
  gorillaPostures,
  validGorillaPostures,
  type GorillaPosture,
  gorillaValues,
  validGorillaSettings,
  type GorillaSettings,
} from '@/lib/gorilla-model';
import GorillaTrajectories from '@/components/gorilla-trajectories';
import type {GorillaKinematics,GorillaTrajectory} from '@/lib/gorilla-kinematics';
import GorillaPostures from '@/components/gorilla-postures';
import GorillaVisual from '@/components/gorilla-visual';
export default function GorillaProperties({
  remote,onRemote,
  settings,
  onChange,
  postures,
  onPostures,
  kinematics,trajectories,onGeometry,
}: {
  remote?: import('@/lib/gorilla-remote').GorillaRemoteConfig;
  onRemote: (r?:import('@/lib/gorilla-remote').GorillaRemoteConfig)=>void;
  settings: GorillaSettings;
  kinematics?:GorillaKinematics;trajectories?:GorillaTrajectory[];onGeometry:(k:GorillaKinematics,t:GorillaTrajectory[])=>void;
  postures?: GorillaPosture[];
  onPostures: (p: GorillaPosture[]) => void;
  onChange: (s: GorillaSettings) => void;
}) {
  const [editingTrajectories,setEditingTrajectories]=useState(false);
  const [editingPostures, setEditingPostures] = useState(false);
  const [leg, setLeg] = useState(0),
    [test, setTest] =
      useState<Record<string, number | string | boolean>>(gorillaValues());
  const change = (key: string, value: number | boolean) =>
    onChange({ ...settings, [key]: value });
  return (
    <section aria-label="Calibración de GorillaBot">
      <details><summary>🎮 Control remoto · web o celular</summary><label><input type="checkbox" checked={!!remote} onChange={e=>onRemote(e.target.checked?{missions:[]}:undefined)}/> Habilitar mando local (sin pines)</label>{remote&&<><label>Misiones permitidas (máximo 4 de 32 caracteres), una por línea<textarea aria-label="Misiones del mando" defaultValue={remote.missions.join('\n')} maxLength={131} onBlur={e=>{const missions=e.target.value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,4);onRemote({missions:[...new Set(missions)].map(s=>s.slice(0,32))});}}/></label><p>El programa lee la solicitud de misión (1 a 4) y decide qué procedimiento ejecutar. La conexión Wi-Fi y su clave se configuran al usar la placa, no aquí. El mando requiere intérprete y reglas; no se incluye en fuentes nativas.</p></>}</details>
      <p>
        La vista previa no mueve motores físicos. Para probar un servo real usá
        el ejemplo, con el robot sostenido y una persona adulta. Primero
        verificá conexiones, centros y límites.
      </p>
      <button type="button" onClick={() => setEditingPostures(true)}>
        Editar posturas
      </button>
      <button type="button" onClick={()=>setEditingTrajectories(true)}>Editar trayectorias de una pata</button>
      {editingTrajectories&&<GorillaTrajectories settings={settings} kinematics={kinematics} trajectories={trajectories} onCancel={()=>setEditingTrajectories(false)} onSave={(k,t)=>{onGeometry(k,t);setEditingTrajectories(false);}}/>}
      {editingPostures && (
        <GorillaPostures
          settings={settings}
          postures={gorillaPostures({ postures })}
          onCancel={() => setEditingPostures(false)}
          onSave={(poses) => {
            onPostures(poses);
            setEditingPostures(false);
          }}
        />
      )}
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
      {validGorillaSettings(settings) &&
        !validGorillaPostures(gorillaPostures({ postures }), settings) && (
          <p role="alert">
            Alguna postura supera los nuevos límites. Abrí Editar posturas para
            corregirla antes de guardar.
          </p>
        )}
      <GorillaVisual
        kinematics={kinematics}
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
