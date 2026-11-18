"use strict";
// Fix-it 18 (Mix): composer avatar and own Dailies tile never show an empty black circle or the DanzStak "D".
const assert = require("node:assert/strict");
const fs = require("node:fs");
const js = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/mix-polish.css", "utf8");
assert.doesNotMatch(css, /\.composer-avatar[^{]*\{background:#0b0b0c!important/, "a background shorthand with !important wipes the member's photo");
assert.match(css, /\.composer-avatar,\.post-avatar-fallback\{background-color:#0b0b0c!important;background-size:cover/, "dark ground set with background-color only");
assert.match(js, /image\.onerror = restoreInitial;/, "a failed composer photo restores the initial");
assert.match(js, /if \(!image\.naturalWidth \|\| !image\.naturalHeight\) return restoreInitial\(\);/, "a zero-size photo restores the initial");
assert.match(js, /if \(dailyAvatar\.tagName !== "IMG" && !dailyAvatar\.dataset\.viewerPicture\) dailyAvatar\.textContent = initial; \/\/ Fix-it 18/, "own Dailies tile shows the member's initial before the photo is tried");
console.log("Avatar initial checks passed: no photo-wiping shorthand, failed photos restore the initial, Dailies tile uses the member's initial.");
