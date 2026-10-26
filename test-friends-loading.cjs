const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('  if (name === "Friends") {'), source.indexOf('  if (["Photos", "Videos"].includes(name)) {'));
const nodes = [];
function node(tag) {
  const item = { tag, children: [], append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); }, replaceChildren() { this.children = []; }, setAttribute() {} };
  nodes.push(item); return item;
}
vm.runInNewContext(`function render(){const name = "Friends"; ${code}} render();`, {
  document: { createElement: node }, workspace: node('workspace'), featureText: {}, createFriendRequestForm: () => node('form'),
  fetch: async url => {
    if (url.endsWith('/calls/directory')) throw new Error('Presence unavailable');
    return { ok: true, json: async () => ({ friends: [{ email: 'friend@example.com', memberId: '44444444-4444-4444-4444-444444444444', name: 'Existing Friend' }] }) };
  }
});
setImmediate(() => {
  try {
    assert.equal(nodes.filter(item => item.tag === 'a').length, 1, 'presence failure must not hide accepted friends');
    assert.equal(nodes.find(item => item.tag === 'a').href, 'profile.html?member=44444444-4444-4444-4444-444444444444');
    assert.doesNotMatch(nodes.find(item => item.tag === 'a').href, /@|%40/);
    assert.ok(nodes.some(item => item.tag === 'small' && item.textContent === 'Status unavailable'), 'presence failure must not falsely label a friend offline');
    console.log('Friends loading check passed: accepted friends survive a failed presence lookup without a false offline status.');
  } catch (error) { console.error(error); process.exitCode = 1; }
});
