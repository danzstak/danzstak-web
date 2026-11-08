const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const css = readFileSync(join(__dirname, 'assets/feed-enhancements.css'), 'utf8');
const feed = readFileSync(join(__dirname, 'feed.html'), 'utf8');

assert.match(source, /function renderOnlineFriendList\(list, users, presenceAvailable = true\)/, 'Friends has a dedicated online-user discovery list with an explicit availability state');
assert.match(source, /const online = users\.filter\(person => person\.online === true\)/, 'only currently online people appear in the discovery list');
assert.match(source, /action\.textContent = feedTranslate\("Add Friend"\)/, 'an unconnected online member has one clear localized Add Friend action');
assert.match(source, /const labelAction = template => \{[\s\S]*feedFormat\(template, \{ name: displayName \}\)[\s\S]*action\.setAttribute\("aria-label", label\)/, 'every repeated friend action receives a localized member-specific accessible name');
for (const label of ["Message {name}", "Message {name} from your Tribe", "Accept friend request from {name}", "Accepting friend request from {name}", "Send friend request to {name}", "Sending friend request to {name}", "Friend request sent to {name}.", "Friends with {name}"])
  assert.ok(source.includes(`"${label}"`), `friend action state must identify the affected member: ${label}`);
assert.match(source, /const requestTarget = \/\^\[a-f0-9-\]\{36\}\$\/\.test\(memberId\) \? \{ memberId \} : \{ email: person\.email \}/, 'online discovery uses an opaque member ID whenever available');
assert.match(source, /action\.textContent = feedTranslate\("Accept"\)/, 'incoming requests can be accepted from the same localized list');
assert.match(source, /action\.textContent = feedTranslate\("Requested"\)/, 'sent requests have an understandable localized state');
assert.match(source, /action\.textContent = feedTranslate\(person\.friendStatus === "friends" \? "Message" : "Tribe Message"\)/, 'existing connections can be messaged instead of receiving duplicate requests');
assert.match(source, /\["all", "All friends"\], \["online", "Online"\], \["requests", "Requests"\], \["find", "Find friends"\]/, 'Friends provides one compact set of truthful directory tabs');
assert.match(source, /window\.danzstakMountPeopleFinder\?\.\(finderHost, \{ compact: true, searchInput: search \}\)/, 'member discovery reuses the single Friends search field');
assert.doesNotMatch(source, /Add a friend by email/, 'ordinary users are not required to know account email addresses');
assert.match(css, /\.friends-workspace-list\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(280px,1fr\)\)/, 'the unified directory uses a responsive compact grid');
assert.match(source, /message\.dataset\.icon = "chat"/, 'the friend message action uses the shared recognizable Chat icon');
assert.match(source, /message\.title = message\.getAttribute\("aria-label"\)/, 'the compact friend message action keeps a descriptive desktop tooltip');
assert.match(css, /\.friend-workspace-row\{position:relative;display:grid;grid-template-columns:minmax\(0,1fr\) auto/, 'friend rows reserve one compact action column instead of creating a second row');
assert.match(css, /\.friend-workspace-actions\{display:flex;align-items:center;gap:6px;flex-wrap:nowrap\}/, 'friend actions stay together without wrapping');
assert.match(css, /\.friend-message-action,.friend-message-action\.ds-icon-button\{width:44px;min-width:44px;min-height:44px;/, 'the compact message control keeps a usable mobile touch target');
assert.match(feed, /assets\/feed-enhancements\.css\?v=504/, 'the feed loads the current friend discovery styles');
assert.match(css, /@media\(max-width:700px\)\{\.friend-discovery-row button\.ds-icon-button\{width:44px;min-width:44px;height:44px;min-height:44px\}\}/, 'online-user Chat icons keep a full phone touch target');
assert.match(feed, /assets\/feed-enhancements\.js\?v=536/, 'the feed loads the current localized friend discovery behavior');
assert.match(source, /action\.dataset\.icon = "chat";[\s\S]*labelAction\(person\.friendStatus === "friends" \? "Message \{name\}"/, 'accepted online users use the same accessible Chat icon as saved friends');

console.log('Friend discovery checks passed: the Friends button lists online users with one-tap relationship actions and no email lookup.');
