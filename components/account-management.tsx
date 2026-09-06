'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Plus, RefreshCw, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { announceSessionChange, sessionChangePending, watchSessionChange, type Account } from '@/lib/account-session';
import { downloadText } from '@/lib/capiblocks';

type ManagedUser = Account & { isActive: boolean; createdAt: string; version: string };
type Listing = { actor: Account; csrfToken: string; users: ManagedUser[]; count: number; page: number; pageSize: number };
type Mode = 'create' | 'edit' | 'password' | 'delete';
type Draft = { alias: string; displayName: string; role: string; isActive: boolean; password: string; confirmation: string; confirmationAlias: string; understandsLocalDrafts: boolean };
const roles = [{ value: 'alumno', label: 'Alumno' }, { value: 'docente', label: 'Docente' }, { value: 'administrador', label: 'Administrador' }, { value: 'administrador,docente', label: 'Administrador y docente' }];
const emptyDraft = (): Draft => ({ alias: '', displayName: '', role: 'alumno', isActive: true, password: '', confirmation: '', confirmationAlias: '', understandsLocalDrafts: false });

export default function AccountManagement() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [locked, setLocked] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<Mode | null>(null);
  const [target, setTarget] = useState<ManagedUser | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const owner = useRef<string | null>(null);
  const filters = useRef({ q: '', role: '', active: '', page: 1 });
  const [baseline, setBaseline] = useState('');
  const dirty = mode !== null && JSON.stringify(draft) !== baseline;

  const closeForm = useCallback(() => {
    setMode(null); setTarget(null); setDraft(emptyDraft()); setShowPassword(false); setFormError(''); setDiscard(false);
  }, []);
  const lock = useCallback(() => { document.documentElement.dataset.editorLocked = 'true'; setLocked(true); }, []);
  const clearPrivate = useCallback(() => { setListing(null); owner.current = null; closeForm(); }, [closeForm]);

  const refresh = useCallback(async (hide = false) => {
    if (inFlight.current) return;
    if (sessionChangePending()) { lock(); return; }
    const ticket = ++epoch.current;
    if (hide) lock();
    setRefreshing(true); setError('');
    try {
      const response = await fetch(`/api/management/users/?${new URLSearchParams({ ...filters.current, page: String(filters.current.page) })}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (ticket !== epoch.current) return;
      if (response.status === 401 || response.status === 403) {
        clearPrivate(); lock();
        setError('Necesitás una cuenta administradora con contraseña definitiva para gestionar usuarios.');
        return;
      }
      if (!response.ok) throw new Error();
      const data = await response.json() as Listing;
      if (ticket !== epoch.current) return;
      if (!data.actor?.roles.includes('administrador') || !Array.isArray(data.users) || !data.csrfToken) throw new Error();
      if (owner.current && owner.current !== data.actor.id) closeForm();
      owner.current = data.actor.id;
      filters.current.page = data.page;
      setListing(data);
      if (document.visibilityState === 'visible') { delete document.documentElement.dataset.editorLocked; setLocked(false); }
    } catch {
      if (ticket === epoch.current) { lock(); setError('No pudimos verificar el acceso. Reintentá la conexión; no se enviaron cambios desde esta verificación.'); }
    } finally { if (ticket === epoch.current) setRefreshing(false); }
  }, [clearPrivate, closeForm, lock]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void refresh(true); });
    const focus = () => { void refresh(true); };
    const visibility = () => {
      if (document.visibilityState === 'hidden') { ++epoch.current; lock(); }
      else void refresh(true);
    };
    const stop = watchSessionChange(changing => {
      // No descartar un formulario por el aviso propio al completar su escritura.
      ++epoch.current; lock();
      if (inFlight.current) return;
      if (changing) clearPrivate(); else void refresh(true);
    });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    window.addEventListener('focus', focus); window.addEventListener('pageshow', focus); document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      // Contador de solicitudes, no referencia a un nodo DOM.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++epoch.current;
      stop(); window.clearInterval(timer); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus); document.removeEventListener('visibilitychange', visibility);
      delete document.documentElement.dataset.editorLocked;
    };
  }, [clearPrivate, lock, refresh]);

  function openForm(nextMode: Mode, user: ManagedUser | null = null) {
    const next = user ? { ...emptyDraft(), alias: user.alias, displayName: user.displayName, role: user.roles.join(','), isActive: user.isActive } : emptyDraft();
    setTarget(user); setDraft(next); setBaseline(JSON.stringify(next)); setMode(nextMode); setFormError(''); setShowPassword(false); setNotice('');
  }
  function requestClose() { if (!inFlight.current) { if (dirty) setDiscard(true); else closeForm(); } }
  function update<K extends keyof Draft>(field: K, value: Draft[K]) { setDraft(previous => ({ ...previous, [field]: value })); }

  async function save() {
    if (!mode || !listing || inFlight.current || locked) return;
    inFlight.current = true; ++epoch.current; setBusy(true); setFormError('');
    const operation = mode;
    const url = `/api/management/users/${target ? `${target.id}/` : ''}${mode === 'password' ? 'password/' : ''}`;
    const profile = { alias: draft.alias, displayName: draft.displayName, roles: draft.role.split(','), isActive: draft.isActive };
    const credentials = { temporaryPassword: draft.password, confirmation: draft.confirmation };
    const payload = mode === 'create' ? { ...profile, ...credentials } : mode === 'edit' ? { ...profile, version: target!.version }
      : mode === 'password' ? { ...credentials, version: target!.version }
        : { version: target!.version, confirmationAlias: draft.confirmationAlias, understandsLocalDrafts: draft.understandsLocalDrafts };
    let succeeded = false;
    try {
      const response = await fetch(url, { method: mode === 'edit' ? 'PATCH' : mode === 'delete' ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': listing.csrfToken }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      const result = await response.json() as { error?: string; code?: string; sessionEnded?: boolean };
      if (response.status === 401 || response.status === 403) {
        clearPrivate(); lock(); setError('Tu sesión o permiso cambió. Volvé a Mi cuenta e ingresá nuevamente.');
        return;
      }
      if (!response.ok) { setFormError(result.error || 'No pudimos guardar. Revisá los datos.'); return; }
      succeeded = true; closeForm();
      if (result.sessionEnded) { announceSessionChange(); window.location.replace('/cuenta/'); return; }
      setNotice(operation === 'create' ? 'Cuenta creada. Entregá la contraseña temporal en privado; deberá cambiarla al ingresar.'
        : operation === 'password' ? 'Contraseña temporal guardada. Las sesiones de esa cuenta quedaron cerradas.'
          : operation === 'delete' ? 'Cuenta eliminada definitivamente. Los archivos JSON exportados no se borraron.' : 'Cambios guardados. Si cambiaste el acceso, las sesiones anteriores quedaron cerradas.');
      announceSessionChange();
    } catch {
      setFormError('Se interrumpió la conexión y no podemos confirmar el resultado. Cancelá y actualizá el listado antes de repetir.');
    } finally {
      inFlight.current = false; setBusy(false);
      if (succeeded || document.documentElement.dataset.editorLocked === 'true') void refresh();
    }
  }

  const accessMessage = <>{error ? <p role="alert" className="account-error">{error}</p> : <output>Comprobando acceso administrativo…</output>}
    <div className="account-actions"><Button className="account-action" onClick={() => void refresh(true)}>Reintentar</Button><Link className="account-back" href="/cuenta/" prefetch={false}>Ir a Mi cuenta</Link></div></>;
  const title = mode === 'create' ? 'Crear usuario' : mode === 'edit' ? 'Editar usuario' : mode === 'password' ? 'Restablecer contraseña' : 'Eliminar cuenta definitivamente';
  const formFields = <>
    {formError && <p className="account-error" role="alert">{formError}</p>}
    {(mode === 'create' || mode === 'edit') && <>
      <label htmlFor="managed-alias">Alias</label><Input id="managed-alias" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={32} value={draft.alias} onChange={event => update('alias', event.target.value)} />
      <label htmlFor="managed-name">Nombre visible</label><Input id="managed-name" required maxLength={80} value={draft.displayName} onChange={event => update('displayName', event.target.value)} />
      <span id="managed-role-label">Rol</span><RadioGroup aria-labelledby="managed-role-label" value={draft.role} onValueChange={value => update('role', String(value))} className="management-roles">{roles.map(item => <label key={item.value}><RadioGroupItem value={item.value} />{item.label}</label>)}</RadioGroup>
      <label className="management-check" htmlFor="managed-active"><Checkbox id="managed-active" checked={draft.isActive} onCheckedChange={value => update('isActive', value)} />Cuenta activa</label>
      <p className="account-help">Desactivar impide ingresar y cierra sesiones; reactivar conserva la identidad de la cuenta. Docente no concede acceso a cursos todavía.</p>
    </>}
    {(mode === 'create' || mode === 'password') && <>
      {target && <p>Para <strong>{target.displayName}</strong> (@{target.alias}). No muestra ni recupera su contraseña anterior.</p>}
      <label htmlFor="managed-password">Contraseña temporal</label><Input id="managed-password" autoComplete="new-password" type={showPassword ? 'text' : 'password'} minLength={10} maxLength={256} required value={draft.password} onChange={event => update('password', event.target.value)} />
      <label htmlFor="managed-confirmation">Repetir contraseña temporal</label><Input id="managed-confirmation" autoComplete="new-password" type={showPassword ? 'text' : 'password'} minLength={10} maxLength={256} required value={draft.confirmation} onChange={event => update('confirmation', event.target.value)} />
      <Button type="button" variant="ghost" className="account-reveal" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff /> : <Eye />}{showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Button>
      <p className="account-help">Al menos 10 caracteres. Una frase sirve; evitá contraseñas comunes, sólo números o el alias. La persona elegirá su clave definitiva al ingresar.</p>
    </>}
  </>;

  return <>
    {!listing && <main className="account-page session-cover"><section className="account-card"><h1>Gestión de usuarios</h1>{accessMessage}</section></main>}
    {listing && <>
      <main className="management-page" inert={locked} aria-hidden={locked || undefined}>
        <header className="management-header"><div><Link className="account-back" href="/cuenta/" prefetch={false}><ArrowLeft size={18} /> Mi cuenta</Link><h1><Users aria-hidden="true" /> Usuarios</h1><p>Administración de cuentas · {listing.actor.displayName}</p></div><Button className="account-action" onClick={() => openForm('create')}><Plus />Crear usuario</Button></header>
        {notice && <output className="account-notice">{notice}</output>}
        <section className="management-panel" aria-label="Listado de usuarios">
          <form className="management-search" onSubmit={event => { event.preventDefault(); filters.current = { q: query.trim(), role, active: inactiveOnly ? 'false' : '', page: 1 }; void refresh(); }}>
            <label className="management-search-input" htmlFor="managed-search">Buscar por alias o nombre<Input id="managed-search" maxLength={80} value={query} onChange={event => setQuery(event.target.value)} /></label>
            <Button type="submit" className="account-action" disabled={refreshing}><Search />Buscar</Button>
            <Button type="button" variant="outline" className="account-action" disabled={refreshing} onClick={() => void refresh()}><RefreshCw />Actualizar</Button>
            <fieldset className="management-filters"><legend>Filtrar por rol</legend><RadioGroup value={role} onValueChange={value => setRole(String(value))}>{[{ value: '', label: 'Todos' }, ...roles.slice(0, 3)].map(item => <label key={item.value}><RadioGroupItem value={item.value} />{item.label}</label>)}</RadioGroup></fieldset>
            <label className="management-check" htmlFor="managed-inactive"><Checkbox id="managed-inactive" checked={inactiveOnly} onCheckedChange={setInactiveOnly} />Sólo inactivos</label>
          </form>
          <output>{refreshing ? 'Actualizando…' : `${listing.count} cuenta(s) · página ${listing.page} de ${Math.max(1, Math.ceil(listing.count / listing.pageSize))}`}</output>
          <Table><TableHeader><TableRow><TableHead>Persona</TableHead><TableHead>Rol y acceso</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>
            {listing.users.map(user => <TableRow key={user.id}><TableCell><strong>{user.displayName}</strong><span className="management-alias">@{user.alias}{user.id === listing.actor.id ? ' · vos' : ''}</span></TableCell><TableCell>{user.roles.join(' y ')}<span className={`management-status ${user.isActive ? '' : 'inactive'}`}>{user.isActive ? 'Activa' : 'Inactiva'}{user.mustChangePassword ? ' · contraseña temporal' : ''}</span></TableCell><TableCell><div className="management-row-actions">
              <Button variant="outline" aria-label={`Editar ${user.alias}`} onClick={() => openForm('edit', user)}>Editar</Button><Button variant="ghost" aria-label={`Restablecer contraseña de ${user.alias}`} onClick={() => openForm('password', user)}>Contraseña</Button><Button variant="ghost" className="management-danger" aria-label={`Eliminar ${user.alias}`} onClick={() => openForm('delete', user)}>Eliminar</Button>
            </div></TableCell></TableRow>)}
          </TableBody></Table>
          {!listing.users.length && <p>No hay cuentas que coincidan. Modificá los filtros y buscá nuevamente.</p>}
          <nav className="management-pagination" aria-label="Páginas de usuarios"><Button variant="outline" disabled={refreshing || listing.page <= 1} onClick={() => { filters.current.page--; void refresh(); }}>Anterior</Button><Button variant="outline" disabled={refreshing || listing.page * listing.pageSize >= listing.count} onClick={() => { filters.current.page++; void refresh(); }}>Siguiente</Button></nav>
        </section>
        <p className="account-help">Los proyectos aún son borradores locales. Administrar una cuenta no permite leer sus proyectos privados. Antes de eliminarla, pedí que exporte sus JSON; preferí desactivarla si la baja no es definitiva.</p>
      </main>
      <Dialog open={locked}><DialogContent className="session-cover session-dialog account-card" showCloseButton={false}><DialogHeader><DialogTitle>Acceso administrativo</DialogTitle><DialogDescription>Verificamos tu sesión antes de continuar.</DialogDescription></DialogHeader>{accessMessage}</DialogContent></Dialog>
    </>}
    <Dialog open={mode !== null && mode !== 'delete'} onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent className="management-dialog" showCloseButton={!busy}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{mode === 'edit' ? 'Guardá para aplicar los cambios. Cambiar alias, rol o estado cierra las sesiones de esa persona.' : 'Sólo el administrador puede crear y recuperar cuentas. No se requiere correo electrónico.'}</DialogDescription></DialogHeader>
        <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy}>{formFields}<div className="management-form-actions"><Button variant="outline" className="account-action" type="button" onClick={requestClose}>Cancelar</Button><Button className="account-action" type="submit">{busy ? 'Guardando…' : 'Guardar'}</Button></div></fieldset></form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={mode === 'delete'} onOpenChange={open => { if (!open && !busy) closeForm(); }}><AlertDialogContent className="management-dialog"><AlertDialogHeader><AlertDialogTitle>Eliminar cuenta definitivamente</AlertDialogTitle><AlertDialogDescription>Se eliminará {target?.displayName} (@{target?.alias}). No se puede deshacer. El último administrador activo está protegido.</AlertDialogDescription></AlertDialogHeader>
      {formError && <p role="alert" className="account-error">{formError}</p>}
      <p>No hay biblioteca de proyectos en servidor todavía. Los borradores locales no se cuentan ni se respaldan aquí y dejarán de abrirse con esta cuenta. Pedí a la persona que exporte sus JSON antes de continuar.</p>
      <Button variant="outline" className="account-action" disabled={busy} onClick={() => { if (target) downloadText(`ficha-${target.alias}.json`, JSON.stringify({ ...target, version: undefined, note: 'Ficha administrativa. No contiene contraseña ni proyectos; no restablece la cuenta.' }, null, 2), 'application/json'); }}>Exportar ficha (sin proyectos)</Button>
      <label className="management-check" htmlFor="managed-delete-warning"><Checkbox id="managed-delete-warning" disabled={busy} checked={draft.understandsLocalDrafts} onCheckedChange={value => update('understandsLocalDrafts', value)} />Entiendo que esta ficha no respalda los proyectos y que la eliminación es definitiva.</label>
      <label htmlFor="delete-alias">Escribí el alias exacto para confirmar</label><Input id="delete-alias" disabled={busy} autoComplete="off" value={draft.confirmationAlias} onChange={event => update('confirmationAlias', event.target.value)} />
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy || !draft.understandsLocalDrafts || draft.confirmationAlias !== target?.alias} onClick={() => void save()}>{busy ? 'Eliminando…' : 'Eliminar definitivamente'}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
    <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent className="management-dialog"><AlertDialogHeader><AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle><AlertDialogDescription>Todavía no se guardaron. La cuenta seguirá como estaba.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={closeForm}>Descartar cambios</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
