"use strict";
// Queue 5a1: one shared full-screen media viewer. Wiring checks; the behaviour check is browser-checks/media-viewer.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = f => fs.readFileSync(f, "utf8");
const viewer = read("assets/media-viewer.js"), css = read("assets/media-viewer.css"), visibility = read("assets/media-visibility.js");
const feed = read("feed.html"), profile = read("profile.html"), worker = read("service-worker.js");
for (const [name, html] of [["feed.html", feed], ["profile.html", profile]]) {
  assert.match(html, /<script src="assets\/media-viewer\.js\?v=\d+" defer><\/script>/, `${name} loads the viewer`);
  assert.match(html, /<link rel="stylesheet" href="assets\/media-viewer\.css\?v=\d+">/, `${name} loads the viewer styles`);
  assert.ok(html.indexOf("assets/media-visibility.js") < html.indexOf("assets/media-viewer.js"), `${name}: playback coordinator loads before the viewer`);
}
assert.ok(worker.includes('"/assets/media-viewer.js"') && worker.includes('"/assets/media-viewer.css"'), "viewer is in the offline shell");
assert.match(feed, /article\.dataset\.authorMemberId = String\(authorMemberId\)/, "Mix posts carry the author id so swipes stay with that member");
assert.match(viewer, /img\.post-media,video\.post-media,img\.profile-post-media,video\.profile-post-media,\[data-media-viewer\]/, "Mix, Tribe and profile media open the viewer; other screens opt in with data-media-viewer");
assert.match(viewer, /kindOf\(item\) === kind && sourceOf\(item\) && ownerKey\(item\) === key/, "swipes through the same member's photos or videos only");
assert.match(viewer, /history\.pushState\(\{ \.\.\.\(history\.state \|\| \{\}\), danzstakMediaViewer: true \}/, "opening adds a history entry so system Back closes it");
assert.match(viewer, /window\.scrollTo\(state\.scrollX, state\.scrollY\)/, "closing restores the exact scroll spot");
assert.match(viewer, /startSession\?\.\(track, video, \{ sound: soundOn \}\)/, "videos play through the shared coordinator (one player, sound choice carries over)");
assert.match(viewer, /event\.key === "Escape"/, "Esc closes on computers");
assert.match(viewer, /ArrowRight/, "arrow keys move on computers");
assert.match(viewer, /Math\.min\(4, Math\.max\(1, pinch\.scale/, "pinch-zoom on photos (1x–4x)");
assert.doesNotMatch(viewer, /post-content|post-actions/, "media only: the viewer never copies post text or reaction rows");
assert.match(visibility, /video\.ds-media-viewer-video/, "viewer videos autoplay muted like Mix");
assert.match(css, /\.ds-media-viewer\{[^}]*position:fixed;inset:0/, "full screen");
assert.match(css, /object-fit:contain/, "fit to the screen, never stretched");
assert.match(css, /\.ds-media-viewer-close\{[^}]*width:44px;height:44px/, "44px close target");
console.log("Media viewer wiring checks passed: Mix/profile media open full screen, same-member swipes, Back restores scroll, shared playback.");
