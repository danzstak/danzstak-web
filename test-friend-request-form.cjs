const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const css = readFileSync(join(__dirname, 'assets/feed-enhancements.css'), 'utf8');
const feed = readFileSync(join(__dirname, 'feed.html'), 'utf8');

assert.match(source, /function renderOnlineFriendList\(list, users, presenceAvailable = true\)/, 'Friends has a dedicated online-user discovery list with an explicit availability state');
assert.match(source, /const online = users\.filter\(person => person\.online === true\)/, 'only currently online people appear in the discovery list');
assert.match(source, /action\.textContent = feedTranslate\("Add Friend"\)/, 'an unconnected online member has one clear localized Add Friend action');
assert.match(source, /const labelAction = template => action\.setAttribute\("aria-label", template\.replace\("\{name\}", displayName\)\)/, 'every repeated friend action receives a member-specific accessible name');
for (const label of ["Message {name}", "Message {name} from your Tribe", "Accept friend request from {name}", "Accepting friend request from {name}", "Send friend request to {name}", "Sending friend request to {name}", "Friend request sent to {name}.", "Friends with {name}"])
  assert.ok(source.includes(`"${label}"`), `friend action state must identify the affected member: ${label}`);
assert.match(source, /const requestTarget = \/\^\[a-f0-9-\]\{36\}\$\/\.test\(memberId\) \? \{ memberId \} : \{ email: person\.email \}/, 'online discovery uses an opaque member ID whenever available');
assert.match(source, /action\.textContent = feedTranslate\("Accept"\)/, 'incoming requests can be accepted from the same localized list');
assert.match(source, /action\.textContent = feedTranslate\("Requested"\)/, 'sent requests have an understandable localized state');
assert.match(source, /action\.textContent = feedTranslate\(person\.friendStatus === "friends" \? "Message" : "Tribe Message"\)/, 'existing connections can be messaged instead of receiving duplicate requests');
assert.match(source, /onlineHeading\.textContent = feedTranslate\("Users online"\)/, 'the top Friends workspace section has a localized Users online heading');
assert.match(source, /friendsHeading\.textContent = feedTranslate\("Your friends"\)/, 'accepted friends remain visible below a localized heading');
assert.doesNotMatch(source, /Add a friend by email/, 'ordinary users are not required to know account email addresses');
assert.match(css, /\.friend-discovery-list\{display:grid;/, 'online-user discovery uses a responsive compact grid');
assert.match(source, /message\.dataset\.icon = "chat"/, 'the friend message action uses the shared recognizable Chat icon');
assert.match(source, /message\.title = `\$\{feedTranslate\("Message"\)\}: \$\{displayName\.textContent\}`/, 'the compact friend message action keeps a descriptive desktop tooltip');
assert.match(css, /\.friend-workspace-row\{grid-template-columns:minmax\(0,1fr\) 44px\}/, 'mobile friend rows reserve one compact action column instead of creating a second row');
assert.match(css, /\.friend-message-action,.friend-message-action\.ds-icon-button\{width:44px;min-width:44px;min-height:44px;/, 'the compact friend message control keeps a usable mobile touch target');
assert.match(feed, /assets\/feed-enhancements\.css\?v=490/, 'the feed loads the current friend discovery styles');
assert.match(feed, /assets\/feed-enhancements\.js\?v=521/, 'the feed loads the current localized friend discovery behavior');

console.log('Friend discovery checks passed: the Friends button lists online users with one-tap relationship actions and no email lookup.');
