"use strict";
// Owner 2026-11-16: the EPK builder must look like DanzStak (black, silver, hazard orange, laminate, setlist), not a stock form.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = file => fs.readFileSync(`${__dirname}/${file}`, "utf8");
const html = read("epk.html"), css = read("assets/epk-skin.css"), laminate = read("assets/epk-laminate.js"), epk = read("assets/epk.js"), worker = read("service-worker.js");
assert.match(html, /<body class="ds-tool-page epk-skin">/);
assert.match(html, /assets\/epk-skin\.css\?v=1/);
assert.ok(html.indexOf("epk-skin.css") > html.indexOf("mobile-design-system.css"), "skin loads after the shared design system");
assert.match(html, /class="epk-laminate" aria-hidden="true"/);
assert.match(html, /assets\/epk-laminate\.js\?v=1/);
// Builder only: the public EPK keeps the artist's chosen genre look.
for (const rule of css.split("}").filter(rule => rule.includes("{") && /\.epk-skin/.test(rule))) assert.match(rule, /\.epk-skin:not\(\.public-mode\)/, `skin rule must skip public EPKs: ${rule.slice(0, 80)}`);
assert.match(css, /--sk-ground:#0b0b0c/); assert.match(css, /--sk-accent:#ff5a1f/);
assert.doesNotMatch(css, /#1268d8/, "no stock social-network blue");
assert.match(css, /prefers-reduced-motion/);
assert.match(epk, /item\.classList\.toggle\("is-current", current\)/);
assert.match(epk, /setAttribute\("aria-current", "step"\)/);
assert.match(laminate, /\^https:\\\/\\\//, "laminate photo accepts only https image URLs");
assert.match(worker, /"\/assets\/epk-skin\.css", "\/assets\/epk-laminate\.js"/);
console.log("EPK builder skin checks passed.");
