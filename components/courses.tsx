'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { sessionChangePending, watchSessionChange, type Account } from '@/lib/account-session';
import CourseProjects from '@/components/course-projects';

type Member = { id: string; alias: string; displayName: string; role: 'docente' | 'alumno'; isActive?: boolean };
type Course = { id: string; name: string; description: string; isArchived: boolean; version?: string; myRole?: string; members?: Member[] };
type Listing = { courses: Course[]; count: number; page: number; pageSize: number; actor: Account; csrfToken: string };
type Candidates = { users: (Account & { isActive: boolean })[]; count: number; page: number; pageSize: number };
type Draft = Course & { members: Member[]; original: Course };
const signature = (course: Course) => JSON.stringify([course.name, course.description, course.isArchived, (course.members ?? []).map(member => `${member.id}:${member.role}`).sort()]);
const emptyCourse = (): Course => ({ id: '', name: '', description: '', isArchived: false, members: [] });

export default function Courses({ management = false }: { management?: boolean }) {
  const root = management ? '/api/management/courses/' : '/api/courses/';
  const [listing, setListing] = useState<Listing | null>(null);
  const [view, setView] = useState<Course | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [candidates, setCandidates] = useState<Candidates | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState({ q: '', status: 'active', page: 1 });
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [discard, setDiscard] = useState(false);
  const epoch = useRef(0);
  const active = useRef(false);
  const inFlight = useRef(false);
  const owner = useRef<string | null>(null);
  const selected = useRef<string | null>(null);
  const dirty = Boolean(draft && signature(draft) !== signature(draft.original));
  const close = useCallback(() => { selected.current = null; setView(null); setDraft(null); setCandidates(null); setMemberQuery(''); setDiscard(false); setError(''); }, []);
  const clear = useCallback(() => { owner.current = null; setListing(null); close(); }, [close]);
  const lock = useCallback(() => { document.documentElement.dataset.editorLocked = 'true'; setLocked(true); }, []);

  const refresh = useCallback(async (hide = false) => {
    if (!active.current || inFlight.current) return;
    if (sessionChangePending()) { lock(); return; }
    const ticket = ++epoch.current;
    if (hide) lock();
    setAccessError('');
    try {
      const response = await fetch(`${root}?${new URLSearchParams({ ...filter, page: String(filter.page) })}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (ticket !== epoch.current) return;
      if (response.status === 401 || response.status === 403) { clear(); lock(); setAccessError('Tu sesión o permiso cambió. Ingresá desde Mi cuenta para continuar.'); return; }
      if (!response.ok) throw new Error();
      const data = await response.json() as Listing;
      if (ticket !== epoch.current) return;
      if (!data.actor?.id || !data.csrfToken || !Array.isArray(data.courses) || (management && !data.actor.roles.includes('administrador'))) throw new Error();
      if (owner.current && owner.current !== data.actor.id) close();
      owner.current = data.actor.id;
      // Revalidar el curso abierto, no sólo la sesión: una membresía puede
      // desaparecer sin cambiar el rol ni la sesión de la persona.
      if (selected.current) {
        const detail = await fetch(`${root}${selected.current}/`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
        if (ticket !== epoch.current) return;
        if (detail.status === 404) { close(); setNotice('El curso ya no está disponible para tu cuenta.'); }
        else if (detail.status === 401 || detail.status === 403) { clear(); lock(); setAccessError('Tu acceso cambió. Volvé a Mi cuenta.'); return; }
        else if (!detail.ok) throw new Error();
        else { const result = await detail.json() as { course: Course }; if (ticket !== epoch.current) return; setView(result.course); }
      }
      setListing(data);
      if (document.visibilityState === 'visible') { delete document.documentElement.dataset.editorLocked; setLocked(false); }
    } catch {
      if (ticket === epoch.current) { lock(); setAccessError('No pudimos verificar el acceso. Reintentá la conexión; no descartamos tus cambios sin guardar.'); }
    }
  }, [clear, close, filter, lock, management, root]);

  useEffect(() => {
    active.current = true;
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void refresh(true); });
    const focus = () => { void refresh(true); };
    const visibility = () => { if (document.visibilityState === 'hidden') { ++epoch.current; lock(); } else void refresh(true); };
    const stop = watchSessionChange(changing => { ++epoch.current; lock(); if (changing) clear(); else void refresh(true); });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    window.addEventListener('focus', focus); window.addEventListener('pageshow', focus); document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      active.current = false;
      // Contador de peticiones, no una referencia a un nodo DOM.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++epoch.current;
      stop(); window.clearInterval(timer); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus); document.removeEventListener('visibilitychange', visibility);
      delete document.documentElement.dataset.editorLocked;
    };
  }, [clear, lock, refresh]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function cancel() { if (!inFlight.current) { if (dirty) setDiscard(true); else { close(); void refresh(); } } }
  async function operation<T>(url: string, options: RequestInit, receive: (data: T) => void) {
    if (inFlight.current || locked) return;
    inFlight.current = true; setBusy(true); setError('');
    const ticket = ++epoch.current;
    try {
      const response = await fetch(url, { ...options, cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const result = await response.json() as T & { error?: string };
      if (ticket !== epoch.current) return;
      if (response.status === 401 || response.status === 403) { clear(); lock(); setAccessError('Tu sesión o permiso cambió. Volvé a Mi cuenta.'); return; }
      if (response.status === 404) { close(); setNotice('El curso ya no está disponible.'); return; }
      if (!response.ok) { setError(result.error || 'No pudimos completar la operación.'); return; }
      receive(result);
    } catch {
      if (ticket === epoch.current) setError('Se interrumpió la conexión. No podemos confirmar el resultado. Cancelá y revisá lo guardado antes de repetir.');
    } finally {
      inFlight.current = false; setBusy(false);
      void refresh();
    }
  }
  function open(course: Course) {
    setNotice('');
    void operation(`${root}${course.id}/`, {}, (result: { course: Course }) => {
      selected.current = result.course.id; setView(result.course);
      if (management) setDraft({ ...result.course, members: result.course.members ?? [], original: result.course });
    });
  }
  function searchMembers(page = 1) {
    void operation(`/api/management/users/?${new URLSearchParams({ q: memberQuery, active: 'true', page: String(page) })}`, {}, (data: Candidates) => setCandidates(data));
  }
  function save() {
    if (!draft || !listing || !dirty) return;
    const payload = { name: draft.name, description: draft.description, isArchived: draft.isArchived, members: draft.members.map(({ id, role }) => ({ id, role })), ...(draft.id ? { version: draft.version } : {}) };
    void operation(`${root}${draft.id ? `${draft.id}/` : ''}`, { method: draft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': listing.csrfToken }, body: JSON.stringify(payload) }, () => {
      close(); setNotice('Curso guardado. Las asignaciones ya están actualizadas.');
    });
  }
  const access = <>{accessError ? <p className="account-error" role="alert">{accessError}</p> : <output>Comprobando acceso…</output>}<div className="account-actions"><Button className="account-action" onClick={() => void refresh(true)}>Reintentar</Button><Link className="account-back" href="/cuenta/" prefetch={false}>Ir a Mi cuenta</Link></div></>;
  const title = management ? 'Gestionar cursos' : 'Mis cursos';
  const removed = draft?.original.members?.filter(member => !draft.members.some(item => item.id === member.id)).length ?? 0;
  return <>
    {!listing && <main className="account-page session-cover"><section className="account-card"><h1>{title}</h1>{access}</section></main>}
    {listing && <>
      <main className="management-page courses-page" inert={locked} aria-hidden={locked || undefined}>
        <header className="management-header"><div><Link className="account-back" href="/cuenta/" prefetch={false}><ArrowLeft size={18} /> Mi cuenta</Link><h1><BookOpen aria-hidden="true" />{title}</h1><p>{management ? 'Armá grupos y asigná docentes y alumnos.' : 'Los grupos a los que te asignó tu colegio.'}</p></div>{management && <Button className="account-action" disabled={busy} onClick={() => { close(); setNotice(''); const course = emptyCourse(); setDraft({ ...course, members: [], original: course }); }}><Plus />Crear curso</Button>}</header>
        {notice && <output className="account-notice">{notice}</output>}
        {error && !draft && !view && <p role="alert" className="account-error">{error}</p>}
        <form className="course-filters" onSubmit={event => { event.preventDefault(); setFilter({ ...filter, q: query, page: 1 }); }}>
          <label htmlFor="course-search">Buscar curso<Input id="course-search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} /></label>
          <label htmlFor="course-status">Mostrar<Select value={filter.status} onValueChange={value => { if (value) setFilter({ ...filter, status: value, page: 1 }); }}><SelectTrigger id="course-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activos</SelectItem><SelectItem value="archived">Archivados</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent></Select></label>
          <Button type="submit" variant="outline" className="account-action" disabled={busy}>Buscar</Button>
        </form>
        {!listing.count ? <section className="management-panel"><h2>{management ? 'No hay cursos en esta vista' : 'Todavía no hay cursos para mostrar'}</h2><p>{management ? 'Creá un curso o revisá los filtros.' : 'Podés revisar los archivados o pedirle al administrador que te asigne. Mientras tanto, podés seguir usando el editor.'}</p></section> : <div className="course-grid">{listing.courses.map(course => <article className="management-panel course-card" key={course.id}><span className="course-status">{course.isArchived ? 'Archivado' : 'Activo'}</span><h2>{course.name}</h2>{course.description && <p>{course.description}</p>}<Button className="account-action" variant="outline" disabled={busy} onClick={() => open(course)} aria-label={`${management ? 'Editar' : 'Ver'} ${course.name}`}>{management ? 'Editar curso y miembros' : 'Ver curso'}</Button></article>)}</div>}
        <nav className="account-actions course-paging" aria-label="Páginas de cursos"><Button variant="outline" disabled={busy || listing.page <= 1} onClick={() => setFilter({ ...filter, page: listing.page - 1 })}>Anterior</Button><span>Página {listing.page} de {Math.max(1, Math.ceil(listing.count / listing.pageSize))} · {listing.count} cursos</span><Button variant="outline" disabled={busy || listing.page * listing.pageSize >= listing.count} onClick={() => setFilter({ ...filter, page: listing.page + 1 })}>Siguiente</Button></nav>
        <p className="account-help">Los alumnos eligen qué proyectos guardados asignar al curso desde Mis proyectos. Pertenecer a un curso no comparte toda su biblioteca ni los borradores locales.</p>
      </main>
      <Dialog open={locked}><DialogContent className="session-cover session-dialog account-card" showCloseButton={false}><DialogHeader><DialogTitle>Verificar acceso</DialogTitle><DialogDescription>Protegemos la información del curso mientras verificamos tu cuenta.</DialogDescription></DialogHeader>{access}</DialogContent></Dialog>
    </>}
    <Dialog open={Boolean(draft || view)} onOpenChange={open => { if (!open) cancel(); }}><DialogContent className="management-dialog course-dialog" showCloseButton={!busy}>
      <DialogHeader><DialogTitle>{draft ? (draft.id ? 'Editar curso' : 'Crear curso') : view?.name}</DialogTitle><DialogDescription>{draft ? 'Los cambios sólo se aplican al guardar. Cancelar conserva la versión guardada.' : `${view?.isArchived ? 'Archivado' : 'Activo'} · Tu función: ${view?.myRole ?? ''}`}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="account-error">{error}</p>}
      {draft ? <form onSubmit={event => { event.preventDefault(); save(); }}><fieldset disabled={busy} className="course-form">
        <label htmlFor="course-name">Nombre del curso<Input id="course-name" required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Por ejemplo: Robótica · 5.º A · 2026" /></label>
        <label htmlFor="course-description">Descripción breve (opcional)<Textarea id="course-description" maxLength={500} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value.replace(/[\r\n]/g, ' ') })} /></label>
        {draft.id && <label className="management-check" htmlFor="course-archived"><Checkbox id="course-archived" checked={draft.isArchived} onCheckedChange={value => setDraft({ ...draft, isArchived: value })} />Curso archivado</label>}
        {(draft.isArchived || draft.original.isArchived) && <p className="account-help">Archivar conserva la lectura de sus miembros, pero impide nuevas incorporaciones. Podés retirar miembros. Para agregar, desmarcá «Curso archivado» y guardá primero.</p>}
        <section aria-labelledby="course-members-title"><h2 id="course-members-title">Miembros seleccionados · {draft.members.length}/200</h2>
          {!draft.members.length && <p>Aún no seleccionaste docentes ni alumnos.</p>}
          <ul className="course-member-list">{draft.members.map(member => <li key={member.id}><div><strong>{member.displayName}</strong><span>@{member.alias} · {member.role}{member.isActive === false ? ' · Cuenta inactiva, sin acceso' : ''}</span></div><Button type="button" variant="outline" aria-label={`Quitar ${member.alias}`} onClick={() => setDraft({ ...draft, members: draft.members.filter(item => item.id !== member.id) })}>Quitar</Button></li>)}</ul>
          {draft.members.filter(member => member.role === 'docente' && member.isActive !== false).length === 0 && <p className="account-help">Sin docentes activos asignados. El administrador puede completar el grupo más adelante.</p>}
          {signature({ ...draft.original, name: '', description: '', isArchived: false }) !== signature({ ...draft, name: '', description: '', isArchived: false }) && <Button type="button" variant="ghost" onClick={() => setDraft({ ...draft, members: draft.original.members ?? [] })}>Restaurar selección guardada</Button>}
        </section>
        {!draft.isArchived && !draft.original.isArchived && <section className="course-add" aria-labelledby="course-add-title"><h2 id="course-add-title">Agregar personas</h2><label htmlFor="course-member-search">Nombre o alias<Input id="course-member-search" maxLength={80} value={memberQuery} onChange={event => setMemberQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); searchMembers(); } }} /></label><Button type="button" variant="outline" onClick={() => searchMembers()}>Buscar personas</Button>
          {candidates && <><ul className="course-member-list">{candidates.users.map(user => {
            const role = user.roles.includes('docente') ? 'docente' : user.roles.includes('alumno') ? 'alumno' : null;
            const added = draft.members.some(member => member.id === user.id);
            return <li key={user.id}><div><strong>{user.displayName}</strong><span>@{user.alias} · {role ?? 'Administrador sin rol docente'}</span></div><Button type="button" variant="outline" disabled={!role || added || draft.members.length >= 200} aria-label={`Agregar ${user.alias}`} onClick={() => { if (role) setDraft({ ...draft, members: [...draft.members, { id: user.id, alias: user.alias, displayName: user.displayName, role, isActive: user.isActive }] }); }}>{added ? 'Seleccionado' : 'Agregar'}</Button></li>;
          })}</ul>{!candidates.count && <p>No hay cuentas activas que coincidan.</p>}<div className="account-actions"><Button type="button" variant="ghost" disabled={candidates.page <= 1} onClick={() => searchMembers(candidates.page - 1)}>Personas anteriores</Button><span>Página {candidates.page} · {candidates.count} cuentas</span><Button type="button" variant="ghost" disabled={candidates.page * candidates.pageSize >= candidates.count} onClick={() => searchMembers(candidates.page + 1)}>Más personas</Button></div></>}
          <p className="account-help">La función depende del rol de la cuenta. Administrador sin rol docente no puede ser miembro. Las cuentas se crean desde Gestionar usuarios.</p>
        </section>}
        {removed > 0 && <output className="account-notice">Al guardar se retirarán {removed} membresías. Esas personas perderán el acceso a este curso.</output>}
        <div className="management-form-actions course-save"><Button type="button" variant="outline" className="account-action" onClick={cancel}>Cancelar</Button><Button type="submit" className="account-action" disabled={!dirty}>{busy ? 'Guardando…' : 'Guardar curso'}</Button></div>
      </fieldset></form> : view && <><p>{view.description || 'Este curso todavía no tiene descripción.'}</p>{view.members && <section><h2>Docentes y alumnos del curso</h2><ul className="course-member-list">{view.members.map(member => <li key={member.id}><div><strong>{member.displayName}</strong><span>@{member.alias} · {member.role}</span></div></li>)}</ul></section>}{view.myRole === 'docente' && listing ? <CourseProjects key={`${listing.actor.id}:${view.id}`} courseId={view.id} accountId={listing.actor.id} locked={locked} students={view.members?.filter(member => member.role === 'alumno')} /> : <p className="account-help">Asigná tus proyectos guardados desde el editor → Mis proyectos → Elegir curso.</p>}<Button className="account-action" onClick={cancel}>Cerrar curso</Button></>}
    </DialogContent></Dialog>
    <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent className="management-dialog"><AlertDialogHeader><AlertDialogTitle>¿Descartar los cambios del curso?</AlertDialogTitle><AlertDialogDescription>El nombre, estado y miembros guardados no se modificarán.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={() => { close(); void refresh(); }}>Descartar cambios</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
