import assert from 'node:assert/strict';
import { fittedCamera, zoomScene, constrainCamera } from '../lib/scene-camera.ts';
import { wemosContacts, physicalWemosLabel } from '../lib/wemos-board.ts';
import { wemosD1R32Pins } from '../lib/scene-model.ts';
import { watchPeriodicRefresh, SESSION_REFRESH_MS } from '../lib/session-polling.ts';

assert.deepEqual(zoomScene(fittedCamera, 2, { x: 20, y: 10 }), { zoom: 2, x: -20, y: -10 });
assert.deepEqual(zoomScene(zoomScene(fittedCamera, 2, { x: 20, y: 10 }), 1, { x: 20, y: 10 }), fittedCamera);
assert.equal(zoomScene(fittedCamera, 100, { x: 0, y: 0 }).zoom, 4);
assert.equal(zoomScene(fittedCamera, 0, { x: 0, y: 0 }).zoom, .25);
const bounded = constrainCamera({ zoom: 1, x: 99999, y: -99999 }, { width: 500, height: 300 }, { width: 640, height: 480 });
assert.equal(bounded.x, 402); assert.equal(bounded.y, -252);
assert.deepEqual(fittedCamera, { zoom: 1, x: 0, y: 0 });
for (const pin of wemosD1R32Pins) {
  const contacts = wemosContacts.filter(contact => contact.gpio === pin.gpio);
  assert.equal(contacts.length, 1, `one physical location for GPIO ${pin.gpio}`);
  assert.equal(contacts[0].alias, pin.label);
}
assert.equal(physicalWemosLabel(26), 'IO26');
assert.equal(physicalWemosLabel(35), 'IO35');
assert.equal(physicalWemosLabel(36), 'IO36');
assert.equal(physicalWemosLabel(999), undefined);
assert.equal(physicalWemosLabel(null), undefined);

const browser = new EventTarget(), documentMock = new EventTarget(), timers = new Map();
documentMock.visibilityState = 'visible';
let timerId = 0;
browser.setInterval = (fn, ms) => { assert.equal(ms, 60000); timers.set(++timerId, fn); return timerId; };
browser.clearInterval = id => timers.delete(id);
globalThis.window = browser; globalThis.document = documentMock;
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
let calls = 0, otherCalls = 0, release;
const stop = watchPeriodicRefresh(() => { calls++; return new Promise(resolve => { release = resolve; }); });
const stopOther = watchPeriodicRefresh(() => { otherCalls++; });
assert.equal(SESSION_REFRESH_MS, 60000); assert.equal(timers.size, 1);
browser.dispatchEvent(new Event('focus')); documentMock.dispatchEvent(new Event('visibilitychange'));
browser.dispatchEvent(new Event('pageshow')); await flush(); assert.equal(calls, 0);
timers.values().next().value(); await flush(); assert.equal(calls, 1); assert.equal(otherCalls, 1);
timers.values().next().value(); browser.dispatchEvent(new Event('online')); await flush(); assert.equal(calls, 1, 'no overlap while a periodic request is pending');
release(); await flush();
documentMock.visibilityState = 'hidden'; timers.values().next().value(); await flush(); assert.equal(calls, 1);
documentMock.visibilityState = 'visible'; documentMock.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(calls, 1);
const restored = new Event('pageshow'); restored.persisted = true; browser.dispatchEvent(restored); await flush(); assert.equal(calls, 2);
stop(); stopOther(); assert.equal(timers.size, 0); release(); await flush();
browser.dispatchEvent(new Event('online')); await flush(); assert.equal(calls, 2);
delete globalThis.window; delete globalThis.document;
console.log('Workbench: camera math and limits, all supported Wemos contacts, periodic cadence, hidden/focus/BFCache, request deduplication and cleanup passed.');
