"use strict";
// Screen titles (fix-it 18, owner 2026-11-17). Real browser: browser-checks/screen-titles.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
assert.match(feed, /function setScreenTitle\(name\) \{ const label = screenTitles\[name\] \|\| name \|\| "Your Mix"; document\.title = "DanzStak \| " \+/);
assert.match(feed, /const screenTitles = \{ HQ: "Music HQ", Groups: "Tribes" \};/);
assert.match(feed, /const visibleName = canonicalName === "Groups" \? "Tribes" : canonicalName;\s*setScreenTitle\(canonicalName\);/, "every workspace sets its title");
assert.match(feed, /activateMobileScreen\("home"\);\s*setScreenTitle\(""\);/, "Mix gets its title back");
assert.match(feed, /if \(shouldOpen && !wasOpen\) \{ titleBeforeMenu = document\.title; setScreenTitle\("Menu"\); \}/, "Menu has its own title and restores the previous one");
assert.match(feed, /function openNotificationDrawer\(opener, \{ updateHistory = true \} = \{\}\) \{\s*setScreenTitle\("Notifications"\);/);
assert.match(feed, /history\.pushState\(\{ workspace: canonicalName \}, "", nextHash\)/, "each screen is its own history entry, so Back is a real screen change");
console.log("Screen title checks passed.");
