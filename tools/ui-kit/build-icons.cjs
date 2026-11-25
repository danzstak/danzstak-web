#!/usr/bin/env node
"use strict";
// Builds assets/icons.svg: one <symbol> per Lucide icon named in icons.json, taken from lucide-static (ISC).
// Symbols carry only geometry; .ds-icon (components.css) sets stroke 2, round caps, currentColor, so the same symbol
// can be drawn outlined or filled (active tab, 39a).   node build-icons.cjs <output.svg>
const fs = require("node:fs");
const path = require("node:path");
const out = process.argv[2];
if (!out) { console.error("usage: node build-icons.cjs <output.svg>"); process.exit(2); }
const names = require("./icons.json").icons;
const dir = path.join(path.dirname(require.resolve("lucide-static/package.json")), "icons");
const version = require("lucide-static/package.json").version;
const missing = names.filter(name => !fs.existsSync(path.join(dir, `${name}.svg`)));
if (missing.length) { console.error(`Not in lucide-static ${version}: ${missing.join(", ")}`); process.exit(1); }
const symbols = names.map(name => {
  const svg = fs.readFileSync(path.join(dir, `${name}.svg`), "utf8");
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/\s*\n\s*/g, "").trim();
  return `<symbol id="${name}" viewBox="0 0 24 24">${inner}</symbol>`;
});
const header = `<!-- Lucide icons ${version} (ISC licence: assets/vendor/lucide-LICENSE.txt). Built by tools/ui-kit/build-icons.cjs; do not edit. -->`;
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${header}\n${symbols.join("\n")}\n</svg>\n`);
const licence = path.join(path.dirname(require.resolve("lucide-static/package.json")), "LICENSE");
if (fs.existsSync(licence)) fs.copyFileSync(licence, path.join(path.dirname(out), "vendor", "lucide-LICENSE.txt"));
console.log(`icons.svg: ${names.length} symbols from lucide-static ${version}`);
