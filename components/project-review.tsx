'use client';
import UserAvatar from '@/components/user-avatar';

// Navegación de documento intencional: respeta beforeunload para texto sin enviar.
/* oxlint-disable next/no-html-link-for-pages */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import ProjectFeedback from '@/components/project-feedback';
import ReviewSimulation from '@/components/review-simulation';
import {
  decodeProject,
  downloadText,
  safeFilename,
  generateEspIdfCodeResult,
  type CodeGenerationResult,
  type ProjectFile,
} from '@/lib/capiblocks';
import { createEspIdfArchive, downloadFirmwareArchive } from '@/lib/firmware-archive';
import {
  sessionChangePending,
  watchSessionChange,
  type Session,
} from '@/lib/account-session';
import {
  ReviewError,
  isReviewStatus,
  type ReviewStatus,
  type ReviewVersion,
  type ReviewRequest,
} from '@/lib/project-review';

type Snapshot = { version: ReviewVersion; document: ProjectFile };
type Selection = { id: string; course: string; initialVersion: number | null };

export default function ProjectReview() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState('');
  const [accessError, setAccessError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftKey, setDraftKey] = useState(0);
  const [discard, setDiscard] = useState(false);
  const [copyPrompt, setCopyPrompt] = useState(false);
  const [artifact, setArtifact] = useState<{
    revision: number;
    generated: CodeGenerationResult | null;
  } | null>(null);
  const identity = useRef<string | null>(null);
  const token = useRef('');
  const active = useRef(false);
  const allowed = useRef(false);
  const epoch = useRef(0);
  const fetching = useRef(false);
  const operating = useRef(false);
  const selected = useRef<number | null>(null);
  const opened = useRef(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const copyIntent = useRef<{
    revision: number;
    id: string;
    operationId: string;
  } | null>(null);
  const root = selection ? `/api/review/${selection.id}/` : '';
  const suffix = selection?.course
    ? `?course=${encodeURIComponent(selection.course)}`
    : '';
  const clear = useCallback((message: string) => {
    ++epoch.current;
    allowed.current = false;
    selected.current = null;
    opened.current = false;
    setLocked(true);
    setStatus(null);
    setSnapshot(null);
    setArtifact(null);
    setAccessError(message);
    setError('');
    setNotice('');
    setDraftKey((key) => key + 1);
    setDirty(false);
    setCopyPrompt(false);
    setDiscard(false);
    copyIntent.current = null;
  }, []);
  const pause = useCallback(() => {
    allowed.current = false;
    setLocked(true);
  }, []);
  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      const params = new URL(window.location.href).searchParams;
      const id = params.get('project') ?? '',
        course = params.get('course') ?? '';
      const version = Number(params.get('version'));
      if (
        !/^[a-f0-9-]{36}$/i.test(id) ||
        (course && !/^[a-f0-9-]{36}$/i.test(course))
      ) {
        setAccessError(
          'El enlace de revisión no es válido. Abrilo desde Mis cursos o Mis proyectos.',
        );
        return;
      }
      setSelection({
        id,
        course,
        initialVersion:
          Number.isSafeInteger(version) && version > 0 ? version : null,
      });
    });
    return () => {
      disposed = true;
    };
  }, []);
  const request: ReviewRequest = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      if (
        !active.current ||
        !allowed.current ||
        !identity.current ||
        sessionChangePending()
      )
        throw new ReviewError('Primero verificá el acceso a esta revisión.');
      const ticket = epoch.current;
      let response: Response;
      try {
        response = await fetch(`${root}${path}${suffix}`, {
          ...options,
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'X-Capi-Account': identity.current,
            'X-CSRFToken': token.current,
          },
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw new ReviewError(
          'Se cortó la conexión. No podemos confirmar el resultado; conservamos tu borrador. Reintentá para verificar el mismo envío.',
        );
      }
      if (!active.current || ticket !== epoch.current || !allowed.current)
        throw new ReviewError(
          'El acceso cambió durante la solicitud. Verificá tu cuenta.',
        );
      let data: T & { error?: string; code?: string };
      try {
        data = await response.json();
      } catch {
        throw new ReviewError(
          'La respuesta del servidor está incompleta. Reintentá para verificar el resultado.',
        );
      }
      if (!active.current || ticket !== epoch.current || !allowed.current)
        throw new ReviewError('La revisión se cerró.');
      if (!response.ok) {
        if (
          [401, 403].includes(response.status) ||
          data.code === 'account_changed'
        )
          clear(
            'Tu cuenta o permiso cambió. Volvé a ingresar desde Mi cuenta.',
          );
        if (response.status === 404 && data.code !== 'version_unavailable')
          clear(
            'Este proyecto ya no está disponible para tu cuenta o curso. Cerramos la revisión y la simulación.',
          );
        // Una versión retirada no implica revocación del proyecto; el sondeo
        // revalida el objeto completo. Nunca sustituirla por otra al comentar.
        throw new ReviewError(
          data.error ||
            'La versión ya no está disponible. Actualizá y elegí una versión guardada.',
          response.status,
        );
      }
      return data;
    },
    [clear, root, suffix],
  );
  const loadVersion = useCallback(
    async (revision: number) => {
      if (operating.current || !allowed.current) return;
      opened.current = true;
      operating.current = true;
      setBusy(true);
      setError('');
      const ticket = epoch.current;
      try {
        const result = await request<{
          version: ReviewVersion;
          document: unknown;
        }>(`versions/${revision}/`, { method: 'POST', body: '{}' });
        const decoded = decodeProject(result.document);
        if (!decoded.project || result.version?.revision !== revision)
          throw new Error(
            'Esta versión no es compatible; no se abrió otro contenido en su lugar.',
          );
        if (!active.current || ticket !== epoch.current || !allowed.current)
          return;
        selected.current = revision;
        opened.current = true;
        setSnapshot({ version: result.version, document: decoded.project });
        setArtifact(null);
        const url = new URL(window.location.href);
        url.searchParams.set('version', String(revision));
        window.history.replaceState(null, '', url);
      } catch (failure) {
        if (active.current && ticket === epoch.current)
          setError(
            failure instanceof Error
              ? failure.message
              : 'No pudimos abrir la versión.',
          );
      } finally {
        operating.current = false;
        if (active.current) setBusy(false);
      }
    },
    [request],
  );
  const refresh = useCallback(async () => {
    if (
      !selection ||
      !active.current ||
      fetching.current ||
      operating.current ||
      document.visibilityState !== 'visible'
    )
      return;
    if (sessionChangePending()) {
      pause();
      return;
    }
    fetching.current = true;
    const ticket = epoch.current;
    try {
      const sessionResponse = await fetch('/api/auth/session/', {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      const session = (await sessionResponse.json()) as Session;
      if (!active.current || ticket !== epoch.current) return;
      if (
        !sessionResponse.ok ||
        !session.user ||
        session.user.mustChangePassword
      ) {
        clear(
          'Ingresá con tu cuenta y contraseña definitiva para revisar este trabajo.',
        );
        return;
      }
      if (identity.current && identity.current !== session.user.id) {
        clear(
          'La cuenta cambió en otra pestaña. Volvé a Mi cuenta y abrí un enlace autorizado para la cuenta actual.',
        );
        return;
      }
      identity.current = session.user.id;
      token.current = session.csrfToken;
      const response = await fetch(`${root}${suffix}`, {
        headers: { 'X-Capi-Account': identity.current },
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      if (!active.current || ticket !== epoch.current) return;
      if ([401, 403, 404, 409].includes(response.status)) {
        clear(
          'Este proyecto ya no está disponible para tu cuenta o curso. Cerramos la revisión y la simulación.',
        );
        return;
      }
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!active.current || ticket !== epoch.current) return;
      if (!isReviewStatus(data) || data.project.id !== selection.id)
        throw new Error();
      token.current = data.csrfToken;
      setStatus(data);
      allowed.current = true;
      setLocked(false);
      setAccessError('');
      if (
        selected.current !== null &&
        !data.versions.some((item) => item.revision === selected.current)
      ) {
        selected.current = null;
        setSnapshot(null);
        setArtifact(null);
        setError(
          'La versión que estabas revisando ya no está en el historial. Tu texto pendiente sigue aquí. Elegí explícitamente otra versión para continuar.',
        );
      }
      if (selected.current === null && !opened.current)
        await loadVersion(selection.initialVersion ?? data.project.revision);
    } catch {
      if (active.current && ticket === epoch.current) {
        pause();
        setAccessError(
          'No pudimos verificar el acceso. La simulación está detenida; reintentá la conexión. Los borradores de devoluciones siguen en esta pestaña mientras no se confirme un cambio de cuenta o permiso.',
        );
      }
    } finally {
      fetching.current = false;
    }
  }, [clear, loadVersion, pause, root, selection, suffix]);
  useEffect(() => {
    active.current = true;
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void refresh();
    });
    const focus = () => {
      void refresh();
    };
    const visibility = () => {
      ++epoch.current;
      pause();
      if (document.visibilityState === 'visible') void refresh();
    };
    const stop = watchSessionChange((changing) => {
      clear('Verificando el cambio de sesión…');
      if (!changing) void refresh();
    });
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener('focus', focus);
    window.addEventListener('pageshow', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      active.current = false;
      // Epoch de red, no una referencia DOM.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++epoch.current;
      stop();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pageshow', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [clear, pause, refresh]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const changed = useCallback(() => {
    void refresh();
  }, [refresh]);
  const onCode = useCallback(
    (generated: CodeGenerationResult | null) => {
      if (snapshot) setArtifact({ revision: snapshot.version.revision, generated });
    },
    [snapshot],
  );
  function viewVersion(revision: number) {
    if (busy || locked) return;
    const action = () => {
      void loadVersion(revision);
    };
    if (dirty) {
      pendingAction.current = action;
      setDiscard(true);
    } else action();
  }
  async function exportVersion(kind: 'json' | 'arduino' | 'esp-idf') {
    if (!snapshot || operating.current || !allowed.current) return;
    operating.current = true;
    setBusy(true);
    setError('');
    const exportEpoch = epoch.current;
    try {
      const verified = await request<Snapshot>(
        `versions/${snapshot.version.revision}/`,
      );
      if (
        verified.version?.revision !== snapshot.version.revision ||
        !decodeProject(verified.document).project
      )
        throw new Error('La descarga no corresponde a la versión abierta.');
      const name = `${safeFilename(snapshot.document.metadata.title)}-v${snapshot.version.revision}`;
      if (kind === 'json')
        downloadText(
          `${name}.capibloques.json`,
          JSON.stringify(verified.document, null, 2),
          'application/json',
        );
      else if (
        artifact?.revision === snapshot.version.revision &&
        artifact.generated
      ) {
        if (kind === 'esp-idf') {
          const generated = generateEspIdfCodeResult(artifact.generated.program, verified.document.metadata.title, verified.document.scene);
          const archive = await createEspIdfArchive(generated);
          // Recheck access after asynchronous packaging; revocation may have arrived meanwhile.
          await request<Snapshot>(`versions/${snapshot.version.revision}/`);
          if (!active.current || !allowed.current || epoch.current !== exportEpoch) return;
          downloadFirmwareArchive(`${name}-esp-idf.zip`, archive);
        } else downloadText(`${name}.ino`, artifact.generated.code, 'text/plain');
      }
      else
        throw new Error(
          'Revisá los avisos de cableado y bloques. No hay código válido para esta versión.',
        );
      setNotice(
        `Descargaste una copia de la versión ${snapshot.version.revision}. El archivo no se revoca si luego cambian tus permisos.`,
      );
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error ? failure.message : 'No se pudo descargar.',
        );
    } finally {
      operating.current = false;
      if (active.current) {
        setBusy(false);
        void refresh();
      }
    }
  }
  async function makeCopy() {
    if (!snapshot || operating.current || !allowed.current) return;
    if (copyIntent.current?.revision !== snapshot.version.revision)
      copyIntent.current = {
        revision: snapshot.version.revision,
        id: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
      };
    const { revision, ...payload } = copyIntent.current;
    operating.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await request<{ project: { title: string } }>(
        `versions/${revision}/copy/`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      setNotice(
        `Copia personal creada: «${result.project.title}». La encontrarás en tu editor → Mis proyectos. Tu borrador actual no se reemplazó.`,
      );
      setCopyPrompt(false);
      copyIntent.current = null;
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'No se confirmó la copia. Reintentá sin crear otra identidad.',
        );
    } finally {
      operating.current = false;
      if (active.current) {
        setBusy(false);
        void refresh();
      }
    }
  }
  return (
    <main className="review-page">
      <header className="review-header">
        <div>
          <p className="review-eyebrow">🔎 CapiBloques · revisión pedagógica</p>
          <h1>
            {locked
              ? 'Revisar un proyecto'
              : (status?.project.title ?? 'Revisar un proyecto')}
          </h1>
        </div>
        <nav className="account-actions" aria-label="Salir de revisión">
          <a className="account-back" href="/cursos/">
            Mis cursos
          </a>
          <a
            className="account-back"
            href="/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Mi editor (otra pestaña)
          </a>
          <a className="account-back" href="/cuenta/">
            Mi cuenta
          </a>
        </nav>
      </header>
      {locked && (
        <section className="account-card review-access">
          <h2>Verificar acceso</h2>
          <p role={accessError ? 'alert' : 'status'}>
            {accessError ||
              'Verificando tu cuenta y permiso sobre este proyecto…'}
          </p>
          <Button onClick={() => void refresh()} disabled={!selection}>
            Reintentar acceso
          </Button>
        </section>
      )}
      {/* Ocultar sin desmontar formularios ante un corte permite conservar texto.
        El simulador sí se desmonta: termina el worker y todos los sonidos. */}
      <div hidden={locked} inert={locked} aria-hidden={locked || undefined}>
        {status && (
          <>
            <p className="review-context">
              <UserAvatar id={status.owner.avatarId} size={36} decorative />{' '}
              {status.isOwner
                ? 'Tu proyecto'
                : `${status.owner.displayName} (@${status.owner.alias})`}{' '}
              · {status.project.course?.name ?? 'Personal'}
              {status.project.course?.isArchived
                ? ' · Curso archivado'
                : ''} ·
              Último guardado en servidor:{' '}
              {new Date(status.project.updatedAt).toLocaleString('es-AR')} ·
              versión {status.project.revision}
            </p>
            <p>
              Revisás sólo versiones guardadas. No vemos cambios pendientes,
              pantallas ni actividad en vivo. Esta página nunca modifica los
              bloques o la escena del original.
            </p>
            {notice && <output className="account-notice">{notice}</output>}
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
            <section
              className="review-toolbar"
              aria-label="Versión que estás revisando"
            >
              <label htmlFor="review-version">
                Versión abierta
                <select
                  id="review-version"
                  value={snapshot?.version.revision ?? ''}
                  disabled={busy}
                  onChange={(event) => viewVersion(Number(event.target.value))}
                >
                  <option value="" disabled>
                    Elegí una versión
                  </option>
                  {snapshot &&
                    !status.versions.some(
                      (item) => item.revision === snapshot.version.revision,
                    ) && (
                      <option value={snapshot.version.revision}>
                        Versión {snapshot.version.revision} · verificar
                        disponibilidad
                      </option>
                    )}
                  {status.versions.map((item) => (
                    <option key={item.revision} value={item.revision}>
                      Versión {item.revision}
                      {item.current ? ' · última guardada' : ''}
                      {item.pinned ? ' · con devolución protegida' : ''} ·{' '}
                      {new Date(item.createdAt).toLocaleString('es-AR')}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setError('');
                  void refresh();
                }}
              >
                Actualizar revisión
              </Button>
              {snapshot && (
                <strong className="review-version-badge">
                  Estás revisando la versión {snapshot.version.revision}
                </strong>
              )}
            </section>
            {snapshot &&
              status.project.revision > snapshot.version.revision && (
                <output className="account-notice review-new-version">
                  Hay una versión más reciente ({status.project.revision}). Tu
                  revisión sigue fijada en la {snapshot.version.revision}.
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => viewVersion(status.project.revision)}
                  >
                    Abrir última versión
                  </Button>
                </output>
              )}
            {snapshot && (
              <div className="account-actions review-downloads">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void exportVersion('json')}
                >
                  Descargar JSON de versión {snapshot.version.revision}
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    artifact?.revision !== snapshot.version.revision ||
                    !artifact.generated
                  }
                  onClick={() => void exportVersion('arduino')}
                >
                  Descargar Arduino de versión {snapshot.version.revision}
                </Button>
                <Button variant="outline" disabled={busy || artifact?.revision !== snapshot.version.revision || !artifact.generated} onClick={() => void exportVersion('esp-idf')}>
                  Descargar ESP-IDF de versión {snapshot.version.revision}
                </Button>
                <Button disabled={busy} onClick={() => setCopyPrompt(true)}>
                  Crear mi copia personal
                </Button>
              </div>
            )}
            {!locked && snapshot && (
              <ReviewSimulation
                key={snapshot.version.revision}
                project={snapshot.document}
                onCode={onCode}
              />
            )}
            <ProjectFeedback
              key={draftKey}
              status={status}
              revision={snapshot?.version.revision ?? null}
              request={request}
              onChanged={changed}
              onDirty={setDirty}
              viewVersion={viewVersion}
              disabled={locked || busy}
            />
            <p className="account-help">
              Las versiones comentadas están protegidas. Las demás siguen la
              retención del historial: una revisión antigua sin devolución puede
              dejar de estar disponible. Si ocurre, elegí explícitamente otra
              versión; nunca se comenta un contenido diferente de forma
              silenciosa.
            </p>
          </>
        )}
      </div>
      <AlertDialog open={discard && !locked} onOpenChange={setDiscard}>
        <AlertDialogContent className="management-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Cambiar de versión y descartar el texto pendiente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Los borradores de devolución y respuesta no se guardan
              automáticamente. Un envío sin confirmar podría ya estar en
              servidor: revisá la conversación antes de repetirlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir con esta versión</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDraftKey((key) => key + 1);
                setDirty(false);
                const action = pendingAction.current;
                pendingAction.current = null;
                action?.();
              }}
            >
              Descartar borradores y cambiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={copyPrompt && !locked}
        onOpenChange={(open) => {
          if (!busy) setCopyPrompt(open);
        }}
      >
        <AlertDialogContent className="management-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Crear una copia para experimentar
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se guardará la versión {snapshot?.version.revision} en tu
              biblioteca personal, sin curso, comentarios ni historial ajeno.
              Conserva una indicación de procedencia. El original y el proyecto
              abierto en tu editor quedan intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="account-error">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void makeCopy();
              }}
            >
              {busy ? 'Creando copia…' : 'Confirmar copia personal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
