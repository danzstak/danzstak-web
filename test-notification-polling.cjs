const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('async function refreshNotificationCount()'), source.indexOf('function readSections()'));
const requests = [], counts = [], document = { hidden: true };
const context = vm.createContext({ document, AbortController, setTimeout, clearTimeout, readSections: () => ({}),
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
  console.log('Notification polling checks passed: hidden tabs, overlap prevention, and failure recovery.');
})().catch(error => { console.error(error); process.exitCode = 1; });
