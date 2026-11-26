const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'service-worker.js'), 'utf8');
// Chrome gives a notification tap ONE window-interaction allowance, and WindowClient.focus() and clients.openWindow()
// both spend it (a second one is refused with "Not allowed to open a window"). The stand-ins below share that allowance.
let allowance = true;
const spend = what => { if (!allowance) throw new Error(`InvalidAccessError: Not allowed to ${what}`); allowance = false; };
async function click(clients, action = '', type = 'notification', url = '/messages.html?member=11111111-1111-1111-1111-111111111111', callId = '', userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36') {
  const handlers = {}, calls = [];
  allowance = true;
  const self = { location: { origin: 'https://danzstak.com' }, navigator: { userAgent }, addEventListener: (name, handler) => { handlers[name] = handler; },
    clients: { matchAll: async () => clients, openWindow: async destination => { spend('open a window'); calls.push(destination); return { focus: async () => { calls.push('opened:focus'); } }; } } };
  vm.runInNewContext(source, { self, URL, setTimeout });
  let pending;
  handlers.notificationclick({ action, notification: { data: { url, type, callId }, close() {} }, waitUntil: promise => { pending = promise; } });
  await pending;
  return calls;
}
(async () => {
  const order = [];
  const live = { url: 'https://danzstak.com/feed.html', frameType: 'top-level', focus: async () => { spend('focus a window'); order.push('focus'); return live; }, navigate: async () => { order.push('navigate'); return live; } };
  assert.deepEqual(await click([live]), []);
  assert.deepEqual(order, ['navigate', 'focus'], 'the window takes the address first; only then is it brought forward');
  const stale = { ...live, navigate: async () => { throw new Error('Closed window'); } };
  assert.match((await click([stale]))[0], /\/sync\/\?member=/, 'task 34: SYNC notifications open SYNC (/sync/), the installed SYNC app when there is one');
  assert.match((await click([{ ...live, navigate: async () => null }]))[0], /\/sync\/\?member=/);
  let nestedTouched = false;
  assert.match((await click([{ ...live, frameType: 'nested', focus: async () => { nestedTouched = true; } }]))[0], /\/sync\/\?member=/);
  assert.equal(nestedTouched, false);
  // Task 34: an open SYNC window is reused before any other DanzStak window; other destinations are left as they are.
  const used = [];
  const feedWindow = { ...live, focus: async () => used.push('feed'), navigate: async () => { used.push('feed:navigate'); return feedWindow; } };
  const syncWindow = { ...live, url: 'https://danzstak.com/sync/?app=sync', focus: async () => { spend('focus a window'); used.push('sync'); return syncWindow; }, navigate: async destination => { used.push(destination); return syncWindow; } };
  assert.deepEqual(await click([feedWindow, syncWindow]), []);
  assert.deepEqual(used, ['https://danzstak.com/sync/?member=11111111-1111-1111-1111-111111111111', 'sync']);
  assert.equal((await click([], '', 'notification', '/feed.html#notifications'))[0], 'https://danzstak.com/feed.html#notifications');
  assert.deepEqual(await click([], 'dismiss', 'call'), []);
  assert.equal(new URL((await click([], '', 'call'))[0]).searchParams.has('answer'), false);
  assert.equal(new URL((await click([], 'answer', 'call'))[0]).searchParams.get('answer'), '1');
  assert.equal(new URL((await click([], 'answer', 'call', '/messages.html?member=11111111-1111-1111-1111-111111111111', 'selected-call'))[0]).searchParams.get('callId'), 'selected-call');
  // Owner 2026-11-19: on a phone, a tap must open the app, not navigate a window in the background nobody can see.
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
  const behind = [];
  const hidden = { ...live, visibilityState: 'hidden', focused: false, focus: async () => { spend('focus a window'); behind.push('focus'); return hidden; }, navigate: async () => { behind.push('navigate'); return hidden; } };
  assert.match((await click([hidden], '', 'notification', undefined, '', ANDROID))[0], /^https:\/\/danzstak\.com\/sync\/\?member=/, 'phone, app in the background: opens the app at SYNC');
  assert.deepEqual(behind, [], 'the background window is not navigated behind the home screen');
  const onScreen = { ...live, visibilityState: 'visible', focused: true, focus: async () => { spend('focus a window'); behind.push('focus'); return onScreen; }, navigate: async () => { behind.push('navigate'); return onScreen; } };
  assert.deepEqual(await click([onScreen], '', 'notification', undefined, '', ANDROID), [], 'phone, app on screen: reused');
  assert.deepEqual(behind, ['navigate', 'focus']);
  // Owner 2026-11-26, a SYNC notification "does not open the app": a window on screen that can't take the address (a page
  // the worker doesn't control, or one that just closed) must not spend the tap's one go; the app opens at SYNC instead.
  for (const [name, navigate] of [['not controlled by the worker', async () => { throw new TypeError('This service worker is not the client\'s active service worker.'); }], ['gone', async () => null]]) {
    behind.length = 0;
    const cantTake = { ...onScreen, navigate, focus: async () => { spend('focus a window'); behind.push('focus'); return cantTake; } };
    const phoneTap = await click([cantTake], '', 'notification', undefined, '', ANDROID);
    assert.match(phoneTap[0] || '', /^https:\/\/danzstak\.com\/sync\/\?member=/, `phone, window on screen ${name}: the app still opens at SYNC (${phoneTap.join(' ')})`);
    assert.deepEqual(behind, [], `phone, window on screen ${name}: not focused, so the tap is still there to open the app`);
    const desktopTap = await click([{ ...cantTake, visibilityState: 'hidden', focused: false }]);
    assert.match(desktopTap[0] || '', /\/sync\/\?member=/, `computer, window ${name}: SYNC opens in a new window (${desktopTap.join(' ')})`);
  }
  assert.match((await click([hidden], 'answer', 'call', undefined, 'call-1', ANDROID))[0], /\/sync\/\?member=.*answer=1.*callId=call-1/, 'Accept on a phone opens SYNC straight into the call');
  // A step that never answers falls back to opening the app.
  const hung = { ...live, focus: () => new Promise(() => {}), navigate: () => new Promise(() => {}) };
  assert.match((await click([hung]))[0], /\/sync\/\?member=/, 'a hung window never swallows the tap');
  const started = Date.now();
  assert.match((await click([hung, hung, hung, hung]))[0], /\/sync\/\?member=/, 'several hung windows: still opens');
  assert.ok(Date.now() - started < 3200, `windows stop being tried after 2.5 s so the app still opens (${Date.now() - started} ms)`);
  console.log('Notification click checks passed: a window takes the address before it is focused (one tap = one focus or one open), a window that can\'t take it never swallows the tap, windows are tried for at most 2.5 s, focus order, stale windows, nested frames, app opening, call actions; on a phone a background window is never navigated out of sight (the app opens instead), and a hung window falls back to opening the app.');
})().catch(error => { console.error(error); process.exitCode = 1; });
