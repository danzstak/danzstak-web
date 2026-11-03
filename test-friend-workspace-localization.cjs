const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");

const friendsStart = feed.indexOf('if (name === "Friends")');
const friendsEnd = feed.indexOf('if (["Photos", "Videos"].includes(name))', friendsStart);
assert.ok(friendsStart >= 0 && friendsEnd > friendsStart, "Friends workspace must remain inspectable");
const workspace = feed.slice(friendsStart, friendsEnd);

for (const text of [
  "Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.",
  "Users online",
  "Finding users online…",
  "Your friends",
  "Loading friends…",
  "No accepted friends yet.",
  "Online",
  "Offline",
  "Status unavailable",
  "Message"
]) {
  assert.ok(workspace.includes(`feedTranslate("${text}")`) || workspace.includes(`feedTranslate(friendIsOnline ? "Online" : presenceAvailable ? "Offline" : "Status unavailable")`), `${text} must use the live translation layer`);
  assert.ok(i18n.includes(`"${text}"`), `${text} must have localized dictionary coverage`);
}

const onlineStart = feed.indexOf("function renderOnlineFriendList");
const onlineEnd = feed.indexOf("async function groupFetch", onlineStart);
const onlineList = feed.slice(onlineStart, onlineEnd);
assert.match(onlineList, /feedTranslate\("No other users are online right now\. Your accepted friends remain listed below\."\)/, "online empty state is localized");
assert.match(onlineList, /feedTranslate\("Add Friend"\)/, "friend action is localized");
assert.match(onlineList, /feedFormat\("Friend request sent to \{name\}\."/, "dynamic confirmation uses a translated template without translating the member name");
assert.doesNotMatch(workspace, /textContent = "(?:Users online|Finding users online…|Your friends|Loading friends…|No accepted friends yet\.|Message)"/, "Friends workspace must not bypass translation for user-facing state");

console.log("Friend workspace localization checks passed: discovery, presence, actions, and accessible labels use the selected language.");
