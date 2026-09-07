'use client';

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { announceSessionChange, createAccountDraftStore, sessionChangePending, watchSessionChange, type AccountDraftStore, type EditorSession } from '@/lib/account-session';

const CapiBlocksApp = lazy(() => import('@/components/capiblocks-app'));
export type EditorCheckpoint = { suspend: () => boolean; resume: () => void };
type OpenEditor = { session: EditorSession; store: AccountDraftStore };

export default function EditorAccess() {
  const [editor, setEditor] = useState<OpenEditor | null>(null);
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState('');
  const current = useRef<OpenEditor | null>(null);
  const checkpoint = useRef<EditorCheckpoint | null>(null);
  const generation = useRef(0);
  const leaving = useRef(false);
  const preparingExit = useRef(false);

  const lock = useCallback(() => {
    checkpoint.current?.suspend();
    if (current.current) current.current.store.active = false;
    // Incluye los diálogos y popups renderizados en portales fuera del editor.
    document.documentElement.dataset.editorLocked = 'true';
    setLocked(true);
  }, []);

  const check = useCallback(async (hide = true) => {
    if (leaving.current) return;
    if (sessionChangePending()) { lock(); return; }
    const ticket = ++generation.current;
    if (hide) lock();
    setError('');
    try {
      const response = await fetch('/api/auth/editor-session/', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (ticket !== generation.current || leaving.current) return;
      if (response.status === 401 || response.status === 403) {
        lock(); setEditor(null); current.current = null;
        window.location.replace('/cuenta/?editor=1');
        return;
      }
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error();
      const body = await response.json() as EditorSession;
      if (ticket !== generation.current || leaving.current) return;
      if (!body.user?.id || body.user.mustChangePassword || !body.context || !body.csrfToken) throw new Error();
      const previous = current.current;
      if (previous?.session.user.id !== body.user.id || previous.session.context !== body.context) {
        lock();
        current.current = { session: body, store: createAccountDraftStore(body.user.id) };
      } else {
        previous.session = body;
        previous.store.active = true;
        if (document.visibilityState === 'visible') checkpoint.current?.resume();
      }
      setEditor({ ...current.current! });
      // Una respuesta iniciada antes de ocultar la pestaña no vuelve a mostrarla.
      if (document.visibilityState === 'visible') {
        delete document.documentElement.dataset.editorLocked;
        setLocked(false);
      }
    } catch {
      if (ticket !== generation.current) return;
      lock(); setError('No pudimos verificar tu sesión. Tu borrador se conserva; reconectá para seguir.');
    }
  }, [lock]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void check(); });
    const focus = () => { void check(); };
    const visible = () => {
      if (document.visibilityState === 'hidden') { ++generation.current; lock(); }
      else void check();
    };
    const pageHide = () => { ++generation.current; lock(); };
    const stopWatching = watchSessionChange(changing => {
      ++generation.current; lock();
      if (!changing) void check();
    });
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void check(false); }, 15000);
    window.addEventListener('focus', focus);
    window.addEventListener('pageshow', focus);
    window.addEventListener('pagehide', pageHide);
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      // Invalida respuestas pendientes; no es una referencia a un nodo DOM.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      window.clearInterval(interval); stopWatching();
      window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus); window.removeEventListener('pagehide', pageHide);
      document.removeEventListener('visibilitychange', visible);
      delete document.documentElement.dataset.editorLocked;
    };
  }, [check, lock]);

  const logout = useCallback(async (retry = false) => {
    const retrying = retry === true && leaving.current;
    if ((leaving.current && !retrying) || preparingExit.current || !current.current) return;
    const target = current.current;
    // Una salida voluntaria no debe ocultar un fallo al guardar. El editor muestra
    // el error y permite exportar; una revocación externa sí bloquea el acceso.
    if (!retrying && checkpoint.current?.suspend() === false) return;
    preparingExit.current = true;
    try { await target.store.flush(); }
    catch {
      setError('No pudimos conservar el último cambio. Exportá una copia JSON antes de cerrar sesión.');
      return;
    } finally { preparingExit.current = false; }
    if (current.current !== target || (!retrying && (!target.store.active || leaving.current))) return;
    leaving.current = true; ++generation.current;
    lock(); announceSessionChange(true); setError('');
    try {
      const state = await fetch('/api/auth/session/', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!state.ok) throw new Error();
      const session = await state.json() as EditorSession;
      if (session.user && session.user.id !== current.current.session.user.id) {
        window.location.replace('/cuenta/?editor=1');
        return;
      }
      const response = await fetch('/api/auth/logout/', {
        method: 'POST', headers: { 'X-CSRFToken': session.csrfToken }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error();
      const result = await response.json() as { user?: unknown; csrfToken?: unknown } | null;
      if (result?.user !== null || typeof result.csrfToken !== 'string') throw new Error();
      setEditor(null); current.current = null;
      window.location.replace('/cuenta/?editor=1');
    } catch {
      // No afirmar un cierre que el servidor no confirmó ni reabrir el editor.
      setError('No pudimos confirmar el cierre de sesión. Volvé a intentar antes de dejar esta computadora.');
    } finally {
      announceSessionChange();
      // Un cierre fallido sólo se recupera con el botón explícito de reintento.
    }
  }, [lock]);

  const feedback = error ? <><p role="alert" className="account-error">{error}</p><Button className="account-action" onClick={() => {
        if (leaving.current) { void logout(true); } else void check();
      }}>Reintentar</Button></> : <output>Comprobando tu sesión…</output>;

  return <>
    {editor && !locked && error && <div className="account-error" role="alert">{error}</div>}
    {!editor && <main className="account-page session-cover"><section className="account-card" aria-label="Acceso al editor">
      <header className="account-heading"><span className="brand-mark" aria-hidden="true">🐾</span><h1>CapiBloques</h1></header>{feedback}
    </section></main>}
    {editor && <Dialog open={locked}>
      <DialogContent className="session-cover session-dialog account-card" showCloseButton={false}>
        <DialogHeader><DialogTitle>CapiBloques</DialogTitle><DialogDescription>Verificamos tu acceso antes de continuar.</DialogDescription></DialogHeader>
        {feedback}
      </DialogContent>
    </Dialog>}
    {editor && <div className="authenticated-editor" inert={locked} aria-hidden={locked || undefined}>
      <Suspense fallback={<div className="account-page"><output>Abriendo tu editor…</output></div>}>
        <CapiBlocksApp key={`${editor.session.user.id}:${editor.session.context}`} account={editor.session.user} csrfToken={editor.session.csrfToken} draftStore={editor.store} checkpointRef={checkpoint} onLogout={() => void logout()} />
      </Suspense>
    </div>}
  </>;
}
