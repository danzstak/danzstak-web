"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(source, /reelsRail\.setAttribute\("role", "dialog"\)[\s\S]*?reelsRail\.setAttribute\("aria-modal", "true"\)/,
  "fullscreen The Roll must be announced as a modal dialog");
assert.match(source, /reelsRail\.removeAttribute\("role"\)[\s\S]*?reelsRail\.removeAttribute\("aria-modal"\)/,
  "leaving fullscreen must restore the embedded section semantics");
assert.match(source, /if \(!reelsRail\.classList\.contains\("roll-fullscreen"\)\) return;[\s\S]*?event\.key === "Escape"[\s\S]*?setRollFullscreen\(false\)/,
  "Escape must close only an active fullscreen Roll");
assert.match(source, /event\.key !== "Tab"[\s\S]*?reelsRail\.querySelectorAll[\s\S]*?event\.shiftKey[\s\S]*?last\.focus\(\)[\s\S]*?first\.focus\(\)/,
  "Tab and Shift+Tab must stay inside the fullscreen Roll");
assert.match(source, /else \{[\s\S]*?rollOpen\.focus\(\{ preventScroll: true \}\)/,
  "closing fullscreen must return focus to its opener");

console.log("The Roll fullscreen accessibility checks passed: modal semantics, focus containment, Escape, and focus return.");
