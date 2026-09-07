'use client';

import { useEffect, useState } from 'react';
import type { AccountDraftStore } from '@/lib/account-session';
import type { RecoveryDraft } from '@/lib/project-recovery';
import { downloadText, safeFilename } from '@/lib/capiblocks';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export default function LocalRecovery({ store, onOpen }: { store: AccountDraftStore; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<RecoveryDraft[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<RecoveryDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let disposed = false, sequence = 0;
    const load = async () => {
      const ticket = ++sequence;
      try {
        const records = await store.recovery.list();
        if (!disposed && store.active && ticket === sequence) { setRows(records); setError(''); }
      } catch (failure) { if (!disposed && store.active && ticket === sequence) setError(failure instanceof Error ? failure.message : 'No pudimos leer las copias locales.'); }
    };
    void load();
    const unsubscribe = store.subscribe(() => { if (!store.recovering) void load(); });
    return () => { disposed = true; unsubscribe(); };
  }, [store, refresh]);
  const others = rows.filter(row => row.id !== store.recovery.id);
  return <section className="library-recovery local-copies" aria-label="Copias en esta computadora">
    <h2>Copias en esta computadora</h2>
    <p>Estas copias están en esta computadora. Recuperá una para continuar o reintentar su envío. Para verla en otro equipo, guardala en tu cuenta; no se suben todas en segundo plano.</p>
    <p>Hasta 30 copias y 50 MB. Conservar una copia al cambiar de proyecto permite volver acá después.</p>
    <Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Actualizar copias locales</Button>
    {!others.length && <p>No hay otras copias locales para recuperar.</p>}
    {others.map(row => <article className="library-project" key={row.id}>
      <h3>{row.title}</h3>
      <p>{new Date(row.updatedAt).toLocaleString('es-AR')} · {row.pending ? 'Envío pendiente' : row.remote ? 'Copia de un proyecto de tu cuenta' : 'Sólo en esta computadora'}</p>
      <div className="account-actions">
        <Button disabled={busy} onClick={() => onOpen(row.id)}>Recuperar {row.title}</Button>
        <Button variant="outline" disabled={busy} onClick={() => downloadText(`${safeFilename(row.title)}.capibloques.json`, row.document, 'application/json')}>Exportar copia local de {row.title}</Button>
        <Button variant="outline" disabled={busy} onClick={() => setSelected(row)}>Quitar copia local de {row.title}</Button>
      </div>
    </article>)}
    {error && <p role="alert" className="account-error">{error}</p>}
    <AlertDialog open={Boolean(selected)} onOpenChange={value => { if (!value && !busy) setSelected(null); }}>
      <AlertDialogContent className="management-dialog local-recovery-dialog">
        <AlertDialogHeader><AlertDialogTitle>¿Quitar esta copia local?</AlertDialogTitle>
          <AlertDialogDescription>{selected?.title} se quitará de este navegador. No se borra el proyecto del servidor. Los cambios y envíos pendientes de esta copia no podrán recuperarse aquí: exportá JSON antes si querés conservarlos.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={async event => {
            event.preventDefault();
            if (!selected || !store.active) return;
            setBusy(true);
            try { await store.recovery.remove(selected.id, selected.sequence); setSelected(null); setRefresh(value => value + 1); }
            catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo quitar la copia.'); }
            finally { setBusy(false); }
          }}>Quitar sólo esta copia local</AlertDialogAction></AlertDialogFooter>
        {error && <p role="alert" className="account-error">{error}</p>}
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
