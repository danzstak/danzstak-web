"use strict";
// Owner 2026-11-18 (phone screenshot): the profile Videos tab showed full posts with text, likes and comments,
// and the videos did not scroll in full screen. Videos tab = stills only; tap = full-screen vertical player
// through that member's videos, "That's all from <name>" at the end, Back returns.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const js = fs.readFileSync("assets/profile-videos.js", "utf8"), css = fs.readFileSync("assets/profile-videos.css", "utf8");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8"), page = fs.readFileSync("profile.html", "utf8");
const visibility = fs.readFileSync("assets/media-visibility.js", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8");

// The Videos tab builds the grid, not post cards; Photos and Posts keep their cards.
assert.match(editor, /mediaOnly && mediaType === "video" && window\.danzstakProfileVideos \? window\.danzstakProfileVideos\.createGrid\(\) : null/);
assert.match(editor, /if \(!addVideo\(\{ mediaUrl: post\.mediaUrl, content: post\.content \|\| "", refresh: \(\) => refreshProfilePostMedia\(post\) \}\)\) tabMessage\.appendChild\(profilePostCard\(post\)\)/);
assert.match(editor, /addVideo\(\{ mediaUrl, content: "Profile video", refresh: refreshProfileVideo \}\)/, "the profile video joins the grid too");
// Grid tiles: no caption text, no reactions, never autoplay or grab sound.
assert.doesNotMatch(js.slice(js.indexOf("function createGrid"), js.indexOf("window.danzstakProfileVideos")), /textContent|reaction|comment/i);
assert.match(visibility, /!element\.closest\('\.video-grid,\.call-setup-dialog,\.profile-video-grid'\)/, "grid stills are not autoplay candidates");
// Full-screen vertical snap player run as a media session (one player, sound preference, mute toggle).
assert.match(css, /\.pvv-list\{[^}]*scroll-snap-type:y mandatory/);
assert.match(css, /\.pvv-slide\{[^}]*height:100dvh;scroll-snap-align:start;scroll-snap-stop:always/);
assert.match(css, /video\.pvv-video\{[^}]*object-fit:contain!important/, "fit, never stretched");
assert.match(js, /startSession\?\.\(list, video, \{ sound \}\)/);
assert.match(js, /endSession\?\.\(list\)/);
assert.match(js, /video\.className = "reel-player pvv-video"/);
assert.match(js, /That's all from \{name\}/);
// Back: device Back (history) and ← both close to the same spot; Esc too.
assert.match(js, /danzstakProfileVideos: true \}, ""\)/);
assert.match(js, /window\.addEventListener\("popstate", \(\) => \{ if \(viewer\.open\) \{ fromHistory = true; close\(\); \} \}\)/);
assert.match(js, /viewer\.addEventListener\("cancel"/);
// Touch targets.
assert.match(css, /\.pvv-back\{[^}]*width:44px;height:44px/);
// Loaded on the profile page before the editor, and cached offline.
assert.ok(page.indexOf("assets/profile-videos.js") > 0 && page.indexOf("assets/profile-videos.js") < page.indexOf("assets/profile-editor.js"));
assert.match(page, /assets\/profile-videos\.css\?v=\d+/);
assert.match(worker, /"\/assets\/profile-videos\.css", "\/assets\/profile-videos\.js"/);
console.log("profile videos grid ok");
