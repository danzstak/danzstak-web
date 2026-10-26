const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const joinCode = source.slice(source.indexOf('        join.addEventListener("click", async () => {'), source.indexOf('        card.append(category, title, description);'));
const listStart = source.indexOf('    groupFetch("/groups/membership"');
const listCode = source.slice(listStart, source.indexOf('\n    return;', listStart));
async function scenario(initiallyJoined, staleGroupIds) {
  const requests = [], saved = { GroupsJoined: { group1: initiallyJoined } };
  let click;
  const button = { disabled: false, classList: { toggle() {} }, addEventListener: (_, handler) => { click = handler; } };
  const context = vm.createContext({ saved, group: { id: 'group1' }, membershipChanges: new Map(), join: button, writeSections() {}, renderGroups() {},
    alert: message => { throw new Error(message); }, groupFetch: () => new Promise(resolve => requests.push(resolve)) });
  vm.runInContext(listCode, context);
  vm.runInContext(joinCode, context);
  const mutation = click();
  requests[1]({ ok: true }); await mutation;
  requests[0]({ ok: true, json: async () => ({ groupIds: staleGroupIds }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(saved.GroupsJoined.group1, !initiallyJoined, 'late initial data cannot undo a confirmed membership change');
  assert.equal(button.disabled, false);
}
(async () => {
  await scenario(false, []);
  await scenario(true, ['group1']);
  console.log('Group membership checks passed: delayed initial responses preserve confirmed joins and leaves.');
})().catch(error => { console.error(error); process.exitCode = 1; });
