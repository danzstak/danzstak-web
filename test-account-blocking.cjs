const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const authApi = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const frontend = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.match(template, /async function relationshipPair\(a,b\)/, "relationship checks must read both directions");
assert.match(template, /const blockedStatus=status=>status==='blocked'\|\|status==='blocked_by'/, "both block directions must deny contact");
assert.match(template, /if\(blockedStatus\(mineStatus\)\|\|blockedStatus\(theirStatus\)\)return false;if\(mineStatus==='friends'&&theirStatus==='friends'\)return true;/, "a shared Tribe must not bypass a block");
assert.match(template, /async function friendBlock\(event,user\)[\s\S]*?status:\{S:'blocked'\}[\s\S]*?status:\{S:'blocked_by'\}/, "blocking must atomically replace both relationship directions");
assert.match(template, /if\(mineStatus==='blocked_by'\|\|theirStatus==='blocked'\)return json\(404,\{error:'DanzStak user not available'\}\)/, "a blocked member must not overwrite the original block");
assert.match(template, /async function friendUnblock\(event,user\)[\s\S]*?ConditionExpression:'#status = :blocked'[\s\S]*?ConditionExpression:'#status = :blockedBy'/, "only the blocker may atomically remove the matching block pair");
assert.match(template, /async function getBlockedMembers\(user\)[\s\S]*?return \{memberId:profile.memberId,name:profile.name,picture:profile.picture,blockedAt:/, "block management must return public identity only");
assert.doesNotMatch(template.match(/async function getBlockedMembers[\s\S]*?return json\(200,\{members:[\s\S]*?\}\);/s)?.[0] || "", /return \{email/, "blocked-member responses must not expose account email addresses");
for (const route of ["POST /friends/block", "POST /friends/unblock", "GET /friends/blocked"]) assert.ok(template.includes(route), `${route} must be deployed`);

assert.match(template, /visibleEmails=\[\.\.\.emails\]\.filter\(email=>!blockedStatus\(states\[email\]\)\)/, "blocked accounts must leave the online directory");
assert.match(template, /email===user\.email\|\|blockedStatus\(states\[email\]\)/, "blocked accounts must leave people search");
assert.match(template, /events:items\.filter\(x=>!blocked\.has\(x\.senderEmail\.S\)\)/, "queued call signals from blocked accounts must be suppressed");
assert.match(template, /messages=chats\.filter\(x=>!blocked\.has\(x\.contactEmail\.S\)/, "blocked accounts must not produce message notifications");
assert.match(template, /visibleStories=live\.filter\(x=>!blocked\.has\(x\.userEmail\.S\)/, "blocked Stories must be hidden");
assert.match(template, /visibleReels=live\.filter\(x=>!blocked\.has\(x\.userEmail\.S\)/, "blocked Reels must be hidden");

assert.match(authApi, /async function isBlockedPair\(viewerEmail, memberEmail\)/, "the feed API must share the block model");
assert.match(authApi, /blockedEmails\.has\(item\.userEmail\?\.S\)/, "public and friend feed posts from blocked accounts must be hidden");
assert.match(authApi, /await isBlockedPair\(viewerEmail, post\.userEmail\.S\)/, "direct public-post access must enforce blocks");
assert.match(authApi, /reactionItemsRaw\.filter\(item => !blockedEmails\.has\(item\.userEmail\?\.S\)\)/, "blocked reactions must be hidden");
assert.match(authApi, /commentItemsRaw\.filter\(item => !blockedEmails\.has\(item\.userEmail\?\.S\)\)/, "blocked comments must be hidden");
assert.match(authApi, /if \(\["blocked", "blocked_by"\]\.includes\(friendship\.Item\?\.status\?\.S\)\) return false;/, "shared Tribes must not reveal blocked profile media");

assert.match(frontend, /choices: \[[\s\S]*?value: "remove"[\s\S]*?value: "block"/, "friend options must offer removal and blocking");
assert.match(frontend, /friendActionFetch\(blocking \? "\/friends\/block" : "\/friends\/remove"/, "the chosen privacy action must reach the matching endpoint");
assert.match(frontend, /body: JSON\.stringify\(\{ memberId \}\)/, "block actions must send only an opaque member ID");
assert.match(frontend, /async function renderBlockedMembers\(container\)/, "Settings must manage blocked members");
assert.match(frontend, /friendActionFetch\("\/friends\/unblock"/, "Settings must support explicit unblocking");
assert.match(frontend, /settingRow\("lock", feedTranslate\("Blocked members"\), blockedMembers\)/, "blocked members must be discoverable in Settings");
assert.match(css, /\.blocked-member-row\{display:grid;grid-template-columns:36px minmax\(0,1fr\) auto;/, "blocked-member rows must remain compact");
assert.match(css, /\.settings-row \.blocked-member-unblock\{min-height:44px\}/, "unblock must retain a phone touch target over the shared Settings button rule");

const keysMatch = i18n.match(/const accountBlockKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const accountBlockGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(accountBlockGuidance\)\)/);
assert.ok(keysMatch && translationsMatch, "account-block translations must remain inspectable");
const localeContext = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, localeContext);
const expectedLanguages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "ar", "fil", "hi", "vi", "th", "id"];
for (const language of expectedLanguages) {
  const values = localeContext.result.translations[language];
  assert.equal(values?.length, localeContext.result.keys.length, `${language} must translate every block-management phrase`);
  assert.ok(values.every(value => String(value).trim()), `${language} block-management translations must not be blank`);
}

assert.match(feed, /assets\/feed-enhancements\.css\?v=503/);
assert.match(feed, /assets\/i18n\.js\?v=396/);
assert.match(feed, /assets\/feed-enhancements\.js\?v=533/);

console.log("Account-blocking checks passed: atomic ownership, discovery/contact denial, feed/media filtering, Settings recovery, privacy, localization, and mobile controls.");
