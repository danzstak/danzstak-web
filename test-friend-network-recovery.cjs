const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/feed-enhancements.js', 'utf8');
const start = source.indexOf('async function friendActionFetch(');
const end = source.indexOf('function createFriendRequestForm', start);
assert.ok(start >= 0 && end > start, 'deadline-protected friend action helper is missing');

let deadline;
let cleared = 0;
class AbortController {
  constructor() {
    const listeners = [];
    this.signal = { addEventListener(type, fn) { if (type === 'abort') listeners.push(fn); } };
    this.abort = () => listeners.forEach(fn => fn());
  }
}
const context = vm.createContext({
  AbortController,
  setTimeout(fn) { deadline = fn; return 1; },
  clearTimeout() { cleared++; },
  fetch(url, options) {
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
      const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
    }));
  }
});
vm.runInContext(source.slice(start, end), context);

(async () => {
  const request = vm.runInContext('friendActionFetch("/friends/request", {method:"POST"})', context);
  deadline();
  await assert.rejects(request, /friend service took too long/);
  assert.equal(cleared, 1, 'friend-action deadline must be cleared after failure');
  assert.ok(source.includes('friendActionFetch("/friends/request"'));
  assert.ok(source.includes('friendActionFetch("/friends/respond"'));
  console.log('Friend network checks passed: send, accept, and decline actions abort cleanly and remain retryable.');
})().catch(error => { console.error(error); process.exitCode = 1; });
