const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/feed-enhancements.js', 'utf8');
const start = source.indexOf('async function postActionFetch(');
const end = source.indexOf('const changedPostPreferenceFields', start);
assert.ok(start >= 0 && end > start, 'deadline-protected post action helper is missing');

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
  const request = vm.runInContext('postActionFetch("/secure-posts/example", {method:"DELETE"})', context);
  deadline();
  await assert.rejects(request, /taking too long/);
  assert.equal(cleared, 1, 'post-action deadline must be cleared after failure');
  for (const required of [
    'postActionFetch("/settings/posts"',
    'postActionFetch("/secure-posts/" + encodeURIComponent(postId)'
  ]) assert.ok(source.includes(required), `Post action bypasses recovery helper: ${required}`);
  assert.equal(source.includes('fetch("https://api.danzstak.com/secure-posts/" + encodeURIComponent(postId)'), false);
  console.log('Post network checks passed: edit, privacy, policy, delete, hide, and preferences use bounded requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
