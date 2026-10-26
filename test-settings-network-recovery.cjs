const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/feed-enhancements.js', 'utf8');
const start = source.indexOf('async function settingsFetch(');
const end = source.indexOf('const heading =', start);
assert.ok(start >= 0 && end > start, 'deadline-protected settings request helper is missing');

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
  const request = vm.runInContext('settingsFetch({method:"POST"})', context);
  deadline();
  await assert.rejects(request, /settings took too long/);
  assert.equal(cleared, 1, 'settings deadline must be cleared after failure');
  assert.ok(source.includes('button.dataset.mode = "retry"'));
  assert.ok(source.includes('if (button.dataset.mode === "retry") { renderWorkspace("Settings"); return; }'));
  console.log('Settings network checks passed: stalled loads and saves abort into the existing retry flow.');
})().catch(error => { console.error(error); process.exitCode = 1; });
