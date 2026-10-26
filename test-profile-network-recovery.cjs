const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/profile-editor.js', 'utf8');
const start = source.indexOf('async function profileFetch(');
const end = source.indexOf('let viewingOtherProfile', start);
assert.ok(start >= 0 && end > start, 'deadline-protected profile request helper is missing');

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
  const request = vm.runInContext('profileFetch("https://api.danzstak.com/profiles")', context);
  deadline();
  await assert.rejects(request, /taking too long/);
  assert.equal(cleared, 1, 'profile deadline must be cleared after failure');
  assert.equal((source.match(/\bfetch\(/g) || []).length, 1, 'profile requests must use the single guarded fetch helper');
  assert.ok(source.includes('Math.max(120000, Math.ceil(file.size / (64 * 1024)) * 1000)'), 'upload deadline must scale with file size');
  console.log('Profile network checks passed: profile operations are bounded and large uploads receive adaptive time.');
})().catch(error => { console.error(error); process.exitCode = 1; });
