"use strict";
// Owner directive 2026-11-16: Mix, The Roll and profile media fill the card width with source-shaped frames.
const assert = require("node:assert/strict"), fs = require("node:fs");
for (const page of ["feed.html", "profile.html"]) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /assets\/media-fit\.css\?v=\d+/, `${page} loads the media-fit styles`);
  assert.match(html, /assets\/media-fit\.js\?v=\d+/, `${page} loads the media-fit script`);
  assert.ok(html.lastIndexOf("media-fit.css") > html.lastIndexOf("responsive-media.css"), `${page} loads media-fit after older media styles`);
}
const css = fs.readFileSync("assets/media-fit.css", "utf8");
assert.match(css, /object-fit:cover!important/, "media fills its frame (no bars)");
assert.match(css, /:fullscreen\{object-fit:contain/, "fullscreen still shows the whole picture");
assert.match(css, /img\.post-media\{\s*width:calc\(100% \+/, "feed images bleed to the card edges like videos");
const js = fs.readFileSync("assets/media-fit.js", "utf8");
// Owner 2026-11-22 ("Make the container the size of the image or the video"): a post's frame is the media's own shape,
// limited only to 9:20 (a phone screenshot) .. 3:1; The Roll's preview cards keep 4:5..1.91:1 so the strip stays even.
const MIN = Number(js.match(/ MIN = ([\d.]+)/)[1]), MAX = Number(js.match(/ MAX = ([\d.]+)/)[1]);
assert.equal(MIN, 0.45, "tallest post frame is 9:20 (a phone screenshot shows whole)"); assert.equal(MAX, 3, "widest post frame is 3:1");
assert.match(js, /const ROLL_MIN = 0\.8, ROLL_MAX = 1\.91;/, "The Roll's preview cards keep one even shape");
assert.match(js, /\(media\.closest\("\.reels-rail"\) \? clampRoll : clamp\)\(width \/ height\)/, "only The Roll's strip uses the card range");
assert.match(js, /danzstak_data_saver/, "data saver keeps videos from preloading");
console.log("Media fit checks passed: full-width Mix/Roll/profile media, own-shape frames (9:20..3:1; Roll cards 4:5..1.91:1), cover, fullscreen contain, data saver respected.");
