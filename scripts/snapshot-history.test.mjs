import assert from 'node:assert/strict';
import {
  commitSnapshot,
  createSnapshotHistory,
  finishSnapshotGroup,
  redoSnapshot,
  replacePresentSnapshot,
  undoSnapshot,
} from '../lib/snapshot-history.ts';

let history = createSnapshotHistory({ value: 0, selected: 'a' }, 3);
history = commitSnapshot(history, { value: 1, selected: 'a' });
history = commitSnapshot(history, { value: 2, selected: 'a' });
assert.equal(undoSnapshot(history).present.value, 1);

history = undoSnapshot(history);
history = redoSnapshot(history);
assert.equal(history.present.value, 2);

history = commitSnapshot(
  history,
  { value: 3, selected: 'a' },
  { group: 'drag' },
);
history = commitSnapshot(
  history,
  { value: 4, selected: 'a' },
  { group: 'drag' },
);
history = finishSnapshotGroup(history);
assert.equal(undoSnapshot(history).present.value, 2, 'a drag is one undo step');

const stepsBeforeSelection = history.past.length;
history = replacePresentSnapshot(history, {
  ...history.present,
  selected: 'b',
});
assert.equal(
  history.past.length,
  stepsBeforeSelection,
  'selection does not create an undo step',
);

history = commitSnapshot(history, { value: 5, selected: 'b' });
history = commitSnapshot(history, { value: 6, selected: 'b' });
history = commitSnapshot(history, { value: 7, selected: 'b' });
history = commitSnapshot(history, { value: 8, selected: 'b' });
assert.equal(history.past.length, 3, 'history respects its configured limit');

console.log('snapshot history tests passed');
