'use client';

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { CompiledProgram } from '@/lib/capiblocks';
import type { SceneDevice } from '@/lib/scene-model';
import { validFavorite } from '@/lib/user-preferences';

type BlocklyApi = typeof import('blockly');
type BlocklyWorkspaceSvg = import('blockly').WorkspaceSvg;
type BlocklyBlock = import('blockly').Block;

export interface BlocklyWorkspaceHandle {
  save(): Record<string, unknown>;
  load(data: Record<string, unknown>): void;
  compile(): CompiledProgram;
  highlight(blockIds?: string | readonly string[]): void;
  undo(): void;
  redo(): void;
  zoomToFit(): void;
  focusBlock(blockId: string): void;
}

export interface BlocklyHistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

interface BlocklyWorkspaceProps {
  favorites?: readonly string[];
  onChooseFavorites?: () => void;
  readOnly?: boolean;
  initialWorkspace: Record<string, unknown>;
  revision: number;
  devices: readonly SceneDevice[];
  onChange: (workspace: Record<string, unknown>) => void;
  onBlockSnap?: () => void;
  onError?: (message: string) => void;
  onHistoryChange?: (state: BlocklyHistoryState) => void;
}

import { DEVICE_FIELD, AREA_FIELD, EMPTY_FAVORITES, serializedAreaIds, workspaceDevices, serializedDeviceIds, toolbox, collectSerializedDeviceIds, registerBlocks, refreshAreaField, refreshDeviceFields, updateDeviceWarning, ensureSingleStart, compileWorkspace } from '@/lib/blockly-engine';

function saveWorkspace(Blockly: BlocklyApi, workspace: BlocklyWorkspaceSvg) {
  const snapshot = Blockly.serialization.workspaces.save(workspace);
  const roots = (snapshot.blocks as { blocks?: { type: string; deletable?: boolean }[] } | undefined)?.blocks ?? [];
  // Root protection is an editor invariant, not a document edit. Persisting
  // its UI flag would falsely dirty every old project merely by opening it.
  roots.filter(root => root.type === 'capi_start').forEach(root => { delete root.deletable; });
  return snapshot;
}

function loadWorkspaceData(
  Blockly: BlocklyApi,
  workspace: BlocklyWorkspaceSvg,
  data: Record<string, unknown>,
) {
  const previous = saveWorkspace(Blockly, workspace) as Record<
    string,
    unknown
  >;
  const previousDeviceIds = serializedDeviceIds.get(workspace) ?? new Map();
  const previousAreaIds = serializedAreaIds.get(workspace) ?? new Map();
  serializedAreaIds.set(workspace, collectSerializedDeviceIds(data, AREA_FIELD));
  serializedDeviceIds.set(workspace, collectSerializedDeviceIds(data));
  Blockly.Events.disable();
  workspace.setResizesEnabled(false);
  try {
    workspace.clearUndo();
    workspace.clear();
    Blockly.serialization.workspaces.load(data, workspace);
    ensureSingleStart(Blockly, workspace);
    workspace.clearUndo();
  } catch (error) {
    workspace.clear();
    serializedDeviceIds.set(workspace, previousDeviceIds);
    serializedAreaIds.set(workspace, previousAreaIds);
    try {
      Blockly.serialization.workspaces.load(previous, workspace);
    } catch {
      workspace.clear();
    }
    workspace.clearUndo();
    throw error;
  } finally {
    workspace.setResizesEnabled(true);
    Blockly.Events.enable();
  }
  refreshDeviceFields(Blockly, workspace);
  workspace.zoomToFit();
  Blockly.svgResize(workspace);
}

function historyState(workspace: BlocklyWorkspaceSvg): BlocklyHistoryState {
  return {
    canUndo: workspace.getUndoStack().length > 0,
    canRedo: workspace.getRedoStack().length > 0,
  };
}

function blockAccessibilityLabel(block: BlocklyBlock) {
  const description = block
    .toString()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return `Bloque: ${description || 'bloque vacío'}`;
}

function refreshBlockAccessibility(workspace: BlocklyWorkspaceSvg) {
  for (const block of workspace.getAllBlocks(false)) {
    const root = block.getSvgRoot();
    const path = root?.querySelector<SVGElement>('.blocklyPath');
    if (!path) continue;
    path.setAttribute('role', 'img');
    path.setAttribute('aria-label', blockAccessibilityLabel(block));
  }
}

function readableLoadError(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return detail
    ? `No pudimos abrir esos bloques (${detail}). El programa anterior sigue intacto.`
    : 'No pudimos abrir esos bloques. El programa anterior sigue intacto.';
}

const BlocklyWorkspace = forwardRef<
  BlocklyWorkspaceHandle,
  BlocklyWorkspaceProps
>(function BlocklyWorkspace(
  {
    initialWorkspace,
    revision,
    devices,
    onChange,
    onBlockSnap,
    onError,
    onHistoryChange,
    readOnly = false,
    favorites = EMPTY_FAVORITES,
    onChooseFavorites,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<BlocklyWorkspaceSvg | null>(null);
  const blocklyRef = useRef<BlocklyApi | null>(null);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialWorkspaceRef = useRef(initialWorkspace);
  // El modo no cambia durante la vida de un workspace; revisión monta el suyo.
  const readOnlyRef = useRef(readOnly);
  const revisionRef = useRef(revision);
  const appliedRevisionRef = useRef<number | null>(null);
  const devicesRef = useRef(devices);
  const onChangeRef = useRef(onChange);
  const onBlockSnapRef = useRef(onBlockSnap);
  const onErrorRef = useRef(onError);
  const onHistoryChangeRef = useRef(onHistoryChange);
  const favoritesRef = useRef(favorites);
  const onChooseFavoritesRef = useRef(onChooseFavorites);
  useEffect(() => { favoritesRef.current = favorites; onChooseFavoritesRef.current = onChooseFavorites; }, [favorites, onChooseFavorites]);
  const highlightedBlockIdsRef = useRef(new Set<string>());
  const keyboardStatusRef = useRef<HTMLOutputElement>(null);
  const [ready, setReady] = useState(false);
  const deviceSignature = JSON.stringify(
    devices.map(device => [device.id, device.kind, device.name, device.kind === 'display' ? device.config : null]),
  );

  useEffect(() => {
    initialWorkspaceRef.current = initialWorkspace;
    revisionRef.current = revision;
    devicesRef.current = devices;
    onChangeRef.current = onChange;
    onBlockSnapRef.current = onBlockSnap;
    onErrorRef.current = onError;
    onHistoryChangeRef.current = onHistoryChange;
  }, [
    devices,
    initialWorkspace,
    onBlockSnap,
    onChange,
    onError,
    onHistoryChange,
    revision,
  ]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    let resizeFrame: number | undefined;
    let keyboardHost: HTMLDivElement | null = null;
    let activateKeyboardNavigation: ((event: KeyboardEvent) => void) | null =
      null;
    let deactivateKeyboardNavigation: (() => void) | null = null;
    let announceBlocklyFocus: ((event?: FocusEvent) => void) | null = null;
    void Promise.all([import('blockly'), import('blockly/msg/es')]).then(
      ([Blockly, spanish]) => {
        if (disposed || !hostRef.current) return;
        blocklyRef.current = Blockly;
        const spanishMessages = { ...spanish } as Record<string, unknown>;
        delete spanishMessages.default;
        Blockly.setLocale(spanishMessages as Record<string, string>);
        registerBlocks(Blockly);
        const theme = Blockly.Theme.defineTheme('capi-theme', {
          name: 'capi-theme',
          base: Blockly.Themes.Classic,
          componentStyles: {
            workspaceBackgroundColour: '#f8f9ff',
            toolboxBackgroundColour: '#ffffff',
            toolboxForegroundColour: '#273155',
            flyoutBackgroundColour: '#f2f4ff',
            flyoutForegroundColour: '#273155',
            flyoutOpacity: 1,
            scrollbarColour: '#aeb5d2',
            insertionMarkerColour: '#6257e8',
            insertionMarkerOpacity: 0.35,
            cursorColour: '#6257e8',
          },
          fontStyle: {
            family: 'Inter, Segoe UI, sans-serif',
            weight: '600',
            size: 13,
          },
        });
        const workspace = Blockly.inject(hostRef.current, {
          toolbox: readOnlyRef.current ? undefined : toolbox,
          readOnly: readOnlyRef.current,
          theme,
          renderer: 'zelos',
          trashcan: !readOnlyRef.current,
          move: { scrollbars: true, drag: true, wheel: true },
          zoom: {
            controls: true,
            wheel: true,
            startScale: 0.9,
            maxScale: 1.6,
            minScale: 0.45,
            scaleSpeed: 1.12,
            pinch: true,
          },
          grid: { spacing: 22, length: 2, colour: '#d9dced', snap: false },
          sounds: false,
        });
        workspaceRef.current = workspace;
        workspace.registerButtonCallback('CAPI_CHOOSE_FAVORITES', () => onChooseFavoritesRef.current?.());
        workspace.registerToolboxCategoryCallback('CAPI_FAVORITES', () => [
          {kind:'button',text:'☆ Elegir favoritos',callbackKey:'CAPI_CHOOSE_FAVORITES'},
          ...(!favoritesRef.current.length ? [{kind:'label',text:'Marcá estrellas para agregar tus bloques.'}] : []),
          ...favoritesRef.current.filter(type=>validFavorite(type) && Boolean(Blockly.Blocks[type])).map(type=>({kind:'block',type})),
        ]);
        workspaceDevices.set(workspace, devicesRef.current);
        try {
          loadWorkspaceData(Blockly, workspace, initialWorkspaceRef.current);
        } catch (error) {
          onErrorRef.current?.(readableLoadError(error));
        }
        refreshBlockAccessibility(workspace);
        appliedRevisionRef.current = revisionRef.current;
        onChangeRef.current(
          saveWorkspace(Blockly, workspace) as Record<
            string,
            unknown
          >,
        );
        workspace.addChangeListener((event) => {
          if (readOnlyRef.current) return;
          if (event.isUiEvent) return;
          if (event.type === Blockly.Events.BLOCK_CREATE || event.type === Blockly.Events.BLOCK_DELETE) {
            const group = Blockly.Events.getGroup();
            Blockly.Events.setGroup(event.group || true);
            try { ensureSingleStart(Blockly, workspace); } catch (error) { onErrorRef.current?.(readableLoadError(error)); }
            finally { Blockly.Events.setGroup(group); }
          }
          if (event.type === Blockly.Events.BLOCK_MOVE && event.recordUndo)
            onBlockSnapRef.current?.();
          if (event.type === Blockly.Events.BLOCK_CHANGE) {
            const change = event as typeof event & {
              blockId?: string;
              element?: string;
              name?: string;
            };
            if (
              change.element === 'field' &&
              change.name === DEVICE_FIELD &&
              change.blockId
            ) {
              serializedDeviceIds.get(workspace)?.delete(change.blockId);
              const block = workspace.getBlockById(change.blockId);
              if (block) { refreshAreaField(block); updateDeviceWarning(block); }
            }
            if (change.element === 'field' && change.name === AREA_FIELD && change.blockId) {
              serializedAreaIds.get(workspace)?.delete(change.blockId);
              const block = workspace.getBlockById(change.blockId);
              if (block) updateDeviceWarning(block);
            }
            if (
              change.element === 'field' &&
              (change.name === 'KIND' || change.name === 'SENSOR')
            ) {
              refreshDeviceFields(Blockly, workspace);
            }
          }
          if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
          changeTimerRef.current = setTimeout(() => {
            if (!workspaceRef.current) return;
            refreshBlockAccessibility(workspaceRef.current);
            onChangeRef.current(
              saveWorkspace(Blockly, workspaceRef.current) as Record<string, unknown>,
            );
            onHistoryChangeRef.current?.(historyState(workspaceRef.current));
          }, 180);
        });
        activateKeyboardNavigation = (event: KeyboardEvent) => {
          if (
            event.key.startsWith('Arrow') ||
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            Blockly.keyboardNavigationController.setIsActive(true);
            window.requestAnimationFrame(() => announceBlocklyFocus?.());
          }
        };
        announceBlocklyFocus = (event?: FocusEvent) => {
          const target = (event?.target ??
            document.activeElement) as Element | null;
          if (!target || !keyboardHost?.contains(target)) return;
          const blockRoot = target.closest<SVGElement>('[data-id]');
          const blockId = blockRoot?.getAttribute('data-id');
          const block = blockId ? workspace.getBlockById(blockId) : null;
          const label = block
            ? blockAccessibilityLabel(block)
            : (target.getAttribute('aria-label') ??
              target.textContent?.replace(/\s+/g, ' ').trim() ??
              'Control del editor de bloques');
          if (target instanceof SVGElement) {
            target.setAttribute('aria-label', label);
          }
          if (keyboardStatusRef.current) {
            keyboardStatusRef.current.textContent = label;
          }
        };
        deactivateKeyboardNavigation = () =>
          Blockly.keyboardNavigationController.setIsActive(false);
        keyboardHost = hostRef.current;
        keyboardHost.addEventListener('keydown', activateKeyboardNavigation);
        keyboardHost.addEventListener('focusin', announceBlocklyFocus);
        keyboardHost.addEventListener(
          'pointerdown',
          deactivateKeyboardNavigation,
        );
        resizeObserver = new ResizeObserver(() => {
          if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            resizeFrame = undefined;
            if (!disposed) Blockly.svgResize(workspace);
          });
        });
        resizeObserver.observe(hostRef.current);
        onHistoryChangeRef.current?.(historyState(workspace));
        setReady(true);
      },
    );
    return () => {
      disposed = true;
      if (keyboardHost && activateKeyboardNavigation) {
        keyboardHost.removeEventListener('keydown', activateKeyboardNavigation);
      }
      if (keyboardHost && deactivateKeyboardNavigation) {
        keyboardHost.removeEventListener(
          'pointerdown',
          deactivateKeyboardNavigation,
        );
      }
      if (keyboardHost && announceBlocklyFocus) {
        keyboardHost.removeEventListener('focusin', announceBlocklyFocus);
      }
      resizeObserver?.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      workspaceRef.current?.dispose();
      workspaceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !ready ||
      revision === 0 ||
      appliedRevisionRef.current === revision ||
      !workspaceRef.current ||
      !blocklyRef.current
    )
      return;
    workspaceDevices.set(workspaceRef.current, devicesRef.current);
    try {
      loadWorkspaceData(
        blocklyRef.current,
        workspaceRef.current,
        initialWorkspaceRef.current,
      );
    } catch (error) {
      onErrorRef.current?.(readableLoadError(error));
      return;
    }
    appliedRevisionRef.current = revision;
    onChangeRef.current(
      saveWorkspace(blocklyRef.current, workspaceRef.current) as Record<string, unknown>,
    );
    refreshBlockAccessibility(workspaceRef.current);
  }, [ready, revision]);

  useEffect(() => {
    if (!ready || !workspaceRef.current || !blocklyRef.current) return;
    workspaceDevices.set(workspaceRef.current, devicesRef.current);
    if (refreshDeviceFields(blocklyRef.current, workspaceRef.current)) {
      refreshBlockAccessibility(workspaceRef.current);
      onChangeRef.current(
        saveWorkspace(blocklyRef.current, workspaceRef.current) as Record<string, unknown>,
      );
    }
  }, [deviceSignature, ready]);

  useImperativeHandle(
    ref,
    () => ({
      save() {
        if (!workspaceRef.current || !blocklyRef.current)
          return initialWorkspaceRef.current;
        return saveWorkspace(blocklyRef.current, workspaceRef.current) as Record<string, unknown>;
      },
      load(data) {
        if (!workspaceRef.current || !blocklyRef.current) return;
        try {
          loadWorkspaceData(blocklyRef.current, workspaceRef.current, data);
        } catch (error) {
          onErrorRef.current?.(readableLoadError(error));
          return;
        }
        onChangeRef.current(
          saveWorkspace(blocklyRef.current, workspaceRef.current) as Record<string, unknown>,
        );
      },
      compile() {
        if (!workspaceRef.current) return { version: 2, threads: [] };
        return compileWorkspace(workspaceRef.current);
      },
      highlight(blockIds) {
        const workspace = workspaceRef.current;
        if (!workspace) return;
        for (const id of highlightedBlockIdsRef.current) {
          workspace
            .getBlockById(id)
            ?.getSvgRoot()
            ?.classList.remove('capi-block-active');
        }
        const nextIds = new Set(
          typeof blockIds === 'string'
            ? [blockIds]
            : blockIds
              ? [...blockIds]
              : [],
        );
        for (const id of nextIds) {
          workspace
            .getBlockById(id)
            ?.getSvgRoot()
            ?.classList.add('capi-block-active');
        }
        highlightedBlockIdsRef.current = nextIds;
        workspace.highlightBlock([...nextIds][0] ?? null);
      },
      undo() {
        if (readOnlyRef.current) return;
        const workspace = workspaceRef.current;
        if (!workspace || !workspace.getUndoStack().length) return;
        workspace.undo(false);
        onHistoryChangeRef.current?.(historyState(workspace));
      },
      redo() {
        if (readOnlyRef.current) return;
        const workspace = workspaceRef.current;
        if (!workspace || !workspace.getRedoStack().length) return;
        workspace.undo(true);
        onHistoryChangeRef.current?.(historyState(workspace));
      },
      zoomToFit() {
        workspaceRef.current?.zoomToFit();
      },
      focusBlock(blockId) {
        const workspace = workspaceRef.current;
        if (workspace?.getBlockById(blockId) && !workspace.isDragging()) workspace.centerOnBlock(blockId);
      },
    }),
    [],
  );

  useEffect(() => {
    if (ready && !readOnlyRef.current) workspaceRef.current?.refreshToolboxSelection();
  }, [favorites, ready]);

  return (
    <div className="blockly-shell">
      {!ready && <div className="editor-loading">Preparando los bloques…</div>}
      <p id="blockly-keyboard-help" className="visually-hidden">
        Usa Tab para recorrer el editor. Las flechas permiten navegar por los
        controles de Blockly. {readOnly ? 'Sólo lectura: no se pueden modificar los bloques.' : 'Control Z deshace y Control Y rehace.'}
      </p>
      <output
        ref={keyboardStatusRef}
        id="blockly-keyboard-status"
        className="visually-hidden"
        aria-live="polite"
        aria-atomic="true"
      />
      <div
        ref={hostRef}
        className="blockly-host"
        role="application"
        aria-label={readOnly ? 'Bloques de la versión, sólo lectura' : 'Editor visual de bloques'}
        aria-describedby="blockly-keyboard-help blockly-keyboard-status"
      />
    </div>
  );
});

export default memo(BlocklyWorkspace);
