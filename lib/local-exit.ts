import { decodeProject } from './capiblocks';
import { projectFingerprint } from './project-library';
import { RecoveryJournal, type RecoverySnapshot } from './project-recovery';
import type { SceneDraft } from './scene-recovery';

export type ExitSnapshot = {
  recovery: RecoverySnapshot;
  legacy: { key: string; raw: string | null }[];
  files: { id: string; title: string; document: string; status: string; sceneDraft?: SceneDraft | null }[];
};

export async function prepareLocalExit(journal: RecoveryJournal): Promise<ExitSnapshot> {
  const recovery = await journal.snapshot();
  const prefix = `capibloques-account:${journal.accountId}:`;
  const legacy = ['project-v2', 'library-draft-v1'].map(suffix => {
    const key = `${prefix}${suffix}`;
    return { key, raw: localStorage.getItem(key) };
  });
  const files: ExitSnapshot['files'] = recovery.rows.map(row => ({
    id: row.id, title: row.title, document: row.document, sceneDraft: row.sceneDraft,
    status: row.pending ? 'Envío sin confirmar' : !row.remote ? 'Sólo en esta computadora'
      : projectFingerprint(JSON.parse(row.document)) !== row.remote.savedFingerprint ? 'Cambios sólo en esta computadora' : 'Coincide con el último guardado confirmado',
  }));
  for (const [index, entry] of legacy.entries()) {
    if (entry.raw === null) continue;
    const value = JSON.parse(entry.raw);
    const document = index === 0 ? entry.raw : value.document;
    if (index === 1 && value.accountId !== journal.accountId) throw new Error('El borrador anterior necesita revisión; no se quitó.');
    const decoded = decodeProject(JSON.parse(document));
    if (!decoded.project) throw new Error('No pudimos leer una copia anterior. Conservá las copias al salir.');
    files.push({ id: entry.key, title: decoded.project.metadata.title, document, status: 'Copia anterior (también se quitará)' });
  }
  return { recovery, legacy, files };
}

export async function clearLocalExit(journal: RecoveryJournal, snapshot: ExitSnapshot) {
  const checkLegacy = () => {
    if (snapshot.legacy.some(entry => localStorage.getItem(entry.key) !== entry.raw))
      throw new Error('Una copia anterior cambió. No se quitó; ingresá nuevamente para revisarla.');
  };
  checkLegacy();
  await journal.removeAll(snapshot.recovery);
  checkLegacy();
  // Sólo documentos de esta cuenta: ni otra cuenta ni el borrador anónimo.
  for (const entry of snapshot.legacy) localStorage.removeItem(entry.key);
}
