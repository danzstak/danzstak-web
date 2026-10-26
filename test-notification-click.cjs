const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'service-worker.js'), 'utf8');
async function click(clients, action = '', type = 'notification', url = '/messages.html?contact=test%40example.com', callId = '') {
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
  assert.match((await click([stale]))[0], /messages.html/);
  assert.match((await click([{ ...live, navigate: async () => null }]))[0], /messages.html/);
  let nestedTouched = false;
  assert.match((await click([{ ...live, frameType: 'nested', focus: async () => { nestedTouched = true; } }]))[0], /messages.html/);
  assert.equal(nestedTouched, false);
  assert.deepEqual(await click([], 'dismiss', 'call'), []);
  assert.equal(new URL((await click([], '', 'call'))[0]).searchParams.has('answer'), false);
  assert.equal(new URL((await click([], 'answer', 'call'))[0]).searchParams.get('answer'), '1');
  assert.equal(new URL((await click([], 'answer', 'call', '/messages.html?contact=test%40example.com', 'selected-call'))[0]).searchParams.get('callId'), 'selected-call');
  console.log('Notification click checks passed: focus order, stale windows, nested frames, app opening, and call actions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
