const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/feed-enhancements.js', 'utf8');
const start = source.indexOf('async function reelFetch(');
const end = source.indexOf('let internalReelsVersion', start);
assert.ok(start >= 0 && end > start, 'deadline-protected reel request helper is missing');

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
  const request = vm.runInContext('reelFetch("/stories")', context);
  deadline();
  await assert.rejects(request, /taking too long/);
  assert.equal(cleared, 1, 'reel deadline must be cleared after a failed request');
  for (const required of [
    'reelFetch("/stories", { method: "POST"',
    'reelFetch("/stories/" + encodeURIComponent(reel.id)',
    'reelFetch("/stories", { credentials: "include", cache: "no-store" }'
  ]) assert.ok(source.includes(required), `Reel request bypasses recovery helper: ${required}`);
  console.log('Reel network checks passed: media operations use bounded requests and recover after timeout.');
})().catch(error => { console.error(error); process.exitCode = 1; });
