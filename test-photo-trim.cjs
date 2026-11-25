"use strict";
// Spec 46 SHOT: the screenshot/border detector (assets/photo-trim.js) is plain JS with no DOM, so the same code trims on
// the phone (media-scale.js) and, in part 3, on the server. Here it runs in Node on synthetic RGBA pictures.
// The browser half (real canvases, the chip, Undo, centre taps) is browser-checks/screenshot-trim.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const trim = require("./assets/photo-trim.js");

let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function canvas(w, h, rgb) { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) a.set([...rgb, 255], i * 4); return a; }
function photo(a, W, x0, y0, w, h, dark = false) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = ((y0 + y) * W + x0 + x) * 4, n = rand() * 40 - 20, b = dark ? 18 : 90;
    a[p] = b + 120 * x / w + n; a[p + 1] = b + 60 + 80 * y / h + n; a[p + 2] = (dark ? 30 : 160) - 60 * x / w + n; a[p + 3] = 255;
  }
}
function bar(a, W, y0, h, rgb) { for (let y = y0; y < y0 + h; y++) for (let x = 0; x < W; x++) a.set([...rgb, 255], (y * W + x) * 4); }

// A phone screenshot (360 × 800 copy): status bar, header, the photo, a caption line, a tab bar.
{
  const W = 360, H = 800, a = canvas(W, H, [255, 255, 255]);
  bar(a, W, 0, 26, [28, 28, 30]); bar(a, W, 26, 54, [242, 242, 242]); photo(a, W, 0, 240, 360, 240); bar(a, W, 520, 10, [40, 40, 40]); bar(a, W, 744, 56, [250, 250, 250]);
  assert.equal(trim.looksLikeScreenshot({ type: "image/png", name: "Screenshot_1.png", width: 1080, height: 2400, rgba: a, sw: W, sh: H }), true, "a PNG phone screen with app bars is a screenshot");
  const box = trim.find(a, W, H, { screenshot: true });
  assert.ok(box, "the photo inside is found");
  for (const [k, v] of Object.entries({ x: 0, y: 240, width: 360, height: 240 })) assert.ok(Math.abs(box[k] - v) <= 2, `${k}: ${box[k]} vs ${v}`);
}
// Not sure → keep whole: a text-only screen, two photos, a camera photo, a dark night photo.
{
  const W = 360, H = 800, chat = canvas(W, H, [255, 255, 255]);
  for (let k = 0; k < 10; k++) bar(chat, W, 60 + k * 70, 40, k % 2 ? [220, 248, 198] : [238, 238, 238]);
  assert.equal(trim.find(chat, W, H, { screenshot: true }), null, "a chat screenshot stays whole");
  const grid = canvas(W, H, [255, 255, 255]); photo(grid, W, 10, 150, 165, 165); photo(grid, W, 185, 150, 165, 165); photo(grid, W, 10, 330, 165, 165); photo(grid, W, 185, 330, 165, 165);
  assert.equal(trim.find(grid, W, H, { screenshot: true }), null, "a 2×2 photo grid stays whole");
  const cam = canvas(360, 270, [0, 0, 0]); photo(cam, 360, 0, 0, 360, 270);
  assert.equal(trim.find(cam, 360, 270, { screenshot: false }), null, "a camera photo stays whole");
  const night = canvas(360, 270, [0, 0, 0]); photo(night, 360, 0, 0, 360, 270, true);
  assert.equal(trim.find(night, 360, 270, { screenshot: false }), null, "a dark night photo keeps its dark edges");
}
// A wide share card or downloaded artwork with dark edges (1200×630 JPEG, no camera details) is not a screenshot
// (found with the shop manager's test image: its dark smoke was cut as "app chrome").
assert.equal(trim.looksLikeScreenshot({ type: "image/jpeg", name: "front.jpg", width: 1200, height: 630, camera: false }), false, "a 1.91:1 card is not a screenshot");
// Flat letterbox bars come off any photo.
{
  const W = 360, H = 270, a = canvas(W, H, [0, 0, 0]); photo(a, W, 0, 34, 360, 202);
  const box = trim.find(a, W, H, { screenshot: false });
  assert.ok(box && box.kind === "borders" && Math.abs(box.y - 34) <= 1 && Math.abs(box.height - 202) <= 2, `letterbox bars trimmed: ${JSON.stringify(box)}`);
}
// Camera details: a JPEG with EXIF Make is a camera photo; one without isn't.
{
  const exif = Buffer.from("ffd8ffe1001c457869660000" + "49492a0008000000" + "01000f010200040000004e696b00" + "ffda", "hex");
  assert.equal(trim.hasCamera(exif), true, "EXIF Make → camera");
  assert.equal(trim.hasCamera(Buffer.from("ffd8ffe000104a46494600010100000100010000ffda", "hex")), false, "JFIF without EXIF → no camera");
  assert.equal(trim.looksLikeScreenshot({ type: "image/jpeg", name: "IMG_1.jpg", width: 4000, height: 3000, camera: true }), false, "a camera JPEG is never a screenshot");
}
// Wiring: only pickers that opt in; never SYNC or Support; the chip is translated.
{
  const scale = fs.readFileSync("assets/media-scale.js", "utf8");
  assert.match(scale, /input\.hasAttribute\("data-trim-screenshots"\)/, "only opted-in pickers trim");
  for (const file of ["messages.html", "sync/index.html", "sync.html", "support.html", "assets/sync-wallpaper.js", "assets/chat.js"]) if (fs.existsSync(file)) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /trim-screenshots|trimScreenshots/, `${file} never trims`);
  for (const [file, pattern] of [["assets/feed-enhancements.js", /input\.dataset\.trimScreenshots/], ["assets/profile-editor.js", /mediaInput\.dataset\.trimScreenshots/], ["store.html", /productPhotoInput" type="file" data-trim-screenshots/], ["assets/events-page.js", /trimScreenshots/]]) assert.match(fs.readFileSync(file, "utf8"), pattern, `${file} opts in`);
  const i18n = fs.readFileSync("assets/i18n.js", "utf8");
  assert.match(i18n, /it:\["Ritagliata da uno screenshot","Annulla"/, "the chip is Italian");
  for (const page of ["feed.html", "profile.html", "store.html"]) assert.match(fs.readFileSync(page, "utf8"), /assets\/photo-trim\.js\?v=1" defer><\/script>\s*<script src="assets\/media-scale\.js\?v=3"/, `${page} loads the detector before media-scale.js`);
  assert.match(fs.readFileSync("service-worker.js", "utf8"), /"\/assets\/photo-trim\.js"/, "kept offline");
}
console.log("Photo trim checks passed: a screenshot's photo is found within 2 px, chats, grids, camera and night photos stay whole, letterbox bars come off, EXIF cameras are never screenshots, and only opted-in pickers trim.");
