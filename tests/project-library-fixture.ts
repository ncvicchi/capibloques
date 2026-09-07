import type { Page } from '@playwright/test';
import type { ProjectFile } from '../lib/capiblocks';
import type { CloudProject } from '../lib/project-library';
import { student, token } from './editor-fixture';

// Contrato UI exclusivamente. Autorización/CSRF/validación reales: tests Django.
export async function mockLibrary(page: Page) {
  const projects = new Map<string, { project: CloudProject; document: ProjectFile }>();
  const operations = new Map<string, string>();
  const control = { projects, writes: 0, loseNextAck: false, staleNext: false, delayMs: 0 };
  await page.route('**/api/projects/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const [, , , id, action] = url.pathname.split('/');
    if (req.headers()['x-capi-account'] !== student.id) return route.fulfill({ status: 409, json: { code: 'account_changed', error: 'La cuenta cambió' } });
    const record = projects.get(id);
    if (req.method() === 'GET') {
      if (id) return route.fulfill({ status: record ? 200 : 404, json: record ?? { error: 'No disponible' } });
      const trash = url.searchParams.get('state') === 'trash';
      const entries = [...projects.values()].filter(item => Boolean(item.project.trashedAt) === trash && item.project.title.toLowerCase().includes((url.searchParams.get('q') ?? '').toLowerCase()));
      return route.fulfill({ json: { projects: entries.map(item => item.project), count: entries.length, page: 1, pageSize: 20, actor: student, csrfToken: token } });
    }
    const body = req.postDataJSON();
    if (operations.has(body.operationId)) return route.fulfill({ json: { project: projects.get(operations.get(body.operationId)!)!.project } });
    if (control.staleNext || (record && record.project.revision !== body.revision)) {
      control.staleNext = false;
      return route.fulfill({ status: 409, json: { code: 'stale_revision', error: 'Otra pestaña cambió este proyecto. Guardá una copia o abrí la versión del servidor.' } });
    }
    const now = new Date().toISOString();
    let saved = record;
    if (!id) {
      saved = { project: { id: body.id, title: body.document.metadata.title, revision: 1, updatedAt: now, trashedAt: null }, document: body.document };
      projects.set(body.id, saved!);
    } else if (saved) {
      saved.project.revision++;
      saved.project.updatedAt = now;
      if (action === 'trash') saved.project.trashedAt = now;
      else if (action === 'restore') saved.project.trashedAt = null;
      else if (action === 'rename') saved.document.metadata.title = saved.project.title = body.title;
      else { saved.document = body.document; saved.project.title = body.document.metadata.title; }
    }
    if (!saved) return route.fulfill({ status: 404, json: { error: 'No disponible' } });
    control.writes++; operations.set(body.operationId, saved.project.id);
    if (control.delayMs) await new Promise(resolve => setTimeout(resolve, control.delayMs));
    if (control.loseNextAck) { control.loseNextAck = false; return route.abort('connectionfailed'); }
    return route.fulfill({ status: id ? 200 : 201, json: { project: saved.project } });
  });
  return control;
}
