const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/feed-enhancements.js', 'utf8');
const start = source.indexOf('async function groupFetch(');
const end = source.indexOf('async function migrateLocalGroups', start);
assert.ok(start >= 0 && end > start, 'deadline-protected group request helper is missing');

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
  const request = vm.runInContext('groupFetch("/groups")', context);
  deadline();
  await assert.rejects(request, /group service took too long/);
  assert.equal(cleared, 1, 'group deadline must be cleared after failure');
  for (const required of ['groupFetch("/groups"', 'groupFetch("/groups/membership"', 'groupFetch("/reports"', 'Retry Group Service', 'createButton.dataset.mode === "retry"']) {
    assert.ok(source.includes(required), `Group operation bypasses recovery: ${required}`);
  }
  console.log('Group network checks passed: group actions are bounded and failed initial loading exposes Retry Group Service.');
})().catch(error => { console.error(error); process.exitCode = 1; });
