"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/profile-editor.js", "utf8");

assert.match(source, /let profileEditorOpener = null;/,
  "the profile editor must remember the control that opened it");
assert.match(source, /activeElement instanceof HTMLElement && !panel\.contains\(activeElement\)[\s\S]*?profileEditorOpener = activeElement/,
  "opening the editor must capture a stable focus-return target");
assert.match(source, /function closeProfileEditor\([\s\S]*?profileEditorOpener\?\.isConnected \? profileEditorOpener : editButton[\s\S]*?focusTarget\.focus\(\{ preventScroll: true \}\)/,
  "closing the editor must restore focus to its opener or the Edit Profile control");
assert.match(source, /url\.searchParams\.has\("edit"\)[\s\S]*?url\.searchParams\.delete\("edit"\)[\s\S]*?history\.replaceState/,
  "closing a deep-linked editor must clear only the temporary edit route");
assert.match(source, /\[data-cancel\][\s\S]*?closeProfileEditor\(\)/,
  "Cancel must use the shared close path");
assert.match(source, /status\.textContent = profileTranslate\("Profile saved[\s\S]*?closeProfileEditor\(\)/,
  "a successful save must also use the shared close path");

console.log("Profile editor focus checks passed: cancel/save restore focus and clear the temporary edit route.");
