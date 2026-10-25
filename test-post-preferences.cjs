const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('const changedPostPreferenceFields = '), source.indexOf('const hiddenPostKey = '));
function setup() {
  let saved = '{}';
  const requests = [];
  const context = vm.createContext({ postPreferencesKey: 'danzstak-post-preferences', post: { dataset: { postId: 'p1' } }, isLocalHost: () => false,
    localStorage: { getItem: () => saved, setItem: (_, value) => { saved = value; } },
    fetch: (_, options) => new Promise((resolve, reject) => requests.push({ resolve, reject, body: JSON.parse(options.body) })) });
  vm.runInContext(code, context);
  return { context, requests, saved: () => JSON.parse(saved) };
}
(async () => {
  const h = setup();
  const rejected = vm.runInContext('updatePostPreference(post, {saved:true})', h.context).catch(error => error);
  assert.deepEqual(h.saved(), {}, 'local state waits for server confirmation');
  h.requests[0].resolve({ ok: false });
  assert.match((await rejected).message, /could not be saved/);
  assert.deepEqual(h.saved(), {}, 'rejected save must not be cached as successful');
  const accepted = vm.runInContext('updatePostPreference(post, {saved:true})', h.context);
  h.requests[1].resolve({ ok: true }); await accepted;
  assert.equal(h.saved().p1.saved, true);
  const mute = vm.runInContext('updatePostPreference(post, {notificationsOff:true})', h.context);
  assert.equal(h.requests[2].body.preference, 'muted');
  h.requests[2].resolve({ ok: true }); await mute;
  assert.deepEqual(h.saved().p1, { saved: true, notificationsOff: true });
  h.context.current = h.saved().p1;
  const merged = vm.runInContext('mergeRemotePostPreferences("p1", current, { saved:new Set(), notificationsOff:new Set(), pinned:new Set(["p1"]) })', h.context);
  assert.equal(merged.saved, true, 'late initial settings cannot undo a confirmed save');
  assert.equal(merged.notificationsOff, true);
  assert.equal(merged.pinned, true, 'untouched settings still hydrate from the account');
  const disconnected = vm.runInContext('updatePostPreference(post, {pinned:true})', h.context).catch(error => error);
  h.requests[3].reject(new Error('Network offline')); await disconnected;
  assert.equal(h.saved().p1.pinned, undefined);
  console.log('Post preference checks passed: server confirmation, failure recovery, and preserving existing choices.');
})().catch(error => { console.error(error); process.exitCode = 1; });
