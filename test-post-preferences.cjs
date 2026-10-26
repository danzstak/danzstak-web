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
    postActionFetch: (_, options) => new Promise((resolve, reject) => requests.push({ resolve, reject, body: JSON.parse(options.body) })) });
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
  h.context.localStorage.setItem = () => { throw new Error('quota exceeded'); };
  const noStorage = vm.runInContext('updatePostPreference(post, {saved:false})', h.context);
  h.requests[4].resolve({ok:true}); await noStorage;
  assert.equal(vm.runInContext('readPostPreferences().p1.saved',h.context),false,'confirmed state overrides stale disk cache after quota failure');
  h.context.localStorage.getItem = () => { throw new Error('storage blocked'); };
  assert.equal(vm.runInContext('readPostPreferences().p1.notificationsOff',h.context),true,'confirmed preferences remain available without browser storage');
  const hydrateStart = source.indexOf('if (!isLocalHost()) postActionFetch("/settings/posts"');
  const hydrateCode = source.slice(hydrateStart,source.indexOf('function openPostReportDialog(',hydrateStart));
  let hiddenApplied=0;
  Object.assign(h.context, {
    hiddenPostIds:new Set(),recentlyHiddenPostIds:new Set(),hiddenPostKey:'hidden',
    postActionFetch:async()=>({ok:true,json:async()=>({hidden:['hidden1'],saved:['p2','notLoadedYet']})}),
    document:{querySelectorAll:()=>[{dataset:{postId:'p2'},querySelector:()=>null}]},
    applyHiddenPosts:()=>hiddenApplied++,addPostDeleteButton:()=>{},
    window:{dispatchEvent:()=>{}},CustomEvent:class {},featurePanel:{querySelector:()=>null,hidden:false}
  });
  await vm.runInContext(hydrateCode,h.context);
  assert.equal(hiddenApplied,1,'hidden posts still apply when caching account settings fails');
  assert.equal(h.context.hiddenPostIds.has('hidden1'),true);
  assert.equal(vm.runInContext('readPostPreferences().p2.saved',h.context),true,'initial account choices remain readable with blocked storage');
  assert.equal(vm.runInContext('readPostPreferences().notLoadedYet.saved',h.context),true,'account preferences hydrate before the corresponding feed cards arrive');
  console.log('Post preference checks passed: server confirmation, failure recovery, and preserving existing choices.');
})().catch(error => { console.error(error); process.exitCode = 1; });
