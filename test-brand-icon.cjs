const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const png = file => {
  const data = fs.readFileSync(path.join(root, file));
  assert.equal(data.subarray(1, 4).toString("ascii"), "PNG", `${file} must be a PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data[25] };
};

for (const [file, size] of [
  ["assets/favicon-32.png", 32],
  ["assets/favicon-192.png", 192],
  ["assets/favicon-512.png", 512],
  ["assets/apple-touch-icon.png", 180],
]) {
  const image = png(file);
  assert.deepEqual([image.width, image.height], [size, size], `${file} must be ${size}px square`);
  assert.ok([4, 6].includes(image.colorType), `${file} must preserve transparency`);
}

const master = png("assets/danzstak-d-icon.png");
assert.equal(master.width, master.height, "the master D icon must be square");
assert.ok(master.width >= 1024, "the master D icon must support high-density displays");
assert.ok([4, 6].includes(master.colorType), "the master D icon must have an alpha channel");

const manifest = JSON.parse(read("manifest.webmanifest"));
assert.deepEqual(manifest.icons.map(icon => icon.src), ["/assets/favicon-192.png", "/assets/favicon-512.png"]);
assert.ok(manifest.icons.every(icon => icon.purpose === "any"), "transparent artwork must not be cropped as a maskable icon");

const feed = read("feed.html");
assert.match(feed, /class="logo brand-lockup"[^>]*>[\s\S]*danzstak-d-icon\.png[\s\S]*<span class="brand-name">DANZSTAK<\/span>/);
assert.match(feed, /data-route="home"[\s\S]*brand-nav-icon[\s\S]*danzstak-d-icon\.png/);
assert.match(feed, /menu-brand-icon[\s\S]*danzstak-d-icon\.png/);

const landing = read("index.html");
assert.equal((landing.match(/danzstak-logo\.png/g) || []).length, 2, "landing should use the full logo once visually plus structured-data branding");
assert.match(landing, /class="logo brand-lockup"[\s\S]*danzstak-d-icon\.png/);

for (const file of ["index.html", "feed.html", "profile.html", "messages.html", "booking.html", "epk.html", "record-stores.html"]) {
  assert.doesNotMatch(read(file), /app-icon\.svg/, `${file} must not reference the retired generic icon`);
  assert.match(read(file), /favicon-32\.png\?v=3/, `${file} must reference the current D favicon`);
}

console.log("DanzStak brand icon assets and references verified.");
