const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/session-activity.js', 'utf8');
const timeouts = [];
const intervals = [];
const calls = [];
const events = [];
let presenceAttempts = 0;

class AbortController {
  constructor() {
    const listeners = [];
    this.signal = { addEventListener(type, fn) { if (type === 'abort') listeners.push(fn); } };
    this.abort = () => listeners.splice(0).forEach(fn => fn());
  }
}

function fetch(url, options) {
  calls.push(url);
  if (url.endsWith('/calls/presence')) presenceAttempts++;
  if (presenceAttempts > 1 && url.endsWith('/calls/presence')) return Promise.resolve({ ok: true, status: 200 });
  return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    reject(error);
  }));
}

const context = vm.createContext({
  AbortController,
  CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
  Date,
  document: { hidden: false, addEventListener() {} },
  location: { replace() {} },
  fetch,
  setTimeout(fn) { timeouts.push(fn); return timeouts.length; },
  clearTimeout() {},
  setInterval(fn) { intervals.push(fn); return intervals.length; },
  addEventListener() {},
  dispatchEvent(event) { events.push(event.type); }
});

vm.runInContext(source, context);
(async () => {
  assert.equal(presenceAttempts, 1, 'initial presence heartbeat must run');
  timeouts.splice(0).forEach(fn => fn());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(intervals.length, 2, 'session and presence retry intervals must be installed');
  await intervals[1]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(presenceAttempts, 2, 'a timed-out heartbeat must release its lock for the next retry');
  assert.deepEqual(events, ['danzstak-presence-updated']);
  assert.ok(calls.some(url => url.endsWith('/auth/refresh')));
  console.log('Presence heartbeat checks passed: stalled requests abort, release their locks, and recover on retry.');
})().catch(error => { console.error(error); process.exitCode = 1; });
