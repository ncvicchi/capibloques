'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { announceSessionChange, watchSessionChange, type Account, type Session } from '@/lib/account-session';
import { downloadText, safeFilename } from '@/lib/capiblocks';
import { clearLocalExit, prepareLocalExit, type ExitSnapshot } from '@/lib/local-exit';
import { RecoveryJournal } from '@/lib/project-recovery';

type Phase = 'choosing' | 'sending' | 'failed' | 'cleanup-failed';

export default function SessionExit({ account, all = false, journal, onCancel }: {
  account: Account; all?: boolean; journal: RecoveryJournal; onCancel: () => void;
}) {
  const [snapshot, setSnapshot] = useState<ExitSnapshot | null>(null);
  const [localError, setLocalError] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [phase, setPhase] = useState<Phase>('choosing');
  const state = useRef<Phase>('choosing');
  const generation = useRef(0);
  const remove = useRef(false);
  const [signalOrigin] = useState(() => crypto.randomUUID());
  const goToAccount = useCallback((result?: string) => window.location.replace(`/cuenta/?editor=1${result ? `&salida=${result}` : ''}`), []);

  const verify = useCallback(async (hide = true) => {
    if (state.current !== 'choosing') return;
    const ticket = ++generation.current;
    if (hide) setVerified(false);
    setError('');
    try {
      const response = await fetch('/api/auth/session/', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error();
      const body = await response.json() as Session;
      if (ticket !== generation.current) return;
      if (body.user?.id !== account.id || body.user.mustChangePassword !== account.mustChangePassword) { goToAccount(); return; }
      setVerified(true);
    } catch {
      if (ticket === generation.current) { setVerified(false); setError('No pudimos verificar tu sesión. Reconectá para revisar las copias y salir.'); }
    }
  }, [account.id, account.mustChangePassword, goToAccount]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) { announceSessionChange(true, signalOrigin); void verify(); } });
    const focus = () => { void verify(); };
    const visible = () => {
      if (document.visibilityState === 'hidden') { ++generation.current; setVerified(false); }
      else void verify();
    };
    const stop = watchSessionChange(changing => {
      if (state.current !== 'choosing') return;
      ++generation.current; setVerified(false);
      if (!changing) void verify();
    }, signalOrigin);
    const timer = window.setInterval(() => {
      if (state.current !== 'cleanup-failed') announceSessionChange(true, signalOrigin);
      if (document.visibilityState === 'visible') void verify(false);
    }, 10000);
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      // Época de solicitudes, no una referencia a un nodo DOM.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current; stop(); window.clearInterval(timer);
      announceSessionChange(false, signalOrigin);
      window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visible);
    };
  }, [verify, signalOrigin]);

  const loadCopies = useCallback(async () => {
    setSnapshot(null); setDiscard(false); setLocalError('');
    try { setSnapshot(await prepareLocalExit(journal)); }
    catch (failure) { setLocalError(failure instanceof Error ? failure.message : 'No pudimos revisar las copias. Podés conservarlas al salir.'); }
  }, [journal]);
  useEffect(() => { let disposed = false; queueMicrotask(() => { if (!disposed) void loadCopies(); }); return () => { disposed = true; }; }, [loadCopies]);

  async function exit(removing: boolean) {
    if (state.current === 'sending' || state.current === 'cleanup-failed') return;
    if (state.current === 'choosing' && (!verified || (removing && (!snapshot || !discard)))) return;
    remove.current = removing;
    state.current = 'sending'; setPhase('sending'); ++generation.current;
    setVerified(false); setError(''); announceSessionChange(true, signalOrigin);
    let confirmed = false;
    try {
      const response = await fetch('/api/auth/session/', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error();
      const session = await response.json() as Session;
      if (session.user && session.user.id !== account.id) { goToAccount(); return; }
      if (typeof session.csrfToken !== 'string') throw new Error();
      const result = await fetch(`/api/auth/${all && session.user ? 'logout-all' : 'logout'}/`, {
        method: 'POST', headers: { 'X-CSRFToken': session.csrfToken, 'X-Capi-Account': account.id }, signal: AbortSignal.timeout(15000),
      });
      if (!result.ok) throw new Error();
      const body = await result.json() as Session;
      if (body.user !== null || typeof body.csrfToken !== 'string') throw new Error();
      confirmed = true;
      if (removing && snapshot) await clearLocalExit(journal, snapshot);
      if (all && !session.user) {
        state.current = 'cleanup-failed'; setPhase('cleanup-failed');
        setError('Esta sesión está cerrada. No pudimos confirmar el cierre de las sesiones de otros equipos; ingresá nuevamente si necesitás cerrarlas.');
        return;
      }
      goToAccount(removing ? 'limpia' : 'conservada');
    } catch (failure) {
      state.current = confirmed ? 'cleanup-failed' : 'failed'; setPhase(state.current);
      setError(confirmed
        ? `Sesión cerrada, pero la limpieza local no se completó. ${failure instanceof Error ? failure.message : 'Ingresá nuevamente para revisar tus copias.'}`
        : 'No pudimos confirmar el cierre de sesión. Volvé a intentar antes de dejar esta computadora. No quitamos tus copias.');
    } finally { announceSessionChange(state.current === 'failed', signalOrigin); }
  }

  return <Dialog open onOpenChange={value => { if (!value && state.current === 'choosing') onCancel(); }}>
    <DialogContent className="session-cover session-dialog account-card session-exit-dialog" showCloseButton={false}>
      <DialogHeader><DialogTitle>{all ? 'Cerrar todas mis sesiones' : 'Antes de salir'}</DialogTitle>
        <DialogDescription>Elegí qué hacer con las copias de tus proyectos en este navegador. Tus proyectos guardados en la cuenta no se borran.</DialogDescription></DialogHeader>
      {phase === 'choosing' && verified && <>
        <p>Para guardar cambios en tu cuenta, cancelá y usá Guardar en el editor. Al salir no se envían proyectos pendientes.</p>
        {all && <p>Se cerrarán tus sesiones en todos los equipos. Sólo podemos quitar copias locales de este navegador, no de otras computadoras.</p>}
        {snapshot ? <>
          <p><strong>{snapshot.files.length} copias locales</strong> de @{account.alias}. Incluye otros proyectos y copias de pestañas de esta cuenta.</p>
          {snapshot.files.length > 0 && <details><summary>Revisar y exportar las copias JSON</summary>
            <p>Descargá cada copia que quieras conservar. Comprobá los archivos en Descargas antes de quitarlas. Los JSON no incluyen envíos pendientes ni vínculo al servidor; se importan como proyectos.</p>
            {snapshot.files.map((file, index) => <article className="library-project" key={file.id}>
              <h2>{file.title}</h2><p>{file.status}</p>
              <Button variant="outline" onClick={() => downloadText(`${index + 1}-${safeFilename(file.title)}.capibloques.json`, file.document, 'application/json')}>Exportar JSON de {file.title}</Button>
            </article>)}
          </details>}
          <label className="exit-confirmation"><input type="checkbox" checked={discard} onChange={event => setDiscard(event.target.checked)} />
            <span>Quiero quitar todas estas copias locales. Entiendo que los cambios y envíos pendientes se descartan sin deshacer.</span></label>
          <p>Si es una computadora compartida, exportá lo que necesites y elegí quitar las copias. Esto no borra archivos descargados, copias de otros usuarios ni el borrador anterior sin dueño; tampoco es un borrado seguro del disco.</p>
          <Button variant="outline" onClick={() => void loadCopies()}>Actualizar copias antes de salir</Button>
        </> : localError ? <p role="alert" className="account-error">{localError}</p> : <output>Revisando copias locales…</output>}
        <div className="account-actions">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => void exit(false)}>Salir y conservar copias</Button>
          <Button variant="outline" disabled={!snapshot || !discard} onClick={() => void exit(true)}>Salir y quitar copias</Button>
        </div>
      </>}
      {phase === 'choosing' && !verified && <><output>Comprobando tu sesión…</output><Button variant="outline" onClick={onCancel}>Cancelar</Button></>}
      {phase === 'sending' && <output>Cerrando sesión y completando tu elección…</output>}
      {error && <p role="alert" className="account-error">{error}</p>}
      {phase === 'choosing' && error && <Button onClick={() => void verify()}>Reintentar</Button>}
      {phase === 'failed' && <Button onClick={() => void exit(remove.current)}>Reintentar</Button>}
      {phase === 'cleanup-failed' && <Button onClick={() => goToAccount()}>Ir al ingreso</Button>}
    </DialogContent>
  </Dialog>;
}
