'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CloudProject } from '@/lib/project-library';
import { decodeProject, downloadText, safeFilename } from '@/lib/capiblocks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type Version = { revision: number; title: string; createdAt: string; kind: string; current: boolean; pinned: boolean; bytes: number };
type History = { project: CloudProject; versions: Version[] };
type Operation = { url: string; method: string; body: string; action: 'restore' | 'remove' | 'purge' };

export default function ProjectHistory({ project, request, close, changed }: {
  project: CloudProject;
  request: <T>(url: string, options?: RequestInit) => Promise<T>;
  close: () => void;
  changed: () => void;
}) {
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [target, setTarget] = useState<{ version?: Version; action: Operation['action'] } | null>(null);
  const [pending, setPending] = useState<Operation | null>(null);
  const [checkedAt, setCheckedAt] = useState(0);
  const alive = useRef(true), running = useRef(false);
  const requestRef = useRef(request);
  useLayoutEffect(() => { requestRef.current = request; }, [request]);
  const url = `/api/projects/${project.id}/`;
  async function load() {
    try { const result = await requestRef.current<History>(`${url}history/`); if (alive.current) { setData(result); setCheckedAt(Date.now()); setError(''); } }
    catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'No pudimos leer las versiones.'); }
  }
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [project.id]); // oxlint-disable-line react-hooks/exhaustive-deps

  async function exportVersion(version: Version) {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const result = await requestRef.current<{ document: unknown }>(`${url}history/${version.revision}/`);
      const parsed = decodeProject(result.document);
      if (!parsed.project) throw new Error('Esta versión no contiene un proyecto compatible.');
      if (alive.current) downloadText(`${safeFilename(version.title)}-v${version.revision}.capibloques.json`, JSON.stringify(parsed.project, null, 2), 'application/json');
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'No se pudo exportar.'); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }
  async function confirm() {
    if (!data || !target || running.current) return;
    const operation = pending ?? {
      url: target.action === 'purge' ? `${url}purge/` : `${url}history/${target.version!.revision}/${target.action === 'restore' ? 'restore/' : ''}`,
      method: target.action === 'remove' ? 'DELETE' : 'POST',
      body: JSON.stringify({ operationId: crypto.randomUUID(), revision: data.project.revision, ...(target.action !== 'restore' ? { confirmation } : {}) }),
      action: target.action,
    };
    running.current = true; setPending(operation); setBusy(true); setError('');
    try {
      await requestRef.current(operation.url, { method: operation.method, body: operation.body });
      if (!alive.current) return;
      changed(); setPending(null); setTarget(null); setConfirmation('');
      if (operation.action === 'purge') { close(); return; }
      setNotice(operation.action === 'restore' ? 'Versión restaurada en tu cuenta como una versión nueva. Tu editor no cambió: volvé a la biblioteca y abrí el proyecto para cargarla.' : 'Versión anterior eliminada. El contenido actual no cambió.');
      await load();
    } catch (failure) {
      if (alive.current) {
        const status = (failure as { status?: number }).status;
        // Un rechazo definitivo permite actualizar y preparar otra operación;
        // un resultado incierto sólo reintenta el cuerpo original.
        if (status && status >= 400 && status < 500) { setPending(null); setTarget(null); }
        setError(failure instanceof Error ? failure.message : 'No se confirmó la operación. Reintentá sin cambiarla.');
      }
    } finally { running.current = false; if (alive.current) setBusy(false); }
  }
  const purgeReady = Boolean(data?.project.purgeAfter && Date.parse(data.project.purgeAfter) <= checkedAt);
  const expected = target?.action === 'purge' ? data?.project.title : String(target?.version?.revision);
  return <Dialog open onOpenChange={value => { if (!value && !busy && !pending) close(); }}>
    <DialogContent className="management-dialog project-history-dialog" showCloseButton={!busy && !pending}>
      <DialogHeader><DialogTitle>Historial de {project.title}</DialogTitle><DialogDescription>Conservamos las últimas 20 versiones. Restaurar no cambia tu editor abierto.</DialogDescription></DialogHeader>
      <details><summary>Límites del historial</summary><p>Hasta 20 versiones recientes, más las referenciadas; 50 MB de historial por cuenta. Guardados manuales y puntos automáticos cada 5 minutos. Las más antiguas no referenciadas se reemplazan al superar 20. La versión actual siempre se conserva.</p></details>
      {!data && !error && <output>Cargando versiones…</output>}
      {error && <p role="alert" className="account-error">{error}</p>}
      {notice && <output>{notice}</output>}
      {target ? <section aria-label="Confirmar cambio de historial">
        <h2>{target.action === 'restore' ? `¿Restaurar versión ${target.version?.revision}?` : target.action === 'remove' ? `¿Eliminar versión ${target.version?.revision}?` : '¿Eliminar definitivamente el proyecto?'}</h2>
        <p>{target.action === 'restore' ? 'Se guardará como una versión nueva en tu cuenta. Tus cambios abiertos en el editor quedan intactos y no se fusionan.' : 'Este borrado no se puede deshacer. Exportá las versiones que quieras conservar antes de confirmar. No borra archivos descargados ni copias de otros navegadores.'}</p>
        {target.action !== 'restore' && <label>Escribí {target.action === 'purge' ? 'el nombre exacto del proyecto' : 'el número de versión'}: {expected}<Input aria-label="Confirmación de borrado" value={confirmation} disabled={busy || Boolean(pending)} onChange={event => setConfirmation(event.target.value)} /></label>}
        {pending && <p>Resultado sin confirmar. Reintentá la misma operación. Si cerrás, revisá el historial al volver: cancelar la vista no revierte una petición enviada.</p>}
        <div className="account-actions">
          <Button variant="outline" disabled={busy} onClick={() => { setTarget(null); setPending(null); setConfirmation(''); void load(); }}>Cancelar</Button>
          <Button variant={target.action === 'restore' ? 'default' : 'destructive'} disabled={busy || (!pending && target.action !== 'restore' && confirmation !== expected)} onClick={() => void confirm()}>{busy ? 'Confirmando…' : pending ? 'Reintentar misma operación' : target.action === 'restore' ? 'Restaurar como nueva versión' : target.action === 'purge' ? 'Eliminar proyecto definitivamente' : 'Eliminar esta versión'}</Button>
        </div>
      </section> : <>
        <div className="library-list">{data?.versions.map(version => <article className="library-project" key={version.revision}>
          <h2>Versión {version.revision}{version.current ? ' · Actual' : ''}</h2>
          <p>{version.title} · {new Date(version.createdAt).toLocaleString('es-AR')} · {version.kind === 'automatic' ? 'Automática' : version.kind === 'restored' ? 'Restaurada' : 'Manual'}{version.pinned ? ' · Referenciada (protegida)' : ''}</p>
          <div className="account-actions">
            <Button variant="outline" disabled={busy} onClick={() => void exportVersion(version)}>Exportar versión {version.revision}</Button>
            {!version.current && <><Button disabled={busy || Boolean(data.project.trashedAt) || data.project.course?.ownerCanEdit === false} onClick={() => setTarget({ version, action: 'restore' })}>Restaurar versión {version.revision}</Button><Button variant="outline" disabled={busy || version.pinned} onClick={() => setTarget({ version, action: 'remove' })}>Eliminar versión {version.revision}</Button></>}
          </div>
        </article>)}</div>
        {data?.project.trashedAt && <section><p>Protegido en papelera hasta {new Date(data.project.purgeAfter ?? Date.parse(data.project.trashedAt) + 30 * 86400000).toLocaleString('es-AR')}. Después puede eliminarse definitivamente, junto con todas sus versiones. Hasta entonces podés restaurarlo desde la biblioteca.</p><Button variant="destructive" disabled={busy || !purgeReady} onClick={() => setTarget({ action: 'purge' })}>Eliminar definitivamente…</Button></section>}
        <div className="account-actions"><Button variant="outline" disabled={busy} onClick={() => void load()}>Actualizar historial</Button><Button disabled={busy} onClick={close}>Volver a la biblioteca</Button></div>
      </>}
    </DialogContent>
  </Dialog>;
}
