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
assert.equal(requested('#friends'), 'Friends', 'Friends is its own profile tab, like Facebook (owner 2026-11-16)');
assert.equal(requested('#media'), 'Posts', 'retired Media links fall back to Posts');
assert.equal(requested('#memories'), 'Posts', 'retired Memories links fall back to Posts');
assert.equal(requested('#shop'), 'More', 'shop links open the Shop tab');
assert.equal(requested('#about'), 'About');
assert.equal(requested('#profileMain'), 'Posts', 'non-tab anchors safely fall back to Posts');
assert.equal(requested(''), 'Posts', 'fresh profiles retain the Posts default');
assert.match(source, /history\?\.replaceState\?\.\(null, "", "#" \+ \(requestedMoreSection \|\| name\)\.toLowerCase\(\)\)/,
  'selecting a profile tab updates its bookmarkable URL');
assert.doesNotMatch(source, /\["Featured", \.\.\./, 'Featured and Memories are removed from the profile (owner 2026-11-16)');
assert.doesNotMatch(source, /nameEditHint\.hidden = false/, 'no "tap your name" instruction is shown');

console.log('Profile tab-route checks passed: Posts/About/Friends/Photos/Videos(/Shop) are bookmarkable, retired Featured/Memories/Media links fall back safely, no name-edit hint.');
