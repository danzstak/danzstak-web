const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");

const source = readFileSync("assets/feed-enhancements.js", "utf8");
const css = readFileSync("assets/feed-enhancements.css", "utf8");
const feed = readFileSync("feed.html", "utf8");
const start = source.indexOf('if (name === "Friends")');
const end = source.indexOf('if (["Photos", "Videos"].includes(name))', start);
const workspace = source.slice(start, end);

for (const tab of ["All Friends", "Online", "Requests", "Find Friends"])
  assert.ok(workspace.includes(`"${tab}"`), `${tab} must remain available`);
assert.match(workspace, /return count && value !== "find" \? `\$\{feedTranslate\(label\)\}/, "tab labels and counts use translations");
assert.match(workspace, /presenceAvailable: false, shown: 24/, "large friend lists begin with a bounded page");
assert.match(workspace, /message\.textContent = feedTranslate\("Message \(SYNC\)"\)/, "accepted friends have a direct SYNC action");
assert.match(workspace, /more\.textContent = feedTranslate\("More"\)/, "relationship actions stay in More");
assert.match(workspace, /removeAcceptedFriend\(memberId, more\)/, "More preserves confirmed remove and block behavior");
assert.match(workspace, /\[\[true, "Confirm", "primary"\], \[false, "Delete", "secondary"\]\]/, "requests expose confirm and delete actions in place");
assert.match(workspace, /danzstakMountPeopleFinder/, "Find Friends uses member discovery");
assert.match(workspace, /event\.key === 'ArrowRight'/, "tabs support keyboard navigation");
assert.doesNotMatch(workspace, /Add a friend by email/, "ordinary users are not required to know account emails");
assert.match(css, /\.friends-directory-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, "desktop uses a compact two-column directory");
assert.match(css, /@media\(max-width:700px\)[\s\S]*\.friends-directory-list\{grid-template-columns:1fr\}/, "mobile uses one readable column");
assert.match(css, /\.friend-sync-action,.friend-more-action,.friend-request-actions button\{min-height:44px/, "mobile controls keep usable touch targets");
assert.match(feed, /assets\/feed-enhancements\.css\?v=499/, "feed loads current Friends styles");
assert.match(feed, /assets\/feed-enhancements\.js\?v=530/, "feed loads current Friends behavior");

console.log("Friend directory checks passed: compact tabs, paging, requests, discovery, SYNC and safe relationship actions.");
