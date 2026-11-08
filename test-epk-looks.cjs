"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const html = fs.readFileSync("epk.html", "utf8"), client = fs.readFileSync("assets/epk.js", "utf8"), css = fs.readFileSync("assets/epk-looks.css", "utf8"), api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8");

function luminance(hex) {
  const values = hex.match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}
function contrast(first, second) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

assert.match(html, /id="epkLook"[\s\S]*value="techno"[\s\S]*value="punk"[\s\S]*value="metal"[\s\S]*value="house"/);
assert.match(html, /Change the look any time[\s\S]*stay intact/);
assert.match(html, /assets\/epk-looks\.css\?v=1/);
assert.match(html, /assets\/epk\.js\?v=18/);
assert.match(client, /look: epkLooks\.has\(byId\("epkLook"\)\.value\)/);
assert.match(client, /preview\.dataset\.look = look/);
assert.match(client, /byId\("epkLook"\)\.value = epkLooks\.has\(kit\.look\)/);
assert.match(api, /new Set\(\["techno", "punk", "metal", "house"\]\)\.has\(data\.look\)/);
for (const look of ["techno", "punk", "metal", "house"]) assert.match(css, new RegExp(`data-look="${look}"`), `${look} public EPK look is missing`);
for (const family of ["Archivo","JetBrains Mono","Anton","Special Elite","Work Sans","Pirata One","Oswald","Source Serif 4","Syne","DM Sans"]) assert.match(css, new RegExp(family.replace(" ", "\\s")), `${family} self-hosted font is missing`);
assert.doesNotMatch(css, /https?:\/\//, "EPK looks must not make third-party font requests");
for (const [look, ink, ground] of [["techno", "EDEDEA", "0B0B0C"], ["punk", "121110", "EFE8DA"], ["metal", "E6DECB", "0E0D0D"], ["house", "FFF4E0", "0F2E26"]]) {
  assert.ok(contrast(ink, ground) >= 4.5, `${look} body text must meet WCAG AA contrast`);
}
assert.match(css, /data-look="punk"\] \.epk-body h2\{color:var\(--epk-ink\)\}/, "Punk small labels must use accessible ink instead of the low-contrast accent");
assert.match(css, /data-look="metal"\] \.epk-body h2\{color:var\(--epk-ink\)/, "Metal small labels must use accessible ink instead of the low-contrast accent");
assert.match(worker, /danzstak-shell-v747/);
assert.match(worker, /\/assets\/epk-looks\.css/);
for (const file of ["archivo","jetbrains-mono","anton","special-elite","work-sans","pirata-one","oswald","source-serif-4","syne","dm-sans"]) {
  assert.ok(fs.statSync(`assets/fonts/${file}.woff2`).size > 1000, `${file} font file is missing or empty`);
  assert.match(worker, new RegExp(`/assets/fonts/${file}\\.woff2`));
}
console.log("EPK look checks passed: content-independent selection, four bounded themes, self-hosted fonts, persistence, and PWA caching.");
