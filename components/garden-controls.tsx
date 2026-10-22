'use client';
import { type GardenEnvironment } from '@/lib/garden-world';

export default function GardenControls({ value, onChange, disabled = false }: { value: GardenEnvironment; onChange: (value: GardenEnvironment) => void; disabled?: boolean }) {
  return <fieldset className="message-test-panel" disabled={disabled}>
    <legend>Clima virtual de la huerta</legend>
    <label>Sol <select aria-label="Sol de la huerta" value={value.sun} onChange={event => onChange({ ...value, sun: event.target.value as GardenEnvironment['sun'] })}>
      <option value="low">Bajo</option><option value="medium">Medio</option><option value="strong">Fuerte</option>
    </select></label>
    <label>Temperatura exterior: {value.outsideTemperature} °C <input aria-label="Temperatura exterior de la huerta" type="range" min={5} max={40} step={1} value={value.outsideTemperature} onChange={event => onChange({ ...value, outsideTemperature: Number(event.target.value) })} /></label>
    <label><input type="checkbox" checked={value.rain} onChange={event => onChange({ ...value, rain: event.target.checked })} /> Lluvia en la huerta exterior</label>
    <label><input type="checkbox" checked={value.changingWeather} onChange={event => onChange({ ...value, changingWeather: event.target.checked })} /> Clima cambiante</label>
    <small>Condiciones virtuales: no modifican sensores físicos. Los cambios de temperatura son graduales. El programa decide riego y ventilación.</small>
  </fieldset>;
}
