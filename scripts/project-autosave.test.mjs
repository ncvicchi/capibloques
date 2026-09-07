import assert from 'node:assert/strict';
import { AutosaveSchedule } from '../lib/project-autosave.ts';

const clock = new AutosaveSchedule();
clock.observe(null, 'initial', true, 0);
assert.equal(
  clock.due(100000),
  false,
  'never creates a new project implicitly',
);
clock.observe('a', 'saved', false, 0);
clock.observe('a', 'edited', true, 100);
assert.equal(clock.due(1599), false);
assert.equal(clock.due(1600), true, 'debounce 1500 ms');
for (let i = 1; i <= 12; i++)
  clock.observe('a', `edit-${i}`, true, 100 + i * 800);
assert.equal(clock.due(10099), false);
assert.equal(
  clock.due(10100),
  true,
  'continuous edits are bounded to ten seconds',
);
clock.result(false, 10100);
clock.observe('a', 'edited-during-failure', true, 11000);
assert.equal(clock.due(15099), false);
assert.equal(clock.due(15100), true, 'editing does not defeat retry backoff');
clock.result(false, 15100);
assert.equal(clock.due(25099), false);
assert.equal(clock.due(25100), true);
clock.result(false, 25100);
assert.equal(clock.due(45099), false);
assert.equal(clock.due(45100), true);
clock.result(false, 45100);
assert.equal(clock.due(75099), false);
assert.equal(clock.due(75100), true);
clock.reconnect();
assert.equal(
  clock.due(45101),
  true,
  'network restoration may retry immediately',
);
clock.result(true, 50000);
clock.observe('a', 'later-edit', true, 50000);
assert.equal(clock.due(51499), false);
assert.equal(clock.due(51500), true, 'a second snapshot waits after the ACK');
clock.observe('a', 'later-edit', false, 52000);
clock.observe('a', 'after-idle', true, 1000000);
assert.equal(clock.due(1001499), false, 'idle time does not bypass debounce');
assert.equal(clock.due(1001500), true);
clock.observe('b', 'new-project', false, 1002000);
assert.equal(
  clock.due(2000000),
  false,
  'old schedule never moves to another project',
);
clock.observe('b', 'edit', true, 2000000);
clock.observe('b', 'new-project', false, 2000500);
assert.equal(
  clock.due(3000000),
  false,
  'undoing to saved state cancels the send',
);
console.log(
  'Autosave schedule: debounce, max wait, retry backoff and identity isolation passed.',
);
