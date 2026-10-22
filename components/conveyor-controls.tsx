'use client';
import type { ConveyorEnvironment } from '@/lib/conveyor-world';
export default function ConveyorControls({ value, onChange, onSend, pending = false, disabled = false }: { value: ConveyorEnvironment; onChange: (v: ConveyorEnvironment) => void; onSend?: () => void; pending?: boolean; disabled?: boolean }) {
  return <fieldset className="message-test-panel" disabled={disabled}><legend>Taller virtual</legend>
    <label><input type="checkbox" checked={value.automaticArrivals} onChange={e => onChange({ ...value, automaticArrivals: e.target.checked })} /> Llegadas automáticas</label>
    <label>Color del paquete manual <select aria-label="Color del paquete" value={value.color} onChange={e => onChange({ ...value, color: e.target.value as ConveyorEnvironment['color'] })}><option value="red">Rojo</option><option value="blue">Azul</option><option value="green">Verde</option></select></label>
    <label>Peso del paquete manual (g) <input aria-label="Peso del paquete" type="number" min="100" max="1000" value={value.weight} onChange={e => { const weight = e.target.valueAsNumber; if (Number.isFinite(weight) && weight >= 100 && weight <= 1000) onChange({ ...value, weight }); }} /></label>
    {onSend && <button type="button" disabled={disabled || pending} onClick={onSend}>{pending ? 'Paquete esperando ingreso' : 'Enviar paquete'}</button>}
    <small>Automático mezcla colores y pesos. Para pesar, detené el paquete en lectura durante 0,6 s. Un atasco requiere Reiniciar escena. La cinta sólo avanza o se detiene.</small>
  </fieldset>;
}
