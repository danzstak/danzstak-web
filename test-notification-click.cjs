const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'service-worker.js'), 'utf8');
async function click(clients, action = '', type = 'notification', url = '/messages.html?member=11111111-1111-1111-1111-111111111111', callId = '') {
  const handlers = {}, calls = [];
  const self = { location: { origin: 'https://danzstak.com' }, addEventListener: (name, handler) => { handlers[name] = handler; },
    clients: { matchAll: async () => clients, openWindow: async destination => { calls.push(destination); return { focus: async () => { calls.push('opened:focus'); } }; } } };
  vm.runInNewContext(source, { self, URL });
  let pending;
  handlers.notificationclick({ action, notification: { data: { url, type, callId }, close() {} }, waitUntil: promise => { pending = promise; } });
  await pending;
  return calls;
}
(async () => {
  const order = [];
  const live = { url: 'https://danzstak.com/feed.html', frameType: 'top-level', focus: async () => order.push('focus'), navigate: async () => { order.push('navigate'); return live; } };
  assert.deepEqual(await click([live]), []);
  assert.deepEqual(order, ['focus', 'navigate']);
  const stale = { ...live, focus: async () => { throw new Error('Closed window'); } };
  assert.match((await click([stale]))[0], /\/sync\/\?member=/, 'task 34: SYNC notifications open SYNC (/sync/), the installed SYNC app when there is one');
  assert.match((await click([{ ...live, navigate: async () => null }]))[0], /\/sync\/\?member=/);
  let nestedTouched = false;
  assert.match((await click([{ ...live, frameType: 'nested', focus: async () => { nestedTouched = true; } }]))[0], /\/sync\/\?member=/);
  assert.equal(nestedTouched, false);
  // Task 34: an open SYNC window is reused before any other DanzStak window; other destinations are left as they are.
  const used = [];
  const feedWindow = { ...live, focus: async () => used.push('feed'), navigate: async () => feedWindow };
  const syncWindow = { ...live, url: 'https://danzstak.com/sync/?app=sync', focus: async () => used.push('sync'), navigate: async destination => { used.push(destination); return syncWindow; } };
  assert.deepEqual(await click([feedWindow, syncWindow]), []);
  assert.deepEqual(used, ['sync', 'https://danzstak.com/sync/?member=11111111-1111-1111-1111-111111111111']);
  assert.equal((await click([], '', 'notification', '/feed.html#notifications'))[0], 'https://danzstak.com/feed.html#notifications');
  assert.deepEqual(await click([], 'dismiss', 'call'), []);
  assert.equal(new URL((await click([], '', 'call'))[0]).searchParams.has('answer'), false);
  assert.equal(new URL((await click([], 'answer', 'call'))[0]).searchParams.get('answer'), '1');
  assert.equal(new URL((await click([], 'answer', 'call', '/messages.html?member=11111111-1111-1111-1111-111111111111', 'selected-call'))[0]).searchParams.get('callId'), 'selected-call');
  console.log('Notification click checks passed: focus order, stale windows, nested frames, app opening, and call actions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
