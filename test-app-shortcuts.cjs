"use strict";
// SHORTCUT (owner 2026-11-24): "in the long hold of the app icon just have sync in that list", then "just sync and their
// shop", and "give the danzstak my shop an icon". Long-pressing DanzStak's installed icon lists SYNC and My shop, each
// with an icon file that really exists at its stated size.
const fs = require("node:fs");
const assert = require("node:assert");
const zlib = require("node:zlib");

const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
assert.deepEqual(manifest.shortcuts.map(item => item.name), ["SYNC", "My shop"], "exactly SYNC, then My shop");
const shop = manifest.shortcuts[1];
assert.equal(shop.url, "/store.html?manage=1", "My shop opens the member's own shop manager");

// Read a PNG's size and check its corners/centre, without extra packages.
function png(file) {
  const data = fs.readFileSync(file);
  assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${file} is a PNG`);
  const width = data.readUInt32BE(16), height = data.readUInt32BE(20), depth = data[24], type = data[25];
  assert.equal(depth, 8, `${file}: 8-bit`); assert.ok(type === 6 || type === 2, `${file}: RGB or RGBA`);
  const channels = type === 6 ? 4 : 3, chunks = [];
  for (let at = 8; at < data.length;) {
    const length = data.readUInt32BE(at), kind = data.toString("latin1", at + 4, at + 8);
    if (kind === "IDAT") chunks.push(data.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = width * channels, rows = [];
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const add = [0, a, b, Math.floor((a + b) / 2), pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      line[x] = (line[x] + add) & 255;
    }
    rows.push(line); previous = line;
  }
  const pixel = (x, y) => Array.from(rows[y].subarray(x * channels, x * channels + channels));
  return { width, height, pixel, channels };
}

for (const icon of shop.icons) {
  const file = icon.src.replace(/^\//, "");
  assert.ok(fs.existsSync(file), `${file} exists`);
  const [w, h] = icon.sizes.split("x").map(Number), image = png(file);
  assert.deepEqual([image.width, image.height], [w, h], `${file} is ${icon.sizes}`);
  // DanzStak orange in the storefront, black ground behind it (same family as the SYNC icon).
  let orange = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const [r, g, b] = image.pixel(x, y); if (r > 240 && g > 70 && g < 110 && b < 50) orange++; }
  assert.ok(orange / ((w / 2) * (h / 2)) > (icon.purpose === "maskable" ? 0.06 : 0.12), `${file}: a bold orange storefront`);
  const ground = image.pixel(Math.round(w / 2), Math.round(h * 0.06));
  assert.ok(ground[0] < 20 && ground[1] < 20 && ground[2] < 20, `${file}: black ground`);
  if (icon.purpose === "maskable") {
    // Android crops maskable icons to a circle inside the middle 80%: nothing orange may sit outside it.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - w / 2, dy = y - h / 2;
      if (Math.hypot(dx, dy) <= w * 0.4) continue;
      const [r, g, b] = image.pixel(x, y); assert.ok(!(r > 200 && b < 80), `${file}: artwork inside the safe zone (${x},${y})`);
    }
    const [r, g, b, a = 255] = image.pixel(0, 0); assert.ok(a === 255 && r < 20 && g < 20 && b < 20, `${file}: full-bleed black`);
  } else {
    assert.equal(image.pixel(0, 0)[3], 0, `${file}: rounded corners are see-through`);
  }
}
assert.ok(shop.icons.some(icon => icon.sizes === "192x192" && icon.purpose === "any"), "192px icon");
assert.ok(shop.icons.some(icon => icon.purpose === "maskable"), "maskable icon");
assert.ok(fs.existsSync("assets/shop-icon.svg"), "the icon's source artwork is in the repo");

// Signed out, My shop goes to sign in and comes back to the shop manager.
const store = fs.readFileSync("assets/store.js", "utf8");
assert.match(store, /if\(managing && error\.status===401\) \{ try \{ sessionStorage\.setItem\("danzstak_return_to", "\/store\.html\?manage=1"\)/);
const home = fs.readFileSync("assets/home.js", "utf8");
const rule = home.match(/return (\/\^.*?\/)\.test\(path\)/)[1];
assert.ok(new Function(`return ${rule}`)().test("/store.html?manage=1"), "home.js accepts the shop manager as a return page");

const worker = fs.readFileSync("service-worker.js", "utf8");
for (const file of ["/assets/shop-icon-96.png", "/assets/shop-icon-192.png"]) assert.equal(worker.split(`"${file}"`).length - 1, 1, `cached once: ${file}`);
console.log("App shortcut checks passed: SYNC and My shop, with the shop icon.");
