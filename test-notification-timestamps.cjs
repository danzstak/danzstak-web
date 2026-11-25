const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('assets/feed-enhancements.js', 'utf8');
const kit = readFileSync('assets/notifications.js', 'utf8');

// Times: the one time label (B4) on every row, "2h" / "3d" / "Nov 16", never a full date and clock.
assert.match(kit, /window\.danzstakTimeLabel\?\.paint\(stamp, time\)/, 'notification times use the shared relative time label');
assert.match(kit, /stamp\.dateTime = time/, 'the machine-readable time stays on the element');
assert.doesNotMatch(source.slice(source.indexOf('if (name === "Notifications")'), source.indexOf('if (name === "Friends")')) + kit, /toLocaleString\(\[\], \{ dateStyle: "medium", timeStyle: "short" \}\)/, 'no "Nov 16, 2026, 2:36 AM" notification times');

// Sentences: the name in bold inside one running sentence.
const nodes = [];
const fakeDocument = { createElement: tag => { const el = { tag, children: [], className: '', append(...items) { this.children.push(...items); }, set textContent(value) { this.text = value; } }; nodes.push(el); return el; } };
const context = vm.createContext({ window: {}, document: fakeDocument });
vm.runInContext(kit, context);
const sentence = context.window.danzstakNotifications.sentence('{name} commented: {preview}', { name: 'Sleeping Dragon', preview: 'Loud!' });
assert.deepEqual(sentence.children.map(child => typeof child === 'string' ? child : `<${child.tag}>${child.text}`), ['<strong>Sleeping Dragon', ' commented: ', 'Loud!'], 'only the name is bold');

const notificationBlock = source.slice(source.indexOf('if (name === "Notifications")'), source.indexOf('if (name === "Friends")'));
assert.match(notificationBlock, /time: notice\.createdAt/);
assert.match(notificationBlock, /const displayName = person\?\.name \|\| feedTranslate\("DanzStak member"\)/);
assert.match(notificationBlock, /notice\.memberId[\s\S]*name: notice\.name[\s\S]*picture: notice\.picture/, 'engagement notifications should use public profile identity returned by the API');
assert.match(notificationBlock, /REACTION_NOTIFICATION_TEMPLATES\[String\(notice\.preview \|\| ""\)\.trim\(\)\]/);
assert.match(notificationBlock, /fetch\("https:\/\/api\.danzstak\.com\/friends"/, 'notification identities should include accepted-friend profile data');
assert.match(notificationBlock, /picture: person\.picture \|\| known\.picture/, 'online directory data must not erase a saved friend photo');
assert.match(notificationBlock, /const profileHref = memberId \? `profile\.html\?member=\$\{encodeURIComponent\(memberId\)\}`/, 'notification avatars should open opaque member-profile URLs');
assert.doesNotMatch(notificationBlock, /profile\.html\?email=/, 'notification profiles must never expose account emails in URLs');
assert.match(notificationBlock, /profileLabel: feedFormat\("Open \{name\} profile", \{ name: displayName \}\)/, 'the avatar link names its member');
assert.match(notificationBlock, /`\$\{feedTranslate\(label\)\}: \$\{displayName\}`/, 'Accept / Decline name their member');
assert.match(kit, /target\.setAttribute\("aria-label", text\.textContent\.trim\(\)\)/, 'the whole-row target reads the full sentence');
assert.doesNotMatch(notificationBlock, /String\(notice\.email \|\| "DanzStak member"\)\.split\("@"\)\[0\]/);
const authApi = readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
const engagementStart = authApi.indexOf('async function getEngagementNotifications(');
const engagementEnd = authApi.indexOf('async function clearEngagementNotifications(', engagementStart);
const engagementApi = authApi.slice(engagementStart, engagementEnd);
assert.match(engagementApi, /memberId: actorMembers\.get/);
assert.match(engagementApi, /name: profile\.name/);
assert.match(engagementApi, /picture: profile\.picture/);
assert.doesNotMatch(engagementApi, /email: item\.actorEmail/, 'engagement notification responses must not expose actor account email addresses');
console.log('Notification checks passed: relative times, bold names in one sentence, rows and actions name their member, and account emails stay private.');
