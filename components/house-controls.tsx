'use client';
import type { HouseEnvironment } from '@/lib/house-world';
export default function HouseControls({ value, onChange, onSend, pending = false, disabled = false }: { value: HouseEnvironment; onChange: (value: HouseEnvironment) => void; onSend?: () => void; pending?: boolean; disabled?: boolean }) {
  return <fieldset className="message-test-panel" disabled={disabled}><legend>Casa virtual</legend>
    <label><input type="checkbox" checked={value.night} onChange={e => onChange({ ...value, night: e.target.checked })} /> Es de noche</label>
    <label><input type="checkbox" checked={value.automaticDay} onChange={e => onChange({ ...value, automaticDay: e.target.checked })} /> Ciclo automático día/noche</label>
    <label><input type="checkbox" checked={value.automaticArrivals} onChange={e => onChange({ ...value, automaticArrivals: e.target.checked })} /> Llegadas automáticas</label>
    <label>Visitante para envío manual <select aria-label="Tipo de visitante" value={value.nextVisitor} onChange={e => onChange({ ...value, nextVisitor: e.target.value as HouseEnvironment['nextVisitor'] })}><option value="known">Tarjeta azul</option><option value="unknown">Tarjeta roja</option><option value="none">Sin tarjeta</option></select></label>
    {onSend && <button type="button" disabled={disabled || pending} onClick={onSend}>{pending ? 'Visitante esperando su turno' : 'Enviar visitante'}</button>}
    <small>Las llegadas automáticas mezclan tipos. El programa decide qué tarjeta acepta; una puerta abierta no verifica identidad. Simulación educativa, no sistema de seguridad real.</small>
  </fieldset>;
}
