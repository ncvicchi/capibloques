'use client';

import { useEffect, useMemo, useState } from 'react';
import SceneStage from '@/components/scene-stage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  addDeviceToScene,
  appendTemplateToScene,
  assignSafePins,
  cloneScene,
  duplicateSceneDevice,
  getPinRequirements,
  pinLabel,
  removeDeviceFromScene,
  sceneComponentCatalog,
  validateScene,
  wemosD1R32Pins,
  type LegacySceneId,
  type PinNumber,
  type SceneBackground,
  type SceneDefinition,
  type SceneDevice,
  type ScenePosition,
  type SceneWidget,
} from '@/lib/scene-model';
import {
  commitSnapshot,
  createSnapshotHistory,
  finishSnapshotGroup,
  redoSnapshot,
  replacePresentSnapshot,
  snapshotsEqual,
  undoSnapshot,
} from '@/lib/snapshot-history';

interface SceneBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: SceneDefinition;
  onSceneChange: (scene: SceneDefinition) => void;
}

type SceneItem = SceneDevice | SceneWidget;
type InspectorDraft =
  | { kind: 'device'; value: SceneDevice }
  | { kind: 'widget'; value: SceneWidget };
type DeleteTarget =
  | { kind: 'all' }
  | { kind: 'device'; id: string }
  | { kind: 'widget'; id: string };
type EditorSnapshot = { scene: SceneDefinition; selectedId?: string };

const backgrounds: { value: SceneBackground; label: string; icon: string }[] = [
  { value: 'park', label: 'Parque', icon: '🌳' },
  { value: 'workshop', label: 'Taller', icon: '🧰' },
  { value: 'home', label: 'Casa', icon: '🏠' },
  { value: 'pond', label: 'Laguna', icon: '🪷' },
  { value: 'blank', label: 'En blanco', icon: '⬜' },
];

const quickTemplates: {
  id: LegacySceneId;
  name: string;
  icon: string;
  detail: string;
}[] = [
  { id: 'traffic', name: 'Semáforo', icon: '🚦', detail: '3 luces' },
  { id: 'robot', name: 'Robot', icon: '🤖', detail: '2 motores' },
  { id: 'wifi', name: 'Wi-Fi', icon: '📶', detail: 'conexión' },
  { id: 'counter', name: 'Contador', icon: '🐸', detail: 'número + sonido' },
];

const sceneItems = (scene: SceneDefinition): SceneItem[] => [
  ...scene.devices,
  ...scene.widgets,
];

const findSceneItem = (scene: SceneDefinition, itemId?: string) =>
  itemId
    ? (scene.devices.find((device) => device.id === itemId) ??
      scene.widgets.find((widget) => widget.id === itemId))
    : undefined;

const selectedIdForScene = (scene: SceneDefinition, preferred?: string) =>
  findSceneItem(scene, preferred)?.id ?? sceneItems(scene)[0]?.id;

const createInspectorDraft = (
  scene: SceneDefinition,
  selectedId?: string,
): InspectorDraft | null => {
  const item = findSceneItem(scene, selectedId);
  if (!item) return null;
  return 'pins' in item
    ? { kind: 'device', value: structuredClone(item) }
    : { kind: 'widget', value: structuredClone(item) };
};

const replaceSceneItem = (
  scene: SceneDefinition,
  item: SceneItem,
): SceneDefinition => {
  const next = cloneScene(scene);
  if ('pins' in item) {
    next.devices = next.devices.map((device) =>
      device.id === item.id ? structuredClone(item) : device,
    );
  } else {
    next.widgets = next.widgets.map((widget) =>
      widget.id === item.id ? structuredClone(item) : widget,
    );
  }
  return next;
};

const sceneWithInspectorDraft = (
  scene: SceneDefinition,
  draft: InspectorDraft | null,
) => (draft ? replaceSceneItem(scene, draft.value) : scene);

const cloneWithDevice = (
  scene: SceneDefinition,
  deviceId: string,
  update: (device: SceneDevice) => SceneDevice,
) => {
  const next = cloneScene(scene);
  next.devices = next.devices.map((device) =>
    device.id === deviceId ? update(device) : device,
  );
  return next;
};

const selectionAfterRemoval = (
  before: SceneDefinition,
  after: SceneDefinition,
  removedId: string,
) => {
  const beforeItems = sceneItems(before);
  const removedIndex = beforeItems.findIndex((item) => item.id === removedId);
  const afterItems = sceneItems(after);
  if (!afterItems.length) return undefined;
  return afterItems[Math.min(Math.max(removedIndex, 0), afterItems.length - 1)]
    ?.id;
};

const isTextEditingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.matches('input, textarea, select, [role="textbox"]')
  );
};

export default function SceneBuilder({ open, ...props }: SceneBuilderProps) {
  if (!open) return null;
  return <SceneBuilderSession open={open} {...props} />;
}

function SceneBuilderSession({
  open,
  onOpenChange,
  scene: savedScene,
  onSceneChange,
}: SceneBuilderProps) {
  const initialSelectedId = selectedIdForScene(savedScene);
  const [history, setHistory] = useState(() =>
    createSnapshotHistory<EditorSnapshot>({
      scene: cloneScene(savedScene),
      selectedId: initialSelectedId,
    }),
  );
  const [inspectorDraft, setInspectorDraft] = useState<InspectorDraft | null>(
    () => createInspectorDraft(savedScene, initialSelectedId),
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(
    null,
  );
  const [discardSceneOpen, setDiscardSceneOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [baselineScene] = useState(() => cloneScene(savedScene));

  const draftScene = history.present.scene;
  const selectedId = history.present.selectedId;
  const storedSelectedItem = findSceneItem(draftScene, selectedId);
  const inspectorDirty = Boolean(
    inspectorDraft &&
    storedSelectedItem &&
    inspectorDraft.value.id === storedSelectedItem.id &&
    !snapshotsEqual(inspectorDraft.value, storedSelectedItem),
  );
  const previewScene = useMemo(
    () => sceneWithInspectorDraft(draftScene, inspectorDraft),
    [draftScene, inspectorDraft],
  );
  const selectedItem = findSceneItem(previewScene, selectedId);
  const selected =
    selectedItem && 'pins' in selectedItem ? selectedItem : undefined;
  const selectedWidget =
    selectedItem && !('pins' in selectedItem) ? selectedItem : undefined;
  const validation = useMemo(() => validateScene(previewScene), [previewScene]);
  const sceneNameIssue = validation.issues.find(
    (issue) => issue.code === 'invalid-scene-name',
  );
  const sceneDirty = !snapshotsEqual(baselineScene, previewScene);
  const objectCount = previewScene.devices.length + previewScene.widgets.length;

  const commitScene = (
    nextScene: SceneDefinition,
    notice = '',
    options: { group?: string; select?: string | null } = {},
  ) => {
    const preferredSelection =
      options.select === null ? undefined : (options.select ?? selectedId);
    const nextSelection = selectedIdForScene(nextScene, preferredSelection);
    setHistory((current) =>
      commitSnapshot(
        current,
        { scene: cloneScene(nextScene), selectedId: nextSelection },
        { group: options.group },
      ),
    );
    setInspectorDraft(createInspectorDraft(nextScene, nextSelection));
    setMessage(notice);
  };

  const finishHistoryGroup = () =>
    setHistory((current) => finishSnapshotGroup(current));

  const selectNow = (itemId: string, sourceScene = draftScene) => {
    if (!findSceneItem(sourceScene, itemId)) return;
    setHistory((current) =>
      replacePresentSnapshot(current, {
        ...current.present,
        selectedId: itemId,
      }),
    );
    setInspectorDraft(createInspectorDraft(sourceScene, itemId));
  };

  const requestSelection = (itemId: string) => {
    if (itemId === selectedId) return true;
    if (inspectorDirty) {
      setPendingSelectionId(itemId);
      return false;
    }
    selectNow(itemId);
    return true;
  };

  const applyInspector = (notice = 'Cambios guardados en el borrador.') => {
    if (!inspectorDraft || !inspectorDirty) {
      setMessage('No hay cambios pendientes en este objeto.');
      return;
    }
    const next = replaceSceneItem(draftScene, inspectorDraft.value);
    commitScene(next, notice);
    setInspectorDraft(createInspectorDraft(next, inspectorDraft.value.id));
  };

  const cancelInspector = (notice = 'Cambios del objeto descartados.') => {
    setInspectorDraft(createInspectorDraft(draftScene, selectedId));
    setMessage(notice);
  };

  const undoScene = () => {
    if (inspectorDirty) {
      setMessage(
        'Primero guarda o cancela los cambios del objeto. Deshacer sólo modifica cambios ya guardados en el borrador.',
      );
      return;
    }
    if (!history.past.length) return;
    const nextHistory = undoSnapshot(history);
    setHistory(nextHistory);
    setInspectorDraft(
      createInspectorDraft(
        nextHistory.present.scene,
        nextHistory.present.selectedId,
      ),
    );
    setMessage('Último cambio deshecho.');
  };

  const redoScene = () => {
    if (inspectorDirty || !history.future.length) return;
    const nextHistory = redoSnapshot(history);
    setHistory(nextHistory);
    setInspectorDraft(
      createInspectorDraft(
        nextHistory.present.scene,
        nextHistory.present.selectedId,
      ),
    );
    setMessage('Cambio rehecho.');
  };

  const saveAndClose = () => {
    if (!validation.valid) {
      const firstError = validation.issues.find(
        (issue) => issue.severity === 'error',
      );
      setMessage(
        `No se guardó todavía. ${firstError?.message ?? 'Revisa los campos marcados.'}`,
      );
      if (firstError?.code === 'invalid-scene-name') {
        document.getElementById('scene-name')?.focus();
      }
      return;
    }
    const finalScene = cloneScene(previewScene);
    onSceneChange(finalScene);
    onOpenChange(false);
  };

  const requestClose = () => {
    if (sceneDirty) {
      setDiscardSceneOpen(true);
      return;
    }
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (deleteTarget || pendingSelectionId || discardSceneOpen) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        saveAndClose();
        return;
      }
      if (isTextEditingTarget(event.target)) return;
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoScene();
        else undoScene();
      } else if (key === 'y') {
        event.preventDefault();
        redoScene();
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  });

  useEffect(() => {
    if (!sceneDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [sceneDirty]);

  const requireSettledInspector = (action: string) => {
    if (!inspectorDirty) return true;
    setMessage(
      `Primero guarda o cancela los cambios del objeto antes de ${action}.`,
    );
    return false;
  };

  const requestDelete = (target: DeleteTarget) => {
    if (!requireSettledInspector('quitar objetos')) return;
    setDeleteTarget(target);
  };

  const addComponent = (kind: SceneDevice['kind']) => {
    if (!requireSettledInspector('agregar otro componente')) return;
    const result = addDeviceToScene(previewScene, kind);
    commitScene(result.scene, `${result.device.name} ya está en la escena.`, {
      select: result.device.id,
    });
    setInspectorDraft(createInspectorDraft(result.scene, result.device.id));
  };

  const addTemplate = (template: LegacySceneId) => {
    if (!requireSettledInspector('combinar otra aventura')) return;
    const lane = previewScene.devices.length % 5;
    const result = appendTemplateToScene(previewScene, template, {
      offset: { x: 20 + lane * 24, y: 15 + lane * 18 },
    });
    if (template === 'counter' && !result.addedDeviceIds.length) {
      const existingCounter = result.scene.widgets.find(
        (widget) => widget.kind === 'counter',
      );
      const notice =
        result.warnings[0] ??
        'La escena ya tiene su contador global; no hace falta agregar otro.';
      if (!existingCounter) {
        if (!snapshotsEqual(draftScene, result.scene))
          commitScene(result.scene, notice);
        else setMessage(notice);
        return;
      }
      if (!snapshotsEqual(draftScene, result.scene)) {
        commitScene(result.scene, notice, { select: existingCounter.id });
      } else {
        selectNow(existingCounter.id, result.scene);
        setMessage(notice);
      }
      setInspectorDraft(createInspectorDraft(result.scene, existingCounter.id));
      return;
    }
    const nextSelection =
      template === 'counter'
        ? (result.scene.widgets.at(-1)?.id ?? result.addedDeviceIds.at(-1))
        : result.addedDeviceIds.at(-1);
    commitScene(
      result.scene,
      result.warnings.length
        ? 'Se agregó la plantilla. Revisa el cableado sugerido.'
        : 'Plantilla combinada con tu escena.',
      { select: nextSelection },
    );
    setInspectorDraft(createInspectorDraft(result.scene, nextSelection));
  };

  const moveItem = (itemId: string, position: ScenePosition) => {
    if (!requireSettledInspector('mover objetos')) return;
    let next = cloneScene(previewScene);
    if (next.devices.some((device) => device.id === itemId)) {
      next = cloneWithDevice(next, itemId, (device) => ({
        ...device,
        position: { ...position },
      }));
    } else {
      next.widgets = next.widgets.map((widget) =>
        widget.id === itemId
          ? { ...widget, position: { ...position } }
          : widget,
      );
    }
    commitScene(next, '', { group: `move:${itemId}`, select: itemId });
  };

  const updateSelectedDraft = (
    update: (device: SceneDevice) => SceneDevice,
  ) => {
    setInspectorDraft((current) =>
      current?.kind === 'device'
        ? { kind: 'device', value: update(structuredClone(current.value)) }
        : current,
    );
  };

  const updateSelectedWidgetDraft = (
    update: (widget: SceneWidget) => SceneWidget,
  ) => {
    setInspectorDraft((current) =>
      current?.kind === 'widget'
        ? { kind: 'widget', value: update(structuredClone(current.value)) }
        : current,
    );
  };

  const duplicateSelected = () => {
    if (!requireSettledInspector('duplicar objetos')) return;
    if (!selected) return;
    const result = duplicateSceneDevice(previewScene, selected.id);
    if (!result) return;
    commitScene(result.scene, `${result.device.name} fue duplicado.`, {
      select: result.device.id,
    });
    setInspectorDraft(createInspectorDraft(result.scene, result.device.id));
  };

  const duplicateSelectedWidget = () => {
    setMessage(
      'La escena usa un único contador global, así todos ven el mismo valor.',
    );
  };

  const confirmDelete = () => {
    if (!requireSettledInspector('quitar objetos')) {
      setDeleteTarget(null);
      return;
    }
    if (deleteTarget?.kind === 'all') {
      try {
        let empty = cloneScene(draftScene);
        for (const device of draftScene.devices) {
          empty = removeDeviceFromScene(empty, device.id);
        }
        empty.widgets = [];
        commitScene(
          empty,
          'La escena quedó vacía. Puedes deshacer si cambias de idea.',
          { select: null },
        );
        setInspectorDraft(null);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'No se pudo vaciar la escena. Guarda una copia e inténtalo otra vez.',
        );
      }
    } else if (deleteTarget?.kind === 'device') {
      const removed = draftScene.devices.find(
        (device) => device.id === deleteTarget.id,
      );
      const next = removeDeviceFromScene(draftScene, deleteTarget.id);
      const nextSelection = selectionAfterRemoval(
        draftScene,
        next,
        deleteTarget.id,
      );
      commitScene(
        next,
        removed
          ? `${removed.name} fue quitado. Puedes deshacer esta acción.`
          : '',
        { select: nextSelection ?? null },
      );
      setInspectorDraft(createInspectorDraft(next, nextSelection));
    } else if (deleteTarget?.kind === 'widget') {
      const removed = draftScene.widgets.find(
        (widget) => widget.id === deleteTarget.id,
      );
      const next = cloneScene(draftScene);
      next.widgets = next.widgets.filter(
        (widget) => widget.id !== deleteTarget.id,
      );
      const nextSelection = selectionAfterRemoval(
        draftScene,
        next,
        deleteTarget.id,
      );
      commitScene(
        next,
        removed
          ? `${removed.name} fue quitado. Puedes deshacer esta acción.`
          : '',
        { select: nextSelection ?? null },
      );
      setInspectorDraft(createInspectorDraft(next, nextSelection));
    }
    setDeleteTarget(null);
  };

  const autoConnect = () => {
    if (!requireSettledInspector('asignar los pines')) return;
    const result = assignSafePins(previewScene);
    commitScene(
      result.scene,
      result.warnings.length
        ? 'Conecté todo lo posible. Aún faltan pines para algunos componentes.'
        : 'Pines compatibles asignados para la Wemos D1 R32.',
    );
  };

  const discardInspectorAndSelect = () => {
    if (!pendingSelectionId) return;
    selectNow(pendingSelectionId, draftScene);
    setPendingSelectionId(null);
    setMessage('Cambios del objeto anterior descartados.');
  };

  const applyInspectorAndSelect = () => {
    if (!pendingSelectionId) return;
    const nextScene = cloneScene(previewScene);
    commitScene(nextScene, 'Cambios guardados en el borrador.', {
      select: pendingSelectionId,
    });
    setInspectorDraft(createInspectorDraft(nextScene, pendingSelectionId));
    setPendingSelectionId(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose();
        }}
      >
        <DialogContent
          className="scene-builder-dialog"
          showCloseButton={false}
          aria-describedby="scene-builder-description"
        >
          <DialogHeader className="scene-builder-heading">
            <div>
              <span className="eyebrow">Laboratorio de escenas</span>
              <DialogTitle>Arma tu mundo</DialogTitle>
              <DialogDescription id="scene-builder-description">
                Prueba cambios en un borrador. Guarda la escena cuando esté
                lista o cancela para volver a como estaba.
              </DialogDescription>
            </div>
            <div className="scene-builder-status" aria-live="polite">
              <span className={validation.canSimulate ? 'ready' : 'problem'}>
                {validation.canSimulate
                  ? '▶ Se puede simular'
                  : 'Revisar escena'}
              </span>
              <span className={validation.hardwareReady ? 'ready' : 'warning'}>
                {validation.hardwareReady
                  ? '🔌 Pines asignados'
                  : '🔌 Cableado pendiente'}
              </span>
              <span className={sceneDirty ? 'warning' : 'ready'}>
                {sceneDirty ? '● Sin guardar' : '✓ Guardado'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={requestClose}
                aria-label="Cerrar editor de escenas"
                title="Cerrar"
              >
                ✕
              </Button>
            </div>
          </DialogHeader>

          <div className="scene-builder-toolbar">
            <label htmlFor="scene-name">
              <span>Nombre de la escena</span>
              <Input
                id="scene-name"
                value={previewScene.name}
                maxLength={60}
                aria-invalid={Boolean(sceneNameIssue)}
                aria-describedby={
                  sceneNameIssue ? 'scene-name-validation' : undefined
                }
                onChange={(event) => {
                  if (!requireSettledInspector('cambiar la escena')) return;
                  commitScene(
                    { ...cloneScene(previewScene), name: event.target.value },
                    '',
                    { group: 'scene-name' },
                  );
                }}
                onBlur={finishHistoryGroup}
              />
              {sceneNameIssue && (
                <small id="scene-name-validation" className="field-error">
                  {sceneNameIssue.message}
                </small>
              )}
            </label>
            <label htmlFor="scene-background">
              <span>Fondo</span>
              <NativeSelect
                id="scene-background"
                value={previewScene.canvas.background}
                onChange={(event) => {
                  if (!requireSettledInspector('cambiar el fondo')) return;
                  commitScene({
                    ...cloneScene(previewScene),
                    canvas: {
                      ...previewScene.canvas,
                      background: event.target.value as SceneBackground,
                    },
                  });
                }}
              >
                {backgrounds.map((background) => (
                  <NativeSelectOption
                    key={background.value}
                    value={background.value}
                  >
                    {background.icon} {background.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="scene-snap-control">
              <input
                type="checkbox"
                checked={previewScene.canvas.snapToGrid}
                onChange={(event) => {
                  if (!requireSettledInspector('cambiar la cuadrícula')) return;
                  commitScene({
                    ...cloneScene(previewScene),
                    canvas: {
                      ...previewScene.canvas,
                      snapToGrid: event.target.checked,
                    },
                  });
                }}
              />
              Encajar en la cuadrícula
            </label>
            <div
              className="flex items-center gap-1"
              role="toolbar"
              aria-label="Historial de cambios de la escena"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!history.past.length || inspectorDirty}
                onClick={undoScene}
                aria-label="Deshacer último cambio"
                aria-keyshortcuts="Control+Z Meta+Z"
                title="Deshacer (Ctrl/Cmd + Z)"
              >
                ↶ Deshacer
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!history.future.length || inspectorDirty}
                onClick={redoScene}
                aria-label="Rehacer último cambio"
                aria-keyshortcuts="Control+Y Meta+Shift+Z"
                title="Rehacer (Ctrl/Cmd + Y o Shift + Z)"
              >
                ↷ Rehacer
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={autoConnect}
              aria-label="Auto conectar"
            >
              <span aria-hidden="true">✨</span>
              <span className="auto-connect-label">Auto conectar</span>
            </Button>
          </div>

          <div className={`scene-builder-grid${objectCount ? '' : ' empty'}`}>
            <aside
              className="scene-library"
              aria-label="Biblioteca de componentes"
            >
              <section>
                <h3>Combinar aventuras</h3>
                <p>Agrega una escena completa. Puedes repetirlas.</p>
                <div className="template-palette">
                  {quickTemplates.map((template) => (
                    <button
                      type="button"
                      key={template.id}
                      onClick={() => addTemplate(template.id)}
                      aria-label={`Agregar aventura ${template.name}: ${template.detail}`}
                    >
                      <span aria-hidden="true">{template.icon}</span>
                      <strong>{template.name}</strong>
                      <small>{template.detail}</small>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3>Componentes</h3>
                <p>Haz clic para sumar uno a la mesa.</p>
                <div className="component-palette">
                  {sceneComponentCatalog.map((component) => (
                    <button
                      type="button"
                      key={component.kind}
                      onClick={() => addComponent(component.kind)}
                      title={component.description}
                      aria-label={`Agregar ${component.name}. ${component.childFriendlyControl}`}
                    >
                      <span aria-hidden="true">{component.icon}</span>
                      <span>
                        <strong>{component.name}</strong>
                        <small>{component.childFriendlyControl}</small>
                      </span>
                      <b aria-hidden="true">＋</b>
                    </button>
                  ))}
                </div>
              </section>
            </aside>

            <section
              className="scene-builder-canvas"
              aria-label="Lienzo de la escena"
            >
              <div className="canvas-label">
                <span>Tu mesa de pruebas</span>
                <small>
                  Arrastra o usa flechas. Supr quita y Ctrl/Cmd+D duplica
                  componentes.
                </small>
              </div>
              <SceneStage
                scene={previewScene}
                selectedId={selectedId}
                editing
                onSelect={requestSelection}
                onMove={moveItem}
                onMoveEnd={finishHistoryGroup}
                onDelete={(itemId) => {
                  const item = findSceneItem(draftScene, itemId);
                  if (!item) return;
                  requestDelete({
                    kind: 'pins' in item ? 'device' : 'widget',
                    id: itemId,
                  });
                }}
                onDuplicate={(itemId) => {
                  if (!requireSettledInspector('duplicar objetos')) return;
                  if (selectedId !== itemId && !requestSelection(itemId))
                    return;
                  const item = findSceneItem(previewScene, itemId);
                  if (!item) return;
                  if ('pins' in item) {
                    const result = duplicateSceneDevice(previewScene, item.id);
                    if (result) {
                      commitScene(
                        result.scene,
                        `${result.device.name} fue duplicado.`,
                        {
                          select: result.device.id,
                        },
                      );
                    }
                  } else {
                    duplicateSelectedWidget();
                  }
                }}
              />
              {message && (
                <output className="scene-builder-message" aria-live="polite">
                  🐾 {message}
                </output>
              )}
            </section>

            <aside
              className="scene-inspector"
              aria-label="Configuración del componente"
            >
              {selected ? (
                <>
                  <div className="inspector-title">
                    <span aria-hidden="true">
                      {sceneComponentCatalog.find(
                        (item) => item.kind === selected.kind,
                      )?.icon ?? '🔧'}
                    </span>
                    <div>
                      <small>Componente seleccionado</small>
                      <strong>{selected.name}</strong>
                    </div>
                  </div>
                  <label htmlFor="selected-device-name">
                    <span>Nombre</span>
                    <Input
                      id="selected-device-name"
                      value={selected.name}
                      maxLength={60}
                      onChange={(event) =>
                        updateSelectedDraft((device) => ({
                          ...device,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label htmlFor="selected-device-rotation">
                    <span>Giro: {selected.rotation}°</span>
                    <input
                      id="selected-device-rotation"
                      type="range"
                      min="0"
                      max="330"
                      step="30"
                      value={selected.rotation}
                      onChange={(event) =>
                        updateSelectedDraft((device) => ({
                          ...device,
                          rotation: Number(event.target.value),
                        }))
                      }
                    />
                  </label>

                  <div className="pin-editor">
                    <h4>Conexiones</h4>
                    {getPinRequirements(selected.kind).length ? (
                      getPinRequirements(selected.kind).map((requirement) => {
                        const value =
                          (selected.pins as Record<string, PinNumber>)[
                            requirement.key
                          ] ?? null;
                        const compatiblePins = wemosD1R32Pins.filter((pin) =>
                          pin.capabilities.includes(requirement.capability),
                        );
                        const currentPinIsCompatible =
                          value === null ||
                          compatiblePins.some((pin) => pin.gpio === value);
                        return (
                          <label key={requirement.key}>
                            <span>{requirement.label}</span>
                            <NativeSelect
                              value={value === null ? '' : String(value)}
                              aria-label={`${requirement.label} de ${selected.name}`}
                              onChange={(event) => {
                                const pin = event.target.value
                                  ? Number(event.target.value)
                                  : null;
                                updateSelectedDraft(
                                  (device) =>
                                    ({
                                      ...device,
                                      pins: {
                                        ...device.pins,
                                        [requirement.key]: pin,
                                      },
                                    }) as SceneDevice,
                                );
                              }}
                            >
                              <NativeSelectOption value="">
                                Sin asignar
                              </NativeSelectOption>
                              {!currentPinIsCompatible && value !== null && (
                                <NativeSelectOption value={value}>
                                  {pinLabel(value)} · no compatible
                                </NativeSelectOption>
                              )}
                              {compatiblePins.map((pin) => (
                                <NativeSelectOption
                                  key={pin.gpio}
                                  value={pin.gpio}
                                >
                                  {pinLabel(pin.gpio)}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          </label>
                        );
                      })
                    ) : (
                      <p>
                        Este componente usa el Wi-Fi integrado y no necesita
                        pines.
                      </p>
                    )}
                  </div>

                  <div className="widget-help" aria-live="polite">
                    <strong>
                      {inspectorDirty
                        ? '● Cambios pendientes'
                        : '✓ Objeto al día'}
                    </strong>
                    <p>
                      {inspectorDirty
                        ? 'Guárdalos en el borrador o cancélalos antes de continuar con otra acción.'
                        : 'Puedes editar, duplicar, mover o quitar este objeto.'}
                    </p>
                  </div>
                  <div className="inspector-actions">
                    <Button
                      type="button"
                      disabled={!inspectorDirty}
                      onClick={() => applyInspector()}
                    >
                      ✓ Guardar cambios
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!inspectorDirty}
                      onClick={() => cancelInspector()}
                    >
                      Cancelar cambios
                    </Button>
                  </div>
                  <div className="inspector-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={duplicateSelected}
                    >
                      📄 Duplicar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        requestDelete({ kind: 'device', id: selected.id })
                      }
                    >
                      🗑 Quitar
                    </Button>
                  </div>
                </>
              ) : selectedWidget ? (
                <>
                  <div className="inspector-title">
                    <span aria-hidden="true">
                      {selectedWidget.config.mascot}
                    </span>
                    <div>
                      <small>Marcador seleccionado</small>
                      <strong>{selectedWidget.name}</strong>
                    </div>
                  </div>
                  <label htmlFor="selected-widget-name">
                    <span>Nombre</span>
                    <Input
                      id="selected-widget-name"
                      value={selectedWidget.name}
                      maxLength={60}
                      onChange={(event) =>
                        updateSelectedWidgetDraft((widget) => ({
                          ...widget,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label htmlFor="selected-widget-mascot">
                    <span>Animal o dibujo</span>
                    <Input
                      id="selected-widget-mascot"
                      value={selectedWidget.config.mascot}
                      maxLength={12}
                      onChange={(event) =>
                        updateSelectedWidgetDraft((widget) => ({
                          ...widget,
                          config: {
                            ...widget.config,
                            mascot: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <div className="widget-help">
                    <strong>🔢 Marcador del contador</strong>
                    <p>
                      Muestra el contador de tus bloques. Puedes arrastrarlo,
                      pero hay un solo contador global por escena.
                    </p>
                  </div>
                  <div className="widget-help" aria-live="polite">
                    <strong>
                      {inspectorDirty
                        ? '● Cambios pendientes'
                        : '✓ Marcador al día'}
                    </strong>
                    <p>
                      {inspectorDirty
                        ? 'Guárdalos en el borrador o cancélalos antes de continuar.'
                        : 'Los cambios de la escena se guardan sólo al finalizar.'}
                    </p>
                  </div>
                  <div className="inspector-actions">
                    <Button
                      type="button"
                      disabled={!inspectorDirty}
                      onClick={() => applyInspector()}
                    >
                      ✓ Guardar cambios
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!inspectorDirty}
                      onClick={() => cancelInspector()}
                    >
                      Cancelar cambios
                    </Button>
                  </div>
                  <div className="inspector-actions">
                    <Button
                      type="button"
                      variant="outline"
                      disabled
                      onClick={duplicateSelectedWidget}
                      title="La escena tiene un único contador global"
                    >
                      🔢 Contador único
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        requestDelete({
                          kind: 'widget',
                          id: selectedWidget.id,
                        })
                      }
                    >
                      🗑 Quitar
                    </Button>
                  </div>
                </>
              ) : (
                <div className="inspector-empty">
                  <span aria-hidden="true">👆</span>
                  <strong>Elige un objeto</strong>
                  <p>
                    Aquí podrás ponerle nombre, girarlo y revisar sus cables.
                  </p>
                </div>
              )}

              {!!validation.issues.length && (
                <div className="scene-validation">
                  <h4>Revisión de la escena</h4>
                  <ul>
                    {validation.issues.slice(0, 5).map((issue, index) => (
                      <li
                        key={`${issue.code}-${issue.deviceId ?? 'scene'}-${index}`}
                      >
                        {issue.severity === 'error' ? '⛔' : '⚠️'}{' '}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                  {validation.issues.length > 5 && (
                    <small>y {validation.issues.length - 5} avisos más…</small>
                  )}
                </div>
              )}
            </aside>
          </div>

          <DialogFooter className="scene-builder-footer">
            <Button
              type="button"
              variant="outline"
              disabled={!objectCount}
              onClick={() => requestDelete({ kind: 'all' })}
            >
              Vaciar escena
            </Button>
            <span aria-live="polite">
              {objectCount} objeto{objectCount === 1 ? '' : 's'} ·{' '}
              {sceneDirty ? 'cambios sin guardar' : 'sin cambios pendientes'}
            </span>
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={saveAndClose}
              aria-keyshortcuts="Control+S Meta+S"
              title="Guardar escena (Ctrl/Cmd + S)"
            >
              Guardar escena
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === 'all'
                ? '¿Vaciar toda la escena?'
                : deleteTarget?.kind === 'widget'
                  ? '¿Quitar este marcador?'
                  : '¿Quitar este componente?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'all'
                ? 'Se quitarán todos los objetos y widgets. Los bloques no se borrarán. Puedes deshacer después.'
                : deleteTarget?.kind === 'widget'
                  ? 'Se quitará el marcador visual. El contador y sus bloques no se borrarán. Puedes deshacer después.'
                  : 'Los bloques que apunten a este objeto pedirán otro destino. Puedes deshacer después.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Sí, quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingSelectionId !== null}
        onOpenChange={(nextOpen) => !nextOpen && setPendingSelectionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hay cambios en este objeto</AlertDialogTitle>
            <AlertDialogDescription>
              Antes de elegir otro, decide si quieres guardar o descartar los
              cambios del objeto actual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={discardInspectorAndSelect}
            >
              Descartar
            </AlertDialogAction>
            <AlertDialogAction onClick={applyInspectorAndSelect}>
              Guardar y cambiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={discardSceneOpen} onOpenChange={setDiscardSceneOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar la escena?</AlertDialogTitle>
            <AlertDialogDescription>
              Se descartarán todos los cambios hechos desde que abriste el
              editor. Esta acción no se puede deshacer después de salir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDiscardSceneOpen(false);
                onOpenChange(false);
              }}
            >
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
