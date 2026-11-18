"use strict";
// Owner 2026-11-17: Dailies pushes right up to the header and down to the post box; the first post pushes up to the post box.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("assets/mix-polish.css", "utf8");
const block = css.slice(css.indexOf("/* Phone Mix top (owner 2026-11-17)"));
assert.ok(block.includes("@media (max-width:700px)"), "phone layout only");
assert.match(block, /body:has\(#feed\) \.layout\{margin-top:0!important;padding-top:0!important\}/, "no gap between header and Dailies");
assert.match(block, /#storiesRail\{margin:0!important;padding:4px 0 6px!important\}/, "Dailies rail has no outer margin");
assert.match(block, /#postComposer\{margin:0!important;[^}]*border-bottom:1px solid var\(--mix-rule\)!important/, "post box sits on the first post with one hairline");
assert.match(block, /#feed > :first-child\{margin-top:0!important\}/, "first post has no top gap");
assert.match(css, /#feedStatus:empty,\.feed-search-feedback:empty\{display:none!important;margin:0!important\}/, "empty status line adds no gap above the first post");
const feed = fs.readFileSync("feed.html", "utf8");
assert.ok(feed.indexOf("mix-polish.css") > feed.indexOf("mobile-design-system.css"), "mix-polish loads after the mobile design system so it wins");
console.log("Mix top gap checks passed: Dailies under the header, post box under Dailies, first post under the post box.");
