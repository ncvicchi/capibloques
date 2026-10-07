'use client';

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { CompiledProgram, ExecutionTaskState } from '@/lib/capiblocks';
import type { SceneDevice } from '@/lib/scene-model';
import type { BoardProfileId } from '@/lib/board-profiles';
import { validFavorite } from '@/lib/user-preferences';
import { separatedBlockOffset } from '@/lib/editor-ergonomics';
import {
  MAIN_WORKSPACE_TAB_ID,
  MAX_WORKSPACE_TABS,
  cleanWorkspaceTabName,
  isRoutineDefinitionType,
  moveWorkspaceRootToTab,
  nextWorkspaceTabId,
  nextWorkspaceTabName,
  normalizeWorkspaceTabs,
  reconcileWorkspaceTabs,
  saveWorkspaceTabs,
  tabForRoot,
  type WorkspaceTabsState,
} from '@/lib/workspace-tabs';

type BlocklyApi = typeof import('blockly');
type BlocklyWorkspaceSvg = import('blockly').WorkspaceSvg;
type BlocklyBlock = import('blockly').Block;
type BlocklyBlockSvg = import('blockly').BlockSvg;

export interface BlocklyWorkspaceHandle {
  save(): Record<string, unknown>;
  load(data: Record<string, unknown>): void;
  compile(): CompiledProgram;
  highlight(blockIds?: string | readonly string[]): void;
  showExecution(tasks?: readonly ExecutionTaskState[]): void;
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
  allowedBlocks?: readonly string[];
  favorites?: readonly string[];
  onChooseFavorites?: () => void;
  onHelpDevice?: (deviceId: string) => void;
  readOnly?: boolean;
  initialWorkspace: Record<string, unknown>;
  revision: number;
  devices: readonly SceneDevice[];
  boardProfile: BoardProfileId;
  onChange: (workspace: Record<string, unknown>) => void;
  onBlockSnap?: () => void;
  onError?: (message: string) => void;
  onHistoryChange?: (state: BlocklyHistoryState) => void;
}

import {
  DEVICE_FIELD,
  AREA_FIELD,
  EMPTY_FAVORITES,
  serializedAreaIds,
  workspaceDevices,
  workspaceBoardProfiles,
  serializedDeviceIds,
  toolbox,
  collectSerializedDeviceIds,
  registerBlocks,
  refreshAreaField,
  refreshMessageField,
  refreshDeviceFields,
  updateDeviceWarning,
  ensureSingleStart,
  compileWorkspace,
} from '@/lib/blockly-engine';

function saveWorkspace(
  Blockly: BlocklyApi,
  workspace: BlocklyWorkspaceSvg,
  tabs?: WorkspaceTabsState,
) {
  const snapshot = Blockly.serialization.workspaces.save(workspace);
  const roots =
    (
      snapshot.blocks as
        | { blocks?: { type: string; deletable?: boolean }[] }
        | undefined
    )?.blocks ?? [];
  // Root protection is an editor invariant, not a document edit. Persisting
  // its UI flag would falsely dirty every old project merely by opening it.
  roots
    .filter((root) => root.type === 'capi_start')
    .forEach((root) => {
      delete root.deletable;
    });
  return tabs ? saveWorkspaceTabs(snapshot, tabs) : snapshot;
}

function sameTabs(left: WorkspaceTabsState, right: WorkspaceTabsState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function workspaceToolbox(activeTabId: string, allowed?: readonly string[]) {
  const copy = structuredClone(toolbox) as typeof toolbox;
  if (allowed) {
    // Explicit entries replace dynamic/favorite categories so they cannot leak
    // unrestricted tools into a challenge; normal editing keeps its callbacks.
    copy.contents = copy.contents.filter(category => {
      if (!Array.isArray(category.contents)) return false;
      category.contents = category.contents.filter(item => item.kind !== 'block' || !('type' in item) || allowed.includes(String(item.type)));
      return category.contents.some(item => item.kind === 'block');
    });
  }
  if (activeTabId !== MAIN_WORKSPACE_TAB_ID) return copy;
  for (const category of copy.contents ?? []) {
    if (
      category.kind !== 'category' ||
      category.name !== 'Mis bloques' ||
      !Array.isArray(category.contents)
    )
      continue;
    category.contents = category.contents.filter(
      (item) =>
        item.kind !== 'block' ||
        !('type' in item) ||
        !isRoutineDefinitionType(String(item.type)),
    );
    category.contents.unshift({
      kind: 'label',
      text: 'Creá definiciones en una pestaña con +',
    });
  }
  return copy;
}

function createWorkspaceTabsChangeEvent(
  Blockly: BlocklyApi,
  workspaceId: string,
  oldState: WorkspaceTabsState,
  newState: WorkspaceTabsState,
  apply: (state: WorkspaceTabsState) => void,
) {
  return new (class extends Blockly.Events.Abstract {
    isBlank = false;
    type = 'capi_workspace_tabs_change';
    oldState = structuredClone(oldState);
    newState = structuredClone(newState);
    constructor() {
      super();
      this.workspaceId = workspaceId;
    }
    override run(forward: boolean) {
      apply(forward ? this.newState : this.oldState);
    }
  })();
}

function EditableTabName({
  name,
  onDone,
  onCancel,
}: {
  name: string;
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <input
      ref={inputRef}
      className="program-tab-name"
      defaultValue={name}
      maxLength={24}
      aria-label="Nombre de la pestaña"
      onBlur={(event) => onDone(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') onCancel();
      }}
    />
  );
}

function loadWorkspaceData(
  Blockly: BlocklyApi,
  workspace: BlocklyWorkspaceSvg,
  data: Record<string, unknown>,
) {
  const previous = saveWorkspace(Blockly, workspace) as Record<string, unknown>;
  const previousDeviceIds = serializedDeviceIds.get(workspace) ?? new Map();
  const previousAreaIds = serializedAreaIds.get(workspace) ?? new Map();
  serializedAreaIds.set(
    workspace,
    collectSerializedDeviceIds(data, AREA_FIELD),
  );
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
  const root = block.getRootBlock();
  const detached = root.type !== 'capi_start' && !isRoutineDefinitionType(root.type);
  return `Bloque: ${description || 'bloque vacío'}${detached ? '. Fuera del programa; conectalo para ejecutarlo.' : ''}`;
}

function refreshBlockAccessibility(workspace: BlocklyWorkspaceSvg) {
  for (const block of workspace.getAllBlocks(false)) {
    const root = block.getSvgRoot();
    const chain = block.getRootBlock();
    const detached = chain.type !== 'capi_start' && !isRoutineDefinitionType(chain.type);
    root?.classList.toggle('capi-block-detached', detached);
    block.setWarningText(block === chain && detached ? 'Fuera del programa. Conectá estos bloques a Al comenzar o dentro de un procedimiento.' : null, 'outside-program');
    for (const input of block.inputList) for (const field of input.fieldRow) {
      const fieldRoot = field.getSvgRoot();
      fieldRoot?.classList.toggle('capi-choice-field', 'getOptions' in field);
      fieldRoot?.classList.toggle('capi-number-field', typeof field.getValue() === 'number');
    }
    const path = root?.querySelector<SVGElement>('.blocklyPath');
    if (!path) continue;
    path.setAttribute('role', 'img');
    path.setAttribute('aria-label', blockAccessibilityLabel(block));
  }
}

function createBlockDraggingConfigurator(
  Blockly: BlocklyApi,
  workspace: BlocklyWorkspaceSvg,
  onHelpDevice: (deviceId: string) => void,
  getTabs: () => WorkspaceTabsState,
  moveRootToTab: (rootBlockId: string, tabId: string) => void,
) {
  class CapiBlockDragStrategy extends Blockly.dragging.BlockDragStrategy {
    protected override shouldHealStack(event: PointerEvent | undefined) {
      return !(event?.ctrlKey || event?.metaKey);
    }
  }
  const configured = new WeakSet<BlocklyBlockSvg>();
  return () => {
    for (const block of workspace.getAllBlocks(false)) {
      const renderedBlock = block as BlocklyBlockSvg;
      if (configured.has(renderedBlock)) continue;
      renderedBlock.setDragStrategy(new CapiBlockDragStrategy(renderedBlock));
      block.customContextMenu = (options) => {
        const deviceId = String(block.getFieldValue(DEVICE_FIELD) ?? '');
        if (deviceId)
          options.push({
            text: '❓ Ayuda de este componente',
            enabled: true,
            callback: () => {
              const current = String(block.getFieldValue(DEVICE_FIELD) ?? '');
              if (current) onHelpDevice(current);
            },
          });
        const root = block.getRootBlock();
        const state = getTabs();
        const owner = tabForRoot(state, root.id);
        const destinations = state.tabs.filter((tab) => tab.id !== owner);
        if (!destinations.length) return;
        options.push({
          text: 'Enviar a…',
          enabled: false,
          callback: () => {},
        });
        for (const tab of destinations)
          options.push({
            text: `↗ Enviar a «${tab.name}»`,
            enabled: true,
            callback: () => moveRootToTab(root.id, tab.id),
          });
      };
      configured.add(renderedBlock);
    }
  };
}

const executionColours = [
  '#43227a',
  '#00677a',
  '#8a4b00',
  '#08713f',
  '#9b1b55',
  '#315373',
];

function executionColour(taskId: string) {
  let hash = 0;
  for (const character of taskId)
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return executionColours[Math.abs(hash) % executionColours.length];
}

function shortExecutionText(task: ExecutionTaskState) {
  const iteration =
    task.iteration !== undefined && task.totalIterations !== undefined
      ? `Vuelta ${task.iteration}/${task.totalIterations}`
      : '';
  const detail =
    task.detail ??
    (task.status === 'joining'
      ? 'Espera a los otros caminos'
      : task.status === 'waiting'
        ? 'Esperando'
        : 'Ejecutando');
  return [iteration, detail].filter(Boolean).join(' · ');
}

function badgeExecutionText(task: ExecutionTaskState) {
  const iteration =
    task.iteration !== undefined && task.totalIterations !== undefined
      ? `V${task.iteration}/${task.totalIterations}`
      : '';
  const detail =
    task.remainingMs !== undefined
      ? `${(task.remainingMs / 1000).toFixed(2)} s restantes`
      : (task.detail ??
        (task.status === 'joining'
          ? 'Espera a los otros caminos'
          : 'Ejecutando'));
  return [iteration, detail].filter(Boolean).join(' · ');
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

function clearExecutionProgress(
  workspace: BlocklyWorkspaceSvg,
  blockIds: ReadonlySet<string>,
) {
  for (const id of blockIds) {
    const root = workspace.getBlockById(id)?.getSvgRoot();
    if (!root) continue;
    root.classList.remove('capi-block-active');
    root.style.removeProperty('--capi-thread-colour');
    root
      .querySelectorAll('.capi-execution-badge')
      .forEach((badge) => badge.remove());
    const path = root.querySelector<SVGElement>('.blocklyPath');
    const baseLabel = path?.getAttribute('data-capi-base-label');
    if (path && baseLabel) {
      path.setAttribute('aria-label', baseLabel);
      path.removeAttribute('data-capi-base-label');
    }
  }
}

function drawExecutionProgress(
  workspace: BlocklyWorkspaceSvg,
  tasks: readonly ExecutionTaskState[],
  previousBlockIds: ReadonlySet<string>,
) {
  clearExecutionProgress(workspace, previousBlockIds);
  const visible = tasks.filter(
    (task): task is ExecutionTaskState & { blockId: string } =>
      Boolean(task.blockId) &&
      task.status !== 'done' &&
      task.status !== 'inactive',
  );
  const byBlock = new Map<string, typeof visible>();
  for (const task of visible) {
    const group = byBlock.get(task.blockId) ?? [];
    group.push(task);
    byBlock.set(task.blockId, group);
  }
  for (const [blockId, blockTasks] of byBlock) {
    const block = workspace.getBlockById(blockId);
    const root = block?.getSvgRoot();
    if (!block || !root) continue;
    const size = block.getHeightWidth();
    const rootBounds = root.getBoundingClientRect();
    const canvasBounds = root.ownerSVGElement?.getBoundingClientRect();
    const scale = workspace.scale || 1;
    const badgeWidth = 162 * scale;
    const badgeX =
      canvasBounds && canvasBounds.right - rootBounds.right >= badgeWidth
        ? Math.max(96, size.width + 8)
        : canvasBounds && rootBounds.left - canvasBounds.left >= badgeWidth
          ? -162
          : Math.max(0, size.width - 154);
    const badgeY =
      canvasBounds &&
      canvasBounds.right - rootBounds.right < badgeWidth &&
      rootBounds.left - canvasBounds.left < badgeWidth
        ? -43
        : 0;
    root.classList.add('capi-block-active');
    root.style.setProperty(
      '--capi-thread-colour',
      executionColour(blockTasks[0].id),
    );
    const descriptions: string[] = [];
    blockTasks.forEach((task, index) => {
      const colour = executionColour(task.id);
      const detail = shortExecutionText(task);
      const badgeDetail = badgeExecutionText(task);
      descriptions.push(`${task.label}: ${detail}`);
      const badge = svgElement('g');
      badge.classList.add('capi-execution-badge');
      badge.setAttribute('data-task-id', task.id);
      badge.setAttribute(
        'transform',
        `translate(${badgeX} ${badgeY + index * 43})`,
      );
      badge.style.setProperty('--capi-thread-colour', colour);
      badge.setAttribute('aria-hidden', 'true');
      const title = svgElement('title');
      title.textContent = `${task.label}: ${detail}`;
      badge.appendChild(title);
      const background = svgElement('rect');
      background.classList.add('capi-execution-badge-bg');
      background.setAttribute('width', '154');
      background.setAttribute('height', '38');
      background.setAttribute('rx', '8');
      badge.appendChild(background);
      const heading = svgElement('text');
      heading.classList.add('capi-execution-badge-title');
      heading.setAttribute('x', '8');
      heading.setAttribute('y', '14');
      heading.textContent =
        task.label.length > 22 ? `${task.label.slice(0, 21)}…` : task.label;
      badge.appendChild(heading);
      const status = svgElement('text');
      status.classList.add('capi-execution-badge-detail');
      status.setAttribute('x', '8');
      status.setAttribute('y', task.durationMs ? '27' : '30');
      status.textContent =
        badgeDetail.length > 28 ? `${badgeDetail.slice(0, 27)}…` : badgeDetail;
      badge.appendChild(status);
      if (
        task.durationMs !== undefined &&
        task.durationMs > 0 &&
        task.remainingMs !== undefined
      ) {
        const track = svgElement('rect');
        track.classList.add('capi-execution-progress-track');
        track.setAttribute('x', '8');
        track.setAttribute('y', '31');
        track.setAttribute('width', '138');
        track.setAttribute('height', '4');
        track.setAttribute('rx', '2');
        badge.appendChild(track);
        const fill = svgElement('rect');
        fill.classList.add('capi-execution-progress-fill');
        fill.setAttribute('x', '8');
        fill.setAttribute('y', '31');
        fill.setAttribute(
          'width',
          String(
            138 *
              Math.max(0, Math.min(1, 1 - task.remainingMs / task.durationMs)),
          ),
        );
        fill.setAttribute('height', '4');
        fill.setAttribute('rx', '2');
        badge.appendChild(fill);
      }
      root.appendChild(badge);
    });
    const path = root.querySelector<SVGElement>('.blocklyPath');
    if (path) {
      const baseLabel =
        path.getAttribute('aria-label') ?? blockAccessibilityLabel(block);
      path.setAttribute('data-capi-base-label', baseLabel);
      path.setAttribute(
        'aria-label',
        `${baseLabel}. ${descriptions.join('. ')}`,
      );
    }
  }
  return new Set(byBlock.keys());
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
    boardProfile,
    onChange,
    onBlockSnap,
    onError,
    onHistoryChange,
    readOnly = false,
    allowedBlocks,
    favorites = EMPTY_FAVORITES,
    onChooseFavorites,
    onHelpDevice,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<BlocklyWorkspaceSvg | null>(null);
  const blocklyRef = useRef<BlocklyApi | null>(null);
  const initialTabs = normalizeWorkspaceTabs(initialWorkspace);
  const tabsRef = useRef<WorkspaceTabsState>(initialTabs);
  const activeTabIdRef = useRef(MAIN_WORKSPACE_TAB_ID);
  const applyTabsRef = useRef<
    (
      next: WorkspaceTabsState,
      recordUndo?: boolean,
      reconcile?: boolean,
    ) => void
  >(() => {});
  const showTabRef = useRef<(tabId: string, center?: boolean) => void>(
    () => {},
  );
  const stableWorkspaceRef = useRef<Record<string, unknown>>(
    saveWorkspaceTabs(initialWorkspace, initialTabs),
  );
  const configureBlockDraggingRef = useRef<() => void>(() => {});
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialWorkspaceRef = useRef(initialWorkspace);
  // El modo no cambia durante la vida de un workspace; revisión monta el suyo.
  const readOnlyRef = useRef(readOnly);
  const revisionRef = useRef(revision);
  const appliedRevisionRef = useRef<number | null>(null);
  const devicesRef = useRef(devices);
  const boardProfileRef = useRef(boardProfile);
  const onChangeRef = useRef(onChange);
  const onBlockSnapRef = useRef(onBlockSnap);
  const onErrorRef = useRef(onError);
  const onHistoryChangeRef = useRef(onHistoryChange);
  const favoritesRef = useRef(favorites);
  const allowedBlocksRef = useRef(allowedBlocks);
  useEffect(() => { allowedBlocksRef.current = allowedBlocks; if(workspaceRef.current&&!readOnlyRef.current)workspaceRef.current.updateToolbox(workspaceToolbox(activeTabIdRef.current,allowedBlocks)); }, [allowedBlocks]);
  const onChooseFavoritesRef = useRef(onChooseFavorites);
  const onHelpDeviceRef = useRef(onHelpDevice);
  useEffect(() => {
    favoritesRef.current = favorites;
    onChooseFavoritesRef.current = onChooseFavorites;
    onHelpDeviceRef.current = onHelpDevice;
  }, [favorites, onChooseFavorites, onHelpDevice]);
  const highlightedBlockIdsRef = useRef(new Set<string>());
  const keyboardStatusRef = useRef<HTMLOutputElement>(null);
  const [ready, setReady] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [detachedCount, setDetachedCount] = useState(0);
  const [tabs, setTabs] = useState(initialTabs.tabs);
  const [activeTabId, setActiveTabId] = useState(MAIN_WORKSPACE_TAB_ID);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const deviceSignature = JSON.stringify(
    devices.map((device) => [
      device.id,
      device.kind,
      device.name,
      device.kind === 'display' ? device.config : null,
    ]),
  );

  const captureStableWorkspace = () => {
    const workspace = workspaceRef.current;
    const Blockly = blocklyRef.current;
    if (!workspace || !Blockly) return stableWorkspaceRef.current;
    // Blockly connects an insertion marker while a block is being dragged.
    // Its serializer represents that temporary connection as `block: null`,
    // which is deliberately not a valid CapiBloques document.
    if (workspace.isDragging()) return stableWorkspaceRef.current;
    const reconciled = reconcileWorkspaceTabs(
      tabsRef.current,
      workspace
        .getTopBlocks(false)
        .map((block) => ({ id: block.id, type: block.type })),
      activeTabIdRef.current,
    );
    if (!sameTabs(reconciled, tabsRef.current)) {
      tabsRef.current = reconciled;
      setTabs(reconciled.tabs);
    }
    const snapshot = saveWorkspace(Blockly, workspace, reconciled) as Record<
      string,
      unknown
    >;
    stableWorkspaceRef.current = snapshot;
    return snapshot;
  };

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
    let colorObserver: MutationObserver | undefined;
    let resizeFrame: number | undefined;
    let dragConfigurationFrame: number | undefined;
    let dragConfigurationPending = false;
    let keyboardHost: HTMLDivElement | null = null;
    let activateKeyboardNavigation: ((event: KeyboardEvent) => void) | null =
      null;
    let deactivateKeyboardNavigation: (() => void) | null = null;
    let deactivateOutsideEditor: ((event: FocusEvent) => void) | null = null;
    let announceBlocklyFocus: ((event?: FocusEvent) => void) | null = null;
    let openCalledDefinition: ((event: MouseEvent) => void) | null = null;
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
          toolbox: readOnlyRef.current ? undefined : workspaceToolbox(MAIN_WORKSPACE_TAB_ID,allowedBlocksRef.current),
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
        const updateFixedFlyoutScale = () => {
          const flyoutWorkspace = workspace.getFlyout()?.getWorkspace();
          if (flyoutWorkspace && flyoutWorkspace.getScale() !== 0.9)
            flyoutWorkspace.setScale(0.9);
        };
        updateFixedFlyoutScale();
        colorObserver = new MutationObserver(() => {
          workspace
            .getParentSvg()
            .querySelectorAll<HTMLElement>(
              '.blocklyToolboxCategory, .blocklyTreeRow',
            )
            .forEach((row) => {
              if (row.style.color)
                row.style.setProperty('--category-colour', row.style.color);
            });
        });
        colorObserver.observe(workspace.getParentSvg(), {
          attributes: true,
          subtree: true,
          attributeFilter: ['style'],
        });
        const configureBlockDragging = createBlockDraggingConfigurator(
          Blockly,
          workspace,
          (deviceId) => onHelpDeviceRef.current?.(deviceId),
          () => tabsRef.current,
          (rootBlockId, tabId) => {
            applyTabsRef.current(
              moveWorkspaceRootToTab(tabsRef.current, rootBlockId, tabId),
              true,
              false,
            );
            showTabRef.current(tabId, true);
          },
        );
        const configureBlockDraggingWhenIdle = () => {
          dragConfigurationFrame = undefined;
          if (workspace.isDragging()) {
            dragConfigurationPending = true;
            return;
          }
          dragConfigurationPending = false;
          configureBlockDragging();
        };
        configureBlockDraggingRef.current = configureBlockDragging;
        workspaceRef.current = workspace;
        const refreshTabView = (tabId: string, center = false) => {
          const validId = tabsRef.current.tabs.some((tab) => tab.id === tabId)
            ? tabId
            : MAIN_WORKSPACE_TAB_ID;
          activeTabIdRef.current = validId;
          setActiveTabId(validId);
          workspace.getToolbox()?.clearSelection();
          setPaletteOpen(false);
          if (!readOnlyRef.current)
            workspace.updateToolbox(workspaceToolbox(validId,allowedBlocksRef.current));
          for (const block of workspace.getAllBlocks(false)) {
            const owner = tabForRoot(tabsRef.current, block.getRootBlock().id);
            block
              .getSvgRoot()
              ?.classList.toggle('capi-tab-hidden', owner !== validId);
          }
          if (center) window.requestAnimationFrame(() => workspace.zoomToFit());
          Blockly.svgResize(workspace);
        };
        showTabRef.current = refreshTabView;
        applyTabsRef.current = (
          candidate,
          recordUndo = true,
          reconcile = true,
        ) => {
          const next = reconcile
            ? reconcileWorkspaceTabs(
                candidate,
                workspace
                  .getTopBlocks(false)
                  .map((block) => ({ id: block.id, type: block.type })),
                activeTabIdRef.current,
              )
            : structuredClone(candidate);
          const previous = tabsRef.current;
          if (sameTabs(previous, next)) return;
          tabsRef.current = next;
          setTabs(next.tabs);
          const destination = next.tabs.some(
            (tab) => tab.id === activeTabIdRef.current,
          )
            ? activeTabIdRef.current
            : MAIN_WORKSPACE_TAB_ID;
          refreshTabView(destination, true);
          if (recordUndo)
            Blockly.Events.fire(
              createWorkspaceTabsChangeEvent(
                Blockly,
                workspace.id,
                previous,
                next,
                (state) => applyTabsRef.current(state, false, false),
              ),
            );
        };
        workspace.registerButtonCallback('CAPI_CHOOSE_FAVORITES', () =>
          onChooseFavoritesRef.current?.(),
        );
        workspace.registerButtonCallback('CAPI_CREATE_NUMBER', (button) =>
          Blockly.Variables.createVariableButtonHandler(
            button.getTargetWorkspace(),
            undefined,
            'Number',
          ),
        );
        workspace.registerButtonCallback('CAPI_CREATE_TEXT', (button) =>
          Blockly.Variables.createVariableButtonHandler(
            button.getTargetWorkspace(),
            undefined,
            'String',
          ),
        );
        workspace.registerButtonCallback('CAPI_CREATE_BOOLEAN', (button) =>
          Blockly.Variables.createVariableButtonHandler(
            button.getTargetWorkspace(),
            undefined,
            'Boolean',
          ),
        );
        workspace.registerButtonCallback('CAPI_CREATE_TIMER', (button) =>
          Blockly.Variables.createVariableButtonHandler(
            button.getTargetWorkspace(),
            undefined,
            'Timer',
          ),
        );
        workspace.registerToolboxCategoryCallback('CAPI_FAVORITES', () => [
          {
            kind: 'button',
            text: '☆ Elegir favoritos',
            callbackKey: 'CAPI_CHOOSE_FAVORITES',
          },
          ...(!favoritesRef.current.length
            ? [
                {
                  kind: 'label',
                  text: 'Marcá estrellas para agregar tus bloques.',
                },
              ]
            : []),
          ...favoritesRef.current
            .filter(
              (type) => validFavorite(type) && Boolean(Blockly.Blocks[type]),
            )
            .map((type) => ({ kind: 'block', type })),
        ]);
        workspaceDevices.set(workspace, devicesRef.current);
        workspaceBoardProfiles.set(workspace, boardProfileRef.current);
        try {
          loadWorkspaceData(Blockly, workspace, initialWorkspaceRef.current);
          tabsRef.current = normalizeWorkspaceTabs(initialWorkspaceRef.current);
          setTabs(tabsRef.current.tabs);
        } catch (error) {
          onErrorRef.current?.(readableLoadError(error));
        }
        configureBlockDragging();
        refreshTabView(MAIN_WORKSPACE_TAB_ID);
        refreshBlockAccessibility(workspace);
        setDetachedCount(workspace.getTopBlocks(false).filter(block => block.type !== 'capi_start' && !isRoutineDefinitionType(block.type)).length);
        appliedRevisionRef.current = revisionRef.current;
        onChangeRef.current(captureStableWorkspace());
        let workspaceChangePending = false;
        const publishWorkspaceChange = () => {
          changeTimerRef.current = null;
          if (workspace.isDragging()) {
            workspaceChangePending = true;
            return;
          }
          workspaceChangePending = false;
          refreshBlockAccessibility(workspace);
          setDetachedCount(workspace.getTopBlocks(false).filter(block => block.type !== 'capi_start' && !isRoutineDefinitionType(block.type)).length);
          onChangeRef.current(captureStableWorkspace());
          onHistoryChangeRef.current?.(historyState(workspace));
        };
        const scheduleWorkspaceChange = (delay = 180) => {
          if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
          changeTimerRef.current = setTimeout(publishWorkspaceChange, delay);
        };
        workspace.addChangeListener((event) => {
          if (event.type === Blockly.Events.TRASHCAN_OPEN) {
            workspace
              .getParentSvg()
              .querySelector('.blocklyTrash')
              ?.classList.toggle(
                'capi-trash-active',
                (event as import('blockly').Events.TrashcanOpen).isOpen ===
                  true,
              );
          }
          if (event.type === Blockly.Events.VIEWPORT_CHANGE)
            updateFixedFlyoutScale();
          if (readOnlyRef.current) return;
          if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT)
            setPaletteOpen(Boolean(workspace.getFlyout()?.isVisible()));
          if (event.type === Blockly.Events.BLOCK_DRAG) {
            if (!(event as import('blockly').Events.BlockDrag).isStart) {
              const droppedId = (event as import('blockly').Events.BlockDrag).blockId;
              window.requestAnimationFrame(() => {
                if (workspace.isDragging() || !droppedId) return;
                const dropped = workspace.getBlockById(droppedId);
                // Never separate a successful connection, an import or an undo.
                if (!dropped || dropped.getParent()) return;
                const owner = tabForRoot(tabsRef.current, dropped.id);
                const peers = workspace.getTopBlocks(false).filter(block => block.id !== dropped.id && tabForRoot(tabsRef.current, block.id) === owner);
                const delta = separatedBlockOffset(dropped.getBoundingRectangle(), peers.map(block => block.getBoundingRectangle()));
                if (!delta) return;
                const previousGroup = Blockly.Events.getGroup();
                Blockly.Events.setGroup(workspace.getUndoStack().at(-1)?.group || true);
                try { dropped.moveBy(0, delta); } finally { Blockly.Events.setGroup(previousGroup); }
              });
              workspace.getToolbox()?.clearSelection();
              if (dragConfigurationPending) configureBlockDraggingWhenIdle();
              if (workspaceChangePending || changeTimerRef.current) {
                scheduleWorkspaceChange(0);
              }
            }
            setPaletteOpen(Boolean(workspace.getFlyout()?.isVisible()));
          }
          if (event.isUiEvent) return;
          if (
            event.type === Blockly.Events.BLOCK_CREATE ||
            event.type === Blockly.Events.BLOCK_DELETE
          ) {
            const group = Blockly.Events.getGroup();
            Blockly.Events.setGroup(event.group || true);
            try {
              ensureSingleStart(Blockly, workspace);
            } catch (error) {
              onErrorRef.current?.(readableLoadError(error));
            } finally {
              Blockly.Events.setGroup(group);
            }
            if (dragConfigurationFrame !== undefined) {
              cancelAnimationFrame(dragConfigurationFrame);
            }
            dragConfigurationFrame = requestAnimationFrame(() => {
              configureBlockDraggingWhenIdle();
              const reconciled = reconcileWorkspaceTabs(
                tabsRef.current,
                workspace
                  .getTopBlocks(false)
                  .map((block) => ({ id: block.id, type: block.type })),
                activeTabIdRef.current,
              );
              if (!sameTabs(reconciled, tabsRef.current)) {
                tabsRef.current = reconciled;
                setTabs(reconciled.tabs);
              }
              refreshTabView(activeTabIdRef.current);
            });
          }
          if (event.type === Blockly.Events.BLOCK_MOVE && event.recordUndo) {
            onBlockSnapRef.current?.();
            window.requestAnimationFrame(() =>
              refreshTabView(activeTabIdRef.current),
            );
          }
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
              if (block) {
                refreshAreaField(block);
                refreshMessageField(block);
                updateDeviceWarning(block);
              }
            }
            if (
              change.element === 'field' &&
              change.name === AREA_FIELD &&
              change.blockId
            ) {
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
          scheduleWorkspaceChange();
        });
        activateKeyboardNavigation = (event: KeyboardEvent) => {
          if (event.key === 'Escape' && workspace.getFlyout()?.isVisible()) {
            workspace.getToolbox()?.clearSelection();
            setPaletteOpen(false);
          }
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
        deactivateOutsideEditor = (event: FocusEvent) => {
          if (event.target instanceof Node && !keyboardHost?.contains(event.target))
            deactivateKeyboardNavigation?.();
        };
        document.addEventListener('focusin', deactivateOutsideEditor, true);
        openCalledDefinition = (event: MouseEvent) => {
          const target =
            event.target instanceof Element
              ? event.target.closest<SVGElement>('[data-id]')
              : null;
          const block = target?.dataset.id
            ? workspace.getBlockById(target.dataset.id)
            : null;
          if (
            !block ||
            (block.type !== 'capi_procedure_call' &&
              !block.type.startsWith('capi_function_call_'))
          )
            return;
          const routineId = String(block.getFieldValue('ROUTINE') ?? '');
          const definition = workspace
            .getTopBlocks(false)
            .find(
              (candidate) =>
                isRoutineDefinitionType(candidate.type) &&
                String(candidate.getFieldValue('ROUTINE') ?? '') === routineId,
            );
          if (!definition) {
            onErrorRef.current?.(
              'Ese bloque llama a una definición que todavía no existe.',
            );
            return;
          }
          refreshTabView(tabForRoot(tabsRef.current, definition.id));
          window.requestAnimationFrame(() =>
            workspace.centerOnBlock(definition.id),
          );
        };
        keyboardHost.addEventListener('dblclick', openCalledDefinition);
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
        if (deactivateOutsideEditor) document.removeEventListener('focusin', deactivateOutsideEditor, true);
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
      if (keyboardHost && openCalledDefinition)
        keyboardHost.removeEventListener('dblclick', openCalledDefinition);
      resizeObserver?.disconnect();
      colorObserver?.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      if (dragConfigurationFrame !== undefined) {
        cancelAnimationFrame(dragConfigurationFrame);
      }
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      configureBlockDraggingRef.current = () => {};
      applyTabsRef.current = () => {};
      showTabRef.current = () => {};
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
    workspaceBoardProfiles.set(workspaceRef.current, boardProfileRef.current);
    try {
      loadWorkspaceData(
        blocklyRef.current,
        workspaceRef.current,
        initialWorkspaceRef.current,
      );
      tabsRef.current = normalizeWorkspaceTabs(initialWorkspaceRef.current);
      setTabs(tabsRef.current.tabs);
      showTabRef.current(MAIN_WORKSPACE_TAB_ID, true);
    } catch (error) {
      onErrorRef.current?.(readableLoadError(error));
      return;
    }
    configureBlockDraggingRef.current();
    appliedRevisionRef.current = revision;
    onChangeRef.current(captureStableWorkspace());
    refreshBlockAccessibility(workspaceRef.current);
    setDetachedCount(workspaceRef.current.getTopBlocks(false).filter(block => block.type !== 'capi_start' && !isRoutineDefinitionType(block.type)).length);
  }, [ready, revision]);

  useEffect(() => {
    if (!ready || !workspaceRef.current || !blocklyRef.current) return;
    workspaceDevices.set(workspaceRef.current, devicesRef.current);
    workspaceBoardProfiles.set(workspaceRef.current, boardProfile);
    boardProfileRef.current = boardProfile;
    if (refreshDeviceFields(blocklyRef.current, workspaceRef.current)) {
      refreshBlockAccessibility(workspaceRef.current);
      onChangeRef.current(captureStableWorkspace());
    }
  }, [boardProfile, deviceSignature, ready]);

  useImperativeHandle(
    ref,
    () => ({
      save() {
        if (!workspaceRef.current || !blocklyRef.current)
          return initialWorkspaceRef.current;
        return captureStableWorkspace();
      },
      load(data) {
        if (!workspaceRef.current || !blocklyRef.current) return;
        try {
          loadWorkspaceData(blocklyRef.current, workspaceRef.current, data);
          tabsRef.current = normalizeWorkspaceTabs(data);
          setTabs(tabsRef.current.tabs);
          showTabRef.current(MAIN_WORKSPACE_TAB_ID, true);
        } catch (error) {
          onErrorRef.current?.(readableLoadError(error));
          return;
        }
        configureBlockDraggingRef.current();
        onChangeRef.current(captureStableWorkspace());
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
        clearExecutionProgress(workspace, highlightedBlockIdsRef.current);
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
      },
      showExecution(tasks = []) {
        const workspace = workspaceRef.current;
        if (!workspace) return;
        highlightedBlockIdsRef.current = drawExecutionProgress(
          workspace,
          tasks,
          highlightedBlockIdsRef.current,
        );
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
        const block = workspace?.getBlockById(blockId);
        if (workspace && block && !workspace.isDragging()) {
          showTabRef.current(
            tabForRoot(tabsRef.current, block.getRootBlock().id),
          );
          window.requestAnimationFrame(() => workspace.centerOnBlock(blockId));
        }
      },
    }),
    [],
  );

  useEffect(() => {
    if (ready && !readOnlyRef.current)
      workspaceRef.current?.refreshToolboxSelection();
  }, [favorites, ready]);

  const createTab = () => {
    if (tabsRef.current.tabs.length >= MAX_WORKSPACE_TABS) {
      onErrorRef.current?.(
        `Podés usar hasta ${MAX_WORKSPACE_TABS - 1} pestañas además de Principal.`,
      );
      return;
    }
    const tab = {
      id: nextWorkspaceTabId(tabsRef.current.tabs),
      name: nextWorkspaceTabName(tabsRef.current.tabs),
      rootBlockIds: [] as string[],
    };
    applyTabsRef.current({ version: 1, tabs: [...tabsRef.current.tabs, tab] });
    showTabRef.current(tab.id, true);
    setEditingTabId(tab.id);
  };

  const renameTab = (tabId: string, name: string) => {
    const current = tabsRef.current.tabs.find((tab) => tab.id === tabId);
    if (!current) return;
    const nextName = cleanWorkspaceTabName(name, current.name);
    applyTabsRef.current({
      version: 1,
      tabs: tabsRef.current.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, name: nextName } : tab,
      ),
    });
    setEditingTabId(null);
  };

  const moveTab = (tabId: string, direction: -1 | 1) => {
    const next = [...tabsRef.current.tabs];
    const index = next.findIndex((tab) => tab.id === tabId);
    const destination = index + direction;
    if (index < 1 || destination < 1 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    applyTabsRef.current({ version: 1, tabs: next });
  };

  const deleteTab = (tabId: string) => {
    const workspace = workspaceRef.current;
    const Blockly = blocklyRef.current;
    const tab = tabsRef.current.tabs.find((item) => item.id === tabId);
    if (!workspace || !Blockly || !tab || tab.id === MAIN_WORKSPACE_TAB_ID)
      return;
    const routineIds = new Set(
      tab.rootBlockIds.flatMap((id) => {
        const block = workspace.getBlockById(id);
        const value = block ? String(block.getFieldValue('ROUTINE') ?? '') : '';
        return value ? [value] : [];
      }),
    );
    const used = workspace
      .getAllBlocks(false)
      .filter(
        (block) =>
          (block.type === 'capi_procedure_call' ||
            block.type.startsWith('capi_function_call_')) &&
          routineIds.has(String(block.getFieldValue('ROUTINE') ?? '')),
      ).length;
    const detail = tab.rootBlockIds.length
      ? ` También se borrarán ${tab.rootBlockIds.length} grupo${tab.rootBlockIds.length === 1 ? '' : 's'} de bloques${used ? `, con ${used} llamada${used === 1 ? '' : 's'} a sus procedimientos` : ''}.`
      : '';
    if (!window.confirm(`¿Borrar la pestaña «${tab.name}»?${detail}`)) return;
    const next = {
      version: 1 as const,
      tabs: tabsRef.current.tabs.filter((item) => item.id !== tabId),
    };
    Blockly.Events.setGroup(true);
    try {
      applyTabsRef.current(next, true, false);
      for (const id of tab.rootBlockIds)
        workspace.getBlockById(id)?.dispose(false);
    } finally {
      Blockly.Events.setGroup(false);
    }
    showTabRef.current(MAIN_WORKSPACE_TAB_ID, true);
  };
  const displayedActiveTabId = tabs.some((tab) => tab.id === activeTabId)
    ? activeTabId
    : MAIN_WORKSPACE_TAB_ID;

  return (
    <div className="blockly-shell" data-palette-open={paletteOpen}>
      <div
        className="program-tabs"
        role="tablist"
        aria-label="Secciones del programa"
      >
        {tabs.map((tab, index) => (
          <div className="program-tab-wrap" key={tab.id}>
            {editingTabId === tab.id && tab.id !== MAIN_WORKSPACE_TAB_ID ? (
              <EditableTabName
                name={tab.name}
                onDone={(name) => renameTab(tab.id, name)}
                onCancel={() => setEditingTabId(null)}
              />
            ) : (
              <button
                type="button"
                role="tab"
                aria-selected={displayedActiveTabId === tab.id}
                className="program-tab"
                onClick={() => showTabRef.current(tab.id, true)}
                onDoubleClick={() => {
                  if (tab.id !== MAIN_WORKSPACE_TAB_ID && !readOnly)
                    setEditingTabId(tab.id);
                }}
              >
                {tab.name}
              </button>
            )}
            {!readOnly &&
              displayedActiveTabId === tab.id &&
              tab.id !== MAIN_WORKSPACE_TAB_ID && (
                <span className="program-tab-actions">
                  <button
                    type="button"
                    onClick={() => moveTab(tab.id, -1)}
                    disabled={index <= 1}
                    aria-label={`Mover ${tab.name} a la izquierda`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTab(tab.id, 1)}
                    disabled={index >= tabs.length - 1}
                    aria-label={`Mover ${tab.name} a la derecha`}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTabId(tab.id)}
                    aria-label={`Cambiar nombre de ${tab.name}`}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTab(tab.id)}
                    aria-label={`Borrar ${tab.name}`}
                  >
                    ×
                  </button>
                </span>
              )}
          </div>
        ))}
        {!readOnly && (
          <button
            className="program-tab-add"
            type="button"
            onClick={createTab}
            aria-label="Agregar pestaña"
          >
            +
          </button>
        )}
      </div>
      {paletteOpen && (
        <button
          className="palette-close"
          type="button"
          onClick={() => {
            workspaceRef.current?.getToolbox()?.clearSelection();
            setPaletteOpen(false);
          }}
          aria-label="Cerrar catálogo de bloques"
        >
          Catálogo abierto · Cerrar ×
        </button>
      )}
      {!ready && <div className="editor-loading">Preparando los bloques…</div>}
      {detachedCount > 0 && <output className="detached-blocks-notice" aria-live="polite">{detachedCount} {detachedCount === 1 ? 'grupo fuera' : 'grupos fuera'} del programa · Conectalos para ejecutarlos.</output>}
      <p id="blockly-keyboard-help" className="visually-hidden">
        Usa Tab para recorrer el editor. Las flechas permiten navegar por los
        controles de Blockly.{' '}
        {readOnly
          ? 'Sólo lectura: no se pueden modificar los bloques.'
          : 'Al arrastrar se mueve sólo el bloque elegido; mantén Control, o Comando en Mac, para moverlo con los bloques siguientes. Control Z deshace y Control Y rehace.'}
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
        aria-label={
          readOnly
            ? 'Bloques de la versión, sólo lectura'
            : 'Editor visual de bloques'
        }
        aria-describedby="blockly-keyboard-help blockly-keyboard-status"
      />
    </div>
  );
});

export default memo(BlocklyWorkspace);
