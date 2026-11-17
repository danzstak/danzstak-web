"use strict";
// Task 15-A: hometown token sets + matcher. Contrast >= 4.5:1 for every city x every genre look, local matching,
// a stable fallback for any town, original motifs only (no external URLs), CSS generated from the same data.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const looks = require("./assets/hometown-looks.js");
const { block } = require("./scripts/build-hometown-css.cjs");
const css = fs.readFileSync("assets/epk-looks.css", "utf8");

// Curated scene cities from the spec, punk/metal/electronic first.
const expected = ["tacoma", "seattle", "bremerton", "olympia", "portland", "san-francisco", "oakland", "los-angeles", "san-diego", "milwaukee", "chicago", "detroit", "nashville", "austin", "new-york", "philadelphia", "berlin", "mannheim", "bologna", "milan", "rome", "paris", "london", "manchester", "amsterdam", "barcelona"];
assert.deepEqual(looks.CITIES.map(c => c.id), expected);
const HEX = /^#[0-9a-f]{6}$/;
for (const c of looks.CITIES) {
  assert.ok(c.name && c.vibe && c.aliases.length, `${c.id} has a name, a vibe and aliases`);
  for (const key of ["ground", "ink", "accent"]) assert.match(c[key], HEX, `${c.id}.${key}`);
  assert.ok(c.tint > 0 && c.tint <= 1, `${c.id}.tint`);
  assert.ok(Object.keys(looks.MOTIFS).includes(c.motif), `${c.id} uses a library motif`);
  assert.ok(Number.isFinite(c.lat) && Number.isFinite(c.lon) && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180, `${c.id} city-centre coordinates`);
  assert.equal(Math.round(c.lat * 100) / 100, c.lat, `${c.id} latitude is rounded to 2 decimals`);
  assert.equal(Math.round(c.lon * 100) / 100, c.lon, `${c.id} longitude is rounded to 2 decimals`);
}
assert.deepEqual(Object.keys(looks.MOTIFS).sort(), ["arches", "brick", "concrete", "grid", "haze", "pines", "rails", "rain", "waterline"]);

// Contrast: every city x every genre, text and accent, on the ground and on the motif's darkest/lightest spot.
const genres = Object.keys(looks.GENRES);
assert.deepEqual(genres, ["techno", "punk", "metal", "house"]);
let checked = 0, worst = Infinity;
const pass = (label, k) => {
  for (const [name, fg, bg] of [["ink/ground", k.ink, k.ground], ["accent/ground", k.accent, k.ground], ["ink/motif", k.ink, k.worstGround], ["accent/motif", k.accent, k.worstGround]]) {
    const ratio = looks.contrast(fg, bg); worst = Math.min(worst, ratio); checked++;
    assert.ok(ratio >= 4.5, `${label} ${name} contrast ${ratio.toFixed(2)} is below 4.5:1`);
  }
};
for (const city of looks.CITIES) for (const genre of genres) pass(`${city.id} x ${genre}`, looks.compose(genre, looks.hometownLook(city.name)));
// The genre look keeps its light/dark: Punk paper stays light, Techno stays dark.
for (const city of looks.CITIES) {
  assert.ok(looks.contrast(looks.compose("punk", { tokens: city }).ground, "#000000") > 10, `${city.id} keeps Punk's paper light`);
  assert.ok(looks.contrast(looks.compose("techno", { tokens: city }).ground, "#ffffff") > 10, `${city.id} keeps Techno dark`);
}

// Matcher: normalizes case, accents, state/country and commas.
const id = text => looks.hometownLook(text)?.id;
for (const text of ["Tacoma, WA", "tacoma", "TACOMA USA", "Tacoma, Washington, USA", "  tacoma ,wa "]) assert.equal(id(text), "tacoma", text);
assert.equal(id("Milano"), "milan"); assert.equal(id("Roma, Italia"), "rome"); assert.equal(id("NYC"), "new-york"); assert.equal(id("Brooklyn, NY"), "new-york");
assert.equal(id("Philly"), "philadelphia"); assert.equal(id("Bremerton, WA"), "bremerton"); assert.equal(id("Barcelona, España"), "barcelona"); assert.equal(id("Berlin, Deutschland"), "berlin");
assert.equal(looks.hometownLook("Tacoma, WA").curated, true);
assert.equal(looks.hometownLook(""), null); assert.equal(looks.hometownLook(" , "), null);

// Fallback: deterministic, readable, never a curated id, passes contrast in every genre.
const towns = ["Springfield, IL", "Bakersfield", "Gdańsk", "Aberdeen, WA", "Ljubljana", "Tromsø", "Ogden UT", "Wollongong", "Köln", "Valparaíso"];
for (const town of towns) {
  const a = looks.hometownLook(town), b = looks.hometownLook(town.toUpperCase());
  assert.equal(a.curated, false, town);
  assert.deepEqual([a.id, a.tokens], [b.id, b.tokens], `${town}: the same town always gets the same skin`);
  assert.match(a.id, /^town-[a-z0-9-]+$/);
  for (const genre of genres) pass(`fallback ${town} x ${genre}`, looks.compose(genre, a));
}
for (let i = 0; i < 300; i++) { const town = `Town${i * 7919}`; for (const genre of genres) pass(`fallback ${town} x ${genre}`, looks.compose(genre, looks.hometownLook(town))); }
assert.notEqual(looks.hometownLook("Springfield").tokens.accent, looks.hometownLook("Bakersfield").tokens.accent, "different towns get different palettes");

// Motifs: original inline SVG, no external URLs, at most 2 KB each.
for (const name of Object.keys(looks.MOTIFS)) {
  const image = looks.motifImage(name, "#ff5a1f");
  assert.ok(image.startsWith('url("data:image/svg+xml,'), `${name} is an inline data URI`);
  assert.ok(image.length <= 2048, `${name} motif is ${image.length} bytes`);
  const svg = decodeURIComponent(image.slice(26, -2));
  assert.doesNotMatch(svg.replace("http://www.w3.org/2000/svg", ""), /https?:|\/\/|<image|<text|xlink:href/i, `${name} pulls in nothing external and draws no text or images`);
}
const source = fs.readFileSync("assets/hometown-looks.js", "utf8");
assert.doesNotMatch(source.replace("http://www.w3.org/2000/svg", ""), /https?:\/\//, "hometown data loads nothing from the network");

// CSS tokens are generated from the data and the genre values match epk-looks.css.
const at = css.indexOf("/* hometown-tokens:start"), end = css.indexOf("/* hometown-tokens:end */") + "/* hometown-tokens:end */".length;
assert.ok(at > 0, "epk-looks.css has the hometown token block");
assert.equal(css.slice(at, end), block(), "run node scripts/build-hometown-css.cjs: the CSS tokens drifted from hometown-looks.js");
for (const [genre, t] of Object.entries(looks.GENRES)) {
  if (genre === "techno") assert.match(css, new RegExp(`--epk-ground:${t.ground};--epk-ink:${t.ink};--epk-accent:${t.accent}`), "techno defaults match");
  else assert.match(css, new RegExp(`\\[data-look="${genre}"\\]\\{--epk-ground:${t.ground};--epk-ink:${t.ink};--epk-accent:${t.accent}`), `${genre} tokens match epk-looks.css`);
}
assert.match(css, /@media print\{\[data-hometown\]\{--home-motif:none!important;background-image:none!important\}\}/, "print drops textures");

// Every vibe line and local city name has Italian, French and Spanish.
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync("assets/i18n-music.js", "utf8"), sandbox);
const dict = sandbox.window.danzstakTranslations;
for (const c of looks.CITIES) for (const lang of ["it", "fr", "es"]) assert.ok(dict[lang][c.vibe], `${lang} vibe for ${c.id}`);
for (const name of ["Milan", "Rome", "Paris", "London", "Barcelona", "Berlin", "New York"]) assert.equal(dict.it[name] !== undefined && dict.fr[name] !== undefined && dict.es[name] !== undefined, true, `city name ${name}`);

console.log(`Hometown looks checks passed: ${looks.CITIES.length} cities x ${genres.length} genres plus 310 fallback towns, ${checked} contrast pairs (worst ${worst.toFixed(2)}:1), stable matcher, original inline motifs, CSS in sync, it/fr/es.`);
