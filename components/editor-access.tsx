'use client';

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createAccountDraftStore, sessionChangePending, watchSessionChange, type AccountDraftStore, type EditorSession } from '@/lib/account-session';
import SessionExit from '@/components/session-exit';

const CapiBlocksApp = lazy(() => import('@/components/capiblocks-app'));
export type EditorCheckpoint = { suspend: () => boolean; resume: () => void; ready: () => boolean };
type OpenEditor = { session: EditorSession; store: AccountDraftStore };

export default function EditorAccess() {
  const [editor, setEditor] = useState<OpenEditor | null>(null);
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [canContinueLocally, setCanContinueLocally] = useState(false);
  const offlineActive = useRef(false);
  const eligible = useRef(false);
  const current = useRef<OpenEditor | null>(null);
  const checkpoint = useRef<EditorCheckpoint | null>(null);
  const generation = useRef(0);
  const exitPending = useRef(false);
  const [exitTarget, setExitTarget] = useState<OpenEditor | null>(null);

  const lock = useCallback(() => {
    checkpoint.current?.suspend();
    if (current.current) current.current.store.active = false;
    // Incluye los diálogos y popups renderizados en portales fuera del editor.
    document.documentElement.dataset.editorLocked = 'true';
    setLocked(true);
  }, []);

  const check = useCallback(async (hide = true) => {
    if (exitPending.current) return;
    if (sessionChangePending()) { lock(); return; }
    const ticket = ++generation.current;
    if (hide) lock();
    setError('');
    let unavailable = false;
    try {
      const response = await fetch('/api/auth/editor-session/', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (ticket !== generation.current || exitPending.current) return;
      if (response.status === 401 || response.status === 403) {
        eligible.current = false; setCanContinueLocally(false);
        lock(); setEditor(null); current.current = null;
        window.location.replace('/cuenta/?editor=1');
        return;
      }
      unavailable = response.status >= 500;
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error();
      const body = await response.json() as EditorSession;
      if (ticket !== generation.current || exitPending.current) return;
      if (!body.user?.id || body.user.mustChangePassword || !body.context || !body.csrfToken) throw new Error();
      const previous = current.current;
      if (previous?.session.user.id !== body.user.id || previous.session.context !== body.context) {
        lock();
        if (previous?.session.user.id === body.user.id) await previous.store.flush();
        if (ticket !== generation.current || exitPending.current) return;
        current.current = { session: body, store: createAccountDraftStore(body.user.id) };
      } else {
        previous.session = body;
        previous.store.active = true;
        previous.store.remoteAllowed = true;
        if (document.visibilityState === 'visible') checkpoint.current?.resume();
      }
      eligible.current = true; offlineActive.current = false;
      setOffline(false); setCanContinueLocally(false);
      setEditor({ ...current.current! });
      // Una respuesta iniciada antes de ocultar la pestaña no vuelve a mostrarla.
      if (document.visibilityState === 'visible') {
        delete document.documentElement.dataset.editorLocked;
        setLocked(false);
      }
    } catch (failure) {
      if (ticket !== generation.current) return;
      const candidate = current.current;
      const deadline = Date.parse(candidate?.session.expiresAt ?? '');
      const allowed = Boolean(candidate && eligible.current && Date.now() < deadline && checkpoint.current?.ready() &&
        (unavailable || failure instanceof TypeError || (failure instanceof DOMException && ['TimeoutError', 'AbortError', 'NetworkError'].includes(failure.name))));
      if (candidate) candidate.store.remoteAllowed = false;
      setCanContinueLocally(allowed);
      if (!(allowed && offlineActive.current && !hide)) lock();
      setError('No pudimos verificar tu sesión. Tu borrador se conserva; reconectá para seguir.');
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
      eligible.current = false; offlineActive.current = false;
      setOffline(false); setCanContinueLocally(false);
      ++generation.current; lock();
      if (!changing) void check();
    });
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void check(false); }, 15000);
    const online = () => { void check(false); };
    window.addEventListener('online', online);
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
      window.removeEventListener('online', online);
      window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus); window.removeEventListener('pagehide', pageHide);
      document.removeEventListener('visibilitychange', visible);
      delete document.documentElement.dataset.editorLocked;
    };
  }, [check, lock]);

  useEffect(() => {
    const deadline = Date.parse(editor?.session.expiresAt ?? '');
    if (!Number.isFinite(deadline)) return;
    const timer = window.setTimeout(() => {
      eligible.current = false; offlineActive.current = false;
      setOffline(false); setCanContinueLocally(false); lock();
      setError('Tu sesión venció. Reconectá e ingresá nuevamente; conservamos tu trabajo local.');
    }, Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [editor?.session.expiresAt, lock]);

  const logout = useCallback(async () => {
    if (exitPending.current || !current.current?.store.active) return;
    const target = current.current;
    // Una salida voluntaria no debe ocultar un fallo al guardar. El editor muestra
    // el error y permite exportar; una revocación externa sí bloquea el acceso.
    if (checkpoint.current?.suspend() === false) return;
    exitPending.current = true; ++generation.current;
    target.store.active = false;
    try { await target.store.flush(); }
    catch {
      exitPending.current = false; target.store.active = true;
      setError('No pudimos conservar el último cambio. Exportá una copia JSON antes de cerrar sesión.');
      return;
    }
    lock(); setError(''); setExitTarget(target);
  }, [lock]);

  const feedback = error ? <><p role="alert" className="account-error">{error}</p><Button className="account-action" onClick={() => void check()}>Reintentar</Button></> : <output>Comprobando tu sesión…</output>;

  return <>
    {editor && !locked && offline && <output className="offline-banner"><strong>Sin conexión · sólo en esta computadora · @{editor.session.user.alias}</strong><span>Podés editar, simular y exportar. No se envía nada al servidor. No podemos comprobar cambios de acceso hasta reconectar.</span><Button variant="outline" onClick={() => void check(false)}>Reconectar</Button></output>}
    {editor && !locked && error && !offline && <div className="account-error" role="alert">{error}</div>}
    {!editor && <main className="account-page session-cover"><section className="account-card" aria-label="Acceso al editor">
      <header className="account-heading"><span className="brand-mark" aria-hidden="true">🐾</span><h1>CapiBloques</h1></header>{feedback}
    </section></main>}
    {exitTarget && <SessionExit account={exitTarget.session.user} journal={exitTarget.store.recovery} onCancel={() => { setExitTarget(null); exitPending.current = false; void check(); }} />}
    {editor && <Dialog open={locked && !exitTarget}>
      <DialogContent className="session-cover session-dialog account-card" showCloseButton={false}>
        <DialogHeader><DialogTitle>CapiBloques</DialogTitle><DialogDescription>Verificamos tu acceso antes de continuar.</DialogDescription></DialogHeader>
        {feedback}
        {canContinueLocally && <><p>Podés seguir con el proyecto que ya abriste, sólo en esta computadora. Esto no verifica tu sesión ni da acceso a proyectos del servidor. Al reconectar se comprueban la cuenta y los cambios.</p><Button onClick={() => {
          const target = current.current;
          if (!target || !eligible.current || sessionChangePending() || Date.now() >= Date.parse(target.session.expiresAt ?? '') || !checkpoint.current?.ready()) return;
          target.store.remoteAllowed = false; target.store.active = true;
          offlineActive.current = true; setOffline(true); setLocked(false);
          delete document.documentElement.dataset.editorLocked;
        }}>Seguir sólo en esta computadora</Button></>}
      </DialogContent>
    </Dialog>}
    {editor && <div className="authenticated-editor" inert={locked} aria-hidden={locked || undefined}>
      <Suspense fallback={<div className="account-page"><output>Abriendo tu editor…</output></div>}>
        <CapiBlocksApp key={`${editor.session.user.id}:${editor.session.context}`} account={editor.session.user} csrfToken={editor.session.csrfToken} draftStore={editor.store} checkpointRef={checkpoint} onLogout={() => void logout()} offline={offline} />
      </Suspense>
    </div>}
  </>;
}
