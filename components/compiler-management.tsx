'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { sessionChangePending, watchSessionChange, type Session } from '@/lib/account-session';

type Settings = { concurrency: number; ceiling: number; paused: boolean; revision: number; available: boolean };
type Status = { settings: Settings; queued: number; building: number; recent: { framework: string; state: string; metrics: { seconds?: number; oomKilled?: boolean } }[]; csrfToken: string };

export default function CompilerManagement() {
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [locked, setLocked] = useState(true), [busy, setBusy] = useState(false);
  const account = useRef<string | null>(null), epoch = useRef(0), alive = useRef(true), sending = useRef(false), loading = useRef(false);
  const refresh = useCallback(async () => {
    if (!alive.current || loading.current || sending.current || sessionChangePending()) return;
    loading.current = true;
    const ticket = epoch.current;
    try {
      const sessionResponse = await fetch('/api/auth/session/', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!sessionResponse.ok) throw new Error('No pudimos verificar la sesión.');
      const session = await sessionResponse.json() as Session;
      if (!alive.current || ticket !== epoch.current) return;
      if (!session.user?.roles.includes('administrador') || session.user.mustChangePassword) {
        account.current = null; setStatus(null); setDraft(null); throw new Error('Ingresá con una cuenta administradora para continuar.');
      }
      if (account.current && account.current !== session.user.id) { setDraft(null); setStatus(null); }
      account.current = session.user.id;
      const response = await fetch('/api/management/compiler/', { headers: { 'X-Capi-Account': session.user.id }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('No pudimos verificar el acceso a las compilaciones.');
      const data = await response.json() as Status;
      if (!alive.current || ticket !== epoch.current) return;
      setStatus(data); setDraft(previous => previous ?? data.settings); setLocked(false);
    } catch (error) { if (alive.current && ticket === epoch.current) { setLocked(true); setError(error instanceof Error ? error.message : 'No se pudo actualizar.'); } }
    finally { loading.current = false; }
  }, []);
  useEffect(() => {
    alive.current = true; queueMicrotask(() => { if (alive.current) void refresh(); });
    const stop = watchSessionChange(() => { ++epoch.current; account.current = null; setStatus(null); setDraft(null); setLocked(true); void refresh(); });
    const focus = () => { void refresh(); };
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 10000);
    window.addEventListener('focus', focus);
    return () => {
      alive.current = false;
      // Logical request epoch, not a DOM ref.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++epoch.current;
      stop(); clearInterval(timer); window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  const dirty = !!(draft && status && (draft.concurrency !== status.settings.concurrency || draft.paused !== status.settings.paused));
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) {
      event.preventDefault();
      // Required fallback in browsers that still use returnValue for this prompt.
      // oxlint-disable-next-line typescript/no-deprecated
      event.returnValue = '';
    } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save() {
    if (!draft || !status || !account.current || locked || sending.current || sessionChangePending()) return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    const ticket = epoch.current;
    try {
      const response = await fetch('/api/management/compiler/', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Capi-Account': account.current, 'X-CSRFToken': status.csrfToken }, body: JSON.stringify({ revision: draft.revision, concurrency: draft.concurrency, paused: draft.paused }), signal: AbortSignal.timeout(12000) });
      const data = await response.json() as Status & { code?: string; error?: string };
      if (!alive.current || ticket !== epoch.current) return;
      if (!response.ok) { if ([401, 403].includes(response.status) || data.code === 'account_changed') { setLocked(true); setStatus(null); setDraft(null); } throw new Error(data.error || 'No se pudo guardar.'); }
      setStatus(data); setDraft(data.settings); setNotice('Configuración guardada. Los trabajos activos no se interrumpen.');
    } catch (error) { if (alive.current && ticket === epoch.current) setError(error instanceof Error ? error.message : 'No recibimos confirmación. Actualizá para comprobar el resultado antes de repetir.'); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  return <main className="account-page"><section className="account-card compiler-management">
    <Link href="/cuenta/" prefetch={false} onClick={event => { if (dirty && !window.confirm('¿Salir sin guardar la configuración?')) event.preventDefault(); }}>← Mi cuenta</Link>
    <h1>⚙️ Compilaciones</h1><p>Una cola para Arduino y ESP-IDF. El administrador ajusta la capacidad, sin ver proyectos ni claves de otras personas.</p>
    {error && <p role="alert" className="account-error">{error}</p>}{notice && <output className="account-notice">{notice}</output>}
    <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Actualizar estado</Button>
    {status && draft && <><p>{status.settings.available ? 'Compilador conectado' : 'Compilador sin conexión'} · {status.queued} en cola · {status.building} compilando</p>
      <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={locked || busy}>
        <label htmlFor="compiler-concurrency">Compilaciones simultáneas</label><select id="compiler-concurrency" value={draft.concurrency} onChange={event => setDraft({ ...draft, concurrency: Number(event.target.value) })}>{Array.from({ length: status.settings.ceiling }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select>
        <p>Techo operativo: {status.settings.ceiling}. Aumentarlo requiere medir recursos y preparar capacidad en el servidor. Bajar el límite deja terminar los trabajos activos.</p>
        <label><input type="checkbox" checked={draft.paused} onChange={event => setDraft({ ...draft, paused: event.target.checked })} /> Pausar pedidos y nuevos arranques</label>
        <p>La pausa conserva la cola y no interrumpe compilaciones en curso.</p>
        {draft.revision !== status.settings.revision && <p role="alert">La configuración cambió. Cancelá tu edición para cargar la versión vigente antes de guardar.</p>}
        <div className="account-actions"><Button type="submit" disabled={!dirty || draft.revision !== status.settings.revision}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button><Button type="button" variant="outline" onClick={() => { setDraft(status.settings); setError(''); setNotice('Edición cancelada. Se muestra la configuración vigente.'); }}>Cancelar edición</Button></div>
      </fieldset></form>
      <h2>Últimos resultados (sin datos de alumnos)</h2>
      {!status.recent.length ? <p>Todavía no hay mediciones.</p> : <ul>{status.recent.map((item, index) => <li key={index}>{item.framework} · {item.state} · {item.metrics.seconds == null ? 'sin duración registrada' : `${Math.round(item.metrics.seconds)} s`}{item.metrics.oomKilled ? ' · límite de memoria alcanzado' : ''}</li>)}</ul>}
    </>}
    <p className="account-help">Los binarios privados vencen a las 24 horas. El proyecto y su historial no se eliminan. La clave Wi-Fi pendiente se cifra y se retira al terminar, cancelar o vencer el pedido; un binario Wi-Fi contiene esa clave. No se comparten cachés de resultados entre cuentas.</p>
  </section></main>;
}
