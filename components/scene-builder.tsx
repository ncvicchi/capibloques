'use client';
import { DisplayProperties } from '@/components/display-properties';
import { LedMatrixProperties } from '@/components/led-matrix-properties';
import ComponentHelpDialog from '@/components/component-help';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { InspectorDraft, SceneDraft } from '@/lib/scene-recovery';
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
  type LegacySceneId,
  type PinNumber,
  type SceneBackground,
  type SceneDefinition,
  type SceneDevice,
  type EducationalModuleDevice,
  type SceneDeviceKind,
  type ScenePosition,
  type SceneWidget,
  type BoardProfileId,
} from '@/lib/scene-model';
import { boardProfile, boardProfiles } from '@/lib/board-profiles';
import { educationalModuleSpecs, isEducationalModuleKind } from '@/lib/educational-modules';
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
  boardProfile: BoardProfileId;
  recoveryDraft: SceneDraft | null;
  onDraft: (draft: SceneDraft | null) => void;
  onFinish: (scene?: SceneDefinition, boardProfile?: BoardProfileId) => Promise<void>;
  onExportDraft: () => void;
  storageError: string;
  storageBusy: boolean;
}

type SceneItem = SceneDevice | SceneWidget;
type DeleteTarget =
  | { kind: 'all' }
  | { kind: 'device'; id: string }
  | { kind: 'widget'; id: string };
type EditorSnapshot = { scene: SceneDefinition; boardProfile: BoardProfileId; selectedId?: string };

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
  return <SceneRecoveryChoice open={open} {...props} />;
}

function SceneRecoveryChoice(props: SceneBuilderProps) {
  const [recovery] = useState(() => props.recoveryDraft);
  const [accepted, setAccepted] = useState(!recovery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  if (accepted) return <SceneBuilderSession {...props} recoveryDraft={recovery} />;
  const compatible = snapshotsEqual(recovery?.base, props.scene) && (recovery?.baseBoardProfile ?? props.boardProfile) === props.boardProfile;
  return <Dialog open onOpenChange={value => { if (!value && !busy) props.onOpenChange(false); }}><DialogContent className="management-dialog" showCloseButton={!busy}>
    <DialogHeader><DialogTitle>Hay una escena sin terminar</DialogTitle><DialogDescription>El proyecto conserva su escena confirmada. Este borrador está sólo en esta computadora e incluye cambios del inspector. Recuperarlo no lo publica; después elegís Guardar escena o Cancelar.</DialogDescription></DialogHeader>
    {!compatible && <p role="alert">La escena confirmada cambió desde ese borrador. No lo mezclamos con otro estado: exportalo para conservarlo o descartalo explícitamente.</p>}
    <p>Al recuperar se reinicia la lista de Deshacer/Rehacer, no los cambios del borrador.</p>
    {error && <p role="alert">{error}</p>}
    <div className="account-actions">
      <Button variant="outline" disabled={busy} onClick={() => props.onOpenChange(false)}>Ahora no</Button>
      <Button variant="outline" disabled={busy} onClick={props.onExportDraft}>Exportar con escena pendiente</Button>
      <Button variant="outline" disabled={busy} onClick={() => setDiscard(true)}>Descartar borrador…</Button>
      <Button disabled={busy || !compatible} onClick={() => setAccepted(true)}>Recuperar borrador</Button>
    </div>
    {discard && <section aria-label="Confirmar descarte de escena"><p>¿Descartar la escena sin terminar? No se puede deshacer. El proyecto confirmado queda intacto.</p><Button variant="outline" disabled={busy} onClick={() => setDiscard(false)}>Conservar borrador</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); try { await props.onFinish(); props.onOpenChange(false); } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo descartar.'); } finally { setBusy(false); } }}>Sí, descartar borrador</Button></section>}
  </DialogContent></Dialog>;
}

function SceneBuilderSession({
  open,
  onOpenChange,
  scene: savedScene,
  boardProfile: savedBoardProfile,
  recoveryDraft,
  onDraft,
  onFinish,
  onExportDraft,
  storageError,
  storageBusy,
}: SceneBuilderProps) {
  const initialScene = recoveryDraft?.scene ?? savedScene;
  const initialBoardProfile = recoveryDraft?.boardProfile ?? savedBoardProfile;
  const initialSelectedId = selectedIdForScene(initialScene, recoveryDraft?.selectedId);
  const [history, setHistory] = useState(() =>
    createSnapshotHistory<EditorSnapshot>({
      scene: cloneScene(initialScene),
      boardProfile: initialBoardProfile,
      selectedId: initialSelectedId,
    }),
  );
  const [inspectorDraft, setInspectorDraft] = useState<InspectorDraft | null>(
    () => recoveryDraft ? structuredClone(recoveryDraft.inspector) : createInspectorDraft(initialScene, initialSelectedId),
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(
    null,
  );
  const [discardSceneOpen, setDiscardSceneOpen] = useState(false);
  const [pendingBoardProfile, setPendingBoardProfile] = useState<BoardProfileId | null>(null);
  const [message, setMessage] = useState('');
  const [helpTarget, setHelpTarget] = useState<{ kind: SceneDeviceKind; device?: SceneDevice } | null>(null);
  const [baselineScene] = useState(() => cloneScene(savedScene));
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);

  const draftScene = history.present.scene;
  const draftBoardProfile = history.present.boardProfile;
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
  const validation = useMemo(() => validateScene(previewScene, draftBoardProfile), [previewScene, draftBoardProfile]);
  const sceneNameIssue = validation.issues.find(
    (issue) => issue.code === 'invalid-scene-name',
  );
  const sceneDirty = !snapshotsEqual(baselineScene, previewScene) || savedBoardProfile !== draftBoardProfile;
  const objectCount = previewScene.devices.length + previewScene.widgets.length;
  useLayoutEffect(() => {
    if (finishingRef.current) return;
    onDraft(sceneDirty ? { version: 1, base: baselineScene, scene: draftScene, selectedId, inspector: inspectorDraft, baseBoardProfile: savedBoardProfile, boardProfile: draftBoardProfile } : null);
  }, [onDraft, sceneDirty, baselineScene, draftScene, selectedId, inspectorDraft, savedBoardProfile, draftBoardProfile]);

  const finish = async (scene?: SceneDefinition, profileId?: BoardProfileId) => {
    if (finishingRef.current) return;
    finishingRef.current = true; setFinishing(true);
    try { await onFinish(scene, profileId); onOpenChange(false); }
    catch (failure) { setDiscardSceneOpen(false); setMessage(failure instanceof Error ? failure.message : 'No se pudo guardar la copia local. La escena sigue abierta.'); }
    finally { finishingRef.current = false; setFinishing(false); }
  };

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
        { scene: cloneScene(nextScene), boardProfile: current.present.boardProfile, selectedId: nextSelection },
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
      } else if (firstError?.deviceId) {
        selectNow(firstError.deviceId, previewScene);
      }
      return;
    }
    const finalScene = cloneScene(previewScene);
    void finish(finalScene, draftBoardProfile);
  };

  const requestClose = () => {
    if (finishingRef.current) return;
    if (sceneDirty) {
      setDiscardSceneOpen(true);
      return;
    }
    void finish();
  };

  useEffect(() => {
    if (!open) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (finishingRef.current) { event.preventDefault(); return; }
      if (event.defaultPrevented) return;
      const key = event.key.toLowerCase();
      if (deleteTarget || pendingSelectionId || pendingBoardProfile || discardSceneOpen) {
        // Browsers can undo the last edited input even when a button has focus.
        // A confirmation must not mutate the scene hidden underneath it.
        if (['s', 'z', 'y'].includes(key)) event.preventDefault();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !isTextEditingTarget(event.target)) {
        if (!selectedItem) return;
        event.preventDefault();
        if (inspectorDirty) {
          setMessage('Primero guarda o cancela los cambios del objeto antes de quitarlo.');
          return;
        }
        setDeleteTarget({
          kind: 'pins' in selectedItem ? 'device' : 'widget',
          id: selectedItem.id,
        });
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
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
    const result = addDeviceToScene(previewScene, kind, { boardProfile: draftBoardProfile });
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
      boardProfile: draftBoardProfile,
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
    const result = assignSafePins(previewScene, { boardProfile: draftBoardProfile });
    commitScene(
      result.scene,
      result.warnings.length
        ? 'Conecté todo lo posible. Aún faltan pines para algunos componentes.'
        : `Pines compatibles asignados para ${boardProfile(draftBoardProfile).name}.`,
    );
  };

  const changeBoardProfile = (nextProfile: BoardProfileId) => {
    setHistory(current => commitSnapshot(current, {
      ...current.present,
      scene: cloneScene(previewScene),
      boardProfile: nextProfile,
    }));
    setInspectorDraft(createInspectorDraft(previewScene, selectedId));
    setPendingBoardProfile(null);
    setMessage(`Placa cambiada a ${boardProfile(nextProfile).name}. Las conexiones no se cambiaron: revisalas o usá Auto conectar.`);
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

  const visualOutput = previewScene.devices.find(
    (device) => device.kind === 'display' || device.kind === 'ledMatrix',
  );

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
          inert={finishing}
          showCloseButton={false}
          aria-describedby="scene-builder-description"
        >
          <DialogHeader className="scene-builder-heading">
            <div>
              <span className="eyebrow">Laboratorio de escenas</span>
              <DialogTitle>Arma tu mundo</DialogTitle>
              <DialogDescription id="scene-builder-description">
                Prueba cambios en un borrador. Guarda la escena cuando esté
                lista o cancela para volver a como estaba. La copia local permite recuperarlo; todavía no forma parte del proyecto guardado en tu cuenta.
              </DialogDescription>
              {storageError && <p role="alert" className="account-error">{storageError}</p>}
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
            <label htmlFor="scene-board-profile">
              <span>Placa del proyecto</span>
              <NativeSelect
                id="scene-board-profile"
                value={draftBoardProfile}
                onChange={event => {
                  if (!requireSettledInspector('cambiar la placa')) return;
                  const next = event.target.value as BoardProfileId;
                  if (next !== draftBoardProfile) setPendingBoardProfile(next);
                }}
              >
                {Object.values(boardProfiles).map(profile => (
                  <NativeSelectOption key={profile.id} value={profile.id}>{profile.shortName}</NativeSelectOption>
                ))}
              </NativeSelect>
              <small>{boardProfile(draftBoardProfile).flashSize} flash{boardProfile(draftBoardProfile).psramBytes ? ` · ${boardProfile(draftBoardProfile).psramBytes / 1024 / 1024} MB PSRAM` : ''}</small>
            </label>
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
                {visualOutput && (
                  <div className="visual-output-limit" role="note">
                    <strong>📺 Salida visual ocupada</strong>
                    <span>
                      Ya usás <b>{visualOutput.name}</b>. Cada proyecto admite una sola:
                      Pantalla de texto o Matriz LED. Para elegir otra, primero quitá la actual.
                    </span>
                  </div>
                )}
                <div className="component-palette">
                  {sceneComponentCatalog.map((component) => {
                    const visualBlocked = Boolean(
                      visualOutput &&
                      (component.kind === 'display' || component.kind === 'ledMatrix'),
                    );
                    const messagesBlocked = component.kind === 'messages' && previewScene.devices.filter(device => device.kind === 'messages').length >= 2;
                    const reason = visualBlocked
                      ? `No disponible: ya usás ${visualOutput?.name}`
                      : messagesBlocked
                        ? 'No disponible: máximo dos por proyecto'
                        : component.childFriendlyControl;
                    return <div className="component-palette-card" key={component.kind}>
                      <button type="button" className="component-add-button" disabled={visualBlocked || messagesBlocked} onClick={() => addComponent(component.kind)} title={visualBlocked ? `${reason}. Para cambiar, quitá primero la salida visual actual.` : component.description} aria-label={`Agregar ${component.name}. ${reason}`}>
                        <span aria-hidden="true">{component.icon}</span><span><strong>{component.name}</strong><small>{reason}</small></span><b aria-hidden="true">{visualBlocked || messagesBlocked ? '🔒' : '＋'}</b>
                      </button>
                      <button type="button" className="component-help-button" onClick={() => setHelpTarget({ kind: component.kind })} aria-label={`Ayuda sobre ${component.name}`} title={`Qué es y cómo usar ${component.name}`}>?</button>
                    </div>;
                  })}
                </div>
              </section>
            </aside>

            <section
              className="scene-builder-canvas"
              aria-label="Lienzo de la escena"
            >
              <div className="canvas-label">
                <div>
                  <span>Tu mesa de pruebas</span>
                  <small>
                    Arrastra o usa flechas. Supr quita y Ctrl/Cmd+D duplica
                    componentes.
                  </small>
                </div>
                {selectedItem && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-keyshortcuts="Delete Backspace"
                    onClick={() => requestDelete({
                      kind: 'pins' in selectedItem ? 'device' : 'widget',
                      id: selectedItem.id,
                    })}
                  >
                    🗑 Quitar {selectedItem.name}
                  </Button>
                )}
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
                    <Button type="button" size="sm" variant="outline" className="inspector-help-button" onClick={() => setHelpTarget({ kind: selected.kind, device: selected })}>? Ayuda</Button>
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

                  {selected.kind === 'display' && <DisplayProperties key={selected.id} device={selected} boardProfile={draftBoardProfile} sceneDevices={draftScene.devices} onChange={next => updateSelectedDraft(() => next)} />}
                  {selected.kind === 'ledMatrix' && <LedMatrixProperties key={selected.id} device={selected} onChange={next => updateSelectedDraft(() => next)} />}
                  {/* oxlint-disable jsx-a11y/label-has-associated-control -- compound design-system controls are wrapped by their visible labels */}
                  {isEducationalModuleKind(selected.kind) && (() => {
                    const spec = educationalModuleSpecs[selected.kind];
                    const moduleDevice = selected as EducationalModuleDevice;
                    return <div className="messages-properties">
                      <label><span>Modelo</span><NativeSelect value={moduleDevice.config.profile} onChange={event => updateSelectedDraft(device => isEducationalModuleKind(device.kind) ? { ...(device as EducationalModuleDevice), config: { ...(device as EducationalModuleDevice).config, profile: event.target.value } } as SceneDevice : device)}>{spec.profiles.map(profile => <NativeSelectOption key={profile.id} value={profile.id}>{profile.label}</NativeSelectOption>)}</NativeSelect></label>
                      <small>{spec.description}</small>
                      {Object.entries(moduleDevice.config.settings).map(([key, value]) => <label key={key}><span>{key === 'threshold' ? 'Umbral' : key === 'speed' ? 'Velocidad' : key === 'baudRate' ? 'Velocidad de comunicación' : key === 'deadZone' ? 'Zona central' : key === 'maxDistance' ? 'Distancia máxima' : key}</span>{typeof value === 'boolean' ? <input type="checkbox" checked={value} onChange={event => updateSelectedDraft(device => { if (!isEducationalModuleKind(device.kind)) return device; const current = device as EducationalModuleDevice; return { ...current, config: { ...current.config, settings: { ...current.config.settings, [key]: event.target.checked } } } as SceneDevice; })} /> : <Input type={typeof value === 'number' ? 'number' : 'text'} value={String(value)} onChange={event => updateSelectedDraft(device => { if (!isEducationalModuleKind(device.kind)) return device; const current = device as EducationalModuleDevice; return { ...current, config: { ...current.config, settings: { ...current.config.settings, [key]: typeof value === 'number' ? Number(event.target.value) : event.target.value } } } as SceneDevice; })} />}</label>)}
                    </div>;
                  })()}
                  {selected.kind === 'smartLights' && (
                    <div className="messages-properties">
                      {selected.config.geometry === 'matrix' && <>
                        <label htmlFor="smart-lights-layout"><span>Recorrido de filas</span><NativeSelect id="smart-lights-layout" value={selected.config.layout} onChange={event => updateSelectedDraft(device => device.kind === 'smartLights' ? { ...device, config: { ...device.config, layout: event.target.value === 'zigzag' ? 'zigzag' : 'progressive' } } : device)}><NativeSelectOption value="progressive">Todas en el mismo sentido</NativeSelectOption><NativeSelectOption value="zigzag">Una fila va y otra vuelve</NativeSelectOption></NativeSelect></label>
                        <label htmlFor="smart-lights-origin"><span>Primera luz</span><NativeSelect id="smart-lights-origin" value={selected.config.origin} onChange={event => updateSelectedDraft(device => device.kind === 'smartLights' ? { ...device, config: { ...device.config, origin: ['top-right', 'bottom-left', 'bottom-right'].includes(event.target.value) ? event.target.value as 'top-right' | 'bottom-left' | 'bottom-right' : 'top-left' } } : device)}><NativeSelectOption value="top-left">Arriba izquierda</NativeSelectOption><NativeSelectOption value="top-right">Arriba derecha</NativeSelectOption><NativeSelectOption value="bottom-left">Abajo izquierda</NativeSelectOption><NativeSelectOption value="bottom-right">Abajo derecha</NativeSelectOption></NativeSelect></label>
                      </>}
                      <label><span>Tipo de luces</span><NativeSelect value={selected.config.profile} onChange={event => updateSelectedDraft(device => device.kind === 'smartLights' ? { ...device, config: { ...device.config, profile: event.target.value === 'SK6812_RGB' ? 'SK6812_RGB' : 'WS2812B' } } : device)}><NativeSelectOption value="WS2812B">WS2812B / WS2812</NativeSelectOption><NativeSelectOption value="SK6812_RGB">SK6812 RGB</NativeSelectOption></NativeSelect></label>
                      <label><span>Forma</span><NativeSelect value={selected.config.geometry} onChange={event => updateSelectedDraft(device => {
                        if (device.kind !== 'smartLights') return device;
                        const geometry = event.target.value === 'matrix' ? 'matrix' : event.target.value === 'ring' ? 'ring' : 'strip';
                        const width = geometry === 'matrix' ? 8 : device.config.count;
                        const height = geometry === 'matrix' ? Math.max(1, Math.ceil(device.config.count / width)) : 1;
                        return { ...device, config: { ...device.config, geometry, width, height, count: width * height } };
                      })}><NativeSelectOption value="strip">Tira o barra</NativeSelectOption><NativeSelectOption value="ring">Aro o figura</NativeSelectOption><NativeSelectOption value="matrix">Matriz</NativeSelectOption></NativeSelect></label>
                      {selected.config.geometry === 'matrix' ? <><label><span>Ancho</span><Input type="number" min={1} max={16} value={selected.config.width} onChange={event => updateSelectedDraft(device => device.kind === 'smartLights' ? { ...device, config: { ...device.config, width: Math.max(1, Math.min(16, Number(event.target.value) || 1)), count: Math.max(1, Math.min(16, Number(event.target.value) || 1)) * device.config.height } } : device)} /></label><label><span>Alto</span><Input type="number" min={1} max={16} value={selected.config.height} onChange={event => updateSelectedDraft(device => device.kind === 'smartLights' ? { ...device, config: { ...device.config, height: Math.max(1, Math.min(16, Number(event.target.value) || 1)), count: device.config.width * Math.max(1, Math.min(16, Number(event.target.value) || 1)) } } : device)} /></label></> : <label><span>Cantidad de luces</span><Input type="number" min={1} max={256} value={selected.config.count} onChange={event => updateSelectedDraft(device => device.kind === 'smartLights' ? { ...device, config: { ...device.config, count: Math.max(1, Math.min(256, Number(event.target.value) || 1)), width: Math.max(1, Math.min(256, Number(event.target.value) || 1)), height: 1 } } : device)} /></label>}
                      <label><span>Orden de color</span><NativeSelect value={selected.config.colorOrder} onChange={event => updateSelectedDraft(device => device.kind === 'smartLights' ? { ...device, config: { ...device.config, colorOrder: event.target.value === 'RGB' ? 'RGB' : 'GRB' } } : device)}><NativeSelectOption value="GRB">GRB (usual)</NativeSelectOption><NativeSelectOption value="RGB">RGB</NativeSelectOption></NativeSelect></label>
                      <label><span>Brillo máximo: {selected.config.brightness}%</span><input type="range" min="0" max="100" value={selected.config.brightness} onChange={event => updateSelectedDraft(device => device.kind === 'smartLights' ? { ...device, config: { ...device.config, brightness: Number(event.target.value) } } : device)} /></label>
                      <small>Consumo máximo estimado: {Math.ceil(selected.config.count * 60 * selected.config.brightness / 100)} mA. Usá una fuente externa adecuada y GND común.</small>
                    </div>
                  )}
                  {/* oxlint-enable jsx-a11y/label-has-associated-control */}
                  {selected.kind === 'wifiNode' && (
                    <div className="messages-properties">
                      <label htmlFor="wifi-role"><span>Qué hace esta placa</span><NativeSelect id="wifi-role" value={selected.config.role} onChange={event => updateSelectedDraft(device => device.kind === 'wifiNode' ? { ...device, config: { ...device.config, role: event.target.value === 'create' ? 'create' : 'join' } } : device)}>
                        <NativeSelectOption value="create">Crear una red</NativeSelectOption><NativeSelectOption value="join">Conectarse a una red</NativeSelectOption>
                      </NativeSelect></label>
                      <label htmlFor="wifi-network"><span>Nombre de la red</span><Input id="wifi-network" maxLength={32} value={selected.config.ssid} onChange={event => updateSelectedDraft(device => device.kind === 'wifiNode' ? { ...device, config: { ...device.config, ssid: event.target.value.slice(0, 32) } } : device)} /></label>
                      <label htmlFor="wifi-board-name"><span>Nombre de esta placa</span><Input id="wifi-board-name" maxLength={24} value={selected.config.boardName} onChange={event => updateSelectedDraft(device => device.kind === 'wifiNode' ? { ...device, config: { ...device.config, boardName: event.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) } } : device)} /><small>Letras, números, guion o guion bajo. Sirve para saber quién envió.</small></label>
                      <label htmlFor="wifi-peers"><span>Otras placas conocidas · una por línea</span><textarea id="wifi-peers" rows={4} value={selected.config.peers.join('\n')} onChange={event => updateSelectedDraft(device => {
                        if (device.kind !== 'wifiNode') return device;
                        const peers = [...new Set(event.target.value.split(/\r?\n/).map(value => value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)).filter(Boolean))].slice(0, 8);
                        return { ...device, config: { ...device.config, peers } };
                      })} /></label>
                      <label htmlFor="wifi-messages"><span>Mensajes disponibles · uno por línea</span><textarea id="wifi-messages" rows={5} value={selected.config.messages.join('\n')} onChange={event => updateSelectedDraft(device => {
                        if (device.kind !== 'wifiNode') return device;
                        const messages = [...new Set(event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean))].filter(value => new TextEncoder().encode(value).length <= 120).slice(0, 24);
                        return { ...device, config: { ...device.config, messages } };
                      })} /><small>La contraseña no se guarda en la escena ni en el JSON. Se configura al compilar o directamente en la placa.</small></label>
                    </div>
                  )}
                  {selected.kind === 'messages' && (
                    <div className="messages-properties">
                      <label htmlFor="messages-mode">
                        <span>Qué puede hacer</span>
                        <NativeSelect
                          id="messages-mode"
                          value={selected.config.mode}
                          aria-label={`Modo de ${selected.name}`}
                          onChange={(event) => updateSelectedDraft(device => {
                            if (device.kind !== 'messages') return device;
                            const mode = event.target.value as typeof device.config.mode;
                            return {
                              ...device,
                              config: { ...device.config, mode },
                              pins: {
                                tx: mode === 'receive' ? null : device.pins.tx,
                                rx: mode === 'send' ? null : device.pins.rx,
                              },
                            };
                          })}
                        >
                          <NativeSelectOption value="send">Enviar</NativeSelectOption>
                          <NativeSelectOption value="receive">Recibir</NativeSelectOption>
                          <NativeSelectOption value="both">Enviar y recibir</NativeSelectOption>
                        </NativeSelect>
                      </label>
                      <label htmlFor="messages-speed">
                        <span>Velocidad</span>
                        <NativeSelect
                          id="messages-speed"
                          value={String(selected.config.baudRate)}
                          aria-label={`Velocidad de ${selected.name}`}
                          onChange={(event) => updateSelectedDraft(device => device.kind === 'messages' ? { ...device, config: { ...device.config, baudRate: Number(event.target.value) as typeof device.config.baudRate } } : device)}
                        >
                          {[9600, 19200, 38400, 57600, 115200].map(value => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}
                        </NativeSelect>
                      </label>
                      <label htmlFor="messages-list">
                        <span>Mensajes disponibles · uno por línea</span>
                        <textarea
                          id="messages-list"
                          aria-label={`Mensajes disponibles de ${selected.name}`}
                          rows={6}
                          value={selected.config.messages.join('\n')}
                          onChange={(event) => updateSelectedDraft(device => {
                            if (device.kind !== 'messages') return device;
                            const messages = [...new Set(event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean))].slice(0, 24);
                            return { ...device, config: { ...device.config, messages } };
                          })}
                        />
                        <small>Hasta 24 mensajes; cada uno puede ocupar 120 bytes.</small>
                      </label>
                    </div>
                  )}
                  {selected.kind === 'infraredBarrier' && (
                    <div className="messages-properties">
                      <label htmlFor="barrier-interrupted-level">
                        <span>Señal cuando el haz se interrumpe</span>
                        <NativeSelect
                          id="barrier-interrupted-level"
                          value={selected.config.interruptedLevel}
                          aria-label={`Nivel de interrupción de ${selected.name}`}
                          onChange={(event) => updateSelectedDraft(device => device.kind === 'infraredBarrier' ? {
                            ...device,
                            config: { ...device.config, interruptedLevel: event.target.value === 'HIGH' ? 'HIGH' : 'LOW' },
                          } : device)}
                        >
                          <NativeSelectOption value="LOW">Nivel bajo (0)</NativeSelectOption>
                          <NativeSelectOption value="HIGH">Nivel alto (1)</NativeSelectOption>
                        </NativeSelect>
                        <small>Se configura una vez según el detector. En los bloques sólo verás libre o interrumpida.</small>
                      </label>
                    </div>
                  )}
                  {selected.kind === 'otto' && (
                    <div className="messages-properties">
                      <label htmlFor="otto-profile">
                        <span>Configuración del robot</span>
                        <NativeSelect id="otto-profile" value={selected.config.profile} onChange={(event) => updateSelectedDraft(device => {
                          if (device.kind !== 'otto') return device;
                          const profile = event.target.value as typeof device.config.profile;
                          const active = new Set(profile === 'biped4' ? ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot'] : profile === 'biped4-sound' ? ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot', 'buzzer'] : profile === 'biped4-explorer' ? ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot', 'buzzer', 'trigger', 'echo'] : profile === 'biped4-expressive' ? ['leftLeg', 'rightLeg', 'leftFoot', 'rightFoot', 'buzzer', 'trigger', 'echo', 'matrixDin', 'matrixClk', 'matrixCs'] : Object.keys(device.pins));
                          const pins = Object.fromEntries(Object.entries(device.pins).map(([key, value]) => [key, active.has(key) ? value : null])) as typeof device.pins;
                          return { ...device, pins, config: { ...device.config, profile } };
                        })}>
                          <NativeSelectOption value="biped4">Bípedo · 4 servos</NativeSelectOption>
                          <NativeSelectOption value="biped4-sound">Bípedo + sonido</NativeSelectOption>
                          <NativeSelectOption value="biped4-explorer">Explorador · sonido + distancia</NativeSelectOption>
                          <NativeSelectOption value="biped4-expressive">Expresivo · distancia + boca LED</NativeSelectOption>
                          <NativeSelectOption value="humanoid6-expressive">Humanoide · 6 servos + expresión</NativeSelectOption>
                        </NativeSelect>
                      </label>
                      <strong>Calibración de {selected.config.profile === 'humanoid6-expressive' ? 'los seis servos' : 'los cuatro servos'}</strong>
                      <small>Ajustá el centro sólo si el robot no queda derecho. Invertir corrige un servo montado al revés.</small>
                      {(['Pierna izquierda', 'Pierna derecha', 'Pie izquierdo', 'Pie derecho', 'Brazo izquierdo', 'Brazo derecho'] as const).slice(0, selected.config.profile === 'humanoid6-expressive' ? 6 : 4).map((label, index) => (
                        <div key={label} className="otto-calibration-row">
                          <label>
                            <span>{label}: {selected.config.centers[index]}°</span>
                            <input type="range" min="45" max="135" value={selected.config.centers[index]} aria-label={`Centro de ${label}`} onChange={(event) => updateSelectedDraft(device => {
                              if (device.kind !== 'otto') return device;
                              const centers = [...device.config.centers] as typeof device.config.centers;
                              centers[index] = Number(event.target.value);
                              return { ...device, config: { ...device.config, centers } };
                            })} />
                          </label>
                          <label>
                            <input type="checkbox" checked={selected.config.reversed[index]} onChange={(event) => updateSelectedDraft(device => {
                              if (device.kind !== 'otto') return device;
                              const reversed = [...device.config.reversed] as typeof device.config.reversed;
                              reversed[index] = event.target.checked;
                              return { ...device, config: { ...device.config, reversed } };
                            })} /> Invertir
                          </label>
                        </div>
                      ))}
                      {(selected.config.profile === 'biped4-expressive' || selected.config.profile === 'humanoid6-expressive') && <label>
                        <span>Brillo de la boca LED: {selected.config.matrixBrightness}</span>
                        <input type="range" min="0" max="15" value={selected.config.matrixBrightness} onChange={(event) => updateSelectedDraft(device => device.kind === 'otto' ? { ...device, config: { ...device.config, matrixBrightness: Number(event.target.value) } } : device)} />
                      </label>}
                    </div>
                  )}
                  <div className="pin-editor">
                    <h4>Conexiones</h4>
                    {getPinRequirements(selected).length ? (
                      getPinRequirements(selected).map((requirement) => {
                        const value =
                          (selected.pins as Record<string, PinNumber>)[
                            requirement.key
                          ] ?? null;
                        const compatiblePins = boardProfile(draftBoardProfile).pins.filter((pin) =>
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
                                  {pinLabel(value, draftBoardProfile)} · no compatible
                                </NativeSelectOption>
                              )}
                              {compatiblePins.map((pin) => (
                                <NativeSelectOption
                                  key={pin.gpio}
                                  value={pin.gpio}
                                >
                                  {pinLabel(pin.gpio, draftBoardProfile)}
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
                      disabled={selected.kind === 'display' || selected.kind === 'ledMatrix'}
                      title={selected.kind === 'display' || selected.kind === 'ledMatrix' ? 'Una sola pantalla o matriz por proyecto' : undefined}
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
            <Button type="button" variant="outline" onClick={onExportDraft} disabled={!sceneDirty}>Exportar con escena pendiente</Button>
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
              {sceneDirty && ` · ${storageError ? 'copia local sin confirmar' : storageBusy ? 'conservando copia local…' : 'borrador recuperable'}`}
            </span>
            {message.startsWith('No se guardó') && <strong className="scene-save-error" role="alert">{message}</strong>}
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={saveAndClose}
              disabled={finishing}
              aria-keyshortcuts="Control+S Meta+S"
              title="Guardar escena (Ctrl/Cmd + S)"
            >
              {finishing ? 'Guardando…' : 'Guardar escena'}
            </Button>
          </DialogFooter>
        </DialogContent>
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
                disabled={finishing}
                onClick={(event) => {
                  event.preventDefault();
                  void finish();
                }}
              >
                Salir sin guardar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={pendingBoardProfile !== null} onOpenChange={open => !open && setPendingBoardProfile(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cambiar la placa del proyecto?</AlertDialogTitle>
              <AlertDialogDescription>
                Los GPIO actuales se conservan para no cambiar tu circuito a escondidas. Los que no existan en la nueva placa quedarán marcados hasta que los corrijas o uses Auto conectar. Podés deshacer este cambio.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Conservar {boardProfile(draftBoardProfile).shortName}</AlertDialogCancel>
              <AlertDialogAction onClick={() => pendingBoardProfile && changeBoardProfile(pendingBoardProfile)}>
                Cambiar a {pendingBoardProfile ? boardProfile(pendingBoardProfile).shortName : ''}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Dialog>
      {helpTarget && <ComponentHelpDialog open onOpenChange={next => !next && setHelpTarget(null)} kind={helpTarget.kind} device={helpTarget.device} boardProfileId={draftBoardProfile} />}
    </>
  );
}
