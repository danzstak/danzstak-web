"use strict";
// Owner 2026-11-19 (screenshot): the box beside the avatar covered the name. Behaviour check: browser-checks/profile-showcase-fit.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8"), css = fs.readFileSync("assets/profile-shop.css", "utf8");
assert.match(editor, /const room = name \? Math\.floor\(name\.getBoundingClientRect\(\)\.top - coverBottom - 4 - 8\) : 84;/, "box height = the space between the cover and the name");
assert.match(editor, /preview\.style\.top = Math\.max\(0, Math\.round\(coverBottom - boxTop\) \+ 4\) \+ "px";/, "box starts where the cover ends");
assert.match(editor, /avatar\.getBoundingClientRect\(\)\.right - box\.getBoundingClientRect\(\)\.left \+ 12/, "box starts clear of the round avatar");
assert.match(css, /\.profile-showcase-photo\{height:var\(--showcase-room,84px\)!important/, "photo fits the room");
assert.match(css, /\.profile-showcase\{align-items:flex-start;max-height:var\(--showcase-room,84px\)\}/, "prompt never grows over the name");
console.log("Profile showcase fit wiring checks passed: box meets the cover, sized to the space above the name, clear of the avatar.");
