const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('function refreshFeedMediaWorkspace(records)'), source.lastIndexOf('new MutationObserver(records => {'));
const feed = {}, eventList = {}, savedList = {};
const featurePanel = { hidden: false, querySelector: selector => selector === '.saved-posts' ? savedList : eventList }, featureHeading = { textContent: 'Events' }, rendered = [];
let eventRefreshes = 0, savedRefreshes = 0;
const context = vm.createContext({
  featurePanel, featureHeading, document: { getElementById: () => feed }, renderWorkspace: name => rendered.push(name),
  renderPublishedEvents: list => { assert.equal(list, eventList); eventRefreshes++; },
  renderSavedPosts: list => { assert.equal(list, savedList); savedRefreshes++; }
});
vm.runInContext(code, context);
context.changes = [{ target: feed, addedNodes: [{}], removedNodes: [] }];

vm.runInContext('refreshFeedMediaWorkspace(changes)', context);
assert.equal(eventRefreshes, 1, 'late feed results refresh the published events list');
assert.equal(rendered.length, 0, 'feed refresh does not erase an event draft');

featureHeading.textContent = 'Saved';
vm.runInContext('refreshFeedMediaWorkspace(changes)', context);
assert.equal(savedRefreshes, 1, 'late feed results refresh Saved');

// Audit A10 (2026-11-19): Photos and Videos are the member's own media on their profile, never a gallery of other
// members' Mix posts, so feed updates never rebuild them here.
for (const name of ['Photos', 'Videos']) {
  featureHeading.textContent = name;
  vm.runInContext('refreshFeedMediaWorkspace(changes)', context);
}
assert.equal(rendered.length, 0, 'Photos and Videos are not rebuilt from Mix posts');

featureHeading.textContent = 'Events'; featurePanel.hidden = true;
vm.runInContext('refreshFeedMediaWorkspace(changes)', context);
assert.equal(eventRefreshes, 1, 'hidden workspaces are not rebuilt');
featurePanel.hidden = false;
context.changes = [{ target: {}, addedNodes: [{}], removedNodes: [] }];
vm.runInContext('refreshFeedMediaWorkspace(changes)', context);
assert.equal(eventRefreshes, 1, 'comments and reactions do not reset a workspace');

featurePanel.dataset = { workspaceName: 'Events' }; featureHeading.textContent = '이벤트';
context.changes = [{ target: feed, addedNodes: [{}], removedNodes: [] }];
vm.runInContext('refreshFeedMediaWorkspace(changes)', context);
assert.equal(eventRefreshes, 2, 'a translated heading still refreshes the right workspace');

// The Photos/Videos workspace hands over to the member's own profile tabs.
assert.match(source, /if \(\["Photos", "Videos"\]\.includes\(name\)\) \{[\s\S]{0,400}location\.replace\(`profile\.html#\$\{name\.toLowerCase\(\)\}`\)/, 'Menu Photos/Videos open your own profile tabs');
assert.doesNotMatch(source, /document\.querySelectorAll\("#feed \.post \.post-media"\)\]\.filter\(item => item\.tagName === wantedTag\)/, 'Photos/Videos must not copy media out of everyone\'s Mix posts');
console.log('Feed media checks passed: Events and Saved refresh with late posts, Photos and Videos are your own profile media.');
