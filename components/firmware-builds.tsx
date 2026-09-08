'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { projectFingerprint } from '@/lib/project-library';
import { sessionChangePending, watchSessionChange, type Account, type AccountDraftStore } from '@/lib/account-session';
import { type FirmwareFramework, type ProjectFile } from '@/lib/capiblocks';
import { downloadFirmwareArchive, sha256 } from '@/lib/firmware-archive';

type Job = { id: string; projectId: string; revision: number; title: string; framework: FirmwareFramework; state: string; containsWifi: boolean; createdAt: string; expiresAt: string; message: string; sha256: string | null; bytes: number; metrics: { seconds?: number } };
type Listing = { jobs: Job[]; settings: { paused: boolean; available: boolean; concurrency: number }; csrfToken: string };
type Request = { id: string; projectId: string; revision: number; framework: FirmwareFramework; wiringReviewed: true; wifi: { ssid: string; password: string; consent: true } | null };
const labels: Record<string, string> = { queued: '⏳ En cola', building: '⚙️ Compilando', ready: '✅ Listo', failed: 'No se pudo compilar', cancelled: 'Cancelado / retirado', expired: 'Vencido' };

export default function FirmwareBuilds({ account, store, csrfToken, capture, fingerprint, validate, onClose }: {
  account: Account; store: AccountDraftStore; csrfToken: string; capture: () => ProjectFile; fingerprint: string;
  validate: (framework: FirmwareFramework) => { wifi: boolean } | null; onClose: () => void;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [framework, setFramework] = useState<FirmwareFramework>('arduino');
  const [wifi, setWifi] = useState(false);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [locked, setLocked] = useState(false);
  const [remote, setRemote] = useState(store.remote);
  const epoch = useRef(0), alive = useRef(true), pending = useRef<Request | null>(null), inFlight = useRef(false), fetching = useRef(false);
  const token = useRef(csrfToken);
  const headers = useCallback(() => ({ 'Content-Type': 'application/json', 'X-Capi-Account': account.id, 'X-CSRFToken': token.current }), [account.id]);
  const clearSecrets = useCallback(() => { pending.current = null; setSsid(''); setPassword(''); setConsent(false); setUncertain(false); }, []);
  const revoke = useCallback(() => { ++epoch.current; clearSecrets(); setListing(null); setLocked(true); setError('Tu sesión cambió. Cerrá esta ventana e ingresá nuevamente.'); }, [clearSecrets]);
  const usable = useCallback(() => alive.current && store.active && store.remoteAllowed && !sessionChangePending(), [store]);

  const refresh = useCallback(async () => {
    if (!usable() || fetching.current) return;
    fetching.current = true;
    const ticket = epoch.current;
    try {
      const response = await fetch('/api/builds/', { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!usable() || ticket !== epoch.current) return;
      if ([401, 403, 409].includes(response.status)) { revoke(); return; }
      if (!response.ok) throw new Error();
      const data = await response.json() as Listing;
      if (!usable() || ticket !== epoch.current) return;
      token.current = data.csrfToken;
      setListing(data); setLocked(false);
      if (pending.current && data.jobs.some(job => job.id === pending.current?.id)) {
        clearSecrets(); setNotice('Pedido recibido. Podés cerrar y seguir programando.');
      }
    } catch { if (ticket === epoch.current && alive.current) { setLocked(true); setError('No pudimos actualizar la cola. Tus pedidos siguen en el servidor; reintentá la conexión.'); } }
    finally { fetching.current = false; }
  }, [clearSecrets, headers, revoke, usable]);

  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => { if (alive.current) void refresh(); });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
    const stop = watchSessionChange(revoke);
    const unsubscribe = store.subscribe(() => setRemote(store.remote));
    return () => {
      alive.current = false;
      // Logical request epoch, not a DOM ref.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++epoch.current;
      pending.current = null; window.clearInterval(timer); stop(); unsubscribe();
    };
  }, [refresh, revoke, store]);

  async function enqueue() {
    if (!usable() || inFlight.current || locked) return;
    const link = store.remote, document = capture();
    if (!pending.current) {
      if (!link || store.pending || link.savedFingerprint !== projectFingerprint(document)) { setError('Primero guardá todos los cambios con Guardar. No compilamos una versión distinta sin avisarte.'); return; }
      const result = validate(framework);
      if (!result) { onClose(); return; }
      if (result.wifi && !wifi) { setWifi(true); setError('Este programa usa Wi-Fi. Completá la red y confirmá el envío privado antes de compilar.'); return; }
      if (result.wifi && !consent) { setError('Confirmá el tratamiento privado de la clave Wi-Fi.'); return; }
      pending.current = { id: crypto.randomUUID(), projectId: link.id, revision: link.revision, framework, wiringReviewed: true,
        wifi: result.wifi ? { ssid, password, consent: true } : null };
    }
    const ticket = epoch.current;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/builds/', { method: 'POST', headers: headers(), body: JSON.stringify(pending.current), signal: AbortSignal.timeout(15000) });
      if (!usable() || ticket !== epoch.current) return;
      if ([401, 403].includes(response.status)) { revoke(); return; }
      const data = await response.json() as { error?: string; code?: string; job?: Job };
      if (!usable() || ticket !== epoch.current) return;
      if (!response.ok) {
        if (data.code === 'account_changed') { revoke(); return; }
        pending.current = null; setUncertain(false); setError(data.error || 'No se pudo aceptar el pedido.'); return;
      }
      clearSecrets(); setNotice('Pedido recibido. Podés cerrar y seguir programando.');
      await refresh();
    } catch { if (ticket === epoch.current && alive.current) { setUncertain(true); setError('Se perdió la respuesta. Reintentar conserva el mismo pedido y no duplica la compilación. No cambies la red hasta conocer el resultado.'); } }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }

  async function action(job: Job, download: boolean) {
    if (!usable() || inFlight.current || locked) return;
    const ticket = epoch.current;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/builds/${job.id}/${download ? 'download/' : ''}`, { method: download ? 'GET' : 'DELETE', headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(30000) });
      if (!usable() || ticket !== epoch.current) return;
      if ([401, 403, 409].includes(response.status)) {
        const data = await response.json() as { error?: string; code?: string };
        if (data.code === 'account_changed' || response.status !== 409) { revoke(); return; }
        throw new Error(data.error);
      }
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error || 'El pedido ya no está disponible.');
      if (download) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 5_000_000 || await sha256(bytes) !== job.sha256) throw new Error('La descarga no coincide con el firmware. Volvé a intentar.');
        // Revalidate authorization after the asynchronous private download/hash.
        const current = await fetch(`/api/builds/${job.id}/`, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(12000) });
        if (!usable() || ticket !== epoch.current) return;
        if (!current.ok) throw new Error('El acceso o el pedido cambió. No iniciamos la descarga.');
        const latest = (await current.json() as { job: Job }).job;
        if (!usable() || ticket !== epoch.current) return;
        if (latest.state !== 'ready' || latest.sha256 !== job.sha256) throw new Error('El firmware venció o fue retirado.');
        downloadFirmwareArchive(`capibloques-${job.framework}-r${job.revision}-${job.id}.zip`, bytes);
        setNotice(job.containsWifi ? 'Firmware descargado: contiene la clave Wi-Fi. Guardalo en un lugar privado.' : 'Firmware completo descargado. Seguí las instrucciones del ZIP.');
      } else { setNotice('Pedido cancelado o firmware retirado. No se borran copias descargadas ni proyectos.'); await refresh(); }
    } catch (error) { if (ticket === epoch.current && alive.current) setError(error instanceof Error ? error.message : 'No se pudo completar. Reintentá.'); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }

  const saved = remote && !store.pending && remote.savedFingerprint === fingerprint;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="firmware-dialog">
    <DialogHeader><DialogTitle>⚙️ Compilar y descargar firmware</DialogTitle><DialogDescription>Wemos D1 R32 · El servidor compila una versión guardada. Podés cerrar esta ventana y seguir usando el editor.</DialogDescription></DialogHeader>
    {error && <p role="alert" className="account-error">{error}</p>}
    {notice && <output className="account-notice">{notice}</output>}
    <p>{saved ? `Proyecto guardado · versión ${remote.revision}` : 'Hay cambios sin guardar o el proyecto todavía es local. Cerrá esta ventana y usá Guardar antes de compilar.'}</p>
    <form onSubmit={event => { event.preventDefault(); void enqueue(); }}>
      <fieldset disabled={busy || uncertain || locked}>
        <label>Herramientas <select aria-label="Herramientas de compilación" value={framework} onChange={event => { setFramework(event.target.value as FirmwareFramework); setWifi(false); clearSecrets(); }}><option value="arduino">Arduino 3.3.11</option><option value="esp-idf">ESP-IDF 5.5.5 (nativo)</option></select></label>
        {wifi && <section className="firmware-wifi"><h3>📶 Red Wi-Fi de la placa</h3>
          <p>Red de 2,4 GHz. La clave viaja al servidor, se cifra mientras espera y se retira al terminar. No se guarda en el proyecto ni en su historial. El firmware sí contiene la clave.</p>
          <label htmlFor="firmware-ssid">Nombre de la red (SSID)</label><Input id="firmware-ssid" autoComplete="off" value={ssid} maxLength={32} onChange={event => setSsid(event.target.value)} />
          <label htmlFor="firmware-password">Clave Wi-Fi (vacía si la red es abierta)</label><Input id="firmware-password" type="password" autoComplete="off" value={password} maxLength={63} onChange={event => setPassword(event.target.value)} />
          <label className="firmware-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Autorizo el envío privado y temporal. Entiendo que no debo compartir el firmware.</label>
        </section>}
      </fieldset>
      <Button type="submit" disabled={busy || locked || !listing || listing.settings.paused || !listing.settings.available || (!saved && !uncertain)}>{busy ? 'Enviando…' : uncertain ? 'Reintentar el mismo pedido' : 'Compilar versión guardada'}</Button>
    </form>
    {listing && (!listing.settings.available || listing.settings.paused) && <p className="account-notice">El compilador no está disponible o está en pausa. Tus proyectos y pedidos se conservan.</p>}
    <div className="firmware-heading"><h3>Mis pedidos recientes</h3><Button variant="outline" disabled={busy} onClick={() => void refresh()}>Actualizar</Button></div>
    <p className="account-help">Hasta 3 pedidos pendientes por persona. Archivos privados durante 24 horas; registros durante 7 días. Descargar no programa todavía la placa desde la web.</p>
    {!listing ? <p>Consultando la cola…</p> : !listing.jobs.length ? <p>Todavía no pediste ninguna compilación.</p> : <ul className="firmware-jobs">{listing.jobs.map(job => <li key={job.id}>
      <strong>{job.title} · v{job.revision} · {job.framework === 'arduino' ? 'Arduino' : 'ESP-IDF'}</strong>
      <span>{labels[job.state] ?? job.state}{job.metrics.seconds != null ? ` · ${Math.round(job.metrics.seconds)} s` : ''}</span>
      {remote?.id === job.projectId && (remote.revision !== job.revision || !saved) && <p className="account-notice">Esta compilación no incluye los cambios actuales del editor.</p>}
      {job.message && <p>{job.message}</p>}
      {job.containsWifi && <p>🔒 Contiene configuración Wi-Fi. No compartir el firmware.</p>}
      {job.state === 'ready' && <><small>Vence: {new Date(job.expiresAt).toLocaleString()}</small><Button disabled={busy || locked} onClick={() => void action(job, true)}>Descargar firmware completo</Button></>}
      {['queued', 'ready'].includes(job.state) && <Button variant="outline" disabled={busy || locked} onClick={() => { if (job.state === 'queued' || window.confirm('¿Retirar este firmware y sus resultados reutilizados de este proyecto? No se borra el proyecto ni las copias descargadas.')) void action(job, false); }}>{job.state === 'queued' ? 'Cancelar pedido' : 'Retirar firmware'}</Button>}
    </li>)}</ul>}
    <Button variant="outline" onClick={onClose}>Cerrar y seguir programando</Button>
  </DialogContent></Dialog>;
}
