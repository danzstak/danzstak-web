const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const css = readFileSync(join(__dirname, 'assets/feed-enhancements.css'), 'utf8');
const feed = readFileSync(join(__dirname, 'feed.html'), 'utf8');

assert.match(source, /function renderOnlineFriendList\(list, users\)/, 'Friends has a dedicated online-user discovery list');
assert.match(source, /const online = users\.filter\(person => person\.online === true\)/, 'only currently online people appear in the discovery list');
assert.match(source, /action\.textContent = "Add Friend"/, 'an unconnected online member has one clear Add Friend action');
assert.match(source, /const requestTarget = \/\^\[a-f0-9-\]\{36\}\$\/\.test\(memberId\) \? \{ memberId \} : \{ email: person\.email \}/, 'online discovery uses an opaque member ID whenever available');
assert.match(source, /action\.textContent = "Accept"/, 'incoming requests can be accepted from the same list');
assert.match(source, /action\.textContent = "Requested"/, 'sent requests have an understandable state');
assert.match(source, /action\.textContent = person\.friendStatus === "friends" \? "Message" : "Tribe Message"/, 'existing connections can be messaged instead of receiving duplicate requests');
assert.match(source, /onlineHeading\.textContent = "Users online"/, 'the top Friends workspace section is named Users online');
assert.match(source, /friendsHeading\.textContent = "Your friends"/, 'accepted friends remain visible below discovery');
assert.doesNotMatch(source, /Add a friend by email/, 'ordinary users are not required to know account email addresses');
assert.match(css, /\.friend-discovery-list\{display:grid;/, 'online-user discovery uses a responsive compact grid');
assert.match(css, /\.friend-workspace-row\{grid-template-columns:minmax\(0,1fr\)\}\.friend-message-action\{width:100%;min-width:0\}/, 'mobile friend actions stack without clipping off screen');
assert.match(feed, /assets\/feed-enhancements\.css\?v=477/, 'the feed loads the current friend discovery styles');
assert.match(feed, /assets\/feed-enhancements\.js\?v=482/, 'the feed loads the current friend discovery behavior');

console.log('Friend discovery checks passed: the Friends button lists online users with one-tap relationship actions and no email lookup.');
