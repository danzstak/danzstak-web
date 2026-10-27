const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

async function verify(file, startText, endText, invocation, expectedMessage) {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf(startText), end = source.indexOf(endText, start);
  assert.ok(start >= 0 && end > start, `${file} request helper must exist`);
  let timerCallback, cleared = false;
  class AbortController {
    constructor() {
      const listeners = [];
      this.signal = { addEventListener: (name, callback) => { if (name === 'abort') listeners.push(callback); } };
      this.abort = () => listeners.forEach(callback => callback());
    }
  }
  const context = vm.createContext({
    AbortController,
    setTimeout: callback => { timerCallback = callback; return 4; },
    clearTimeout: id => { assert.equal(id, 4); cleared = true; },
    fetch: (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
      const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
    }))
  });
  vm.runInContext(source.slice(start, end), context);
  const request = vm.runInContext(invocation, context).catch(error => error);
  timerCallback();
  const error = await request;
  if (expectedMessage) assert.match(error.message, expectedMessage);
  else assert.equal(error.name, 'AbortError');
  assert.equal(cleared, true, `${file} must clear its timeout`);
  return source;
}

(async () => {
  const sharing = await verify('assets/post-sharing.js', 'async function shareFetch', 'window.danzstakSharePost', 'shareFetch("/secure-posts")', /Sharing took too long/);
  assert.match(sharing, /await shareFetch\('\/secure-posts'/);
  const tags = await verify('assets/media-tags.js', 'async function tagFetch', 'async function patch', 'tagFetch("/friends")', /Tagging took too long/);
  assert.match(tags, /await tagFetch\('\/secure-posts\/'/); assert.match(tags, /await tagFetch\('\/friends'/);
  const views = await verify('assets/post-views.js', 'async function viewFetch', 'function countLabel', 'viewFetch("/post-views")');
  assert.match(views, /await viewFetch\('\/post-views'/);
  const support = await verify('assets/support.js', 'async function supportFetch', 'message.addEventListener', 'supportFetch()', /Support took too long/);
  assert.match(support, /const response=await supportFetch/);
  console.log('Social action network checks passed: sharing, tags, views, and support recover from stalled requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
