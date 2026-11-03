"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const read = name => fs.readFileSync(path.join(root, name), "utf8");

const expectedPngs = new Map([
  ["assets/danzstak-d-icon.png", 1024],
  ["assets/favicon-32.png", 32],
  ["assets/favicon-192.png", 192],
  ["assets/favicon-512.png", 512],
  ["assets/apple-touch-icon.png", 180]
]);

for (const [name, size] of expectedPngs) {
  const buffer = fs.readFileSync(path.join(root, name));
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${name} must be a PNG`);
  assert.equal(buffer.readUInt32BE(16), size, `${name} width`);
  assert.equal(buffer.readUInt32BE(20), size, `${name} height`);
  const colorType = buffer[25];
  const hasAlpha = colorType === 4 || colorType === 6 || (colorType === 3 && buffer.includes(Buffer.from("tRNS")));
  assert.equal(hasAlpha, true, `${name} must retain transparency`);
}

const manifest = JSON.parse(read("manifest.webmanifest"));
assert.deepEqual(manifest.icons.map(icon => icon.src), ["/assets/favicon-192.png", "/assets/favicon-512.png"]);
assert.ok(manifest.icons.every(icon => icon.type === "image/png" && icon.purpose === "any"));

const feed = read("feed.html");
assert.match(feed, /class="logo"[^>]*><img src="assets\/danzstak-d-icon\.png" alt=""><span>DANZSTAK<\/span>/);
assert.match(feed, /class="menu-icon menu-brand-icon"[^>]*><img src="assets\/danzstak-d-icon\.png" alt="">/);

const shell = read("service-worker.js");
assert.match(shell, /"\/assets\/danzstak-d-icon\.png"/);
assert.doesNotMatch(shell, /app-icon\.svg/);

for (const name of fs.readdirSync(root).filter(name => name.endsWith(".html"))) {
  assert.doesNotMatch(read(name), /app-icon\.svg/, `${name} must not reference the retired generic icon`);
}
assert.equal(fs.existsSync(path.join(root, "assets/app-icon.svg")), false, "generic icon must be retired");

console.log("Official DanzStak icon checks passed: transparent D artwork, compact feed header, navigation mark, PWA assets, and generic-icon retirement.");
