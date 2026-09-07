'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CloudProject } from '@/lib/project-library';
import type { AccountDraftStore } from '@/lib/account-session';

export default function ProjectCourseDialog({ project, accountId, token, store, close, saved }: { project: CloudProject; accountId: string; token: string; store: AccountDraftStore; close: () => void; saved: () => void }) {
  const [courses, setCourses] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState(project.course?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false), inFlight = useRef(false);
  const headers = { 'Content-Type': 'application/json', 'X-CSRFToken': token, 'X-Capi-Account': accountId };
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    void fetch('/api/projects/courses/', { headers: { 'X-Capi-Account': accountId }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) }).then(async response => {
      const data = await response.json() as { courses?: { id: string; name: string }[] };
      if (!active.current || !store.active) return;
      if (!response.ok || !Array.isArray(data.courses)) throw new Error('No pudimos verificar tus cursos. Cerrá y reintentá.');
      setCourses(data.courses);
    }).catch(failure => { if (active.current) setError(failure instanceof Error ? failure.message : 'No hay conexión.'); });
    return () => { active.current = false; controller.abort(); };
  }, [accountId, store]);
  async function save() {
    if (!store.active || inFlight.current || !courses) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/projects/${project.id}/course/`, { method: 'POST', headers, body: JSON.stringify({ operationId: crypto.randomUUID(), revision: project.revision, courseId: selected || null }), signal: AbortSignal.timeout(15000) });
      const data = await response.json() as { error?: string };
      if (!active.current || !store.active) return;
      if (!response.ok) throw new Error(data.error || 'No pudimos cambiar el curso.');
      saved(); close();
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : 'No pudimos confirmar el cambio. Cerrá y actualizá la biblioteca antes de repetir.'); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  const unavailable = project.course && !project.course.ownerCanEdit;
  return <Dialog open onOpenChange={value => { if (!value && !busy) close(); }}><DialogContent className="management-dialog" showCloseButton={!busy}>
    <DialogHeader><DialogTitle>Elegir curso del proyecto</DialogTitle><DialogDescription>{project.title}: se asigna la versión guardada en servidor, no los cambios pendientes del editor.</DialogDescription></DialogHeader>
    {error && <p role="alert" className="account-error">{error}</p>}
    {unavailable ? <p>El curso está archivado o ya no estás asignado. Conservamos el original; duplicalo como proyecto personal para continuar.</p> : <>
      <label className="library-filters" htmlFor="project-course-choice">Compartir con<select id="project-course-choice" disabled={busy || !courses} value={selected} onChange={event => setSelected(event.target.value)}><option value="">Personal · sólo yo</option>{project.course && !courses?.some(course => course.id === project.course?.id) && <option value={project.course.id}>{project.course.name}</option>}{courses?.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
      {courses?.length === 0 && <p>No tenés cursos activos como alumno. Podés conservar tu proyecto personal.</p>}
      <p>Los docentes asignados al curso podrán ver y descargar este proyecto guardado. Los compañeros no. Volver a Personal revoca ese acceso, pero no borra copias que ya hayan descargado.</p>
    </>}
    <div className="account-actions"><Button variant="outline" disabled={busy} onClick={close}>Cancelar</Button><Button disabled={busy || !courses || Boolean(unavailable) || selected === (project.course?.id ?? '')} onClick={() => void save()}>Guardar curso del proyecto</Button></div>
  </DialogContent></Dialog>;
}
