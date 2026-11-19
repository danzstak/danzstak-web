"use strict";
// Task 16-C sweep, Mix + Music HQ (owner 2026-11-17): no outlined "HTML" text buttons. Real browser:
// AREA=hq / AREA=mix node browser-checks/buttons-site-audit.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("assets/buttons.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
assert.match(feed, /<link rel="stylesheet" href="assets\/buttons\.css\?v=\d+">/, "Mix and Music HQ load the button system");
assert.ok(feed.lastIndexOf("assets/buttons.css") > feed.lastIndexOf("assets/artist-hq.css"), "the system loads after the HQ styles");
assert.match(css, /\.artist-hq-action\{[\s\S]*?border:0!important;border-radius:var\(--ds-btn-radius\)!important;[\s\S]*?background:var\(--ds-btn-tonal\)!important/, "HQ actions are tonal pills, not outlined boxes");
assert.match(css, /\.artist-hq-action\.primary\{background:var\(--ds-btn-primary\)!important/, "one primary pill");
assert.match(css, /#feed \.post \.post-menu-toggle\{width:var\(--ds-btn-size\)!important/, "post menu is a 44px icon button");
assert.doesNotMatch(css, /pivot-header-button|#pivotButton/, "the old Pivot pill styles are gone (directive F15j: an icon in the bar)");
assert.match(css, /\.push-alert-prompt button\.primary\{/, "alerts banner uses the primary pill");
console.log("Mix + Music HQ button checks passed.");
