'use client';
import UserAvatar from '@/components/user-avatar';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  type Feedback,
  type ReviewStatus,
  type ReviewRequest,
  ReviewError,
} from '@/lib/project-review';

type ReplyDraft = {
  id: string;
  version: number;
  reply: string;
  resolved: boolean;
  operationId: string;
};

export default function ProjectFeedback({
  status,
  revision,
  request,
  onChanged,
  onDirty,
  viewVersion,
  disabled,
}: {
  status: ReviewStatus;
  revision: number | null;
  request: ReviewRequest;
  onChanged: () => void;
  onDirty: (dirty: boolean) => void;
  viewVersion: (revision: number) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<{
    id: string;
    revision: number;
    text: string;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(true);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onDirty(Boolean(text || draft || pending));
  }, [draft, onDirty, pending, text]);
  useEffect(() => {
    let disposed = false;
    // Reconocer un envío cuya respuesta se perdió sin reenviarlo con otro UUID.
    if (pending && status.feedback.some((item) => item.id === pending.id)) {
      queueMicrotask(() => {
        if (!disposed) {
          setPending(null);
          setText('');
          setNotice('Devolución confirmada en el servidor.');
          setError('');
        }
      });
    }
    return () => {
      disposed = true;
    };
  }, [pending, status.feedback]);

  async function send() {
    if (inFlight.current || disabled || !status.canComment || !revision) return;
    const payload = pending ?? {
      id: crypto.randomUUID(),
      revision,
      text: text.trim(),
    };
    setPending(payload);
    inFlight.current = true;
    setSending(true);
    setError('');
    setNotice('');
    try {
      await request('feedback/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!mounted.current) return;
      setPending(null);
      setText('');
      setNotice(`Devolución enviada sobre la versión ${payload.revision}.`);
    } catch (failure) {
      if (!mounted.current) return;
      if (
        failure instanceof ReviewError &&
        failure.status >= 400 &&
        failure.status < 500
      )
        setPending(null);
      setError(
        failure instanceof Error
          ? failure.message
          : 'No se confirmó el envío. Reintentá el mismo mensaje.',
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setSending(false);
        onChanged();
      }
    }
  }
  async function respond() {
    if (!draft || inFlight.current || disabled || !status.canRespond) return;
    const { id, ...payload } = draft;
    inFlight.current = true;
    setSending(true);
    setError('');
    setNotice('');
    try {
      await request(`feedback/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!mounted.current) return;
      setDraft(null);
      setNotice('Respuesta y estado guardados.');
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'No se confirmó el guardado. Tu respuesta sigue aquí.',
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setSending(false);
        onChanged();
      }
    }
  }
  function startReply(item: Feedback) {
    setDraft({
      id: item.id,
      version: item.version,
      reply: item.reply,
      resolved: item.resolved,
      operationId: crypto.randomUUID(),
    });
    setError('');
    setNotice('');
  }
  const entries = status.feedback.filter(
    (item) => showAll || item.revision === revision,
  );
  return (
    <section className="review-feedback" aria-labelledby="feedback-title">
      <h2 id="feedback-title">
        Devoluciones del proyecto · {status.feedback.length}
      </h2>
      <p>
        Conversación privada del alumno y los docentes vigentes de este curso.
        Cada devolución conserva la versión que se revisó.
      </p>
      {!status.canComment && !status.canRespond && (
        <p className="account-notice">
          Conversación de sólo lectura. Un curso archivado, una membresía
          retirada o un proyecto en papelera no admite nuevas respuestas.
        </p>
      )}
      {notice && <output className="account-notice">{notice}</output>}
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      {status.canComment && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="feedback-composer"
        >
          <label htmlFor="new-feedback">
            Nueva devolución · versión{' '}
            {pending?.revision ?? revision ?? 'sin abrir'}
            <Textarea
              id="new-feedback"
              maxLength={1000}
              value={text}
              disabled={sending || Boolean(pending) || disabled || !revision}
              onChange={(event) => setText(event.target.value)}
              placeholder="Por ejemplo: ¿qué pasa si los dos semáforos quedan en verde?"
            />
          </label>
          <p className="account-help">
            {text.length}/1000 caracteres. Enviar publica el texto; escribir no
            lo guarda automáticamente.
          </p>
          {pending && (
            <p className="account-help">
              Estamos verificando este envío. Reintentar usa la misma identidad
              y no crea otra devolución. Si salís antes de confirmarlo, revisá
              la conversación al volver.
            </p>
          )}
          <div className="account-actions">
            <Button
              type="submit"
              disabled={
                sending ||
                disabled ||
                !revision ||
                !text.trim() ||
                status.feedback.length >= 50
              }
            >
              {sending
                ? 'Enviando…'
                : pending
                  ? 'Reintentar devolución'
                  : 'Enviar devolución'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={sending || !text || Boolean(pending)}
              onClick={() => {
                setText('');
                setError('');
              }}
            >
              Cancelar devolución
            </Button>
          </div>
        </form>
      )}
      <label className="review-filter">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(event) => setShowAll(event.target.checked)}
        />
        Mostrar devoluciones de todas las versiones
      </label>
      {!entries.length && (
        <p>
          {status.feedback.length
            ? 'Esta versión todavía no tiene devoluciones.'
            : 'Todavía no hay devoluciones. El docente puede abrir una versión guardada y dejar la primera.'}
        </p>
      )}
      <ol className="feedback-list">
        {entries.map((item) => (
          <li key={item.id}>
            <article
              className="feedback-card"
              aria-label={`Devolución de versión ${item.revision}`}
            >
              <header>
                <strong>
                  {item.author && <UserAvatar id={item.author.avatarId} size={32} decorative />}{' '}
                  {item.author
                    ? `${item.author.displayName} (@${item.author.alias})`
                    : 'Docente · cuenta eliminada'}
                </strong>
                <span
                  className={
                    item.resolved ? 'feedback-resolved' : 'feedback-pending'
                  }
                >
                  {item.resolved
                    ? '✓ Atendida por el alumno'
                    : 'Pendiente de atender'}
                </span>
              </header>
              <p className="account-help">
                Versión {item.revision} ·{' '}
                {new Date(item.createdAt).toLocaleString('es-AR')}
              </p>
              <p className="feedback-text">{item.text}</p>
              <Button
                variant="outline"
                disabled={disabled || sending || revision === item.revision}
                onClick={() => viewVersion(item.revision)}
              >
                {revision === item.revision
                  ? 'Estás viendo esta versión'
                  : `Ver versión ${item.revision} de esta devolución`}
              </Button>
              {item.reply && (
                <section className="feedback-reply">
                  <h3>Respuesta del alumno</h3>
                  <p className="account-help">
                    Actualizada el{' '}
                    {new Date(item.updatedAt).toLocaleString('es-AR')}
                  </p>
                  <p className="feedback-text">{item.reply}</p>
                </section>
              )}
              {draft?.id === item.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void respond();
                  }}
                  className="feedback-composer"
                >
                  {draft.version !== item.version && (
                    <p role="alert" className="account-error">
                      Hay una respuesta más reciente. Cancelá para verla antes
                      de escribir de nuevo; no reemplazamos tu borrador.
                    </p>
                  )}
                  <label htmlFor={`reply-${item.id}`}>
                    Tu respuesta
                    <Textarea
                      id={`reply-${item.id}`}
                      value={draft.reply}
                      maxLength={1000}
                      disabled={sending || disabled || !status.canRespond}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          reply: event.target.value,
                          operationId: crypto.randomUUID(),
                        })
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.resolved}
                      disabled={sending || disabled || !status.canRespond}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          resolved: event.target.checked,
                          operationId: crypto.randomUUID(),
                        })
                      }
                    />
                    Ya atendí esta devolución
                  </label>
                  <div className="account-actions">
                    <Button
                      type="submit"
                      disabled={
                        sending ||
                        disabled ||
                        !status.canRespond ||
                        draft.version !== item.version
                      }
                    >
                      {sending ? 'Guardando…' : 'Guardar respuesta y estado'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={sending}
                      onClick={() => {
                        setDraft(null);
                        setError('');
                      }}
                    >
                      Cancelar respuesta
                    </Button>
                  </div>
                </form>
              ) : (
                status.canRespond && (
                  <Button
                    variant="outline"
                    disabled={Boolean(draft) || sending || disabled}
                    onClick={() => startReply(item)}
                  >
                    {item.reply || item.resolved
                      ? 'Revisar mi respuesta y estado'
                      : 'Responder o marcar atendida'}
                  </Button>
                )
              )}
            </article>
          </li>
        ))}
      </ol>
      <p className="account-help">
        Hasta 50 devoluciones por proyecto, 1000 caracteres por mensaje o
        respuesta. No se incluyen conversaciones al exportar el JSON o hacer una
        copia personal.
      </p>
    </section>
  );
}
