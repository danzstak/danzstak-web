"use strict";
// Fix-it 18, Profile page item 6 (owner 2026-11-17): profile photos and videos size and play like a familiar feed.
// Full width, source aspect (portrait capped at 4:5, never stretched), muted autoplay at 50% one at a time, mute toggle
// bottom-right, tap to see it whole full screen. Real-browser check: browser-checks/profile-mirror.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const visibility = fs.readFileSync("assets/media-visibility.js", "utf8");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
const dailies = fs.readFileSync("assets/profile-dailies.js", "utf8");
const polish = fs.readFileSync("assets/profile-polish.css", "utf8");
const fit = fs.readFileSync("assets/media-fit.js", "utf8");

// Root cause: autoplay only counted Mix videos.
assert.match(visibility, /isFeedVideo=video=>video\?\.matches\?\.\('video\.post-media,video\.profile-post-media,video\.ds-media-viewer-video'\);/, "profile videos autoplay like Mix");
// No browser controls on profile videos; muted inline; tap or Enter opens the viewer.
assert.doesNotMatch(editor, /media\.controls = true; media\.preload = "metadata";/, "profile videos have no native controls");
assert.match(editor, /media\.preload = "metadata"; media\.muted = true; media\.playsInline = true;/);
assert.match(editor, /window\.danzstakProfileDailies\?\.openMedia\?\.\(\[\{ mediaType: post\.mediaType, mediaUrl, label:/, "tap opens the media whole, full screen");
assert.match(editor, /if \(event\.target\.closest\?\.\("\.danzstak-audio-toggle"\)\) return;/, "the mute toggle does not open the viewer");
assert.match(dailies, /const openMedia = \(items, index, from\) => \{ window\.danzstakMediaCoordinator\?\.pauseAll\?\.\(\); openViewer\(items, index, from\); \};/, "opening full screen pauses the feed player");
assert.match(polish, /\.profile-daily-full\{[^}]*object-fit:contain\}/, "the viewer shows the whole picture");
// Mute toggle in the corner; shell bleeds edge to edge.
assert.match(polish, /\.profile-post-card \.danzstak-native-video-shell>\.danzstak-audio-toggle\{right:12px!important;bottom:12px!important\}/);
assert.match(polish, /\.profile-post-card \.danzstak-media-shell\{width:calc\(100% \+ 32px\)!important;max-width:none!important;margin:0 -16px!important\}/);
// Frames take the media's own shape, 9:20 .. 3:1 (owner 2026-11-22: "Make the container the size of the image or the
// video"), covered, never stretched.
assert.match(fit, /const MIN = 0\.45, MAX = 3;/);
assert.match(fit, /video\.profile-post-media/);
// Race (found by the 4x repeat run): media-fit's metadata reload aborted a starting autoplay and left it stuck paused.
assert.match(fit, /const ask = \(\) => \{ if \(video\.readyState === 0 && video\.paused && !dataSaver\(\)\)/, "never reload a video that is starting to play");
assert.match(visibility, /else setTimeout\(\(\)=>\{if\(activeMedia===candidate&&candidate\.paused&&!document\.hidden&&\(ratios\.get\(candidate\)\|\|0\)>=0\.5\)candidate\.play\(\)\.catch\(\(\)=>\{\}\);\},250\);/, "an interrupted autoplay retries once while still the visible choice");
console.log("Profile media checks passed: autoplay like Mix, no native controls, corner mute, tap to see it whole.");
