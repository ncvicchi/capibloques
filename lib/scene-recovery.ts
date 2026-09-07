import { isSceneDefinition, type SceneDefinition, type SceneDevice, type SceneWidget } from './scene-model';

export type InspectorDraft = { kind: 'device'; value: SceneDevice } | { kind: 'widget'; value: SceneWidget };
export type SceneDraft = {
  version: 1;
  base: SceneDefinition;
  scene: SceneDefinition;
  selectedId?: string;
  inspector: InspectorDraft | null;
};
// Portable: deliberadamente sin cuenta, UUID servidor ni envío pendiente.
export function exportLocalSceneCopy(document: string, sceneDraft: SceneDraft) {
  return JSON.stringify({ application: 'CapiBloquesLocalCopy', version: 1, project: JSON.parse(document), sceneDraft });
}
export function sceneDraftPreview(draft: SceneDraft): SceneDefinition {
  const scene = structuredClone(draft.scene), inspector = draft.inspector;
  if (inspector?.kind === 'device') scene.devices = scene.devices.map(item => item.id === inspector.value.id ? structuredClone(inspector.value) : item);
  if (inspector?.kind === 'widget') scene.widgets = scene.widgets.map(item => item.id === inspector.value.id ? structuredClone(inspector.value) : item);
  return scene;
}
export function isSceneDraft(value: unknown): value is SceneDraft {
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > 2 * 1024 * 1024) return false;
  const draft = value as SceneDraft;
  if (draft.version !== 1 || !isSceneDefinition(draft.base) || !isSceneDefinition(draft.scene) || (draft.selectedId !== undefined && typeof draft.selectedId !== 'string')) return false;
  if (draft.inspector !== null) {
    const item = draft.inspector;
    if (!item?.value || !['device', 'widget'].includes(item.kind) || item.value.id !== draft.selectedId) return false;
    if (!(item.kind === 'device' ? draft.scene.devices : draft.scene.widgets).some(row => row.id === item.value.id)) return false;
  }
  return isSceneDefinition(sceneDraftPreview(draft));
}
