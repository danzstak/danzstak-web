const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('feed.html', 'utf8');
const start = source.indexOf('let peopleRefreshPromise = null;');
const end = source.indexOf('loadPosts();', start);
assert.ok(start >= 0 && end > start, 'people refresh coordinator is missing');

let onlineLoads = 0;
let friendLoads = 0;
let release;
const pending = () => new Promise(resolve => { release = resolve; });
let onlineResult = pending();
let friendResult = Promise.resolve();
const context = vm.createContext({
  document: { hidden: false },
  loadOnlineUsers: () => { onlineLoads += 1; return onlineResult; },
  loadFriends: () => { friendLoads += 1; return friendResult; },
  Promise
});
vm.runInContext(source.slice(start, end), context);

(async () => {
  const first = context.refreshPeopleLists();
  const overlapping = context.refreshPeopleLists();
  assert.equal(first, overlapping, 'overlapping refresh triggers must share one request cycle');
  assert.equal(onlineLoads, 1);
  assert.equal(friendLoads, 1);

  release();
  await first;
  onlineResult = Promise.resolve();
  await context.refreshPeopleLists();
  assert.equal(onlineLoads, 2, 'a completed cycle must allow the next refresh');
  assert.equal(friendLoads, 2);

  context.document.hidden = true;
  await context.refreshPeopleLists();
  assert.equal(onlineLoads, 2, 'hidden tabs must not poll presence');
  assert.equal(friendLoads, 2, 'hidden tabs must not poll friends');
  console.log('People refresh checks passed: friends and presence initialize together, avoid overlap, refresh again, and pause when hidden.');
})().catch(error => { console.error(error); process.exitCode = 1; });
