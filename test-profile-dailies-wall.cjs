"use strict";
// Profile wall (fix-it 18, owner 2026-11-17: one continuous wall on a phone, no side gutters, boxes or gaps) and the
// owner's 2026-11-19 correction: "What is this make it just like the other posts. This is funky and does not function.
// Remove this" — the Dailies strip above the profile's posts is gone (every post is already on the wall; Dailies live in
// Mix). A sideways two-photo frame belongs only to a Before & After post the member chooses (F23, photos only).
// profile-dailies.js keeps only the full-screen player a post's photo or video opens. Real browser: profile-mirror.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const dailies = fs.readFileSync("assets/profile-dailies.js", "utf8");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
const polish = fs.readFileSync("assets/profile-polish.css", "utf8");

assert.doesNotMatch(editor, /danzstakProfileDailies\?\.mount/, "no Dailies strip on the profile wall");
assert.doesNotMatch(dailies, /function mount|profile-dailies-row|fetch\(/, "the strip and its /stories call are gone");
assert.doesNotMatch(polish, /\.profile-dailies/, "no strip styles left behind");
assert.match(dailies, /window\.danzstakProfileDailies = \{ openMedia \};/, "the post media player stays");
assert.match(editor, /window\.danzstakProfileDailies\?\.openMedia\?\.\(/, "a post's photo or video still opens full screen");

// The player: muted inline start, a real mute toggle, Back closes, story data never in innerHTML.
assert.match(dailies, /media\.muted = viewerMuted; media\.playsInline = true; media\.autoplay = true;/, "viewer video starts muted and inline");
assert.match(dailies, /profile-daily-mute/, "viewer has a mute toggle");
assert.match(dailies, /history\.pushState\(\{ profileDaily: true \}, ""\)/, "opening pushes a history entry so device Back closes the viewer");
assert.match(dailies, /window\.addEventListener\("popstate", \(\) => \{ if \(viewer\?\.open\)/, "Back closes the viewer");
assert.doesNotMatch(dailies, /innerHTML\s*=\s*[^;]*story\./, "story data never goes into innerHTML");

// Continuous wall on phones.
assert.match(polish, /@media\(max-width:560px\)\{\s*\.profile-page main\{margin:0!important;width:100%!important;max-width:none!important\}/, "profile reaches both screen edges on phones");
assert.match(polish, /\.profile-page \.profile-post-card\{margin-left:-16px!important;margin-right:-16px!important\}/, "posts bleed to the edges");
assert.match(polish, /\.profile-page \.profile-wall-composer\{margin:0 -16px!important/, "composer has no grey gap bands");
console.log("Profile wall checks passed: no Dailies strip above the posts, the post media player stays, one continuous wall.");
