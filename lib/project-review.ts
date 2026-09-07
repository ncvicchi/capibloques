import type { CloudProject } from './project-library';

export type ReviewVersion = {
  revision: number;
  title: string;
  createdAt: string;
  pinned: boolean;
  current: boolean;
  bytes: number;
  kind: string;
};
export type Feedback = {
  id: string;
  revision: number;
  author: { displayName: string; alias: string; avatarId?: string } | null;
  text: string;
  reply: string;
  resolved: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type ReviewStatus = {
  project: CloudProject;
  owner: { displayName: string; alias: string; avatarId?: string };
  versions: ReviewVersion[];
  feedback: Feedback[];
  isOwner: boolean;
  canComment: boolean;
  canRespond: boolean;
  csrfToken: string;
};
export type ReviewRequest = <T>(
  path: string,
  options?: RequestInit,
) => Promise<T>;

// Un corte o una respuesta parcial nunca debe hacer caer el visor con datos
// personales todavía montados. No sustituye la autorización del servidor.
export function isReviewStatus(value: unknown): value is ReviewStatus {
  if (!value || typeof value !== 'object') return false;
  const data = value as ReviewStatus;
  const text = (item: unknown): item is string => typeof item === 'string';
  const positive = (item: unknown): item is number =>
    Number.isSafeInteger(item) && Number(item) > 0;
  return Boolean(
    data.project &&
    text(data.project.id) &&
    text(data.project.title) &&
    positive(data.project.revision) &&
    text(data.project.updatedAt) &&
    (data.project.course == null ||
      (text(data.project.course.id) &&
        text(data.project.course.name) &&
        typeof data.project.course.isArchived === 'boolean')) &&
    data.owner &&
    text(data.owner.alias) &&
    text(data.owner.displayName) &&
    text(data.csrfToken) &&
    data.csrfToken.length > 0 &&
    typeof data.isOwner === 'boolean' &&
    typeof data.canComment === 'boolean' &&
    typeof data.canRespond === 'boolean' &&
    Array.isArray(data.versions) &&
    data.versions.length > 0 &&
    data.versions.every(
      (item) =>
        item &&
        positive(item.revision) &&
        text(item.title) &&
        text(item.createdAt) &&
        typeof item.current === 'boolean' &&
        typeof item.pinned === 'boolean',
    ) &&
    Array.isArray(data.feedback) &&
    data.feedback.length <= 50 &&
    data.feedback.every(
      (item) =>
        item &&
        text(item.id) &&
        positive(item.revision) &&
        positive(item.version) &&
        text(item.text) &&
        text(item.reply) &&
        typeof item.resolved === 'boolean' &&
        text(item.createdAt) &&
        text(item.updatedAt) &&
        (item.author === null ||
          (item.author &&
            text(item.author.displayName) &&
            text(item.author.alias))),
    ),
  );
}

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

export const reviewUrl = (
  id: string,
  course?: string | null,
  revision?: number,
) =>
  `/revision/?${new URLSearchParams({ project: id, ...(course ? { course } : {}), ...(revision ? { version: String(revision) } : {}) })}`;
