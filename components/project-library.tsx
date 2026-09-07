'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { FolderOpen, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { Account, AccountDraftStore } from '@/lib/account-session';

export type ProjectLibraryHandle = {
  detach: () => void;
  replace: (action: () => void) => void;
};
type Props = {
  account: Account;
  store: AccountDraftStore;
  csrfToken: string;
  hydrated: boolean;
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
type PendingSave = {
  url: string;
  method: string;
  body: string;
  fingerprint: string;
  generation: number;
};

const ProjectLibrary = forwardRef<ProjectLibraryHandle, Props>(
  function ProjectLibrary(
    {
      account,
      store,
      csrfToken,
      hydrated,
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
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [cloudNotice, setCloudNotice] = useState('');
    const [pending, setPending] = useState(false);
    const [conflict, setConflict] = useState(false);
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
        active.current && store.active && generation.current === ticket,
      [store],
    );
    const dirty = Boolean(
      hydrated &&
      fingerprint !== (link?.savedFingerprint ?? initialFingerprint),
    );

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
      if (!link || !dirty) return;
      const warn = (event: BeforeUnloadEvent) => event.preventDefault();
      window.addEventListener('beforeunload', warn);
      return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, link]);

    const detach = useCallback(() => {
      ++generation.current;
      store.attach(null);
      setLink(null);
      pendingSave.current = null;
      setPending(false);
      setConflict(false);
      setError('');
      setCloudNotice(
        'Sólo en esta computadora · guardá para agregarlo a tu cuenta.',
      );
      // Un proyecto importado/nuevo nunca conserva la identidad del anterior.
    }, [store]);
    const replace = useCallback(
      (action: () => void) => {
        if (!store.active || inFlight.current) return;
        if (dirty || pendingSave.current) {
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
      const result = await fetch(url, {
        ...options,
        headers: headers(),
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      const data = (await result.json()) as T & {
        error?: string;
        code?: string;
      };
      if (!result.ok) {
        if (
          result.status === 401 ||
          result.status === 403 ||
          data.code === 'account_changed'
        )
          throw new Error(
            'Tu sesión cambió. Volvé a Mi cuenta antes de continuar.',
          );
        if (
          active.current &&
          store.active &&
          (data.code === 'stale_revision' ||
            data.code === 'trashed' ||
            data.code === 'operation_conflict')
        )
          setConflict(true);
        throw new Error(data.error || 'No pudimos completar la operación.');
      }
      return data;
    }

    const refresh = useCallback(async () => {
      if (!active.current || !store.active || inFlight.current) return;
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

    async function save(copy = false): Promise<boolean> {
      if (!store.active || inFlight.current || !hydrated) return false;
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
            url: remote ? `/api/projects/${remote.id}/` : '/api/projects/',
            method: remote ? 'PUT' : 'POST',
            body: JSON.stringify(body),
            fingerprint: projectFingerprint(document),
            generation: generation.current,
          };
        }
        const operation = pendingSave.current;
        try {
          store.write(JSON.stringify(capture()));
        } catch {
          /* El servidor aún puede guardar y exportar sigue disponible. */
        }
        setPending(true);
        const result = await request<{ project: CloudProject }>(operation.url, {
          method: operation.method,
          body: operation.body,
        });
        if (!valid(operation.generation)) return false;
        const next = {
          id: result.project.id,
          revision: result.project.revision,
          savedFingerprint: operation.fingerprint,
        };
        store.attach(next);
        setLink(next);
        pendingSave.current = null;
        setPending(false);
        setConflict(false);
        const current = capture();
        if (copy) {
          current.metadata.title = result.project.title;
          apply(current);
        }
        try {
          store.write(JSON.stringify(current));
        } catch {
          setError(
            'Guardado en servidor. No se pudo actualizar la copia local; abrilo desde Mis proyectos al volver.',
          );
        }
        setCloudNotice('Proyecto guardado en tu cuenta.');
        notice('Proyecto guardado en tu cuenta');
        return true;
      } catch (failure) {
        if (active.current) {
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
          const opened = justSaved ? capture() : file;
          const next = justSaved
            ? store.remote!
            : {
                id: data.project.id,
                revision: data.project.revision,
                savedFingerprint: projectFingerprint(file),
              };
          store.attach(next);
          setLink(next);
          pendingSave.current = null;
          setPending(false);
          setConflict(false);
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
    const status = busy
      ? 'Guardando o consultando…'
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
          disabled={!hydrated || busy}
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
          Personal · {status}
        </span>
        {error && !open && (
          <span className="cloud-error" role="alert">
            {error}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(true)}
            >
              Revisar guardado
            </Button>
          </span>
        )}
        <Dialog
          open={open}
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
                Biblioteca personal de {account.displayName}. Sólo vos podés
                abrir estos proyectos.
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
                <Select
                  value={filter.state}
                  onValueChange={(value) => {
                    if (value) setFilter({ ...filter, state: value, page: 1 });
                  }}
                >
                  <SelectTrigger id="library-state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Mis proyectos</SelectItem>
                    <SelectItem value="trash">Papelera</SelectItem>
                  </SelectContent>
                </Select>
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
                      <p>
                        Versión {project.revision} ·{' '}
                        {new Date(project.updatedAt).toLocaleString('es-AR')}
                        {project.id === link?.id
                          ? ' · Abierto en el editor'
                          : ''}
                      </p>
                      <div className="account-actions">
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
              esta subfase no hay borrado definitivo ni purga automática. Los
              cambios del editor se suben con Guardar; el autoguardado al
              servidor llegará después.
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Volver al editor
            </Button>
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(rename)}
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
          open={Boolean(trash)}
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
          <AlertDialogContent className="management-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Antes de reemplazar el editor</AlertDialogTitle>
              <AlertDialogDescription>
                Hay cambios locales o un guardado sin confirmar. Podés
                guardarlos primero, descartarlos del editor o cancelar. No se
                modifica la versión ya guardada en tu cuenta al descartar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                variant="outline"
                onClick={completeReplacement}
              >
                Descartar cambios y abrir
              </AlertDialogAction>
              <AlertDialogAction
                disabled={busy}
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
