const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/push-notifications.js', 'utf8');
const start = source.indexOf('async function withDeadline(');
const end = source.indexOf('async function state()', start);
assert.ok(start >= 0 && end > start, 'push deadline helpers are missing');

const timers = [];
let cleared = 0;
class AbortController {
  constructor() {
    const listeners = [];
    this.signal = { addEventListener(type, fn) { if (type === 'abort') listeners.push(fn); } };
    this.abort = () => listeners.forEach(fn => fn());
  }
}
const context = vm.createContext({
  API: 'https://api.danzstak.com',
  AbortController,
  setTimeout(fn) { timers.push(fn); return timers.length; },
  clearTimeout() { cleared++; },
  fetch(url, options) {
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
      const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
    }));
  }
});
vm.runInContext(source.slice(start, end), context);

(async () => {
  const request = vm.runInContext('api("/push/key")', context);
  timers[0]();
  await assert.rejects(request, /setup took too long/);
  assert.equal(cleared, 1, 'push API deadline must be cleared after failure');
  for (const required of [
    'withDeadline(navigator.serviceWorker.ready, 10000',
    'withDeadline(registration.pushManager.getSubscription(), 10000',
    'withDeadline(registration.pushManager.subscribe({',
    'signal: controller.signal'
  ]) assert.ok(source.includes(required), `Push operation bypasses deadline recovery: ${required}`);
  console.log('Push network checks passed: API, service-worker, status, and subscription operations are bounded.');
})().catch(error => { console.error(error); process.exitCode = 1; });
