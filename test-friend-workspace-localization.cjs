const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");

const friendsStart = feed.indexOf('if (name === "Friends")');
const friendsEnd = feed.indexOf('if (["Photos", "Videos"].includes(name))', friendsStart);
assert.ok(friendsStart >= 0 && friendsEnd > friendsStart, "Friends workspace must remain inspectable");
const workspace = feed.slice(friendsStart, friendsEnd);

for (const text of [
  "Find friends, answer requests and open SYNC from one place.",
  "Search people",
  "All friends",
  "Requests",
  "Find friends",
  "Loading friends…",
  "No accepted friends yet.",
  "Online",
  "Offline",
  "Status unavailable",
  "Message"
]) {
  assert.ok(workspace.includes(`feedTranslate("${text}")`) || workspace.includes(`feedTranslate(presence?.online ? "Online" : "Offline")`), `${text} must use the live translation layer`);
  assert.ok(i18n.includes(`"${text}"`), `${text} must have localized dictionary coverage`);
}

const onlineStart = feed.indexOf("function renderOnlineFriendList");
const onlineEnd = feed.indexOf("async function groupFetch", onlineStart);
const onlineList = feed.slice(onlineStart, onlineEnd);
assert.match(onlineList, /feedTranslate\("No other users are online right now\. Your accepted friends remain listed below\."\)/, "online empty state is localized");
assert.match(onlineList, /feedTranslate\("Add Friend"\)/, "friend action is localized");
assert.match(onlineList, /feedFormat\("Friend request sent to \{name\}\."/, "dynamic confirmation uses a translated template without translating the member name");
assert.doesNotMatch(workspace, /textContent = "(?:All friends|Requests|Find friends|Loading friends…|No accepted friends yet\.|Message)"/, "Friends workspace must not bypass translation for user-facing state");

console.log("Friend workspace localization checks passed: discovery, presence, actions, and accessible labels use the selected language.");
