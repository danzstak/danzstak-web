const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('async function refreshNotificationCount()'), source.indexOf('function readSections()'));
const requests = [], counts = [], document = { hidden: true };
let settings = {};
const context = vm.createContext({ document, AbortController, setTimeout, clearTimeout, readSections: () => settings,
  notificationSourceCounts: { social: null, engagement: null }, updateNotificationCount: count => counts.push(count),
  fetch: (_, options) => new Promise((resolve, reject) => {
    requests.push({ resolve, reject }); options.signal.addEventListener('abort', () => reject(new Error('Timed out')));
  }) });
vm.runInContext('let notificationCountLoading = false;' + code, context);
(async () => {
  await vm.runInContext('refreshNotificationCount()', context);
  assert.equal(requests.length, 0, 'hidden tabs do not poll badges');
  document.hidden = false;
  const first = vm.runInContext('refreshNotificationCount()', context);
  await vm.runInContext('refreshNotificationCount()', context);
  assert.equal(requests.length, 2, 'slow refreshes cannot overlap');
  requests[0].resolve({ ok: true, json: async () => ({ notifications: [{}] }) });
  requests[1].resolve({ ok: true, json: async () => ({ notifications: [{ unread: true }, { unread: false }] }) });
  await first; assert.equal(counts.at(-1), 2);
  const retry = vm.runInContext('refreshNotificationCount()', context);
  requests[2].reject(new Error('Offline')); requests[3].reject(new Error('Offline'));
  await retry;
  assert.equal(vm.runInContext('notificationCountLoading', context), false, 'network failure releases the refresh guard');
  assert.equal(counts.at(-1), 2, 'failed requests preserve the last known count');
  settings = { Settings: { notifications: false } };
  await vm.runInContext('refreshNotificationCount()', context);
  assert.equal(counts.at(-1), 0, 'turning badges off clears the visible count');
  assert.equal(vm.runInContext('JSON.stringify(notificationSourceCounts)', context), '{"social":0,"engagement":0}', 'turning badges off clears stale source counts');
  settings = {};
  const enabled = vm.runInContext('refreshNotificationCount()', context);
  requests[4].resolve({ ok: true, json: async () => ({ notifications: [{}, {}, {}] }) });
  requests[5].reject(new Error('Engagement offline'));
  await enabled;
  assert.equal(counts.at(-1), 3, 're-enabling after a partial failure must not resurrect an old source count');
  console.log('Notification polling checks passed: hidden tabs, overlap prevention, failure recovery, and preference resets.');
})().catch(error => { console.error(error); process.exitCode = 1; });
