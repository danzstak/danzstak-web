"use strict";
// Task 16-C sweep, profile + shared header pieces (owner 2026-11-17). Real browser: AREA=profile / AREA=bazaar audit.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("assets/buttons.css", "utf8");
const page = fs.readFileSync("profile.html", "utf8");
const audit = fs.readFileSync("browser-checks/buttons-site-audit.cjs", "utf8");
assert.match(page, /<link rel="stylesheet" href="assets\/buttons\.css\?v=\d+">/);
assert.match(css, /body\.profile-page \.profile-create-opener\{min-height:var\(--ds-btn-size\)!important/, "composer opener is a 44px target");
assert.match(css, /body\.profile-page \.profile-post-comment-count\{min-height:var\(--ds-btn-size\)!important/, "comment count is a 44px target");
assert.match(css, /\.pivot-header-button,#pivotButton\{border:0!important;background:#ff5a1f!important;color:#0b0b0c!important/, "one filled Pivot pill everywhere");
assert.match(css, /\.install-app-button\{min-width:var\(--ds-btn-size\)!important;min-height:var\(--ds-btn-size\)!important\}/);
assert.ok(audit.includes("0px( 0px)? inset$"), "the audit tells a tab underline from a bevel");
console.log("Profile button checks passed.");
