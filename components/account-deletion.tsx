'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Preview = { user: { id: string; alias: string; displayName: string; isActive: boolean }; projects: { count: number; active: number; trash: number; bytes: number }; memberships: number; version: string; canDelete: boolean };
export default function AccountDeletion({ targetId, actorId, token, locked, close, deleted }: { targetId: string; actorId: string; token: string; locked: boolean; close: () => void; deleted: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [receipt, setReceipt] = useState('');
  const [alias, setAlias] = useState('');
  const [privateBackup, setPrivateBackup] = useState(false);
  const [localDrafts, setLocalDrafts] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false), inFlight = useRef(false), generation = useRef(0), version = useRef('');
  const url = `/api/management/users/${targetId}/deletion/`;
  const headers = { 'Content-Type': 'application/json', 'X-CSRFToken': token, 'X-Capi-Account': actorId };
  const valid = (ticket: number) => active.current && ticket === generation.current && document.documentElement.dataset.editorLocked !== 'true';
  useEffect(() => {
    active.current = true;
    const refresh = async () => {
      if (locked || inFlight.current) return;
      const ticket = ++generation.current;
      try {
        const response = await fetch(url, { headers: { 'X-Capi-Account': actorId }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
        const data = await response.json() as Preview & { error?: string };
        if (!active.current || ticket !== generation.current) return;
        if (!response.ok || data.user?.id !== targetId) throw new Error(data.error || 'No pudimos preparar la baja. Cancelá y actualizá el listado.');
        if (version.current && version.current !== data.version) { setReceipt(''); setPermanent(false); setError('La cuenta o sus proyectos cambiaron. Revisá los nuevos datos y prepará otro respaldo.'); }
        version.current = data.version; setPreview(data);
      } catch (failure) { if (active.current && ticket === generation.current) { setPreview(null); setReceipt(''); setError(failure instanceof Error ? failure.message : 'No hay conexión.'); } }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      active.current = false;
      // Epoch de peticiones, no referencia DOM.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      window.clearInterval(timer);
    };
  }, [actorId, locked, targetId, url]);

  async function backup() {
    if (!preview?.canDelete || !privateBackup || locked || inFlight.current) return;
    const ticket = ++generation.current;
    inFlight.current = true; setBusy(true); setError(''); setReceipt(''); setPermanent(false);
    try {
      const response = await fetch(`${url}backup/`, { method: 'POST', headers, body: JSON.stringify({ version: preview.version, confirmsPrivateBackup: true }), signal: AbortSignal.timeout(60000) });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || 'No se pudo generar el respaldo.'); }
      const newReceipt = response.headers.get('X-Capi-Backup-Receipt'), checksum = response.headers.get('X-Capi-Backup-SHA256');
      const blob = await response.blob();
      if (!newReceipt || !checksum || blob.size === 0 || blob.size > 55_000_000) throw new Error('El respaldo recibido está incompleto o no es válido.');
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
      if (!valid(ticket)) return;
      if (hash !== checksum) throw new Error('La descarga no coincide con el respaldo; no se habilitó la eliminación.');
      const objectUrl = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = objectUrl; link.download = `respaldo-cuenta-${targetId}.zip`; link.click(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      setReceipt(newReceipt);
    } catch (failure) { if (valid(ticket)) setError(failure instanceof Error ? failure.message : 'Descarga interrumpida. No se eliminó la cuenta.'); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }

  async function remove() {
    if (!preview?.canDelete || locked || inFlight.current || alias !== preview.user.alias || !localDrafts || !permanent || (preview.projects.count > 0 && !receipt)) return;
    const ticket = ++generation.current;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(url, { method: 'DELETE', headers, body: JSON.stringify({ version: preview.version, backupReceipt: receipt, confirmationAlias: alias, understandsLocalDrafts: localDrafts, understandsPermanent: permanent }), signal: AbortSignal.timeout(15000) });
      const data = await response.json() as { error?: string; deleted?: boolean };
      if (!valid(ticket)) return;
      if (!response.ok || data.deleted !== true) throw new Error(data.error || 'No se confirmó la baja. Cancelá y actualizá antes de repetir.');
      deleted();
    } catch (failure) { if (valid(ticket)) { setReceipt(''); setPermanent(false); setError(failure instanceof Error ? failure.message : 'Resultado no confirmado. Cancelá y actualizá antes de repetir.'); } }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) close(); }}><AlertDialogContent className="management-dialog">
    <AlertDialogHeader><AlertDialogTitle>Eliminar cuenta definitivamente</AlertDialogTitle><AlertDialogDescription>Esta baja elimina la cuenta y sus proyectos del servidor. No se puede deshacer; el ZIP permite importar los trabajos como proyectos nuevos.</AlertDialogDescription></AlertDialogHeader>
    {error && <p role="alert" className="account-error">{error}</p>}
    {!preview ? <p>Verificando cuenta, proyectos y membresías… Si no hay conexión, cancelá y reintentá.</p> : <>
      <p><strong>{preview.user.displayName}</strong> (@{preview.user.alias}) · {preview.user.isActive ? 'Activa' : 'Inactiva'}</p>
      <p>{preview.projects.count} proyectos: {preview.projects.active} activos y {preview.projects.trash} en papelera · {(preview.projects.bytes / 1_000_000).toFixed(2)} MB. {preview.memberships} membresías.</p>
      {!preview.canDelete ? <p className="account-error">Primero cancelá, desactivá la cuenta desde Editar y retirale todas sus membresías en Gestionar cursos (incluidos los archivados). El último administrador activo está protegido.</p> : <>
        <label htmlFor="backup-private" className="management-check"><Checkbox id="backup-private" checked={privateBackup} disabled={busy} onCheckedChange={setPrivateBackup} />Entiendo que el respaldo incluye trabajos privados y lo preparo para esta baja.</label>
        <Button variant="outline" disabled={busy || !privateBackup} onClick={() => void backup()}>Descargar respaldo ZIP</Button>
        {receipt && <output className="account-notice">ZIP recibido y verificado. Comprobá que quedó guardado en Descargas antes de confirmar. Vigencia para esta baja: 10 minutos.</output>}
        <p>Incluye los JSON activos y de papelera. No contiene contraseñas ni borradores locales; no restablece la cuenta original ni comparte automáticamente los proyectos importados.</p>
        <label htmlFor="backup-local" className="management-check"><Checkbox id="backup-local" checked={localDrafts} disabled={busy} onCheckedChange={setLocalDrafts} />Entiendo que los borradores locales no están respaldados y debo pedir que los exporten antes de esta baja.</label>
        <label htmlFor="backup-permanent" className="management-check"><Checkbox id="backup-permanent" checked={permanent} disabled={busy || (preview.projects.count > 0 && !receipt)} onCheckedChange={setPermanent} />Conservé el respaldo si hay proyectos y confirmo la eliminación definitiva.</label>
        <label htmlFor="delete-alias">Escribí el alias exacto para confirmar<Input id="delete-alias" disabled={busy} autoComplete="off" maxLength={32} value={alias} onChange={event => setAlias(event.target.value)} /></label>
      </>}
    </>}
    <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy || locked || !preview?.canDelete || !localDrafts || !permanent || alias !== preview?.user.alias || (preview.projects.count > 0 && !receipt)} onClick={() => void remove()}>{busy ? 'Procesando…' : 'Eliminar definitivamente'}</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}
