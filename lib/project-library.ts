import type { ProjectFile } from './capiblocks';

export type ProjectCourse = { id: string; name: string; isArchived: boolean; ownerCanEdit: boolean };

export type CloudProject = {
  id: string;
  title: string;
  revision: number;
  updatedAt: string;
  trashedAt: string | null;
  course?: ProjectCourse | null;
};
export type ProjectLink = {
  id: string;
  revision: number;
  savedFingerprint: string;
  course?: ProjectCourse | null;
};

// Sólo indicador de cambios de UX, nunca autorización ni integridad del servidor.
// Orden canónico: PostgreSQL JSONB puede devolver propiedades en otro orden.
export function projectFingerprint(project: ProjectFile): string {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object')
      return `{${Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
        .join(',')}}`;
    return JSON.stringify(value);
  };
  const raw = canonical([
    project.metadata.title,
    project.target,
    project.scene,
    project.simulation,
    project.workspace,
  ]);
  let a = 2166136261,
    b = 5381;
  for (let index = 0; index < raw.length; index++) {
    const code = raw.charCodeAt(index);
    a = Math.imul(a ^ code, 16777619);
    b = Math.imul(b, 33) ^ code;
  }
  return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

export function isProjectLink(value: unknown): value is ProjectLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as ProjectLink;
  return (
    typeof link.id === 'string' &&
    /^[a-f0-9-]{36}$/.test(link.id) &&
    Number.isSafeInteger(link.revision) &&
    link.revision > 0 &&
    typeof link.savedFingerprint === 'string' &&
    link.savedFingerprint.length <= 32 &&
    (link.course == null || (typeof link.course.id === 'string' && typeof link.course.name === 'string' && link.course.name.length <= 100 && typeof link.course.isArchived === 'boolean' && typeof link.course.ownerCanEdit === 'boolean'))
  );
}
