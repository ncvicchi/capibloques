import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { ProjectFile } from '../lib/capiblocks';
import type { ReviewStatus, Feedback } from '../lib/project-review';

export const reviewProjectId = '1041cbae-f86b-491a-a451-b1f407005b43';
export const reviewCourseId = '60979391-6d1c-4f45-88f9-c65923d651d5';
export const teacher = {
  id: '7908e1d2-c9e6-4e36-bf45-9ba6b420f80e',
  alias: 'profe',
  displayName: 'Profe Sol',
  roles: ['docente'],
  mustChangePassword: false,
};
export const pupil = {
  id: '021a57b5-2991-498a-9b2e-af84ce662aa6',
  alias: 'luna',
  displayName: 'Luna',
  roles: ['alumno'],
  mustChangePassword: false,
};
export const reviewPath = `/revision/?project=${reviewProjectId}&course=${reviewCourseId}`;
export const sampleProject = () =>
  JSON.parse(
    readFileSync('backend/tests/fixtures/projects-v2.json', 'utf8'),
  )[0] as ProjectFile;

export async function mockReview(page: Page, owner = false) {
  const sample = sampleProject();
  const version = {
    revision: 1,
    title: sample.metadata.title,
    createdAt: '2026-09-07T12:00:00Z',
    pinned: false,
    current: true,
    bytes: JSON.stringify(sample).length,
    kind: 'manual',
  };
  const status: ReviewStatus = {
    project: {
      id: reviewProjectId,
      title: sample.metadata.title,
      revision: 1,
      updatedAt: version.createdAt,
      trashedAt: null,
      course: {
        id: reviewCourseId,
        name: 'Robótica A',
        isArchived: false,
        ownerCanEdit: true,
      },
    },
    owner: pupil,
    versions: [version],
    feedback: [],
    isOwner: owner,
    canComment: !owner,
    canRespond: owner,
    csrfToken: 'review-token',
  };
  const state = {
    actor: owner ? pupil : teacher,
    status,
    denied: false,
    offline: false,
    postOffline: false,
    dropCommentAck: false,
    conflict: false,
    copies: 0,
    snapshotOpens: 0,
    posts: [] as { method: string; path: string; data: unknown }[],
    documents: new Map<number, ProjectFile>([[1, sample]]),
  };
  await page.route('**/api/auth/session/', (route) =>
    route.fulfill({ json: { user: state.actor, csrfToken: 'review-token' } }),
  );
  await page.route('**/api/review/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace(`/api/review/${reviewProjectId}/`, ''),
      method = request.method();
    if (state.denied)
      return route.fulfill({
        status: 404,
        json: { error: 'Proyecto no disponible' },
      });
    if (state.offline)
      return route.fulfill({ status: 503, json: { error: 'Sin conexión' } });
    if (method !== 'GET') {
      state.posts.push({ method, path, data: request.postDataJSON() });
      if (state.postOffline) return route.abort();
    }
    if (path === '') return route.fulfill({ json: state.status });
    const match = path.match(/^versions\/(\d+)\/(copy\/)?$/);
    if (match) {
      const revision = Number(match[1]);
      if (match[2]) {
        state.copies++;
        return route.fulfill({
          status: 201,
          json: {
            project: {
              id: request.postDataJSON().id,
              title: `Copia de ${sample.metadata.title}`,
              provenance: {
                title: sample.metadata.title,
                revision,
                course: 'Robótica A',
              },
            },
          },
        });
      }
      if (method === 'POST') state.snapshotOpens++;
      const doc = state.documents.get(revision);
      if (!doc)
        return route.fulfill({
          status: 404,
          json: {
            error: 'Esta versión ya no está disponible',
            code: 'version_unavailable',
          },
        });
      return route.fulfill({
        json: {
          version: { ...version, revision, title: doc.metadata.title },
          document: doc,
        },
      });
    }
    if (path === 'feedback/' && method === 'POST') {
      const data = request.postDataJSON();
      const existing = state.status.feedback.find(
        (item) => item.id === data.id,
      );
      if (existing) return route.fulfill({ json: { feedback: existing } });
      const feedback: Feedback = {
        ...data,
        author: teacher,
        reply: '',
        resolved: false,
        version: 1,
        createdAt: version.createdAt,
        updatedAt: version.createdAt,
      };
      state.status.feedback.push(feedback);
      if (state.dropCommentAck) {
        state.dropCommentAck = false;
        return route.abort();
      }
      return route.fulfill({ status: 201, json: { feedback } });
    }
    if (path.startsWith('feedback/') && method === 'PATCH') {
      const data = request.postDataJSON(),
        item = state.status.feedback.find((entry) => path.includes(entry.id))!;
      if (state.conflict) {
        state.conflict = false;
        item.version++;
        item.reply = 'Respuesta desde otra pestaña';
        return route.fulfill({
          status: 409,
          json: {
            error:
              'La respuesta cambió en otra pestaña. Tu borrador sigue aquí.',
          },
        });
      }
      Object.assign(item, {
        reply: data.reply,
        resolved: data.resolved,
        version: item.version + 1,
      });
      return route.fulfill({ json: { feedback: item } });
    }
    return route.fulfill({
      status: 405,
      json: { error: 'Operación no admitida' },
    });
  });
  return state;
}

export function addFeedback(state: Awaited<ReturnType<typeof mockReview>>) {
  const item: Feedback = {
    id: '7b8046c4-3127-47f0-85d0-42fb08eedca5',
    revision: 1,
    author: teacher,
    text: '¿Qué pasa si los dos semáforos quedan en verde?',
    reply: '',
    resolved: false,
    version: 1,
    createdAt: '2026-09-07T12:00:00Z',
    updatedAt: '2026-09-07T12:00:00Z',
  };
  state.status.feedback.push(item);
  state.status.versions[0].pinned = true;
  return item;
}

export function nextVersion(state: Awaited<ReturnType<typeof mockReview>>) {
  state.status.project.revision = 2;
  state.status.versions[0].current = false;
  state.status.versions.unshift({
    ...state.status.versions[0],
    revision: 2,
    current: true,
    pinned: false,
  });
  const sample = structuredClone(state.documents.get(1)!);
  sample.metadata.title = 'Segunda versión';
  state.documents.set(2, sample);
}
