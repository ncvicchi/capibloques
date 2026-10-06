'use client';

/* eslint-disable react/react-compiler -- Synchronizes externally replaced project
   documents and permission revocation; these resets must not wait for a user gesture. */

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  challengeCatalog,
  decodeChallenge,
  variantScene,
  type Challenge,
  type ChallengeReport,
  type ChallengeGoal,
  type ChallengeObservation,
} from '@/lib/challenges';
import { componentValueCapabilities } from '@/lib/component-capabilities';
import type { Account } from '@/lib/account-session';
import type {
  CompiledProgram,
  ProjectFile,
  ValueExpression,
} from '@/lib/capiblocks';
import { toolbox } from '@/lib/blockly-engine';

type Progress = { status: string; attempts: number; hints: number };
type Item = {
  reservedCaseCount?: number;
  id: string;
  challenge?: Challenge;
  draft?: Challenge;
  versions?: Record<string, Challenge>;
  assigned?: number;
  archived?: boolean;
};
type Course = {
  id: string;
  name: string;
  teacher: boolean;
  version: string;
  items: Item[];
};
type Selection = { challenge: Challenge; courseId: string | null; preview?:boolean };
const blockChoices = [
  ...new Map(
    toolbox.contents
      .flatMap((category) =>
        'contents' in category && category.contents
          ? category.contents.flatMap((item) =>
              item.kind === 'block' && 'type' in item
                ? [{ type: String(item.type), category: category.name }]
                : [],
            )
          : [],
      )
      .map((item) => [item.type, item]),
  ).values(),
];
function download(challenge: Challenge) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(challenge, null, 2)], {
      type: 'application/json',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${challenge.title}.capireto.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ChallengeWorkbench({
  account,
  token,
  enabled,
  workspace,
  capture,
  compile,
  load,
  onPalette,
  projectId,
}: {
  account: Account;
  token: string;
  enabled: boolean;
  workspace: Record<string, unknown>;
  capture: () => ProjectFile;
  compile: () => CompiledProgram;
  load: (project: ProjectFile, applied?: () => void) => void;
  projectId: () => string | null;
  onPalette: (palette: readonly string[] | undefined) => void;
}) {
  const [open, setOpen] = useState(false),
    [courses, setCourses] = useState<Course[]>([]),
    [progress, setProgress] = useState<Record<string, Progress>>({});
  const [selection, setSelection] = useState<Selection | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState<ChallengeReport | null>(null),
    [hints, setHints] = useState(0),
    [showHints, setShowHints] = useState(true);
  const [editing, setEditing] = useState<{
      course: Course;
      challenge: Challenge;
    } | null>(null),
    [students, setStudents] = useState<
      { name: string; progress: Record<string, Progress> }[] | null
    >(null);
  const worker = useRef<Worker | null>(null),
    timeout = useRef<ReturnType<typeof setTimeout> | null>(null),
    alive = useRef(true),
    epoch = useRef(0);
  const headers = {
    'Content-Type': 'application/json',
    'X-CSRFToken': token,
    'X-Capi-Account': account.id,
  };
  const request = async (url: string, body?: unknown) => {
    const ticket = epoch.current;
    if (!enabled)
      throw new Error(
        'Verificá la sesión antes de usar los desafíos del curso o guardar progreso.',
      );
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    const data = (await response.json()) as {
      message?: string;
      error?: string;
      courses: Course[];
      progress: Record<string, Progress> & Progress;
      students: { name: string; progress: Record<string, Progress> }[];
      version: string;
    };
    if (ticket !== epoch.current || !alive.current)
      throw new Error('La sesión cambió; esa respuesta ya no se puede usar.');
    if (!response.ok)
      throw new Error(
        data.message ?? data.error ?? 'No pudimos completar la acción.',
      );
    return data;
  };
  const refresh = async () => {
    try {
      const data = await request('/api/challenges/');
      if (alive.current) {
        setCourses(data.courses);
        setProgress(data.progress);
        setError('');
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : 'Sin conexión.');
    }
  };
  useEffect(() => {
    alive.current = true;
    epoch.current++;
    setCourses([]);
    setProgress({});
    setStudents(null);
    setEditing(null);
    if (enabled) void refresh();
    return () => {
      alive.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- This epoch invalidates requests, not a DOM ref.
      epoch.current++;
      worker.current?.terminate();
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [account.id, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  const association = workspace.capiChallenge as
    | { id?: string; version?: number }
    | undefined;
  useEffect(() => {
    if (!association) {
      worker.current?.terminate();worker.current=null;if(timeout.current)clearTimeout(timeout.current);setBusy(false);setReport(null);
      setSelection(null);
      onPalette(undefined);
      return;
    }
    const personal = challengeCatalog.find(
      (c) => c.id === association.id && c.version === association.version,
    );
    const assigned = courses
      .flatMap((course) =>
        course.items.flatMap((item) =>
          item.challenge
            ? [{ challenge: item.challenge, courseId: course.id }]
            : item.versions
              ? Object.values(item.versions).map((challenge) => ({
                  challenge,
                  courseId: course.id,
                }))
              : [],
        ),
      )
      .find(
        (item) =>
          item.challenge.id === association.id &&
          item.challenge.version === association.version,
      );
    const next =
      (selection?.preview&&selection.challenge.id===association.id&&selection.challenge.version===association.version&&courses.some(c=>c.id===selection.courseId&&c.teacher)?selection:assigned) ??
      (personal
        ? { challenge: personal, courseId: null }
        : selection && selection.challenge.id === association.id &&
            (!selection.courseId ||
              courses.some((c) => c.id === selection.courseId && c.teacher)) &&
            selection?.challenge.version === association.version
          ? selection
          : null);
    const changed=next?.challenge.id!==selection?.challenge.id||next?.challenge.version!==selection?.challenge.version||next?.courseId!==selection?.courseId;
    if(changed){worker.current?.terminate();worker.current=null;if(timeout.current)clearTimeout(timeout.current);setBusy(false);setReport(null);}
    setSelection(next);
    onPalette(next?.challenge.palette);
    const p = next
      ? progress[
          `${next.courseId ?? 'catalog'}:${next.challenge.id}:${next.challenge.version}`
        ]
      : null;
    if(changed)setHints(p?.hints ?? 0);
  }, [association?.id, association?.version, courses]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) {
      worker.current?.terminate();
      worker.current = null;
      setBusy(false);
      setCourses([]);
      setStudents(null);
      setEditing(null);
      if (selection?.courseId) {
        setSelection(null);
        onPalette(undefined);
      }
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = (
    challenge: Challenge,
    courseId: string | null,
    variant = 0,
    applied?:()=>void,
  ) => {
    const c = decodeChallenge(challenge),
      project = structuredClone(c.initial);
    project.scene = variantScene(c, c.variants[variant]);
    project.workspace.capiChallenge = { id: c.id, version: c.version };
    load(project, () => {
      setSelection({ challenge: c, courseId,preview:!!applied });
      setOpen(false);
      setHints(0);
      setReport(null);
      onPalette(c.palette);
      void saveProgress('started', 0, { challenge: c, courseId });
      applied?.();
    });
  };
  const saveProgress = async (
    status: string,
    hintCount = hints,
    current = selection,
  ) => {
    if (
      !current ||
      !enabled ||
      courses.some((course) => course.id === current.courseId && course.teacher)
    )
      return;
    const body = {
      id: current.challenge.id,
      version: current.challenge.version,
      courseId: current.courseId,
      operation: crypto.randomUUID(),
      status,
      hints: hintCount,
      projectId: projectId(),
    };
    try {
      const data = await request('/api/challenges/progress/', body);
      if (alive.current)
        setProgress((p) => ({
          ...p,
          [`${body.courseId ?? 'catalog'}:${body.id}:${body.version}`]:
            data.progress,
        }));
    } catch (e) {
      if (alive.current)
        setError(
          `El resultado sigue visible, pero no se guardó el progreso: ${e instanceof Error ? e.message : 'sin conexión'}`,
        );
    }
  };
  const assess = () => {
    if (!selection || busy) return;
    setBusy(true);
    setError('');
    setReport(null);
    const instance = new Worker(
      new URL('../lib/simulator.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.current = instance;
    const finish = () => {
      instance.terminate();
      worker.current = null;
      setBusy(false);
      if (timeout.current) clearTimeout(timeout.current);
    };
    instance.onmessage = (event) => {
      if (event.data.type !== 'CHALLENGE_REPORT') return;
      if (worker.current !== instance) return;
      const result = event.data.report as ChallengeReport;
      finish();
      if (!alive.current) return;
      setReport(result);
      if (result.status === 'passed' || result.status === 'retry')
        void saveProgress(result.status);
    };
    instance.onerror = () => {
      finish();
      setError(
        'Falló el comprobador. No se registra un intento; tu programa no cambió.',
      );
    };
    timeout.current = setTimeout(() => {
      finish();
      setError(
        'La prueba tardó demasiado; se canceló sin registrar un intento.',
      );
    }, 6000);
    const project = capture(),
      c = structuredClone(selection.challenge);
    const blockTypes=(raw:unknown):string[]=>!raw||typeof raw!=='object'?[]:Array.isArray(raw)?raw.flatMap(blockTypes):[...('type' in raw&&typeof raw.type==='string'&&raw.type.startsWith('capi_')?[raw.type]:[]),...Object.values(raw).flatMap(blockTypes)];
    const allowed=new Set(['capi_start',...c.palette,...blockTypes(c.initial.workspace)]);
    if(blockTypes(project.workspace).some(type=>!allowed.has(type))){finish();setError('Tu programa usa herramientas fuera de la paleta de este desafío. Usá las disponibles o abrí una copia libre.');return;}
    // The challenge owns its test scene: rearranging components must not change
    // the examiner's objective. Programs remain portable and freely editable.
    if (
      JSON.stringify(project.scene.devices.map((d) => [d.id, d.kind]).sort((a,b)=>a[0].localeCompare(b[0]))) !==
      JSON.stringify(c.initial.scene.devices.map((d) => [d.id, d.kind]).sort((a,b)=>a[0].localeCompare(b[0])))
    ) {
      finish();
      setError(
        'Restaurá los componentes del desafío o abrí una copia libre antes de comprobar.',
      );
      return;
    }
    instance.postMessage({
      type: 'ASSESS_CHALLENGE',
      challenge: c,
      program: compile(),
    });
  };
  const create = (course: Course) => {
    const project = capture(),
      device = project.scene.devices.find(
        (d) => componentValueCapabilities(d).length,
      ),
      cap = device ? componentValueCapabilities(device)[0] : null;
    const value: ValueExpression =
      cap && device
        ? {
            kind: 'componentValue',
            deviceId: device.id,
            property: cap.key,
            valueType: cap.type,
            source: cap.source,
          }
        : { kind: 'counterValue' };
    const c: Challenge = {
      format: 'CapiChallenge',
      schemaVersion: 1,
      id: crypto.randomUUID(),
      version: 1,
      title: project.metadata.title,
      prompt: 'Explicá qué hay que conseguir.',
      stage: 1,
      concepts: ['secuencia'],
      mode: 'partial',
      initial: project,
      palette: blockChoices.map((item) => item.type),
      hints: ['Observá el resultado paso a paso.'],
      explanation: '',
      variants: [
        {
          label: 'Caso 1',
          seed: 1,
          inputs: [],
          goals: [
            {
              label: 'Objetivo',
              atMs: 1000,
              value,
              operator: 'EQ',
              expected:
                cap?.type === 'boolean'
                  ? true
                  : cap?.type === 'text'
                    ? 'RED'
                    : 100,
            },
          ],
        },
      ],
      expectations: [],
    };
    delete c.initial.workspace.capiChallenge;
    setEditing({ course, challenge: c });
  };
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          if (enabled) void refresh();
        }}
      >
        {selection ? 'Mi desafío' : 'Desafíos'}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setStudents(null);
        }}
      >
        <DialogContent className="challenge-dialog">
          <DialogHeader>
            <DialogTitle>
              {selection ? selection.challenge.title : 'Desafíos para explorar'}
            </DialogTitle>
            <DialogDescription>
              Objetivos, pistas y pruebas. Guardá tu solución con Guardar;
              comprobar no reemplaza tu proyecto.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert">{error}</p>}
          {selection && (
            <section className="challenge-active">
              <p>{selection.challenge.prompt}</p>
              <p>
                Versión {selection.challenge.version} ·{' '}
                {selection.challenge.concepts.join(', ')} ·{' '}
                {selection.challenge.variants.length} casos reproducibles
              </p>
              <div className="challenge-actions">
                <Button disabled={busy} onClick={assess}>
                  Comprobar solución
                </Button>
                {busy && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      worker.current?.terminate();
                      worker.current = null;
                      if (timeout.current) clearTimeout(timeout.current);
                      setBusy(false);
                    }}
                  >
                    Cancelar prueba
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        '¿Restaurar la escena y los bloques iniciales del desafío? Guardá tu solución antes.',
                      )
                    )
                      start(selection.challenge, selection.courseId);
                  }}
                >
                  Reiniciar desafío
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const project = capture();
                    delete project.workspace.capiChallenge;
                    load(project, () => setOpen(false));
                  }}
                >
                  Abrir copia libre
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const count = Math.min(
                      hints + 1,
                      selection.challenge.hints.length,
                    );
                    setHints(count);
                    setShowHints(true);
                    void saveProgress('started', count);
                  }}
                  disabled={hints >= selection.challenge.hints.length}
                >
                  Pedir pista
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowHints(!showHints)}
                >
                  {showHints ? 'Ocultar pistas' : 'Mostrar pistas'}
                </Button>
              </div>
              {busy && (
                <output>
                  Probando otros casos… Tu programa y tu placa no se modifican.
                </output>
              )}
              {showHints &&
                selection.challenge.hints.slice(0, hints).map((hint, i) => (
                  <p key={i}>
                    Pista {i + 1}: {hint}
                  </p>
                ))}
              {report && (
                <div aria-live="polite">
                  <h3>
                    {report.status === 'passed'
                      ? 'Funciona'
                      : report.status === 'retry'
                        ? 'Seguí probando'
                        : report.status === 'creative'
                          ? 'Laboratorio abierto'
                          : report.status === 'invalid'
                            ? 'No puede ejecutarse'
                            : 'Error del comprobador'}
                  </h3>
                  <p>{report.message}</p>
                  {report.requirements.map((s) => (
                    <p key={s}>Consigna pendiente: {s}</p>
                  ))}
                  {report.suggestions.map((s) => (
                    <p key={s}>Puede mejorar: {s}</p>
                  ))}
                  {report.cases.map((test, i) => (
                    <details key={i}>
                      <summary>
                        {test.passed ? '✓' : '✗'} {test.label} · semilla{' '}
                        {test.seed}
                      </summary>
                      {test.facts.map((f) => (
                        <p key={f}>{f}</p>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() => {
                          const project = capture();
                          project.scene = variantScene(
                            selection.challenge,
                            selection.challenge.variants[i],
                          );
                          load(project);
                          setOpen(false);
                        }}
                      >
                        Probar esta variante con mis bloques
                      </Button>
                    </details>
                  ))}
                  {report.status === 'passed' && (
                    <p>{selection.challenge.explanation}</p>
                  )}
                  {report.status === 'passed' &&
                    challengeCatalog.some(
                      (c) => c.id === selection.challenge.id,
                    ) &&
                    challengeCatalog[
                      challengeCatalog.findIndex(
                        (c) => c.id === selection.challenge.id,
                      ) + 1
                    ] && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          start(
                            challengeCatalog[
                              challengeCatalog.findIndex(
                                (c) => c.id === selection.challenge.id,
                              ) + 1
                            ],
                            null,
                          )
                        }
                      >
                        Probar el siguiente desafío
                      </Button>
                    )}
                  <p>
                    Es una autoevaluación de estos casos, no una nota ni una
                    prueba de que ya dominás el concepto.
                  </p>
                </div>
              )}
            </section>
          )}
          <h3>Recorrido recomendado</h3>
          <div className="challenge-catalog">
            {challengeCatalog.map((c) => (
              <article key={c.id}>
                <h4>
                  {c.stage}. {c.title}
                </h4>
                <p>{c.prompt}</p>
                <small>
                  {c.concepts.join(', ')} ·{' '}
                  {progress[`catalog:${c.id}:${c.version}`]?.status === 'passed'
                    ? 'Completado'
                    : 'Simulador'}
                </small>
                <Button variant="outline" onClick={() => start(c, null)}>
                  Abrir desafío
                </Button>
              </article>
            ))}
          </div>
          {courses.map((course) => (
            <section key={course.id}>
              <h3>{course.name}</h3>
              {course.teacher && (
                <div className="challenge-actions">
                  <Button onClick={() => create(course)}>
                    Crear desde mi proyecto
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void request(
                        `/api/challenges/courses/${course.id}/progress/`,
                      )
                        .then((data) => setStudents(data.students))
                        .catch((e) => setError(e.message));
                    }}
                  >
                    Ver progreso del curso
                  </Button>
                </div>
              )}
              {course.items.map((item) => {
                const c =
                  item.challenge ??
                  item.draft ??
                  Object.values(item.versions ?? {}).at(-1);
                return c ? (
                  <article key={item.id}>
                    <h4>
                      {c.title} ·{' '}
                      {item.archived
                        ? 'Archivado'
                        : item.assigned
                          ? 'Asignado'
                          : 'Borrador'}{' '}
                      · v{c.version}
                    </h4>
                    <div className="challenge-actions">
                      <Button
                        variant="outline"
                        onClick={() => start(c, course.id)}
                      >
                        Abrir / previsualizar
                      </Button>
                      {course.teacher && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelection({
                                challenge: structuredClone(c),
                                courseId: course.id,
                              });
                              setReport(null);
                            }}
                          >
                            Revisar mi programa con todos los casos
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setEditing({
                                course,
                                challenge: structuredClone(c),
                              })
                            }
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              const clone = structuredClone(c);
                              clone.id = crypto.randomUUID();
                              clone.version = 1;
                              clone.title += ' (copia)';
                              setEditing({ course, challenge: clone });
                            }}
                          >
                            Duplicar
                          </Button>
                        </>
                      )}
                    </div>
                  </article>
                ) : null;
              })}
            </section>
          ))}
          {students && (
            <section>
              <h3>Autoevaluaciones del curso</h3>
              {students.map((student) => (
                <p key={student.name}>
                  {student.name}:{' '}
                  {
                    Object.values(student.progress).filter(
                      (p) => p.status === 'passed',
                    ).length
                  }{' '}
                  completados ·{' '}
                  {Object.values(student.progress).reduce(
                    (a, p) => a + p.attempts,
                    0,
                  )}{' '}
                  intentos
                </p>
              ))}
            </section>
          )}
          {!enabled && (
            <p>
              El catálogo funciona localmente. Para guardar progreso o ver tus
              cursos necesitás verificar tu sesión.
            </p>
          )}
        </DialogContent>
      </Dialog>
      {editing && (
        <ChallengeAuthor
          key={`${editing.course.id}:${editing.challenge.id}`}
          initial={editing.challenge}
          course={editing.course}
          compile={compile}
          capture={capture}
          close={() => setEditing(null)}
          preview={(challenge) => {
            const view = structuredClone(challenge);
            view.variants = view.variants.filter((v) => !v.reserved);
            start(view, editing.course.id,0,()=>setEditing(null));
          }}
          save={async (action, challenge, version) => {
            const data = await request(
              `/api/challenges/courses/${editing.course.id}/`,
              { version, action, challenge },
            );
            await refresh();
            return { version: data.version };
          }}
          reloadVersion={async () => {
            const data = await request('/api/challenges/');
            const course = data.courses.find(
              (c) => c.id === editing.course.id && c.teacher,
            );
            if (!course)
              throw new Error('Ya no tenés permiso docente en este curso.');
            return course.version;
          }}
        />
      )}
    </>
  );
}

function ChallengeAuthor({
  initial,
  course,
  compile,
  capture,
  close,
  preview,
  save,
  reloadVersion,
}: {
  initial: Challenge;
  course: Course;
  compile: () => CompiledProgram;
  capture: () => ProjectFile;
  close: () => void;
  preview: (c: Challenge) => void;
  save: (
    action: string,
    c: Challenge,
    version: string,
  ) => Promise<{ version: string }>;
  reloadVersion: () => Promise<string>;
}) {
  const [history, setHistory] = useState<Challenge[]>([
      structuredClone(initial),
    ]),
    [cursor, setCursor] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const c = history[cursor],
    inputRef = useRef<HTMLInputElement>(null),
    versionRef = useRef(course.version);
  const change = (update: (c: Challenge) => void) => {
    const next = structuredClone(c);
    update(next);
    setHistory([...history.slice(0, cursor + 1).slice(-49), next]);
    setCursor(Math.min(cursor + 1, 49));
    setNotice('Borrador con cambios sin guardar');
  };
  const act = async (action: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await save(action, decodeChallenge(c), versionRef.current);
      versionRef.current = result.version;
      setNotice(
        action === 'save'
          ? 'Borrador guardado'
          : action === 'publish'
            ? 'Versión publicada e inmutable'
            : action === 'assign'
              ? 'Asignada al curso'
              : 'Archivado',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se guardó.');
    } finally {
      setBusy(false);
    }
  };
  const values: { label: string; value: ChallengeObservation; type: string }[] =
    [
      { label: 'Contador', value: { kind: 'counterValue' }, type: 'number' },
      {
        label: 'Texto en consola',
        value: { kind: 'consoleText' },
        type: 'text',
      },
      ...c.initial.scene.devices.flatMap((device) =>
        componentValueCapabilities(device).map((cap) => ({
          label: `${device.name}: ${cap.label}`,
          type: cap.type,
          value: {
            kind: 'componentValue',
            deviceId: device.id,
            property: cap.key,
            valueType: cap.type,
            source: cap.source,
          } as ValueExpression,
        })),
      ),
      ...c.initial.scene.devices.flatMap((device) =>
        device.kind === 'display'
          ? [
              {
                label: `${device.name}: texto en pantalla`,
                value: {
                  kind: 'displayText',
                  deviceId: device.id,
                  areaId: 'screen',
                } as ChallengeObservation,
                type: 'text',
              },
            ]
          : [],
      ),
      ...(compile().variables ?? []).map((variable) => ({
        label: `Variable: ${variable.name}`,
        type: variable.type,
        value: {
          kind: 'variable',
          variableId: variable.id,
          valueType: variable.type,
        } as ValueExpression,
      })),
      ...(compile().timers ?? []).flatMap((timer) => [
        {
          label: `${timer.name}: tiempo transcurrido`,
          type: 'number',
          value: { kind: 'timerElapsed', timerId: timer.id } as ValueExpression,
        },
        {
          label: `${timer.name}: tiempo restante`,
          type: 'number',
          value: {
            kind: 'timerRemaining',
            timerId: timer.id,
          } as ValueExpression,
        },
      ]),
    ];
  const updateGoal = (
    variant: number,
    index: number,
    fn: (goal: ChallengeGoal) => void,
  ) => change((next) => fn(next.variants[variant].goals[index]));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (
          !open &&
          !busy &&
          confirm('¿Cerrar el editor? Los cambios no guardados se perderán.')
        )
          close();
      }}
    >
      <DialogContent className="challenge-dialog">
        <DialogHeader>
          <DialogTitle>Crear desafío · {course.name}</DialogTitle>
          <DialogDescription>
            La escena y los bloques iniciales se toman del proyecto. Los
            objetivos comprueban comportamiento, no una solución única.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert">{error}</p>}
        <output>{notice || 'Borrador'}</output>
        <fieldset disabled={busy} className="challenge-author-fields">
          <legend className="sr-only">Editor del desafío</legend>
          <Button
            variant="outline"
            onClick={() => {
              if (
                !confirm(
                  '¿Actualizar la versión del curso conservando este borrador? Revisá los cambios ajenos antes de volver a guardar. Podés exportar el borrador primero.',
                )
              )
                return;
              setBusy(true);
              void reloadVersion()
                .then((version) => {
                  versionRef.current = version;
                  setError('');
                  setNotice(
                    'Versión del curso actualizada. El borrador sigue sin guardar.',
                  );
                })
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            Resolver conflicto sin perder mi borrador
          </Button>
          <div className="challenge-actions">
            <Button
              variant="outline"
              disabled={!cursor || busy}
              onClick={() => setCursor(cursor - 1)}
            >
              Deshacer
            </Button>
            <Button
              variant="outline"
              disabled={cursor === history.length - 1 || busy}
              onClick={() => setCursor(cursor + 1)}
            >
              Rehacer
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                change((next) => {
                  next.version++;
                })
              }
            >
              Nueva versión
            </Button>
          </div>
          <label>
            Título
            <input
              maxLength={100}
              value={c.title}
              onChange={(e) =>
                change((next) => {
                  next.title = e.target.value;
                })
              }
            />
          </label>
          <label>
            Consigna
            <textarea
              maxLength={2000}
              value={c.prompt}
              onChange={(e) =>
                change((next) => {
                  next.prompt = e.target.value;
                })
              }
            />
          </label>
          <label>
            Tramo
            <input
              type="number"
              min={1}
              max={14}
              value={c.stage}
              onChange={(e) =>
                change((next) => {
                  next.stage = Number(e.target.value);
                })
              }
            />
          </label>
          <label>
            Conceptos (separados por coma)
            <input
              value={c.concepts.join(', ')}
              onChange={(e) =>
                change((next) => {
                  next.concepts = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                })
              }
            />
          </label>
          <label>
            Programa inicial
            <select
              value={c.mode}
              onChange={(e) =>
                change((next) => {
                  next.mode = e.target.value as Challenge['mode'];
                })
              }
            >
              <option value="empty">Vacío</option>
              <option value="partial">Parcial</option>
              <option value="broken">Para corregir</option>
              <option value="refactor">Para reorganizar</option>
              <option value="creative">Creación libre</option>
            </select>
          </label>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              change((next) => {
                next.initial.workspace = {
                  blocks: {
                    languageVersion: 0,
                    blocks: [
                      {
                        type: 'capi_start',
                        id: crypto.randomUUID(),
                        x: 40,
                        y: 40,
                      },
                    ],
                  },
                };
                next.mode = 'empty';
              })
            }
          >
            Dejar sólo Al comenzar
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              change((next) => {
                next.initial = capture();
                delete next.initial.workspace.capiChallenge;
              })
            }
          >
            Actualizar escena y programa inicial desde mi proyecto
          </Button>
          <details>
            <summary>Herramientas disponibles ({c.palette.length})</summary>
            <div className="challenge-palette">
              {blockChoices.map((block) => (
                <label key={block.type}>
                  <input
                    type="checkbox"
                    checked={c.palette.includes(block.type)}
                    onChange={(e) =>
                      change((next) => {
                        next.palette = e.target.checked
                          ? [...next.palette, block.type]
                          : next.palette.filter((t) => t !== block.type);
                      })
                    }
                  />
                  {block.category}:{' '}
                  {block.type.replace('capi_', '').replaceAll('_', ' ')}
                </label>
              ))}
            </div>
          </details>
          <h3>Casos y objetivos</h3>
          {c.variants.map((variant, v) => (
            <fieldset key={v}>
              <legend>Caso {v + 1}</legend>
              <label>
                <input
                  type="checkbox"
                  checked={variant.reserved ?? false}
                  onChange={(e) =>
                    change((next) => {
                      next.variants[v].reserved = e.target.checked;
                    })
                  }
                />
                Reservado para revisión docente (no se envía al alumno)
              </label>
              <label>
                Nombre
                <input
                  value={variant.label}
                  onChange={(e) =>
                    change((next) => {
                      next.variants[v].label = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Semilla
                <input
                  type="number"
                  min={0}
                  max={4294967295}
                  value={variant.seed}
                  onChange={(e) =>
                    change((next) => {
                      next.variants[v].seed = Number(e.target.value);
                    })
                  }
                />
              </label>
              {c.initial.scene.devices
                .filter((d) =>
                  [
                    'button',
                    'infraredBarrier',
                    'lightSensor',
                    'potentiometer',
                  ].includes(d.kind),
                )
                .map((device) => (
                  <label key={device.id}>
                    {device.name}: valores iniciales posibles (separados por
                    coma)
                    <input
                      value={
                        variant.inputs
                          .find((i) => i.deviceId === device.id)
                          ?.values.map(String)
                          .join(',') ?? ''
                      }
                      placeholder="Sin cambio"
                      onChange={(e) =>
                        change((next) => {
                          const inputs = next.variants[v].inputs.filter(
                            (i) => i.deviceId !== device.id,
                          );
                          if (e.target.value.trim())
                            inputs.push({
                              deviceId: device.id,
                              values: e.target.value
                                .split(',')
                                .map((s) =>
                                  ['button', 'infraredBarrier'].includes(
                                    device.kind,
                                  )
                                    ? s.trim() === 'true'
                                    : Number(s),
                                ),
                            });
                          next.variants[v].inputs = inputs;
                        })
                      }
                    />
                  </label>
                ))}
              {variant.goals.map((goal, g) => (
                <div className="challenge-goal" key={g}>
                  <label>
                    Qué esperamos
                    <input
                      value={goal.label}
                      onChange={(e) =>
                        updateGoal(v, g, (next) => {
                          next.label = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    Observar a los (ms)
                    <input
                      type="number"
                      min={0}
                      max={120000}
                      value={goal.atMs}
                      onChange={(e) =>
                        updateGoal(v, g, (next) => {
                          next.atMs = Number(e.target.value);
                        })
                      }
                    />
                  </label>
                  <label>
                    Dato
                    <select
                      value={values.findIndex(
                        (item) =>
                          JSON.stringify(item.value) ===
                          JSON.stringify(goal.value),
                      )}
                      onChange={(e) =>
                        updateGoal(v, g, (next) => {
                          const item = values[Number(e.target.value)];
                          next.value = item.value;
                          next.expected =
                            item.type === 'text'
                              ? ''
                              : item.type === 'boolean'
                                ? true
                                : 0;
                        })
                      }
                    >
                      {values.map((item, i) => (
                        <option key={i} value={i}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Comparar
                    <select
                      value={goal.operator}
                      onChange={(e) =>
                        updateGoal(v, g, (next) => {
                          next.operator = e.target
                            .value as ChallengeGoal['operator'];
                        })
                      }
                    >
                      {['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'CONTAINS'].map(
                        (op, i) => (
                          <option key={op} value={op}>
                            {['=', '≠', '<', '≤', '>', '≥', 'contiene'][i]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Valor esperado
                    <input
                      value={String(goal.expected)}
                      onChange={(e) =>
                        updateGoal(v, g, (next) => {
                          next.expected =
                            typeof goal.expected === 'number'
                              ? Number(e.target.value)
                              : typeof goal.expected === 'boolean'
                                ? e.target.value === 'true'
                                : e.target.value;
                        })
                      }
                    />
                  </label>
                  <Button
                    variant="ghost"
                    disabled={variant.goals.length === 1&&c.mode!=='creative'}
                    onClick={() =>
                      change((next) => {
                        next.variants[v].goals.splice(g, 1);
                      })
                    }
                  >
                    Quitar objetivo
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                disabled={variant.goals.length >= 16}
                onClick={() =>
                  change((next) => {
                    next.variants[v].goals.push(
                      structuredClone(variant.goals[0]??{label:'Objetivo',atMs:1000,value:{kind:'counterValue'},operator:'EQ',expected:0}),
                    );
                  })
                }
              >
                Agregar objetivo
              </Button>
              <Button
                variant="ghost"
                disabled={c.variants.length === 1}
                onClick={() =>
                  change((next) => {
                    next.variants.splice(v, 1);
                  })
                }
              >
                Quitar caso
              </Button>
            </fieldset>
          ))}
          <Button
            variant="outline"
            disabled={c.variants.length >= 8}
            onClick={() =>
              change((next) => {
                const variant = structuredClone(next.variants[0]);
                variant.label = `Caso ${next.variants.length + 1}`;
                variant.seed++;
                next.variants.push(variant);
              })
            }
          >
            Agregar variante
          </Button>
          <details>
            <summary>Expectativas pedagógicas</summary>
            {c.expectations.map((expectation, i) => (
              <div key={i}>
                <label>
                  Herramienta
                  <select
                    value={expectation.operation}
                    onChange={(e) =>
                      change((next) => {
                        next.expectations[i].operation = e.target
                          .value as typeof expectation.operation;
                      })
                    }
                  >
                    {[
                      'repeat',
                      'while',
                      'if',
                      'switch',
                      'parallel',
                      'procedureCall',
                      'parameters',
                      'timerStart',
                      'serial',
                      'dataText',
                      'variableSet',
                    ].map((op) => (
                      <option key={op}>{op}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Explicación
                  <input
                    value={expectation.explanation}
                    onChange={(e) =>
                      change((next) => {
                        next.expectations[i].explanation = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={expectation.mandatory}
                    onChange={(e) =>
                      change((next) => {
                        next.expectations[i].mandatory = e.target.checked;
                        if (
                          e.target.checked &&
                          !next.prompt.includes(expectation.explanation)
                        )
                          next.prompt += `\n${expectation.explanation}`;
                      })
                    }
                  />
                  Obligatoria (debe figurar en la consigna)
                </label>
                <Button
                  variant="ghost"
                  onClick={() =>
                    change((next) => {
                      next.expectations.splice(i, 1);
                    })
                  }
                >
                  Quitar
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              disabled={c.expectations.length >= 12}
              onClick={() =>
                change((next) => {
                  next.expectations.push({
                    operation: 'repeat',
                    minimum: 1,
                    mandatory: false,
                    explanation: 'Probá usar un bucle.',
                  });
                })
              }
            >
              Agregar expectativa
            </Button>
          </details>
          <label>
            Pistas en orden (una por línea)
            <textarea
              value={c.hints.join('\n')}
              onChange={(e) =>
                change((next) => {
                  next.hints = e.target.value.split('\n');
                })
              }
            />
          </label>
          <label>
            Explicación al completar
            <textarea
              value={c.explanation}
              onChange={(e) =>
                change((next) => {
                  next.explanation = e.target.value;
                })
              }
            />
          </label>
          <div className="challenge-actions">
            <Button disabled={busy} onClick={() => void act('save')}>
              Guardar borrador
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void act('publish')}
            >
              Publicar versión
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void act('assign')}
            >
              Asignar al curso
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                try {
                  preview(decodeChallenge(c));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Vista de alumno
            </Button>
            <Button variant="outline" onClick={() => download(c)}>
              Exportar desafío
            </Button>
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              Importar desafío
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void act('archive')}
            >
              Archivar
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (confirm('¿Cancelar y cerrar? Lo no guardado se perderá.'))
                  close();
              }}
            >
              Cancelar
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 250000) {
                setError('El archivo supera 250 KB.');
                return;
              }
              void file
                .text()
                .then((text) => {
                  const imported = decodeChallenge(JSON.parse(text));
                  imported.id = crypto.randomUUID();
                  imported.version = 1;
                  change((next) => Object.assign(next, imported));
                })
                .catch((e) => setError(e.message));
            }}
          />
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
