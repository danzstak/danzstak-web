"use strict";
// Audit 36 D7: Settings → Account security asked for a "shield" icon the icon set did not have, so the row showed a
// stand-in dot. Every icon a Settings row asks for must exist in assets/icon-buttons.js.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const icons = fs.readFileSync("assets/icon-buttons.js", "utf8");
const wanted = [...new Set([...feed.matchAll(/settingRow\("([a-z0-9-]+)"/g)].map(match => match[1]))];
assert.ok(wanted.length >= 10, `found the Settings rows (${wanted.length})`);
const defined = name => new RegExp(`(?:^|[\\s,{])"?${name.replace(/-/g, "\\-")}"?:\\s*\\[`, "m").test(icons);
const missing = wanted.filter(name => !defined(name));
assert.deepEqual(missing, [], `Settings rows ask for icons that do not exist: ${missing.join(", ")}`);
assert.ok(wanted.includes("shield"), "Account security uses the shield icon");
console.log(`Settings icon checks passed: all ${wanted.length} Settings row icons exist (${wanted.join(", ")}).`);
