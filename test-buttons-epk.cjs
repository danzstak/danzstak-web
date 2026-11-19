"use strict";
// Task 16-C sweep, EPK builder (owner 2026-11-17): the builder's buttons were square, uppercase, mono outlined boxes.
// They now follow the system on the dark page; the public EPK keeps its genre look. Real browser: AREA=epk buttons-site-audit.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("assets/buttons.css", "utf8");
const epk = fs.readFileSync("epk.html", "utf8");
assert.match(epk, /<link rel="stylesheet" href="assets\/buttons\.css\?v=\d+">/);
assert.ok(epk.lastIndexOf("assets/buttons.css") > epk.lastIndexOf("assets/epk-skin.css"), "loads after the EPK skin");
assert.match(css, /body\.epk-skin:not\(\.public-mode\) main button:not\(\.ds-icon-button\):not\(\[data-icon\]\),[\s\S]*?border-radius:var\(--ds-btn-radius\)!important;[\s\S]*?letter-spacing:0!important;text-transform:none!important;/, "builder buttons are pills, no uppercase blocks");
assert.match(css, /main :is\(button\.primary,a\.primary\):not\(\.ds-icon-button\),[\s\S]*?\{background:var\(--ds-btn-go,#15803d\)!important;color:#fff!important\}/, "one green go button with white text (owner 2026-11-19)");
assert.match(css, /body\.epk-skin:not\(\.public-mode\) main button\.ds-icon-button\{[\s\S]*?border:0!important;border-radius:50%!important;background:transparent!important/, "icon buttons are round and borderless");
assert.doesNotMatch(css, /body\.epk-skin\.public-mode/, "the public EPK look is untouched");
console.log("EPK builder button checks passed.");
