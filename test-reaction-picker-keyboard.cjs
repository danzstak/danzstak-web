"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(source, /palette\.id = "reaction-palette-" \+ \(\+\+reactionPaletteSequence\)/,
  "each reaction toolbar needs a unique controlled element id");
assert.match(source, /button\.setAttribute\("aria-haspopup", "true"\)[\s\S]*?button\.setAttribute\("aria-controls", palette\.id\)[\s\S]*?button\.setAttribute\("aria-expanded", "false"\)/,
  "reaction controls must expose their popup relationship and closed state");
assert.match(source, /palette\.hidden = false; opener\.setAttribute\("aria-expanded", "true"\)/,
  "opening a reaction toolbar must update the active opener state");
assert.match(source, /const hide = \(\) => \{ palette\.hidden = true; opener\?\.setAttribute\("aria-expanded", "false"\); \}/,
  "closing a reaction toolbar must clear the expanded state");
assert.match(source, /\["ArrowRight", "ArrowLeft", "Home", "End"\]\.includes\(event\.key\)[\s\S]*?choices\[next\]\.focus\(\)/,
  "reaction choices must support toolbar arrow, Home, and End navigation");
assert.match(source, /event\.shiftKey && event\.key === "F10"[\s\S]*?palette\.querySelector\("button"\)\?\.focus\(\)/,
  "Shift+F10 must open the picker and focus its first choice");
assert.match(source, /event\.key === "Escape"[\s\S]*?hide\(\); opener\.focus\(\)/,
  "Escape must close the picker and restore its opener");

console.log("Reaction picker keyboard checks passed: popup state, Shift+F10, arrows, Home/End, Escape, and focus return.");
