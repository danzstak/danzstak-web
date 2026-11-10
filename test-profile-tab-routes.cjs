const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('assets/profile-editor.js', 'utf8');
const start = source.indexOf('const profileTabRoutes');
const end = source.indexOf('let profileTabVersion = 0', start);
assert.notEqual(start, -1, 'profile tab routes exist');
assert.notEqual(end, -1, 'profile tab route helper has a stable boundary');

function requested(hash) {
  const context = vm.createContext({ window: { location: { hash } }, Map });
  vm.runInContext(source.slice(start, end), context);
  return context.requestedProfileTab();
}

assert.equal(requested('#photos'), 'Photos');
assert.equal(requested('#videos'), 'Videos');
assert.equal(requested('#friends'), 'More', 'legacy Friends links open the familiar More menu');
assert.equal(requested('#media'), 'More', 'legacy Media links open the familiar More menu');
assert.equal(requested('#about'), 'About');
assert.equal(requested('#profileMain'), 'Posts', 'non-tab anchors safely fall back to Posts');
assert.equal(requested(''), 'Posts', 'fresh profiles retain the Posts default');
assert.match(source, /history\?\.replaceState\?\.\(null, "", "#" \+ \(requestedMoreSection \|\| name\)\.toLowerCase\(\)\)/,
  'selecting a profile tab updates its bookmarkable URL');
assert.match(source, /requested === "More" && requestedProfileMoreSection\(\) === "Memories" && profile\.isOwner !== true\) target = "Posts"/,
  'another member cannot deep-link into private Memories');

console.log('Profile tab-route checks passed: the five profile tabs are bookmarkable, legacy links resolve through More, and private Memories remain protected.');
