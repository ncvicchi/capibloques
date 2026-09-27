export const MAIN_WORKSPACE_TAB_ID = 'main';
export const MAX_WORKSPACE_TABS = 12;
export const MAX_WORKSPACE_TAB_NAME = 24;

export interface WorkspaceTab {
  id: string;
  name: string;
  rootBlockIds: string[];
}

export interface WorkspaceTabsState {
  version: 1;
  tabs: WorkspaceTab[];
}

interface SerializedRoot {
  id?: unknown;
  type?: unknown;
}

function serializedRoots(workspace: Record<string, unknown>): SerializedRoot[] {
  const section = workspace.blocks;
  if (!section || typeof section !== 'object' || Array.isArray(section))
    return [];
  const blocks = (section as { blocks?: unknown }).blocks;
  return Array.isArray(blocks)
    ? blocks.filter(
        (item): item is SerializedRoot =>
          !!item && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
}

export function isRoutineDefinitionType(type: string) {
  return type === 'capi_procedure_def' || type.startsWith('capi_function_def_');
}

export function cleanWorkspaceTabName(value: string, fallback = 'Tab 1') {
  const cleaned = value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_WORKSPACE_TAB_NAME);
  return cleaned || fallback;
}

export function nextWorkspaceTabName(tabs: readonly WorkspaceTab[]) {
  const names = new Set(tabs.map((tab) => tab.name.toLocaleLowerCase('es')));
  let number = 1;
  while (names.has(`tab ${number}`)) number += 1;
  return `Tab ${number}`;
}

export function nextWorkspaceTabId(tabs: readonly WorkspaceTab[]) {
  const ids = new Set(tabs.map((tab) => tab.id));
  let number = 1;
  while (ids.has(`tab-${number}`)) number += 1;
  return `tab-${number}`;
}

export function normalizeWorkspaceTabs(
  workspace: Record<string, unknown>,
): WorkspaceTabsState {
  const roots = serializedRoots(workspace);
  const rootTypes = new Map(
    roots.flatMap((root) =>
      typeof root.id === 'string' && typeof root.type === 'string'
        ? [[root.id, root.type] as const]
        : [],
    ),
  );
  const raw = workspace.capiTabs;
  const rawTabs =
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Array.isArray((raw as { tabs?: unknown }).tabs)
      ? (raw as { tabs: unknown[] }).tabs
      : [];
  const tabs: WorkspaceTab[] = [
    { id: MAIN_WORKSPACE_TAB_ID, name: 'Principal', rootBlockIds: [] },
  ];
  const usedIds = new Set([MAIN_WORKSPACE_TAB_ID]);
  const assignedRoots = new Set<string>();
  for (const item of rawTabs) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const candidate = item as {
      id?: unknown;
      name?: unknown;
      rootBlockIds?: unknown;
    };
    if (
      typeof candidate.id !== 'string' ||
      candidate.id === MAIN_WORKSPACE_TAB_ID ||
      !/^tab-[a-z0-9-]{1,36}$/i.test(candidate.id) ||
      usedIds.has(candidate.id) ||
      tabs.length >= MAX_WORKSPACE_TABS
    )
      continue;
    const rootBlockIds = Array.isArray(candidate.rootBlockIds)
      ? candidate.rootBlockIds.filter(
          (id): id is string =>
            typeof id === 'string' &&
            rootTypes.has(id) &&
            !assignedRoots.has(id) &&
            isRoutineDefinitionType(rootTypes.get(id)!),
        )
      : [];
    rootBlockIds.forEach((id) => assignedRoots.add(id));
    tabs.push({
      id: candidate.id,
      name: cleanWorkspaceTabName(
        typeof candidate.name === 'string' ? candidate.name : '',
        nextWorkspaceTabName(tabs),
      ),
      rootBlockIds,
    });
    usedIds.add(candidate.id);
  }
  const definitions = [...rootTypes]
    .filter(
      ([id, type]) => isRoutineDefinitionType(type) && !assignedRoots.has(id),
    )
    .map(([id]) => id);
  if (definitions.length) {
    let destination = tabs[1];
    if (!destination && tabs.length < MAX_WORKSPACE_TABS) {
      destination = {
        id: nextWorkspaceTabId(tabs),
        name: nextWorkspaceTabName(tabs),
        rootBlockIds: [],
      };
      tabs.push(destination);
    }
    destination?.rootBlockIds.push(...definitions);
  }
  tabs[0].rootBlockIds = [...rootTypes]
    .filter(([, type]) => !isRoutineDefinitionType(type))
    .map(([id]) => id);
  return { version: 1, tabs };
}

export function reconcileWorkspaceTabs(
  state: WorkspaceTabsState,
  roots: readonly { id: string; type: string }[],
  preferredTabId = MAIN_WORKSPACE_TAB_ID,
): WorkspaceTabsState {
  const rootTypes = new Map(roots.map((root) => [root.id, root.type]));
  const tabs = state.tabs.map((tab) => ({
    ...tab,
    rootBlockIds: tab.rootBlockIds.filter((id) => rootTypes.has(id)),
  }));
  if (!tabs.length || tabs[0].id !== MAIN_WORKSPACE_TAB_ID)
    tabs.unshift({
      id: MAIN_WORKSPACE_TAB_ID,
      name: 'Principal',
      rootBlockIds: [],
    });
  tabs[0] = {
    ...tabs[0],
    name: 'Principal',
    rootBlockIds: roots
      .filter((root) => !isRoutineDefinitionType(root.type))
      .map((root) => root.id),
  };
  const assigned = new Set(tabs.slice(1).flatMap((tab) => tab.rootBlockIds));
  const missingDefinitions = roots.filter(
    (root) => isRoutineDefinitionType(root.type) && !assigned.has(root.id),
  );
  if (missingDefinitions.length) {
    let destination =
      preferredTabId === MAIN_WORKSPACE_TAB_ID
        ? undefined
        : tabs.find((tab) => tab.id === preferredTabId);
    destination ??= tabs[1];
    if (!destination && tabs.length < MAX_WORKSPACE_TABS) {
      destination = {
        id: nextWorkspaceTabId(tabs),
        name: nextWorkspaceTabName(tabs),
        rootBlockIds: [],
      };
      tabs.push(destination);
    }
    destination?.rootBlockIds.push(
      ...missingDefinitions.map((root) => root.id),
    );
  }
  return { version: 1, tabs: tabs.slice(0, MAX_WORKSPACE_TABS) };
}

export function saveWorkspaceTabs(
  workspace: Record<string, unknown>,
  state: WorkspaceTabsState,
) {
  return {
    ...workspace,
    capiTabs: {
      version: 1,
      tabs: state.tabs.map((tab) => ({
        id: tab.id,
        name: tab.name,
        rootBlockIds: [...tab.rootBlockIds],
      })),
    },
  };
}

export function tabForRoot(state: WorkspaceTabsState, rootBlockId: string) {
  return (
    state.tabs.find((tab) => tab.rootBlockIds.includes(rootBlockId))?.id ??
    MAIN_WORKSPACE_TAB_ID
  );
}
