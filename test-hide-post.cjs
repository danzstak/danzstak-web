const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const start = source.indexOf('const hiddenPostKey = ');
const code = source.slice(start, source.indexOf('\nif (!isLocalHost()) fetch(', start));
let removed = false, cached = '[]';
const requests = [];
const context = vm.createContext({ post: { dataset: { postId: 'post-1' }, remove() { removed = true; } }, isLocalHost: () => false,
  localStorage: { getItem: () => cached, setItem: (_, value) => { cached = value; } },
  window: { dispatchEvent() {} }, CustomEvent: class {},
  fetch: () => new Promise(resolve => requests.push(resolve)) });
vm.runInContext(code, context);
(async () => {
  const failure = vm.runInContext('hidePostForAccount(post)', context).catch(error => error);
  assert.equal(removed, false, 'hiding waits for server acknowledgement');
  requests[0]({ ok: false });
  assert.match((await failure).message, /could not be hidden/);
  assert.equal(removed, false); assert.equal(cached, '[]');
  const success = vm.runInContext('hidePostForAccount(post)', context);
  requests[1]({ ok: true }); await success;
  assert.equal(removed, true);
  assert.deepEqual(JSON.parse(cached), ['post-1']);
  assert.equal(vm.runInContext('recentlyHiddenPostIds.has("post-1")', context), true);
  console.log('Hide post checks passed: failed account requests preserve the post; confirmed hides are cached.');
})().catch(error => { console.error(error); process.exitCode = 1; });
