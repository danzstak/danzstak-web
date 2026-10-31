const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('feed.html', 'utf8');
const snapshotStart = source.indexOf('let peopleSnapshotPromise = null;');
const snapshotEnd = source.indexOf('async function loadOnlineUsers()', snapshotStart);
assert.ok(snapshotStart >= 0 && snapshotEnd > snapshotStart, 'shared people snapshot loader is missing');

let heartbeatLoads = 0;
let directoryLoads = 0;
let friendsLoads = 0;
const snapshotContext = vm.createContext({
  Promise,
  location: { replace() { throw new Error('unexpected redirect'); } },
  refreshPresenceHeartbeat: async () => { heartbeatLoads += 1; return { online: true, visible: true }; },
  fetchWithDeadline: async url => {
    if (url.endsWith('/calls/directory')) { directoryLoads += 1; return { ok: true, status: 200, json: async () => ({ users: [] }) }; }
    if (url.endsWith('/friends')) { friendsLoads += 1; return { ok: true, status: 200, json: async () => ({ friends: [] }) }; }
    throw new Error('unexpected URL');
  }
});
vm.runInContext(source.slice(snapshotStart, snapshotEnd), snapshotContext);

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
  const snapshotA = snapshotContext.loadPeopleSnapshot();
  const snapshotB = snapshotContext.loadPeopleSnapshot();
  assert.equal(snapshotA, snapshotB, 'friends and online users must share one in-flight snapshot');
  await Promise.all([snapshotA, snapshotB]);
  assert.equal(heartbeatLoads, 1);
  assert.equal(directoryLoads, 1, 'one refresh must make only one directory request');
  assert.equal(friendsLoads, 1, 'one refresh must make only one friends request');
  await snapshotContext.loadPeopleSnapshot();
  assert.equal(directoryLoads, 2, 'a completed refresh must permit one new directory request');
  assert.equal(friendsLoads, 2, 'a completed refresh must permit one new friends request');

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
  console.log('People refresh checks passed: friends and presence share one snapshot, avoid overlap, refresh again, and pause when hidden.');
})().catch(error => { console.error(error); process.exitCode = 1; });
