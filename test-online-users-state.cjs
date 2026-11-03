const fs = require("fs");
const assert = require("assert");

const feed = fs.readFileSync("feed.html", "utf8");
const start = feed.indexOf("async function loadOnlineUsers()");
const end = feed.indexOf("async function updateFeedFriend", start);
assert.ok(start >= 0 && end > start, "online-user renderer is missing");
const source = feed.slice(start, end);

assert.match(source, /presenceAvailable/,
  "online-user rendering must know whether the presence provider succeeded");
assert.match(source, /if \(!presenceAvailable\)[\s\S]*Online status is temporarily unavailable/,
  "a provider outage must not be reported as everyone being offline");
assert.match(source, /findPeople\.textContent = feedTranslate\("Find people"\)/,
  "an empty online list must offer a clear path to member search");
assert.match(source, /querySelector\('\[data-feature="Friends"\]'\)\?\.click\(\)/,
  "the empty-state action must open the Friends workspace");
assert.match(source, /querySelector\("\.friend-name-search input"\)\?\.focus\(\)/,
  "the empty-state action must put keyboard focus in member search");

console.log("Online-user state checks passed: outages remain honest and empty results lead to friend discovery.");
