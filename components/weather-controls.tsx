'use client';
import { useState } from 'react';
import { weatherLabels, type WeatherEnvironment, type WeatherCondition } from '@/lib/weather-world';
export default function WeatherControls({ value, onChange, disabled = false, optimistic = false }: { value: WeatherEnvironment; onChange: (v: WeatherEnvironment) => void; disabled?: boolean; optimistic?: boolean }) {
  const [pending, setPending] = useState<WeatherEnvironment | null>(null);
  const acknowledged = pending && value.condition === pending.condition && value.night === pending.night && value.automatic === pending.automatic;
  if (acknowledged) setPending(null);
  const current = optimistic && pending && !acknowledged ? pending : value;
  const change = (next: WeatherEnvironment) => { if (optimistic) setPending(next); onChange(next); };
  return <fieldset className="message-test-panel" disabled={disabled}><legend>Clima virtual</legend>
    <div className="scene-toolbar">{(Object.entries(weatherLabels) as [WeatherCondition, string][]).map(([condition, label]) => <button type="button" key={condition} aria-pressed={current.condition === condition} onClick={() => change({ ...current, condition, automatic: false })}>{label}</button>)}</div>
    <label><input type="checkbox" checked={current.night} onChange={e => change({ ...current, night: e.target.checked, automatic: false })} /> Es de noche</label>
    <label><input type="checkbox" checked={current.automatic} onChange={e => change({ ...current, automatic: e.target.checked })} /> Secuencia automática de prueba</label>
    <small>La secuencia cambia cada 20 s simulados. Elegir clima o día/noche pasa a manual. El detector tarda en secarse: su porcentaje no son milímetros ni intensidad de lluvia. La presión no predice por sí sola si lloverá.</small>
  </fieldset>;
}
