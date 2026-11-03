"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/profile-editor.js", "utf8");
const page = fs.readFileSync("profile.html", "utf8");
const block = source.slice(source.indexOf("function installProfilePostMedia"), source.indexOf("function profilePostCard"));

assert.match(block, /const watchProfileMedia = \(media, onTimeout\) =>/,
  "profile media should share a bounded load watchdog");
assert.match(block, /new IntersectionObserver\([\s\S]*?rootMargin: "300px"/,
  "only profile media approaching the viewport should begin timing");
assert.match(block, /media\.tagName === "IMG" \? media\.complete && media\.naturalWidth > 0 : media\.readyState >= 2/,
  "already loaded profile media must not be replaced by recovery UI");
assert.match(block, /requestLoad && media\.readyState === 0\) media\.load\(\)/,
  "near-viewport profile videos should begin a metadata request");
assert.match(block, /media\.addEventListener\("pointerdown", \(\) => armWatchdog\(\)/,
  "native video gestures should opt into recovery without resetting playback");
assert.match(block, /setTimeout\(\(\) => \{ watchdog = 0; onTimeout\(\); \}, 15000\)/,
  "active profile media loads should have a bounded wait");
assert.match(block, /showRecovery\("Media is taking longer than expected\."\)/,
  "stalled profile media should expose an honest retry state");
assert.match(block, /media\.loading = "lazy"/,
  "off-screen profile images should remain lazy-loaded");
assert.match(page, /assets\/profile-editor\.js\?v=481/,
  "the profile page should request the updated media controller");

console.log("Profile media watchdog checks passed: near-viewport post and video stalls become retryable.");
