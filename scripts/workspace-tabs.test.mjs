import assert from 'node:assert/strict';
import {
  MAIN_WORKSPACE_TAB_ID,
  cleanWorkspaceTabName,
  nextWorkspaceTabId,
  nextWorkspaceTabName,
  normalizeWorkspaceTabs,
  reconcileWorkspaceTabs,
  saveWorkspaceTabs,
  tabForRoot,
} from '../lib/workspace-tabs.ts';

const legacy = {
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: 'capi_start', id: 'start-1', x: 10, y: 10 },
      { type: 'capi_procedure_def', id: 'definition-1', x: 400, y: 10 },
      { type: 'capi_function_def_number', id: 'definition-2', x: 400, y: 200 },
    ],
  },
};
const migrated = normalizeWorkspaceTabs(legacy);
assert.equal(migrated.tabs[0].id, MAIN_WORKSPACE_TAB_ID);
assert.deepEqual(migrated.tabs[0].rootBlockIds, ['start-1']);
assert.deepEqual(migrated.tabs[1].rootBlockIds, [
  'definition-1',
  'definition-2',
]);
assert.equal(migrated.tabs[1].name, 'Tab 1');
const saved = saveWorkspaceTabs(legacy, migrated);
assert.equal(
  tabForRoot(normalizeWorkspaceTabs(saved), 'definition-2'),
  'tab-1',
);
assert.equal(cleanWorkspaceTabName('   mover   robot   '), 'mover robot');
assert.equal(
  nextWorkspaceTabName([
    ...migrated.tabs,
    { id: 'tab-2', name: 'Tab 2', rootBlockIds: [] },
  ]),
  'Tab 3',
);
assert.equal(
  nextWorkspaceTabId([
    ...migrated.tabs,
    { id: 'tab-2', name: 'Otra', rootBlockIds: [] },
  ]),
  'tab-3',
);
const custom = {
  version: 1,
  tabs: [
    migrated.tabs[0],
    { id: 'tab-mover', name: 'Movimientos', rootBlockIds: ['definition-1'] },
  ],
};
const reconciled = reconcileWorkspaceTabs(
  custom,
  [
    { id: 'start-1', type: 'capi_start' },
    { id: 'definition-1', type: 'capi_procedure_def' },
    { id: 'definition-3', type: 'capi_function_def_text' },
    { id: 'loose-action', type: 'capi_wait' },
  ],
  'tab-mover',
);
assert.deepEqual(reconciled.tabs[0].rootBlockIds, ['start-1', 'loose-action']);
assert.deepEqual(reconciled.tabs[1].rootBlockIds, [
  'definition-1',
  'definition-3',
]);
console.log(
  'Pestañas del programa: migración, nombres y asignación de definiciones OK',
);
