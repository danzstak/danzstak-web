const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('assets/profile-editor.js', 'utf8');
const start = source.indexOf('const profileTabRoutes');
const end = source.indexOf('\n\nlet profileTabVersion', start);
assert.notEqual(start, -1, 'profile tab routes exist');
assert.notEqual(end, -1, 'profile tab route helper has a stable boundary');

function requested(hash) {
  const context = vm.createContext({ window: { location: { hash } }, Map });
  vm.runInContext(source.slice(start, end), context);
  return context.requestedProfileTab();
}

assert.equal(requested('#friends'), 'Friends');
assert.equal(requested('#media'), 'Media');
assert.equal(requested('#about'), 'About');
assert.equal(requested('#profileMain'), 'Posts', 'non-tab anchors safely fall back to Posts');
assert.equal(requested(''), 'Posts', 'fresh profiles retain the Posts default');
assert.match(source, /history\?\.replaceState\?\.\(null, "", "#" \+ name\.toLowerCase\(\)\)/,
  'selecting a profile tab updates its bookmarkable URL');
assert.match(source, /requested === "Memories" && profile\.isOwner !== true \? "Posts" : requested/,
  'another member cannot deep-link into private Memories');

console.log('Profile tab-route checks passed: sections are bookmarkable and private Memories remain protected.');
