const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'service-worker.js'), 'utf8');
async function click(clients, action = '', type = 'notification', url = '/messages.html?member=11111111-1111-1111-1111-111111111111', callId = '', userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36') {
  const handlers = {}, calls = [];
  const self = { location: { origin: 'https://danzstak.com' }, navigator: { userAgent }, addEventListener: (name, handler) => { handlers[name] = handler; },
    clients: { matchAll: async () => clients, openWindow: async destination => { calls.push(destination); return { focus: async () => { calls.push('opened:focus'); } }; } } };
  vm.runInNewContext(source, { self, URL, setTimeout });
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
  // Owner 2026-11-19: on a phone, a tap must open the app, not navigate a window in the background nobody can see.
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
  const behind = [];
  const hidden = { ...live, visibilityState: 'hidden', focused: false, focus: async () => behind.push('focus'), navigate: async () => { behind.push('navigate'); return hidden; } };
  assert.match((await click([hidden], '', 'notification', undefined, '', ANDROID))[0], /^https:\/\/danzstak\.com\/sync\/\?member=/, 'phone, app in the background: opens the app at SYNC');
  assert.deepEqual(behind, [], 'the background window is not navigated behind the home screen');
  const onScreen = { ...live, visibilityState: 'visible', focused: true, focus: async () => behind.push('focus'), navigate: async () => { behind.push('navigate'); return onScreen; } };
  assert.deepEqual(await click([onScreen], '', 'notification', undefined, '', ANDROID), [], 'phone, app on screen: reused');
  assert.deepEqual(behind, ['focus', 'navigate']);
  assert.match((await click([hidden], 'answer', 'call', undefined, 'call-1', ANDROID))[0], /\/sync\/\?member=.*answer=1.*callId=call-1/, 'Accept on a phone opens SYNC straight into the call');
  // A step that never answers falls back to opening the app.
  const hung = { ...live, focus: () => new Promise(() => {}), navigate: () => new Promise(() => {}) };
  assert.match((await click([hung]))[0], /\/sync\/\?member=/, 'a hung window never swallows the tap');
  console.log('Notification click checks passed: focus order, stale windows, nested frames, app opening, call actions; on a phone a background window is never navigated out of sight (the app opens instead), and a hung window falls back to opening the app.');
})().catch(error => { console.error(error); process.exitCode = 1; });
