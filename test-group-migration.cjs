const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('async function migrateLocalGroups('), source.indexOf('function renderWorkspace(name)'));
const requested = [];
const locals = ['Already synced', 'Upload succeeds', 'Offline group', 'Rejected group', 'Incomplete response', 'Same name, other owner'].map((name, i) => ({ id: `local-${i}`, name, category: 'Artists' }));
const context = vm.createContext({ locals, remote: [{ id: 'remote-1', name: 'Already synced', category: 'Artists', cloud: true, isOwner: true }, { id: 'someone-elses', name: 'Same name, other owner', category: 'Artists', cloud: true, isOwner: false }],
  groupFetch: async (_, options) => {
    const body = JSON.parse(options.body); requested.push(body.name);
    if (body.name === 'Offline group') throw new Error('Offline');
    return { ok: body.name !== 'Rejected group', json: async () => body.name === 'Upload succeeds' ? { group: { id: 'remote-2', name: body.name, category: body.category } } : {} };
  } });
vm.runInContext(code, context);
(async () => {
  const result = await vm.runInContext('migrateLocalGroups(locals, remote)', context);
  assert.equal(requested.includes('Already synced'), false, 'existing cloud groups are not duplicated');
  assert.equal(result.groups.length, 3);
  assert.equal(result.joinedIds[0], 'remote-2');
  assert.deepEqual(Array.from(result.pending, group => group.name), ['Offline group', 'Rejected group', 'Incomplete response', 'Same name, other owner']);
  assert.equal(requested.includes('Same name, other owner'), true, 'another member owning a same-named group cannot discard the local group');
  assert.equal(locals.length, 6, 'original local data is not mutated');
  console.log('Group migration checks passed: confirmed uploads migrate; failed groups remain available for retry.');
})().catch(error => { console.error(error); process.exitCode = 1; });
