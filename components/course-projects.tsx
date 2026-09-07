'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { decodeProject, downloadText, safeFilename } from '@/lib/capiblocks';
import type { CloudProject } from '@/lib/project-library';

type Listing = {
  projects: (CloudProject & {
    owner: { displayName: string; alias: string };
  })[];
  count: number;
  page: number;
  pageSize: number;
};
export default function CourseProjects({
  courseId,
  accountId,
  locked,
}: {
  courseId: string;
  accountId: string;
  locked: boolean;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState({ q: '', page: 1 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const epoch = useRef(0),
    active = useRef(false),
    downloading = useRef(false);
  const available = () =>
    active.current && document.documentElement.dataset.editorLocked !== 'true';
  const root = `/api/courses/${courseId}/projects/`;
  useEffect(() => {
    active.current = true;
    const refresh = async () => {
      if (locked || !active.current || downloading.current) return;
      const ticket = ++epoch.current;
      try {
        const response = await fetch(
          `${root}?${new URLSearchParams({ q: filter.q, page: String(filter.page) })}`,
          {
            headers: { 'X-Capi-Account': accountId },
            cache: 'no-store',
            signal: AbortSignal.timeout(12000),
          },
        );
        const data = (await response.json()) as Listing;
        if (ticket !== epoch.current || !active.current) return;
        if (!response.ok || !Array.isArray(data.projects))
          throw new Error(
            'Los proyectos ya no están disponibles o no pudimos verificar tu acceso.',
          );
        setListing(data);
        setError('');
      } catch (failure) {
        if (ticket === epoch.current && active.current) {
          setListing(null);
          setError(
            failure instanceof Error ? failure.message : 'No hay conexión.',
          );
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      active.current = false;
      // Epoch lógico para descartar solicitudes de un curso/cuenta anterior.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++epoch.current;
      window.clearInterval(timer);
    };
  }, [accountId, filter, locked, root, reload]);
  async function exportProject(project: CloudProject) {
    if (!available() || downloading.current) return;
    downloading.current = true;
    setBusy(true);
    setError('');
    const ticket = epoch.current;
    try {
      const response = await fetch(`${root}${project.id}/`, {
        headers: { 'X-Capi-Account': accountId },
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      const data = (await response.json()) as { document?: unknown };
      if (ticket !== epoch.current || !available()) return;
      if (!response.ok) {
        setListing(null);
        throw new Error(
          'El proyecto ya no está disponible. Actualizá el curso.',
        );
      }
      const decoded = decodeProject(data.document);
      if (!decoded.project)
        throw new Error('El JSON no es compatible; no se descargó.');
      downloadText(
        `${safeFilename(decoded.project.metadata.title)}.capibloques.json`,
        JSON.stringify(decoded.project, null, 2),
        'application/json',
      );
    } catch (failure) {
      if (available())
        setError(
          failure instanceof Error
            ? failure.message
            : 'No pudimos descargar el JSON.',
        );
    } finally {
      downloading.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <section
      className="course-projects"
      aria-labelledby="course-projects-heading"
    >
      <h2 id="course-projects-heading">Proyectos guardados del curso</h2>
      <p>
        Sólo trabajos que los alumnos asignaron a este curso. La descarga es una
        copia: importarla en tu editor no modifica el original. Los archivos
        descargados no se revocan si luego cambia la asignación.
      </p>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <form
        className="library-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter({ q: query, page: 1 });
        }}
      >
        <label htmlFor="course-project-search">
          Buscar proyecto
          <Input
            id="course-project-search"
            maxLength={80}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Button type="submit" variant="outline" disabled={busy}>
          Buscar proyectos
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setReload((value) => value + 1)}
        >
          Actualizar proyectos
        </Button>
      </form>
      {listing ? (
        <>
          {!listing.count && <p>No hay proyectos compartidos en esta vista.</p>}
          <ul className="course-member-list">
            {listing.projects.map((project) => (
              <li key={project.id}>
                <div>
                  <strong>{project.title}</strong>
                  <span>
                    {project.owner.displayName} (@{project.owner.alias}) ·
                    Versión {project.revision} ·{' '}
                    {new Date(project.updatedAt).toLocaleString('es-AR')}
                  </span>
                </div>
                <Button
                  variant="outline"
                  disabled={busy || locked}
                  onClick={() => void exportProject(project)}
                >
                  Descargar JSON de {project.title}
                </Button>
              </li>
            ))}
          </ul>
          <nav
            className="account-actions"
            aria-label="Páginas de proyectos del curso"
          >
            <Button
              variant="outline"
              disabled={busy || listing.page <= 1}
              onClick={() => setFilter({ ...filter, page: listing.page - 1 })}
            >
              Proyectos anteriores
            </Button>
            <span>
              {listing.count} proyectos · página {listing.page}
            </span>
            <Button
              variant="outline"
              disabled={
                busy || listing.page * listing.pageSize >= listing.count
              }
              onClick={() => setFilter({ ...filter, page: listing.page + 1 })}
            >
              Más proyectos
            </Button>
          </nav>
        </>
      ) : (
        <p>Actualizá para verificar los proyectos disponibles.</p>
      )}
      <p className="account-help">
        El visor de revisión y las devoluciones por versión llegarán en la fase
        de supervisión.
      </p>
    </section>
  );
}
