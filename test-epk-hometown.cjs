"use strict";
// Task 15-B: the EPK's hometown skin. Builder choice (auto / another city / off), saved as hometownSkin with the kit,
// old kits act as "auto", public EPK + laminate show the city and city-centre coordinates, print drops textures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = file => fs.readFileSync(file, "utf8");

(async () => {
  // Server keeps only a valid setting.
  const { cleanEpk } = await import("./infrastructure/auth-api/index.mjs");
  const skin = value => cleanEpk({ artistName: "Ghost Rider", hometownSkin: value })?.hometownSkin;
  assert.deepEqual(skin(undefined), { mode: "auto" }, "old kits behave as auto");
  assert.deepEqual(skin({ mode: "off" }), { mode: "off" });
  assert.deepEqual(skin({ mode: "city", city: "bologna" }), { mode: "city", city: "bologna" });
  assert.deepEqual(skin({ mode: "city", city: "<script>" }), { mode: "auto" }, "an invalid city id never reaches storage");
  assert.deepEqual(skin({ mode: "city" }), { mode: "auto" });
  assert.deepEqual(skin({ mode: "sneaky", city: "tacoma", extra: 1 }), { mode: "auto" }, "nothing else is stored");

  // Builder markup: one fieldset under the genre look, three choices, a searchable city list, live vibe line.
  const html = read("epk.html");
  const fieldset = html.slice(html.indexOf('<fieldset class="epk-hometown"'), html.indexOf("</fieldset>") + 11);
  assert.ok(html.indexOf('id="epkLook"') < html.indexOf('id="hometownSkin"'), "Hometown skin sits under the EPK look picker");
  for (const mode of ["auto", "city", "off"]) assert.match(fieldset, new RegExp(`name="hometownMode" value="${mode}"`));
  assert.match(fieldset, /value="auto" checked/, "default: on, from the hometown field");
  assert.match(fieldset, /<legend>Hometown skin<\/legend>/);
  assert.match(fieldset, /id="hometownCity" list="hometownCities"/, "another city is searchable");
  assert.match(fieldset, /id="hometownVibe" aria-live="polite"/);
  assert.ok(html.indexOf("assets/hometown-looks.js") < html.indexOf("assets/epk.js?v="), "hometown data loads before the builder");
  assert.match(html, /assets\/epk-hometown\.css\?v=1/);

  // Builder logic.
  const js = read("assets/epk.js");
  assert.match(js, /hometownSkin: hometownSkinFromForm\(\)/, "the setting is saved with the kit");
  assert.match(js, /: \{ mode: "auto" \}; \/\/ old kits act as "auto"/);
  assert.match(js, /applyHometown\(look, home\)/, "the preview wears the skin");
  assert.match(js, /document\.body\.dataset\.epkHometown = home\.id/, "the skin wraps the whole page");
  assert.match(js, /text\("span", "Out of"\), " ", text\("strong", home\.name\)/, "public EPK: Out of <town>");
  assert.match(js, /toFixed\(2\)\}° \$\{lat >= 0 \? "N" : "S"\}/, "coordinates rounded to 2 decimals");
  assert.doesNotMatch(js, /bookingAddress|streetAddress/, "never the artist's address");

  // Run the helpers for real against the hometown data.
  const sandbox = { window: {}, console };
  vm.runInNewContext(read("assets/hometown-looks.js"), sandbox);
  const L = sandbox.window.danzstakHometownLooks;
  assert.equal(L.hometownLook("Tacoma, WA").id, "tacoma");
  assert.equal(L.cityById("bologna").name, "Bologna");

  // Laminate: city + coordinates, readable band text.
  const laminate = read("assets/epk-laminate.js");
  assert.match(laminate, /home\.hometownName, home\.hometownCoords/);
  assert.match(laminate, /L\.contrast\("#0b0b0c", accent\) >= L\.contrast\("#ffffff", accent\)/, "band text picks the readable colour");

  // CSS: edge to edge, no card frame on the public EPK, print without textures, one-line labels on phones.
  const css = read("assets/epk-hometown.css");
  assert.match(css, /body\.public-mode \.epk-preview\{border:0;border-radius:0;box-shadow:none\}/);
  assert.match(css, /body\.public-mode\[data-epk-hometown\]\{background-color:var\(--epk-page-ground\);background-image:var\(--home-motif,none\)\}/);
  assert.match(css, /@media print\{[\s\S]*background-image:none!important/);
  assert.match(css, /prefers-reduced-motion/);

  // Shortened labels keep the full meaning for screen readers.
  assert.match(html, /aria-label="One-page press PDF">Press PDF</);
  assert.match(html, /id="epkGuideTitle" class="epk-sr-only">Build your EPK</);
  assert.match(read("assets/epk-production.js"), /setAttribute\("aria-label", booth \? "Booth plot and input list" : "Stage plot and input list"\)/);

  // Translations.
  const t = { window: {} };
  vm.runInNewContext(read("assets/i18n-music.js"), t);
  for (const text of ["Hometown skin", "From my home town", "Another city", "Search scene cities", "Out of", "Story", "Music & video", "Press files", "Production", "Pitch venues", "Private review link", "Press PDF", "Full PDF", "Copy link", "Plot & inputs", "Booth & inputs", "The genre look on its own.", "Pick a city from the list.", "Add your home town to see its skin."])
    for (const lang of ["it", "fr", "es"]) assert.ok(t.window.danzstakTranslations[lang][text], `${lang} translation for "${text}"`);
  console.log("EPK hometown checks passed: auto / another city / off saved with the kit (old kits auto), server keeps only a valid setting, Out of <town> with 2-decimal city-centre coordinates, edge-to-edge public EPK, print without textures, it/fr/es.");
})().catch(error => { console.error(error); process.exit(1); });
