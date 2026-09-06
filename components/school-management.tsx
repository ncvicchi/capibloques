'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SchoolIdentity, type SchoolBrandData } from '@/components/school-brand';
import { sessionChangePending, watchSessionChange, type Account } from '@/lib/account-session';

type Configuration = { school: SchoolBrandData; actor: Account; version: string; csrfToken: string };
type Draft = { name: string; logoAction: 'keep' | 'remove' | 'replace'; file: File | null; original: SchoolBrandData; version: string };

export default function SchoolManagement() {
  const [data, setData] = useState<Configuration | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [discard, setDiscard] = useState(false);
  const [loadAfterDiscard, setLoadAfterDiscard] = useState(false);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const confirmedLeave = useRef(false);
  const owner = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = Boolean(draft && (draft.name !== draft.original.name || draft.logoAction !== 'keep'));

  const closeForm = useCallback(() => { setDraft(null); setDiscard(false); setFormError(''); }, []);
  const clearPrivate = useCallback(() => { setData(null); owner.current = null; closeForm(); }, [closeForm]);
  const lock = useCallback(() => { document.documentElement.dataset.editorLocked = 'true'; setLocked(true); }, []);
  const refresh = useCallback(async (hide = false) => {
    if (inFlight.current) return;
    if (sessionChangePending()) { lock(); return; }
    const ticket = ++epoch.current;
    if (hide) lock();
    setAccessError('');
    try {
      const response = await fetch('/api/management/school/', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (ticket !== epoch.current) return;
      if (response.status === 401 || response.status === 403) {
        clearPrivate(); lock(); setAccessError('Necesitás una cuenta administradora con contraseña definitiva para configurar el colegio.'); return;
      }
      if (!response.ok) throw new Error();
      const body = await response.json() as Configuration;
      if (ticket !== epoch.current) return;
      if (!body.actor?.roles.includes('administrador') || !body.csrfToken || typeof body.school?.name !== 'string') throw new Error();
      if (owner.current && owner.current !== body.actor.id) closeForm();
      owner.current = body.actor.id;
      setData(body);
      if (document.visibilityState === 'visible') { delete document.documentElement.dataset.editorLocked; setLocked(false); }
    } catch {
      if (ticket === epoch.current) { lock(); setAccessError('No pudimos verificar el acceso. Reintentá la conexión; el borrador no se publicó.'); }
    }
  }, [clearPrivate, closeForm, lock]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void refresh(true); });
    const focus = () => { void refresh(true); };
    const visibility = () => { if (document.visibilityState === 'hidden') { ++epoch.current; lock(); } else void refresh(true); };
    const stop = watchSessionChange(changing => {
      ++epoch.current; lock();
      if (inFlight.current) return;
      if (changing) clearPrivate(); else void refresh(true);
    });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    window.addEventListener('focus', focus); window.addEventListener('pageshow', focus); document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      // Contador de solicitudes, no nodo DOM.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++epoch.current;
      stop(); window.clearInterval(timer); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus); document.removeEventListener('visibilitychange', visibility);
      delete document.documentElement.dataset.editorLocked;
    };
  }, [clearPrivate, lock, refresh]);

  useEffect(() => {
    const url = draft?.file ? URL.createObjectURL(draft.file) : null;
    let disposed = false;
    queueMicrotask(() => { if (!disposed) setPreviewUrl(url); });
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [draft?.file]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { if (!confirmedLeave.current) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function cancel(leaving = false) {
    if (inFlight.current) return;
    if (dirty) { setLoadAfterDiscard(leaving); setDiscard(true); }
    else { closeForm(); if (leaving) { confirmedLeave.current = true; window.location.assign('/cuenta/'); } else void refresh(); }
  }
  function discardChanges() {
    closeForm();
    // La navegación ocurre antes del cleanup del efecto: no pedir una segunda
    // confirmación nativa cuando la persona ya decidió descartar explícitamente.
    if (loadAfterDiscard) { confirmedLeave.current = true; window.location.assign('/cuenta/'); } else void refresh();
  }
  function selectFile(file: File | undefined) {
    if (!file || !draft) return;
    if (fileInput.current) fileInput.current.value = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024 || !file.size) {
      setFormError('Elegí PNG, JPEG o WebP de hasta 2 MiB. La selección anterior se conserva.'); return;
    }
    setDraft({ ...draft, file, logoAction: 'replace' }); setFormError('');
  }
  async function save() {
    if (!draft || !data || inFlight.current || locked || !dirty) return;
    inFlight.current = true; ++epoch.current; setBusy(true); setFormError(''); setNotice('');
    const payload = new FormData();
    payload.set('name', draft.name); payload.set('version', draft.version); payload.set('logoAction', draft.logoAction);
    if (draft.file && draft.logoAction === 'replace') payload.set('logo', draft.file);
    let succeeded = false;
    try {
      const response = await fetch('/api/management/school/', { method: 'POST', headers: { 'X-CSRFToken': data.csrfToken }, body: payload, signal: AbortSignal.timeout(20000) });
      const result = await response.json() as { error?: string };
      if (response.status === 401 || response.status === 403) {
        clearPrivate(); lock(); setAccessError('Tu sesión o permiso cambió. Volvé a Mi cuenta e ingresá nuevamente.'); return;
      }
      if (!response.ok) { setFormError(result.error || 'No pudimos guardar el colegio. Revisá el archivo y el nombre.'); return; }
      succeeded = true; closeForm(); setNotice('Colegio guardado. El nombre y logo ya están disponibles antes del ingreso.');
    } catch {
      setFormError('Se interrumpió la conexión y no podemos confirmar el resultado. Cancelá para cargar lo guardado antes de repetir.');
    } finally {
      inFlight.current = false; setBusy(false);
      if (succeeded || document.documentElement.dataset.editorLocked === 'true') void refresh();
    }
  }

  const accessMessage = <>{accessError ? <p className="account-error" role="alert">{accessError}</p> : <output>Comprobando acceso administrativo…</output>}<div className="account-actions"><Button className="account-action" onClick={() => void refresh(true)}>Reintentar</Button><Link className="account-back" href="/cuenta/" prefetch={false}>Ir a Mi cuenta</Link></div></>;
  const display = draft ? { name: draft.name.trim(), logoUrl: draft.logoAction === 'replace' ? previewUrl : draft.logoAction === 'remove' ? null : draft.original.logoUrl } : data?.school;
  return <>
    {!data && <main className="account-page session-cover"><section className="account-card"><h1>Configurar colegio</h1>{accessMessage}</section></main>}
    {data && <>
      <main className="management-page school-management" inert={locked} aria-hidden={locked || undefined}>
        <header className="management-header"><div><Button variant="ghost" className="account-back" disabled={busy} onClick={() => cancel(true)}><ArrowLeft size={18} /> Mi cuenta</Button><h1><School aria-hidden="true" /> Tu colegio</h1><p>Este nombre y logo serán visibles para todos, incluso antes de ingresar.</p></div></header>
        {notice && <output className="account-notice">{notice}</output>}
        <div className="school-columns">
          <section className="management-panel" aria-labelledby="school-settings-title"><h2 id="school-settings-title">Identidad institucional</h2>
            {!draft ? <><p>{data.school.name || 'Todavía no configuraste el colegio.'}</p><p>{data.school.logoUrl ? 'Hay un logo guardado.' : 'Sin logo. Se puede usar sólo el nombre.'}</p><Button className="account-action" onClick={() => { setDraft({ name: data.school.name, logoAction: 'keep', file: null, original: data.school, version: data.version }); setNotice(''); setFormError(''); }}>Editar colegio</Button></> : <form onSubmit={event => { event.preventDefault(); void save(); }}>
              <fieldset disabled={busy}>
                {formError && <p role="alert" className="account-error">{formError}</p>}
                <label htmlFor="school-name">Nombre del colegio</label><Input id="school-name" required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
                <label htmlFor="school-logo">Logo del colegio (opcional)</label><Input ref={fileInput} id="school-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => selectFile(event.target.files?.[0])} aria-describedby="school-logo-help" />
                <p id="school-logo-help" className="account-help">PNG, JPEG o WebP, hasta 2 MiB, 2048 píxeles por lado y 4 millones de píxeles. Sin animación. Se optimiza a un máximo de 512 píxeles, sin recortar ni estirar. Usá el logo autorizado por tu colegio, no fotos de alumnos.</p>
                {draft.file && <p className="school-file">Seleccionado: {draft.file.name}</p>}
                <div className="account-actions"><Button type="button" variant="outline" className="account-action" disabled={!display?.logoUrl} onClick={() => setDraft({ ...draft, logoAction: 'remove', file: null })}>Quitar logo</Button>{draft.logoAction !== 'keep' && <Button type="button" variant="ghost" className="account-action" onClick={() => { setDraft({ ...draft, logoAction: 'keep', file: null }); setFormError(''); }}>Usar logo guardado</Button>}</div>
                <p className="account-help">La vista previa es local. Sólo Guardar publica los cambios; Cancelar conserva lo que estaba guardado.</p>
                <div className="management-form-actions"><Button type="button" variant="outline" className="account-action" onClick={() => cancel()}>Cancelar</Button><Button type="submit" className="account-action" disabled={!dirty}>{busy ? 'Guardando…' : 'Guardar colegio'}</Button></div>
              </fieldset>
            </form>}
          </section>
          <section className="management-panel school-preview" aria-labelledby="school-preview-title"><h2 id="school-preview-title">{draft ? 'Vista previa · sin guardar' : 'Así se verá al ingresar'}</h2><div className="school-preview-card">{display?.name ? <SchoolIdentity {...display} /> : <p className="account-help">Escribí el nombre para ver la vista previa.</p>}<span className="account-brand">CapiBloques</span><h3>Ingresar</h3><p>Alias y contraseña</p></div><p className="account-help">La misma identidad se verá en todas las cuentas de esta instalación.</p></section>
        </div>
      </main>
      <Dialog open={locked}><DialogContent className="session-cover session-dialog account-card" showCloseButton={false}><DialogHeader><DialogTitle>Acceso administrativo</DialogTitle><DialogDescription>Verificamos tu sesión antes de continuar.</DialogDescription></DialogHeader>{accessMessage}</DialogContent></Dialog>
    </>}
    <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent className="management-dialog"><AlertDialogHeader><AlertDialogTitle>¿Descartar los cambios del colegio?</AlertDialogTitle><AlertDialogDescription>El nombre y logo guardados no se modificarán.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={discardChanges}>Descartar cambios</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
