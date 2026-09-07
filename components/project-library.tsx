'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { FolderOpen, Save } from 'lucide-react';
import ProjectCourseDialog from '@/components/project-course';
import ProjectHistory from '@/components/project-history';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjectAutosave } from '@/components/use-project-autosave';
import LocalRecovery from '@/components/local-recovery';
import type { DurableSave } from '@/lib/project-recovery';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  decodeProject,
  downloadText,
  safeFilename,
  type ProjectFile,
} from '@/lib/capiblocks';
import {
  projectFingerprint,
  type CloudProject,
  type ProjectLink,
} from '@/lib/project-library';
import { announceSessionChange, type Account, type AccountDraftStore } from '@/lib/account-session';

export type ProjectLibraryHandle = {
  detach: () => void;
  replace: (action: () => void) => void;
};
type Props = {
  account: Account;
  store: AccountDraftStore;
  csrfToken: string;
  hydrated: boolean;
  sceneEditing: boolean;
  offline?: boolean;
  fingerprint: string;
  capture: () => ProjectFile;
  apply: (file: ProjectFile) => void;
  onNew: () => void;
  onImport: () => void;
  notice: (message: string) => void;
};
type Listing = {
  projects: CloudProject[];
  count: number;
  page: number;
  pageSize: number;
  actor: Account;
  csrfToken: string;
};
type PendingSave = DurableSave & { generation: number };

class LibraryRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

const ProjectLibrary = forwardRef<ProjectLibraryHandle, Props>(
  function ProjectLibrary(
    {
      account,
      store,
      csrfToken,
      hydrated,
      sceneEditing,
      offline = false,
      fingerprint,
      capture,
      apply,
      onNew,
      onImport,
      notice,
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [listing, setListing] = useState<Listing | null>(null);
    const [link, setLink] = useState<ProjectLink | null>(null);
    const [context, setContext] = useState<CloudProject | null>(null);
    const [courseProject, setCourseProject] = useState<CloudProject | null>(null);
    const [historyProject, setHistoryProject] = useState<CloudProject | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [cloudNotice, setCloudNotice] = useState('');
    const [pending, setPending] = useState(false);
    const [conflict, setConflict] = useState(false);
    const [autoEnabled, setAutoEnabled] = useState(true);
    const [autoReady, setAutoReady] = useState(false);
    const [autoPaused, setAutoPaused] = useState(false);
    const [localError, setLocalError] = useState(store.recoveryError);
    const [localBusy, setLocalBusy] = useState(false);
    useEffect(() => store.subscribe(() => { setLocalError(store.recoveryError); setLocalBusy(store.recovering); }), [store]);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState({ q: '', state: 'active', page: 1 });
    const [rename, setRename] = useState<{
      project: CloudProject;
      title: string;
    } | null>(null);
    const [trash, setTrash] = useState<CloudProject | null>(null);
    const [replacePrompt, setReplacePrompt] = useState(false);
    const replacing = useRef<(() => void) | null>(null);
    const [initialFingerprint, setInitialFingerprint] = useState('');
    const generation = useRef(0);
    const active = useRef(false);
    const inFlight = useRef(false);
    const pendingSave = useRef<PendingSave | null>(null);
    const latestCapture = useRef(capture);
    useLayoutEffect(() => { latestCapture.current = capture; }, [capture]);
    const duplicateIntent = useRef<{ source: string; body: string } | null>(
      null,
    );
    const listEpoch = useRef(0);
    const headers = useCallback(
      () => ({
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Capi-Account': account.id,
      }),
      [account.id, csrfToken],
    );
    const valid = useCallback(
      (ticket: number) =>
        active.current && store.active && store.remoteAllowed && generation.current === ticket,
      [store],
    );
    const dirty = Boolean(
      hydrated &&
      fingerprint !== (link?.savedFingerprint ?? initialFingerprint),
    );
    const autoKey = `capibloques-account:${account.id}:server-autosave`;
    useEffect(() => {
      let disposed = false;
      queueMicrotask(() => {
        if (disposed) return;
        try { setAutoEnabled(localStorage.getItem(autoKey) !== 'false'); } catch { /* La opción sigue disponible en memoria. */ }
        setAutoReady(true);
      });
      return () => { disposed = true; };
    }, [autoKey]);
    useProjectAutosave({
      identity: link?.id ?? (pending ? 'pending-create' : null), fingerprint, needed: dirty || pending,
      enabled: autoReady && autoEnabled,
      paused: busy || open || sceneEditing || replacePrompt || autoPaused || conflict || context?.course?.ownerCanEdit === false,
      ready: () => hydrated && active.current && store.active && store.remoteAllowed && !store.recoveryError && !inFlight.current && document.documentElement.dataset.editorLocked !== 'true',
      save: () => save(false, true),
    });

    useEffect(() => {
      if (!link?.id || busy) return;
      let disposed = false;
      let checks = 0;
      const id = link.id;
      const check = async () => {
        if (!store.active || !store.remoteAllowed || inFlight.current) return;
        const ticket = generation.current;
        const sequence = ++checks;
        const baseRevision = store.remote?.revision;
        try {
          const response = await fetch(`/api/projects/${id}/?metadata=1`, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(12000) });
          const data = await response.json() as { project?: CloudProject };
          if (disposed || !valid(ticket) || sequence !== checks || inFlight.current || store.remote?.id !== id || store.remote?.revision !== baseRevision) return;
          if (!response.ok || data.project?.id !== id) { setContext(null); return; }
          setContext(data.project);
          if ((!store.pending && data.project.revision !== store.remote?.revision) || data.project.course?.ownerCanEdit === false) setConflict(true);
        } catch { if (!disposed && valid(ticket) && sequence === checks && !inFlight.current && store.remote?.id === id && store.remote?.revision === baseRevision) setContext(null); }
      };
      void check();
      const timer = window.setInterval(() => void check(), 15000);
      window.addEventListener('focus', check);
      return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', check); };
    }, [link?.id, link?.revision, busy, store, headers, valid]);

    useEffect(() => {
      active.current = true;
      return () => {
        active.current = false;
        // Epoch lógico, no una referencia DOM: invalidar respuestas al desmontar.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
        ++generation.current;
      };
    }, []);
    useEffect(() => {
      if (!hydrated) return;
      let disposed = false;
      queueMicrotask(() => {
        if (!disposed) {
          setLink(store.remote);
          pendingSave.current = store.pending ? { ...store.pending, generation: generation.current } : null;
          setPending(Boolean(store.pending));
          if (store.pending) setCloudNotice('Recuperamos un envío pendiente. Podés reintentarlo sin crear otra copia.');
          setInitialFingerprint(projectFingerprint(capture()));
        }
      });
      return () => {
        disposed = true;
      };
      // Inicializar una sola vez desde el borrador ya recuperado, no en cada edición.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [hydrated, store]);
    useEffect(() => {
      if ((!link || !dirty) && !pending) return;
      const warn = (event: BeforeUnloadEvent) => event.preventDefault();
      window.addEventListener('beforeunload', warn);
      return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, link, pending]);

    const detach = useCallback(() => {
      ++generation.current;
      store.start(null);
      setLink(null);
      pendingSave.current = null;
      setPending(false);
      setConflict(false);
      setAutoPaused(false);
      setError('');
      setCloudNotice(
        'Sólo en esta computadora · guardá para agregarlo a tu cuenta.',
      );
      // Un proyecto importado/nuevo nunca conserva la identidad del anterior.
    }, [store]);
    const replace = useCallback(
      (action: () => void) => {
        if (!store.active || inFlight.current) return;
        if (dirty || pendingSave.current || store.sceneDraft) {
          replacing.current = action;
          setReplacePrompt(true);
        } else action();
      },
      [dirty, store],
    );
    useImperativeHandle(ref, () => ({ detach, replace }), [detach, replace]);

    async function request<T>(
      url: string,
      options: RequestInit = {},
    ): Promise<T> {
      if (!store.active || !store.remoteAllowed) throw new Error('Sin conexión verificada. Guardá localmente o exportá JSON.');
      const ticket = generation.current;
      const result = await fetch(url, {
        ...options,
        headers: { ...headers(), ...Object.fromEntries(new Headers(options.headers)) },
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      const data = (await result.json().catch(() => ({ error: 'El servidor devolvió una respuesta no válida.' }))) as T & {
        error?: string;
        code?: string;
      };
      if (!valid(ticket)) throw new Error('La sesión o el proyecto cambió durante la operación. Revisá el resultado al volver a ingresar.');
      if (!result.ok) {
        if (
          result.status === 401 ||
          result.status === 403 ||
          data.code === 'account_changed'
        ) {
          announceSessionChange();
          throw new LibraryRequestError(
            'Tu sesión cambió. Volvé a Mi cuenta antes de continuar.',
            result.status,
          );
        }
        if (
          active.current &&
          store.active &&
          (data.code === 'stale_revision' ||
          data.code === 'trashed' ||
          data.code === 'course_locked' ||
            data.code === 'operation_conflict')
        )
          setConflict(true);
        throw new LibraryRequestError(data.error || 'No pudimos completar la operación.', result.status);
      }
      return data;
    }

    const refresh = useCallback(async () => {
      if (!active.current || !store.active || !store.remoteAllowed || inFlight.current) return;
      const ticket = generation.current;
      const sequence = ++listEpoch.current;
      try {
        const response = await fetch(
          `/api/projects/?${new URLSearchParams({ ...filter, page: String(filter.page) })}`,
          {
            headers: headers(),
            cache: 'no-store',
            signal: AbortSignal.timeout(12000),
          },
        );
        const data = (await response.json()) as Listing & { error?: string };
        if (!valid(ticket) || sequence !== listEpoch.current) return;
        if (
          !response.ok ||
          data.actor?.id !== account.id ||
          !Array.isArray(data.projects)
        ) {
          setListing(null);
          throw new Error(data.error || 'Verificá tu sesión y reintentá.');
        }
        setListing(data);
      } catch (failure) {
        if (valid(ticket) && sequence === listEpoch.current) {
          setListing(null);
          setError(
            failure instanceof Error
              ? failure.message
              : 'No pudimos cargar tu biblioteca.',
          );
        }
      }
    }, [account.id, filter, headers, store, valid]);
    useEffect(() => {
      if (!open) return;
      let disposed = false;
      queueMicrotask(() => {
        if (!disposed) void refresh();
      });
      const focus = () => {
        void refresh();
      };
      const timer = window.setInterval(focus, 15000);
      window.addEventListener('focus', focus);
      return () => {
        disposed = true;
        // Epoch lógico para descartar listados de una búsqueda anterior.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
        ++listEpoch.current;
        window.clearInterval(timer);
        window.removeEventListener('focus', focus);
      };
    }, [open, refresh]);

    async function save(copy = false, automatic = false): Promise<boolean> {
      if (!store.active || inFlight.current || !hydrated) return false;
      if (!store.remoteAllowed) {
        if (copy || automatic) return false;
        try { store.write(JSON.stringify(capture())); await store.flush(); notice('Guardado sólo en esta computadora. Reconectá para enviar a tu cuenta.'); return true; }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar localmente. Exportá JSON.'); return false; }
      }
      inFlight.current = true;
      setBusy(true);
      setError('');
      setCloudNotice('');
      try {
        if (copy || !pendingSave.current) {
          const document = capture();
          if (copy)
            document.metadata.title = `${document.metadata.title.slice(0, 72)} (copia)`;
          const remote = copy ? null : store.remote;
          const body = remote
            ? {
                operationId: crypto.randomUUID(),
                revision: remote.revision,
                document,
              }
            : {
                id: crypto.randomUUID(),
                operationId: crypto.randomUUID(),
                document,
              };
          pendingSave.current = {
            copy,
            automatic,
            url: remote ? `/api/projects/${remote.id}/` : '/api/projects/',
            method: remote ? 'PUT' : 'POST',
            body: JSON.stringify(body),
            fingerprint: projectFingerprint(document),
            generation: generation.current,
          };
        }
        const operation = pendingSave.current;
        const { generation: _generation, ...durable } = operation;
        store.setPending(durable);
        store.write(JSON.stringify(capture()));
        setPending(true);
        // No iniciar red hasta confirmar la transacción local con documento,
        // revisión base y operación inmutable. Una recarga puede repetirla.
        await store.flush();
        if (!valid(operation.generation)) return false;
        const result = await request<{ project: CloudProject }>(operation.url, {
          method: operation.method,
          body: operation.body,
          headers: { 'X-Capi-Save-Mode': operation.automatic ? 'automatic' : 'manual' },
        });
        if (!valid(operation.generation)) return false;
        const next = {
          id: result.project.id,
          course: result.project.course,
          revision: result.project.revision,
          savedFingerprint: operation.fingerprint,
        };
        store.attach(next);
        setLink(next);
        setContext(result.project);
        pendingSave.current = null;
        store.setPending(null);
        setPending(false);
        setConflict(false);
        setAutoPaused(false);
        // La petición conserva su instantánea; la copia local conserva el editor
        // más reciente, aunque haya cambiado mientras esperábamos la respuesta.
        const current = latestCapture.current();
        if (operation.copy) {
          current.metadata.title = result.project.title;
          apply(current);
        }
        try {
          store.write(JSON.stringify(current));
          await store.flush();
        } catch {
          setError(
            'Guardado en servidor. No se pudo actualizar la copia local; abrilo desde Mis proyectos al volver.',
          );
        }
        setCloudNotice('Proyecto guardado en tu cuenta.');
        if (!automatic) notice('Proyecto guardado en tu cuenta');
        return true;
      } catch (failure) {
        if (active.current) {
          if (failure instanceof LibraryRequestError && failure.status >= 400 && failure.status < 500) setAutoPaused(true);
          // Rechazo confirmado: permitir corregir el proyecto y enviar otra
          // instantánea. Sólo los resultados inciertos conservan el reintento.
          if (failure instanceof LibraryRequestError && (failure.status === 400 || failure.status === 413)) {
            pendingSave.current = null; setPending(false);
            store.setPending(null);
            store.write(JSON.stringify(latestCapture.current()));
          }
          setError(
            failure instanceof Error
              ? failure.message
              : 'Conexión interrumpida. Reintentá el mismo guardado o exportá tu JSON.',
          );
        }
        return false;
      } finally {
        inFlight.current = false;
        if (active.current) {
          setBusy(false);
          if (open) void refresh();
        }
      }
    }

    async function read(
      project: CloudProject,
      action: 'open' | 'export' | 'duplicate',
    ) {
      if (!store.active || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError('');
      const ticket = generation.current;
      try {
        const data = await request<{
          project: CloudProject;
          document: unknown;
        }>(`/api/projects/${project.id}/`);
        if (!valid(ticket)) return;
        const decoded = decodeProject(data.document);
        if (!decoded.project)
          throw new Error(
            decoded.diagnostics[0]?.message ||
              'El archivo del servidor no es compatible.',
          );
        const file = decoded.project;
        if (action === 'export') {
          downloadText(
            `${safeFilename(data.project.title)}.capibloques.json`,
            JSON.stringify(file, null, 2),
            'application/json',
          );
          return;
        }
        if (action === 'duplicate') {
          file.metadata.title = `${file.metadata.title.slice(0, 72)} (copia)`;
          if (
            duplicateIntent.current &&
            duplicateIntent.current.source !== project.id
          )
            throw new Error(
              'Hay una copia sin confirmar. Reintentá Duplicar en el proyecto anterior antes de crear otra.',
            );
          duplicateIntent.current ??= {
            source: project.id,
            body: JSON.stringify({
              id: crypto.randomUUID(),
              operationId: crypto.randomUUID(),
              document: file,
            }),
          };
          const result = await request<{ project: CloudProject }>(
            '/api/projects/',
            { method: 'POST', body: duplicateIntent.current.body },
          );
          if (valid(ticket)) {
            duplicateIntent.current = null;
            setCloudNotice(`Copia creada: ${result.project.title}`);
          }
          return;
        }
        if (data.project.trashedAt)
          throw new Error('Restaurá el proyecto antes de abrirlo para editar.');
        const openFile = () => {
          if (!store.active) return;
          ++generation.current;
          const justSaved =
            store.remote?.id === data.project.id &&
            store.remote.revision > data.project.revision;
          const opened = justSaved ? latestCapture.current() : file;
          const next = justSaved
            ? store.remote!
            : {
                id: data.project.id,
                course: data.project.course,
                revision: data.project.revision,
                savedFingerprint: projectFingerprint(file),
              };
          store.start(next);
          setLink(next);
          if (!justSaved) setContext(data.project);
          pendingSave.current = null;
          setPending(false);
          setConflict(false);
          setAutoPaused(false);
          apply(opened);
          setOpen(false);
          setError('');
          setCloudNotice('Versión del servidor abierta.');
          try {
            store.write(JSON.stringify(opened));
          } catch {
            setError(
              'Proyecto abierto. No pudimos actualizar el borrador local; exportá JSON antes de cerrar si hacés cambios.',
            );
          }
        };
        if (dirty || pendingSave.current) {
          replacing.current = openFile;
          setReplacePrompt(true);
        } else openFile();
      } catch (failure) {
        if (valid(ticket))
          setError(
            failure instanceof Error
              ? failure.message
              : 'No pudimos abrir el proyecto.',
          );
      } finally {
        inFlight.current = false;
        if (active.current) {
          setBusy(false);
          void refresh();
        }
      }
    }

    async function mutate(
      project: CloudProject,
      action: 'rename' | 'trash' | 'restore',
      newTitle?: string,
    ) {
      if (!store.active || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError('');
      const ticket = generation.current;
      try {
        await request(`/api/projects/${project.id}/${action}/`, {
          method: 'POST',
          body: JSON.stringify({
            operationId: crypto.randomUUID(),
            revision: project.revision,
            ...(action === 'rename' ? { title: newTitle } : {}),
          }),
        });
        if (!valid(ticket)) return;
        setRename(null);
        setTrash(null);
        setCloudNotice(
          action === 'trash'
            ? 'Proyecto enviado a la papelera. Podés restaurarlo.'
            : action === 'restore'
              ? 'Proyecto restaurado.'
              : 'Nombre actualizado.',
        );
        if (project.id === store.remote?.id) {
          setConflict(true);
          setError(
            'El proyecto abierto cambió en la biblioteca. Abrí su versión actual antes de volver a guardar, o guardá tu edición como copia.',
          );
        }
      } catch (failure) {
        if (valid(ticket))
          setError(
            failure instanceof Error
              ? failure.message
              : 'Resultado no confirmado. Actualizá la biblioteca antes de repetir.',
          );
      } finally {
        inFlight.current = false;
        if (active.current) {
          setBusy(false);
          void refresh();
        }
      }
    }

    function completeReplacement() {
      if (!store.active) return;
      const action = replacing.current;
      replacing.current = null;
      setReplacePrompt(false);
      action?.();
    }

    async function replaceLocally(discard: boolean) {
      if (!store.active || inFlight.current) return;
      setBusy(true);
      try {
        store.write(JSON.stringify(latestCapture.current()));
        await store.flush();
        if (!store.active) return;
        if (discard) await store.recovery.discardCurrent();
        if (store.active) completeReplacement();
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'No pudimos conservar los cambios. Exportá JSON antes de continuar.'); }
      finally { setBusy(false); }
    }

    async function openLocal(id: string) {
      if (!store.active || inFlight.current) return;
      const ticket = generation.current;
      inFlight.current = true; setBusy(true);
      try {
        const row = await store.restore(id);
        if (!valid(ticket)) return;
        const file = decodeProject(JSON.parse(row.document)).project;
        if (!file) throw new Error('La copia local no es compatible.');
        ++generation.current;
        setLink(row.remote); setContext(null);
        pendingSave.current = row.pending ? { ...row.pending, generation: generation.current } : null;
        setPending(Boolean(row.pending)); setConflict(false); setAutoPaused(false);
        setInitialFingerprint(projectFingerprint(file));
        apply(file); setOpen(false); setError('');
        setCloudNotice('Copia local recuperada. Revisá el estado antes de salir.');
      } catch (failure) { if (store.active) setError(failure instanceof Error ? failure.message : 'No pudimos recuperar la copia.'); }
      finally { inFlight.current = false; if (active.current) setBusy(false); }
    }
    const status = offline ? 'Sin conexión · guardado local, sin enviar' : busy
      ? 'Guardando o consultando…'
      : conflict
        ? 'Conflicto pendiente · revisá Mis proyectos'
        : pending
        ? 'Guardado sin confirmar · reintentá o exportá'
        : link
          ? dirty
            ? 'Cambios sólo en esta computadora'
            : 'Guardado en tu cuenta'
          : 'Sólo en esta computadora';
    return (
      <>
        <button
          className="header-text-button save-project-button"
          disabled={busy || !hydrated}
          onClick={() => void save()}
        >
          <Save size={18} />
          Guardar
        </button>
        <button
          className="header-text-button"
          disabled={!hydrated || busy || offline}
          title={offline ? 'Reconectá para abrir proyectos del servidor' : undefined}
          onClick={() => {
            setError('');
            setCloudNotice('');
            setListing(null);
            setOpen(true);
          }}
        >
          <FolderOpen size={18} />
          Mis proyectos
        </button>
        <span className="cloud-state" aria-live="polite">
          {link ? context?.id === link.id ? context.course ? `Curso ${context.course.name}${context.course.ownerCanEdit ? ' · Visible para sus docentes' : ' · Sólo lectura; continuá con una copia'}` : 'Personal' : 'Visibilidad sin verificar' : 'Personal'} · {status}
          {link && autoEnabled && <span> · {offline || autoPaused || conflict ? 'Autoguardado pausado' : 'Auto activo'}</span>}
          {localBusy && <span> · Conservando copia local…</span>}
        </span>
        {localError && <span className="cloud-error" role="alert">{localError} Exportá JSON antes de salir.</span>}
        {error && !open && (
          <span className="cloud-error" role="alert">
            {error}
            <Button
              variant="outline"
              disabled={busy || offline}
              onClick={() => setOpen(true)}
            >
              Revisar guardado
            </Button>
          </span>
        )}
        <Dialog
          open={open && !offline}
          onOpenChange={(value) => {
            if (!busy) {
              setOpen(value);
              if (!value) {
                setRename(null);
                setTrash(null);
              }
            }
          }}
        >
          <DialogContent
            className="management-dialog library-dialog"
            showCloseButton={!busy}
          >
            <DialogHeader>
              <DialogTitle>Mis proyectos</DialogTitle>
              <DialogDescription>
                Proyectos de {account.displayName}. Los personales son privados;
                los asignados a cursos también son visibles para sus docentes.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
            {cloudNotice && (
              <output className="account-notice">{cloudNotice}</output>
            )}
            {(pending || conflict) && (
              <section className="library-recovery">
                <h2>Conservamos tu trabajo del editor</h2>
                <div className="account-actions">
                  <Button disabled={busy} onClick={() => void save()}>
                    Reintentar guardado
                  </Button>
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => void save(true)}
                  >
                    Guardar editor como copia
                  </Button>
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => {
                      const file = capture();
                      downloadText(
                        `${safeFilename(file.metadata.title)}.capibloques.json`,
                        JSON.stringify(file, null, 2),
                        'application/json',
                      );
                    }}
                  >
                    Exportar editor JSON
                  </Button>
                </div>
                <p>
                  No mezclamos versiones. Abrir un proyecto del listado permite
                  revisar la versión del servidor.
                </p>
              </section>
            )}
            <div className="account-actions">
              <Button
                disabled={busy}
                onClick={() =>
                  replace(() => {
                    detach();
                    setOpen(false);
                    onNew();
                  })
                }
              >
                Nuevo proyecto
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  onImport();
                }}
              >
                Importar JSON
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => void refresh()}
              >
                Actualizar biblioteca
              </Button>
            </div>
            <form
              className="library-filters"
              onSubmit={(event) => {
                event.preventDefault();
                setFilter({ ...filter, q: query, page: 1 });
              }}
            >
              <label htmlFor="library-search">
                Buscar proyecto
                <Input
                  id="library-search"
                  maxLength={80}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label htmlFor="library-state">
                Mostrar
                <select
                  id="library-state"
                  disabled={busy}
                  value={filter.state}
                  onChange={event => setFilter({ ...filter, state: event.target.value, page: 1 })}
                >
                  <option value="active">Mis proyectos</option>
                  <option value="trash">Papelera</option>
                </select>
              </label>
              <Button variant="outline" type="submit" disabled={busy}>
                Buscar
              </Button>
            </form>
            {!listing ? (
              <p>
                Actualizá para cargar tu biblioteca. Si no hay conexión, podés
                cerrar esta ventana y exportar desde el editor.
              </p>
            ) : (
              <>
                {!listing.count && (
                  <p>
                    {filter.state === 'trash'
                      ? 'La papelera está vacía.'
                      : 'Todavía no hay proyectos guardados en esta vista. Usá Guardar en el editor para agregar el primero.'}
                  </p>
                )}
                <div className="library-list">
                  {listing.projects.map((project) => (
                    <article className="library-project" key={project.id}>
                      <h2>{project.title}</h2>
                      <p>{project.course ? `Curso ${project.course.name}${project.course.ownerCanEdit ? ' · Visible para sus docentes' : ' · Conservado, continuar con copia personal'}` : 'Personal · sólo vos'}</p>
                      <p>
                        Versión {project.revision} ·{' '}
                        {new Date(project.updatedAt).toLocaleString('es-AR')}
                        {project.id === link?.id
                          ? ' · Abierto en el editor'
                          : ''}
                      </p>
                      <div className="account-actions">
                        <Button disabled={busy} variant="outline" onClick={() => setHistoryProject(project)}>Historial de {project.title}</Button>
                        {project.trashedAt ? (
                          <Button
                            disabled={busy}
                            onClick={() => void mutate(project, 'restore')}
                          >
                            Restaurar {project.title}
                          </Button>
                        ) : (
                          <>
                            <Button
                              disabled={busy}
                              onClick={() => void read(project, 'open')}
                            >
                              Abrir {project.title}
                            </Button>
                            <Button
                              disabled={busy}
                              variant="outline"
                              onClick={() =>
                                setRename({ project, title: project.title })
                              }
                            >
                              Renombrar {project.title}
                            </Button>
                            <Button
                              disabled={busy}
                              variant="outline"
                              onClick={() => void read(project, 'duplicate')}
                            >
                              Duplicar {project.title}
                            </Button>
                            <Button
                              disabled={busy}
                              variant="outline"
                              onClick={() => setTrash(project)}
                            >
                              Eliminar {project.title}
                            </Button>
                            <Button disabled={busy} variant="outline" onClick={() => setCourseProject(project)}>Elegir curso de {project.title}</Button>
                          </>
                        )}
                        <Button
                          disabled={busy}
                          variant="outline"
                          onClick={() => void read(project, 'export')}
                        >
                          Exportar JSON de {project.title}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
                <nav
                  className="account-actions"
                  aria-label="Páginas de proyectos"
                >
                  <Button
                    variant="outline"
                    disabled={busy || listing.page <= 1}
                    onClick={() =>
                      setFilter({ ...filter, page: listing.page - 1 })
                    }
                  >
                    Anterior
                  </Button>
                  <span>
                    Página {listing.page} · {listing.count} proyectos
                  </span>
                  <Button
                    variant="outline"
                    disabled={
                      busy || listing.page * listing.pageSize >= listing.count
                    }
                    onClick={() =>
                      setFilter({ ...filter, page: listing.page + 1 })
                    }
                  >
                    Siguiente
                  </Button>
                </nav>
              </>
            )}
            <p className="account-help">
              Hasta 100 proyectos y 50 MB por cuenta, incluida la papelera. En
              la papelera se protegen por 30 días. Luego el borrado definitivo está disponible en Historial; no se ejecuta automáticamente en DEV.
            </p>
            <label htmlFor="server-autosave" className="management-check">
              <Checkbox id="server-autosave" checked={autoEnabled} disabled={!autoReady} onCheckedChange={value => {
                setAutoEnabled(value); if (value) setAutoPaused(false);
                try { localStorage.setItem(autoKey, String(value)); } catch { setError('La opción funciona ahora, pero no pudimos recordarla en este navegador.'); }
              }} />
              Guardar automáticamente en mi cuenta
            </label>
            <p className="account-help">Después del primer Guardar, sube los cambios del proyecto abierto al dejar de editar. Podés usar Guardar en cualquier momento. Esta opción se recuerda para tu cuenta en este navegador. Desactivarla no cancela un envío que ya comenzó.</p>
            <p className="account-help">Los envíos se conservan en este navegador antes de enviarse. Al volver a ingresar podés recuperarlos y reintentar; no dependen de ejecutar código al cerrar. Si aparece un error de copia local, exportá JSON antes de salir. El historial del servidor no incluye escenas todavía sin confirmar.</p>
            {open && <LocalRecovery store={store} onOpen={id => replace(() => { void openLocal(id); })} />}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Volver al editor
            </Button>
          </DialogContent>
        </Dialog>
        {courseProject && !offline && <ProjectCourseDialog key={courseProject.id} project={courseProject} accountId={account.id} token={csrfToken} store={store} close={() => setCourseProject(null)} saved={() => {
          if (courseProject.id === store.remote?.id) { setConflict(true); setContext(null); setError('Cambió el curso del proyecto abierto. Abrí su versión actual desde la biblioteca antes de seguir guardando.'); }
          setCloudNotice('Curso actualizado. Los permisos se aplican a la versión del servidor.'); void refresh();
        }} />}
        {historyProject && !offline && <ProjectHistory key={historyProject.id} project={historyProject} request={request} close={() => setHistoryProject(null)} changed={() => {
          if (historyProject.id === store.remote?.id) { setConflict(true); setContext(null); setError('El historial cambió la versión del servidor. Tus cambios locales siguen intactos. Abrí el proyecto desde la biblioteca o guardá una copia nueva.'); }
          void refresh();
        }} />}
        <Dialog
          open={Boolean(rename) && !offline}
          onOpenChange={(value) => {
            if (!value && !busy) setRename(null);
          }}
        >
          <DialogContent className="management-dialog" showCloseButton={!busy}>
            <DialogHeader>
              <DialogTitle>Renombrar proyecto</DialogTitle>
              <DialogDescription>
                El contenido se conserva. Otra pestaña deberá cargar la nueva
                versión.
              </DialogDescription>
            </DialogHeader>
            {rename && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void mutate(rename.project, 'rename', rename.title);
                }}
              >
                <label htmlFor="library-title">
                  Nombre
                  <Input
                    id="library-title"
                    maxLength={80}
                    required
                    value={rename.title}
                    disabled={busy}
                    onChange={(event) =>
                      setRename({ ...rename, title: event.target.value })
                    }
                  />
                </label>
                {error && (
                  <p role="alert" className="account-error">
                    {error}
                  </p>
                )}
                <div className="account-actions">
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => setRename(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy || rename.title === rename.project.title}
                  >
                    Guardar nombre
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <AlertDialog
          open={Boolean(trash) && !offline}
          onOpenChange={(value) => {
            if (!value && !busy) setTrash(null);
          }}
        >
          <AlertDialogContent className="management-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Enviar a la papelera?</AlertDialogTitle>
              <AlertDialogDescription>
                {trash?.title} dejará de estar en la lista principal. Podés
                restaurarlo desde Papelera; no se borra definitivamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  if (trash) void mutate(trash, 'trash');
                }}
              >
                Enviar a papelera
              </AlertDialogAction>
            </AlertDialogFooter>
            {error && <p role="alert" className="account-error">{error}</p>}
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={replacePrompt} onOpenChange={value => { if (!busy) setReplacePrompt(value); }}>
          <AlertDialogContent className="management-dialog library-replace-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Antes de reemplazar el editor</AlertDialogTitle>
              <AlertDialogDescription>
                Hay cambios locales o un guardado sin confirmar. Podés
                guardarlos primero, conservarlos en esta computadora, descartarlos o cancelar. No se
                modifica la versión ya guardada en tu cuenta al descartar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                variant="outline"
                onClick={event => { event.preventDefault(); void replaceLocally(true); }}
              >
                Descartar cambios y abrir
              </AlertDialogAction>
              <AlertDialogAction disabled={busy} variant="outline" onClick={event => { event.preventDefault(); void replaceLocally(false); }}>
                Conservar copia local y abrir
              </AlertDialogAction>
              <AlertDialogAction
                disabled={busy || offline}
                onClick={async (event) => {
                  event.preventDefault();
                  if (await save()) completeReplacement();
                }}
              >
                Guardar y abrir
              </AlertDialogAction>
            </AlertDialogFooter>
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  },
);

export default ProjectLibrary;
