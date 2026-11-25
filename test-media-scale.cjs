"use strict";
// Owner 2026-11-19: photos scaled to 720p before upload (landscape 1280×720, portrait 720×1280). Behaviour check:
// browser-checks/media-scale.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = f => fs.readFileSync(f, "utf8");
const scale = read("assets/media-scale.js");
for (const page of ["feed.html", "profile.html", "epk.html", "messages.html", "sync.html"]) assert.match(read(page), /<script src="assets\/media-scale\.js\?v=\d+" defer><\/script>/, `${page} scales photos before upload`);
assert.ok(read("service-worker.js").includes('"/assets/media-scale.js"'), "offline shell");
assert.match(scale, /const LONG = 1280, SHORT = 720/, "720p box");
assert.match(scale, /width >= height \? \[LONG, SHORT\] : \[SHORT, LONG\]/, "landscape and portrait (horizontal and vertical) boxes");
assert.match(scale, /Math\.min\(1, maxW \/ width, maxH \/ height\)/, "never scaled up, aspect kept");
assert.match(scale, /\/\^image\\\/\(jpeg\|png\|webp\)\$\/i/, "GIF and other files pass through");
assert.match(scale, /hasAttribute\("data-no-scale"\)/, "inputs can opt out");
assert.match(scale, /\(!crop && blob\.size >= file\.size\)\) return \{ file \}/, "never uploads a bigger file (a trimmed screenshot is a different picture, so it always goes up trimmed)");
// Owner 2026-11-22: a cut-off photo (createImageBitmap refuses it) never reaches the page's upload, on any picker, and the
// member is told to pick it again (translated).
assert.match(scale, /catch \{ return \{ broken: true \}; \}/, "a photo the browser can't read is marked broken");
assert.match(scale, /if \(good\.length < results\.length\) tellBroken\(\)/, "the member is told");
assert.match(read("assets/i18n.js"), /This photo didn't finish loading on your phone\. Open it in your gallery, then pick it again\./, "the message is translated");
console.log("Media scale wiring checks passed: 720p photo box on every upload page.");
