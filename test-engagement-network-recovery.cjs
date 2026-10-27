const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const start = source.indexOf('async function engagementFetch');
const end = source.indexOf('async function loadEngagement(post)');
assert.ok(start >= 0 && end > start, 'engagement request helper must exist');

let timerCallback;
let timeoutCleared = false;
class AbortController {
  constructor() {
    const listeners = [];
    this.signal = { addEventListener: (name, callback) => { if (name === 'abort') listeners.push(callback); } };
    this.abort = () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      for (const callback of listeners) callback(error);
    };
  }
}

const context = vm.createContext({
  engagementApi: 'https://api.danzstak.com',
  AbortController,
  setTimeout: callback => { timerCallback = callback; return 7; },
  clearTimeout: id => { assert.equal(id, 7); timeoutCleared = true; },
  fetch: (_, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  })
});
vm.runInContext(source.slice(start, end), context);

(async () => {
  const request = vm.runInContext('engagementFetch("/comments", { method: "POST" })', context).catch(error => error);
  timerCallback();
  const error = await request;
  assert.match(error.message, /taking too long to update this post/i);
  assert.equal(timeoutCleared, true, 'request timeout must always be cleared');
  assert.match(source, /engagementFetch\(`\/engagement\?postId=/);
  assert.match(source, /engagementFetch\("\/reactions"/);
  assert.match(source, /engagementFetch\("\/comments"/);
  assert.match(source, /engagementFetch\(`\/comments\/\$\{encodeURIComponent\(commentId\)\}/);
  assert.doesNotMatch(source, /fetch\(`\$\{engagementApi\}\/(?:engagement|reactions|comments)/);
  console.log('Engagement recovery checks passed: post actions time out cleanly and all core paths use the guarded request helper.');
})().catch(error => { console.error(error); process.exitCode = 1; });
