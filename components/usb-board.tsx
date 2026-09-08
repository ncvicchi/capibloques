'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { sessionChangePending, watchSessionChange, type Account, type AccountDraftStore } from '@/lib/account-session';
import { authorizeUsbFirmware, fetchUsbFirmware, type FirmwareJob } from '@/lib/usb-firmware';
import { createEspDriver } from '@/lib/usb-esptool';
import { UsbError, UsbSession, usbBusy } from '@/lib/usb-session';

export default function UsbBoard(props: { account: Account; store: AccountDraftStore; job: FirmwareJob | null; currentFingerprint: string; onClose: () => void; onBuilds: () => void }) {
  const [session, setSession] = useState<UsbSession | null>(null);
  useEffect(() => {
    const current = new UsbSession(createEspDriver);
    let alive = true;
    queueMicrotask(() => { if (alive) setSession(current); });
    return () => { alive = false; current.dispose(); };
  }, []);
  return session ? <UsbPanel {...props} session={session} /> : null;
}

function UsbPanel({ account, store, job, currentFingerprint, onClose, onBuilds, session }: { account: Account; store: AccountDraftStore; job: FirmwareJob | null; currentFingerprint: string; onClose: () => void; onBuilds: () => void; session: UsbSession }) {
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [identified, setIdentified] = useState(false), [safe, setSafe] = useState(false), [replace, setReplace] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [follow, setFollow] = useState(true);
  const busy = usbBusy(state), monitoring = state.stage === 'monitor';
  const available = window.isSecureContext && 'serial' in navigator;
  const usable = () => store.active && store.remoteAllowed && !sessionChangePending();
  const differs = job && (store.remote?.id !== job.projectId || store.remote.revision !== job.revision || store.remote.savedFingerprint !== currentFingerprint);

  useEffect(() => {
    let alive = true, checking = false;
    const revoke = () => { if (!alive) return; setRevoked(true); session.clearText(); session.cancel(new UsbError('La sesión cambió o perdió conexión con el servidor. Cerramos USB.')); };
    const stop = watchSessionChange(revoke);
    const checkStore = () => { if (!store.active || !store.remoteAllowed || sessionChangePending()) revoke(); };
    const unsubscribe = store.subscribe(checkStore);
    const checkSession = async () => {
      if (checking) return; checking = true;
      try {
        const response = await fetch('/api/auth/session/', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!response.ok || (await response.json() as { user?: Account }).user?.id !== account.id) revoke();
      } catch { revoke(); }
      finally { checking = false; }
    };
    const timer = window.setInterval(() => { checkStore(); void checkSession(); }, 10000);
    const disconnected = (event: Event) => session.disconnected(event.target);
    navigator.serial?.addEventListener('disconnect', disconnected);
    const unload = (event: BeforeUnloadEvent) => { if (usbBusy(session.state)) event.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    checkStore();
    return () => { alive = false; stop(); unsubscribe(); clearInterval(timer); navigator.serial?.removeEventListener('disconnect', disconnected); window.removeEventListener('beforeunload', unload); };
  }, [account.id, session, store]);

  const requestPort = () => navigator.serial.requestPort();
  function flash() {
    if (!available || !job || !identified || !safe || !replace || revoked || !usable()) return;
    session.flash(requestPort,
      signal => fetchUsbFirmware(job, account.id, AbortSignal.any([signal, AbortSignal.timeout(30000)]), usable),
      signal => authorizeUsbFirmware(job, account.id, AbortSignal.any([signal, AbortSignal.timeout(12000)]), usable));
  }
  function monitor() {
    if (!available || !identified || !safe || revoked || !usable()) return;
    session.monitor(() => {
      // Keep the port selector inside the user gesture, then verify identity
      // again before opening the selected port (which itself may reset boards).
      const selection = requestPort();
      return selection.then(async port => {
        const response = await fetch('/api/auth/session/', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!response.ok || (await response.json() as { user?: Account }).user?.id !== account.id || !usable()) throw new UsbError('Tu sesión cambió. Volvé a ingresar antes de conectar USB.');
        return port;
      });
    });
  }
  function cancel() {
    if (state.writingStarted && !window.confirm('¿Interrumpir la grabación? Puede quedar incompleta y la Wemos no arrancará hasta volver a grabar el firmware entero. No es Deshacer.')) return;
    session.cancel();
  }
  const close = () => { if (!busy && !monitoring) onClose(); };
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="firmware-dialog usb-dialog" showCloseButton={!busy && !monitoring}>
    <DialogHeader><DialogTitle>🔌 USB y monitor Serial</DialogTitle><DialogDescription>La Wemos se conecta por USB a esta PC, no al servidor. Chrome o Edge de escritorio · Wemos D1 R32.</DialogDescription></DialogHeader>
    {!available && <p role="alert" className="account-error">Este navegador o dirección no permite Web Serial. Abrí Chrome o Edge de escritorio en HTTPS o en localhost. Una IP LAN por HTTP no sirve. Podés seguir descargando el firmware y grabarlo con esptool.</p>}
    {revoked && <p role="alert" className="account-error">La sesión cambió o no pudimos verificarla. Cerrá esta ventana y recuperá la conexión antes de volver a usar USB.</p>}
    <section className="usb-target">
      {job ? <><h3>{job.title} · versión {job.revision} · {job.framework === 'arduino' ? 'Arduino' : 'ESP-IDF'}</h3><p>Se grabará esta versión compilada, no el estado actual del editor. Vence: {new Date(job.expiresAt).toLocaleString()}.</p>
        {differs && <p className="account-notice">Esta compilación no corresponde a los cambios actuales del editor. Para incluirlos, guardá y compilá de nuevo.</p>}
        {job.containsWifi && <p>🔒 Este firmware contiene la configuración Wi-Fi. Sólo pasa del servidor privado a la memoria de esta pestaña y a la placa; no se guarda en el navegador. Cambiar el firmware no garantiza borrar residuos de claves anteriores.</p>}
      </> : <p>Para grabar, elegí un firmware listo en Mis pedidos. El monitor puede leer un programa que ya tenga la placa.</p>}
    </section>
    <fieldset className="usb-checks" disabled={busy || monitoring || revoked}>
      <legend>Antes de conectar, revisá con una persona adulta</legend>
      <label><input type="checkbox" checked={identified} onChange={event => setIdentified(event.target.checked)} /> Identifiqué mi Wemos D1 R32 y su cable USB de datos. No es otra placa.</label>
      <label><input type="checkbox" checked={safe} onChange={event => setSafe(event.target.checked)} /> Motores y actuadores desconectados; alimentación y cableado seguros. Abrir USB puede reiniciar la placa.</label>
      {job && <label><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} /> Quiero reemplazar el programa de la Wemos por esta versión. No hay Deshacer ni respaldo automático del firmware anterior.</label>}
    </fieldset>
    <div className="usb-status" aria-live="polite" role={state.stage === 'error' ? 'alert' : 'status'}>
      <strong>{state.message}</strong>{state.chip && <span>{state.chip}</span>}
      {(state.writingStarted || state.stage === 'writing') && <><progress aria-label="Progreso de grabación" value={state.progress} max={100} /><span>{state.progress}% · {state.stage === 'done' ? 'Verificación terminada' : 'Incluye escritura y verificación'}</span></>}
    </div>
    <div className="usb-actions">
      {!busy && !monitoring && <>
        {job && <Button disabled={!available || !identified || !safe || !replace || revoked} onClick={flash}>Elegir Wemos y grabar</Button>}
        <Button variant="outline" disabled={!available || !identified || !safe || revoked} onClick={monitor}>Elegir puerto y abrir monitor</Button>
        <Button variant="outline" disabled={revoked} onClick={onBuilds}>Mis pedidos de firmware</Button>
      </>}
      {(busy || monitoring) && <Button variant="outline" disabled={state.stage === 'closing'} onClick={cancel}>{monitoring ? 'Cerrar monitor y liberar USB' : state.stage === 'closing' ? 'Liberando USB…' : state.writingStarted ? 'Interrumpir grabación…' : 'Cancelar conexión'}</Button>}
    </div>
    {(monitoring || state.text) && <section className="usb-monitor"><div className="firmware-heading"><h3>Mensajes reales de la placa</h3><Button variant="outline" onClick={() => session.clearText()}>Limpiar mensajes</Button></div>
      <label><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} /> Seguir nuevos mensajes</label>
      {/* Keyboard focus is required to scroll this read-only, bounded viewport. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <pre aria-label="Mensajes Serial de la placa" tabIndex={0} ref={element => { if (element && follow) element.scrollTop = element.scrollHeight; }}>{state.text || 'Esperando mensajes… Si el programa ya los envió, presioná RESET en la placa para repetirlos.'}</pre>
      <p className="account-help">Sólo lectura · últimas 200 líneas / 32 KiB · no se envían al servidor ni se guardan. Es distinto de la consola del simulador.</p>
    </section>}
    <details><summary>¿No aparece o no conecta?</summary><p>Usá un cable de datos, cerrá Arduino IDE y otros monitores y seleccioná sólo la placa identificada. Si no entra al cargador, mantené BOOT durante la conexión y soltalo al detectar el chip; algunas placas requieren pulsar RESET. Si se cortó una grabación, repetila completa. No se borra toda la flash ni NVS automáticamente.</p></details>
    <p className="account-help">Cerrar USB o detener el simulador no detiene el programa físico. La Wemos funciona por su cuenta: desconectá su alimentación para detenerla con seguridad.</p>
    <Button variant="outline" disabled={busy || monitoring} onClick={close}>Cerrar y seguir programando</Button>
  </DialogContent></Dialog>;
}
