'use client';

import { useMemo, useState } from 'react';
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
  createEmptyScene,
  duplicateSceneDevice,
  duplicateSceneWidget,
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

interface SceneBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: SceneDefinition;
  onSceneChange: (scene: SceneDefinition) => void;
}

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

export default function SceneBuilder({
  open,
  onOpenChange,
  scene,
  onSceneChange,
}: SceneBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(
    scene.devices[0]?.id ?? scene.widgets[0]?.id,
  );
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'all' }
    | { kind: 'device'; id: string }
    | { kind: 'widget'; id: string }
    | null
  >(null);
  const [message, setMessage] = useState('');

  const selectedItem = useMemo(
    () =>
      scene.devices.find((device) => device.id === selectedId) ??
      scene.widgets.find((widget) => widget.id === selectedId) ??
      scene.devices[0] ??
      scene.widgets[0],
    [scene.devices, scene.widgets, selectedId],
  );
  const selected =
    selectedItem && 'pins' in selectedItem ? selectedItem : undefined;
  const selectedWidget =
    selectedItem && !('pins' in selectedItem) ? selectedItem : undefined;
  const validation = useMemo(() => validateScene(scene), [scene]);

  const changeScene = (next: SceneDefinition, notice = '') => {
    onSceneChange(next);
    setMessage(notice);
  };

  const addComponent = (kind: SceneDevice['kind']) => {
    const result = addDeviceToScene(scene, kind);
    changeScene(result.scene, `${result.device.name} ya está en la escena.`);
    setSelectedId(result.device.id);
  };

  const addTemplate = (template: LegacySceneId) => {
    const lane = scene.devices.length % 5;
    const result = appendTemplateToScene(scene, template, {
      offset: { x: 20 + lane * 24, y: 15 + lane * 18 },
    });
    changeScene(
      result.scene,
      result.warnings.length
        ? 'Se agregó la plantilla. Revisa el cableado sugerido.'
        : 'Plantilla combinada con tu escena.',
    );
    setSelectedId(
      template === 'counter'
        ? result.scene.widgets.at(-1)?.id ?? result.addedDeviceIds.at(-1)
        : result.addedDeviceIds.at(-1),
    );
  };

  const moveItem = (itemId: string, position: ScenePosition) => {
    if (scene.devices.some((device) => device.id === itemId)) {
      changeScene(
        cloneWithDevice(scene, itemId, (device) => ({
          ...device,
          position: { ...position },
        })),
      );
      return;
    }
    const next = cloneScene(scene);
    next.widgets = next.widgets.map((widget) =>
      widget.id === itemId
        ? { ...widget, position: { ...position } }
        : widget,
    );
    changeScene(next);
  };

  const updateSelected = (update: (device: SceneDevice) => SceneDevice) => {
    if (!selected) return;
    changeScene(cloneWithDevice(scene, selected.id, update));
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const result = duplicateSceneDevice(scene, selected.id);
    if (!result) return;
    changeScene(result.scene, `${result.device.name} fue duplicado.`);
    setSelectedId(result.device.id);
  };

  const updateSelectedWidget = (
    update: (widget: SceneWidget) => SceneWidget,
  ) => {
    if (!selectedWidget) return;
    const next = cloneScene(scene);
    next.widgets = next.widgets.map((widget) =>
      widget.id === selectedWidget.id ? update(widget) : widget,
    );
    changeScene(next);
  };

  const duplicateSelectedWidget = () => {
    if (!selectedWidget) return;
    const result = duplicateSceneWidget(scene, selectedWidget.id);
    if (!result) return;
    changeScene(result.scene, `${result.widget.name} fue duplicado.`);
    setSelectedId(result.widget.id);
  };

  const confirmDelete = () => {
    if (deleteTarget?.kind === 'all') {
      const empty = createEmptyScene(scene.name, {
        id: scene.id,
        description: scene.description,
        canvas: scene.canvas,
      });
      changeScene(empty, 'La escena quedó vacía. Puedes empezar otra aventura.');
      setSelectedId(undefined);
    } else if (deleteTarget?.kind === 'device') {
      const removed = scene.devices.find(
        (device) => device.id === deleteTarget.id,
      );
      changeScene(
        removeDeviceFromScene(scene, deleteTarget.id),
        removed ? `${removed.name} fue quitado de la escena.` : '',
      );
    } else if (deleteTarget?.kind === 'widget') {
      const removed = scene.widgets.find(
        (widget) => widget.id === deleteTarget.id,
      );
      const next = cloneScene(scene);
      next.widgets = next.widgets.filter(
        (widget) => widget.id !== deleteTarget.id,
      );
      changeScene(
        next,
        removed ? `${removed.name} fue quitado de la escena.` : '',
      );
    }
    setDeleteTarget(null);
  };

  const autoConnect = () => {
    const result = assignSafePins(scene);
    changeScene(
      result.scene,
      result.warnings.length
        ? 'Conecté todo lo posible. Aún faltan pines para algunos componentes.'
        : 'Cableado seguro asignado para la Wemos D1 R32.',
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="scene-builder-dialog"
          showCloseButton
          aria-describedby="scene-builder-description"
        >
          <DialogHeader className="scene-builder-heading">
            <div>
              <span className="eyebrow">Laboratorio de escenas</span>
              <DialogTitle>Arma tu mundo</DialogTitle>
              <DialogDescription id="scene-builder-description">
                Combina cuantos objetos quieras, muévelos y elige cómo van
                conectados a la Wemos D1 R32.
              </DialogDescription>
            </div>
            <div className="scene-builder-status" aria-live="polite">
              <span className={validation.canSimulate ? 'ready' : 'problem'}>
                {validation.canSimulate ? '▶ Se puede simular' : 'Revisar escena'}
              </span>
              <span className={validation.hardwareReady ? 'ready' : 'warning'}>
                {validation.hardwareReady
                  ? '🔌 Lista para la placa'
                  : '🔌 Cableado pendiente'}
              </span>
            </div>
          </DialogHeader>

          <div className="scene-builder-toolbar">
            <label htmlFor="scene-name">
              <span>Nombre de la escena</span>
              <Input
                id="scene-name"
                value={scene.name}
                maxLength={60}
                onChange={(event) =>
                  changeScene({ ...cloneScene(scene), name: event.target.value })
                }
              />
            </label>
            <label>
              <span>Fondo</span>
              <NativeSelect
                value={scene.canvas.background}
                onChange={(event) =>
                  changeScene({
                    ...cloneScene(scene),
                    canvas: {
                      ...scene.canvas,
                      background: event.target.value as SceneBackground,
                    },
                  })
                }
              >
                {backgrounds.map((background) => (
                  <NativeSelectOption key={background.value} value={background.value}>
                    {background.icon} {background.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="scene-snap-control">
              <input
                type="checkbox"
                checked={scene.canvas.snapToGrid}
                onChange={(event) =>
                  changeScene({
                    ...cloneScene(scene),
                    canvas: {
                      ...scene.canvas,
                      snapToGrid: event.target.checked,
                    },
                  })
                }
              />
              Encajar en la cuadrícula
            </label>
            <Button type="button" variant="outline" onClick={autoConnect}>
              ✨ Auto conectar
            </Button>
          </div>

          <div className="scene-builder-grid">
            <aside className="scene-library" aria-label="Biblioteca de componentes">
              <section>
                <h3>Combinar aventuras</h3>
                <p>Agrega una escena completa. Puedes repetirlas.</p>
                <div className="template-palette">
                  {quickTemplates.map((template) => (
                    <button
                      type="button"
                      key={template.id}
                      onClick={() => addTemplate(template.id)}
                    >
                      <span>{template.icon}</span>
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
                    >
                      <span>{component.icon}</span>
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
                <small>Arrastra los objetos o usa las flechas del teclado.</small>
              </div>
              <SceneStage
                scene={scene}
                selectedId={selectedItem?.id}
                editing
                onSelect={setSelectedId}
                onMove={moveItem}
              />
              {message && (
                <output className="scene-builder-message" aria-live="polite">
                  🐾 {message}
                </output>
              )}
            </section>

            <aside className="scene-inspector" aria-label="Configuración del componente">
              {selected ? (
                <>
                  <div className="inspector-title">
                    <span>
                      {sceneComponentCatalog.find((item) => item.kind === selected.kind)
                        ?.icon ?? '🔧'}
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
                        updateSelected((device) => ({
                          ...device,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Giro: {selected.rotation}°</span>
                    <input
                      type="range"
                      min="0"
                      max="330"
                      step="30"
                      value={selected.rotation}
                      onChange={(event) =>
                        updateSelected((device) => ({
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
                          (selected.pins as Record<string, PinNumber>)[requirement.key] ??
                          null;
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
                              onChange={(event) => {
                                const pin = event.target.value
                                  ? Number(event.target.value)
                                  : null;
                                updateSelected(
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
                              <NativeSelectOption value="">Sin asignar</NativeSelectOption>
                              {!currentPinIsCompatible && value !== null && (
                                <NativeSelectOption value={value}>
                                  {pinLabel(value)} · no compatible
                                </NativeSelectOption>
                              )}
                              {compatiblePins.map((pin) => (
                                <NativeSelectOption key={pin.gpio} value={pin.gpio}>
                                  {pinLabel(pin.gpio)}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          </label>
                        );
                      })
                    ) : (
                      <p>Este componente usa el Wi-Fi integrado y no necesita pines.</p>
                    )}
                  </div>

                  <div className="inspector-actions">
                    <Button type="button" variant="outline" onClick={duplicateSelected}>
                      📄 Duplicar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setDeleteTarget({ kind: 'device', id: selected.id })
                      }
                    >
                      🗑 Quitar
                    </Button>
                  </div>
                </>
              ) : selectedWidget ? (
                <>
                  <div className="inspector-title">
                    <span>{selectedWidget.config.mascot}</span>
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
                        updateSelectedWidget((widget) => ({
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
                        updateSelectedWidget((widget) => ({
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
                      Muestra el contador global de tus bloques. También puedes
                      arrastrarlo y duplicarlo como cualquier componente.
                    </p>
                  </div>
                  <div className="inspector-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={duplicateSelectedWidget}
                    >
                      📄 Duplicar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setDeleteTarget({
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
                  <span>👆</span>
                  <strong>Elige un objeto</strong>
                  <p>Aquí podrás ponerle nombre, girarlo y revisar sus cables.</p>
                </div>
              )}

              {!!validation.issues.length && (
                <div className="scene-validation">
                  <h4>Revisión de la escena</h4>
                  <ul>
                    {validation.issues.slice(0, 5).map((issue, index) => (
                      <li key={`${issue.code}-${issue.deviceId ?? 'scene'}-${index}`}>
                        {issue.severity === 'error' ? '⛔' : '⚠️'} {issue.message}
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
              disabled={!scene.devices.length && !scene.widgets.length}
              onClick={() => setDeleteTarget({ kind: 'all' })}
            >
              Vaciar escena
            </Button>
            <span>
              {scene.devices.length + scene.widgets.length} objeto
              {scene.devices.length + scene.widgets.length === 1 ? '' : 's'}
            </span>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Listo, usar esta escena
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
                ? 'Se quitarán todos los objetos y widgets. Los bloques no se borrarán.'
                : deleteTarget?.kind === 'widget'
                  ? 'Se quitará el marcador visual. El valor del contador y sus bloques no se borrarán.'
                  : 'Los bloques que apunten a este objeto quedarán marcados para que elijas otro.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Sí, quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
