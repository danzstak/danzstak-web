"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(source, /dialog\.setAttribute\("aria-labelledby", titleId\)/,
  "dynamic dialogs need an explicit accessible name");
assert.match(source, /if \(opener\?\.isConnected\) opener\.focus\(\{ preventScroll: true \}\)/,
  "dialogs must return focus to their opener");
assert.match(source, /openPostReportDialog\(post, toggle\)/,
  "the post menu must provide a stable focus-return target");
assert.match(source, /dialog\.querySelector\("button\[value=done\]"\)\.focus\(\)/,
  "successful report submission must move focus to its completion action");
assert.match(source, /dialog\.querySelector\('\[name="reason"\]'\)\.focus\(\)/,
  "report dialogs must focus their first field");
assert.match(source, /if \(menu\.contains\(document\.activeElement\)\) toggle\.focus\(\{ preventScroll: true \}\)/,
  "completed post-menu actions must not leave focus inside a hidden menu");

console.log("Dialog focus checks passed: named dialogs, initial focus, completion focus, and opener restoration.");
