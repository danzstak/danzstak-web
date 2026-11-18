"use strict";
// Edit profile is its own screen (task 19, owner 2026-11-18). Real browser: browser-checks/profile-edit-screen.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const js = fs.readFileSync("assets/profile-editor.js", "utf8"), css = fs.readFileSync("assets/profile-editor.css", "utf8");
const markup = js.slice(js.indexOf("panel.innerHTML ="), js.indexOf("actions.insertAdjacentElement(\"afterend\", panel);"));
// Top bar: Back, title, Save.
assert.match(markup, /class="edit-screen-bar"><button type="button" class="ds-btn-icon edit-screen-back" data-edit-back/);
assert.match(markup, /<h2 tabindex="-1">' \+ profileEditorWords\.edit \+ '<\/h2><button type="submit" class="ds-btn-text edit-screen-save">/);
// No explanation lines, no Moving Day box (Pivot lives in Menu).
assert.doesNotMatch(markup, /nameHelp|edit-note|profileEditorWords\.note/, "no explanatory sub-lines");
assert.doesNotMatch(markup, /Moving Day|profile-import|profilePivotButton/, "no Moving Day box");
// Own history entry; Back returns to the profile at the same scroll spot; ?edit=1 opens it.
assert.match(js, /history\.pushState\(\{ \.\.\.\(history\.state \|\| \{\}\), profileEdit: true \}/);
assert.match(js, /window\.addEventListener\("popstate", event => \{ if \(!event\.state\?\.profileEdit && document\.body\.classList\.contains\("profile-editing"\)\) closeEditScreen\(true\); \}\)/);
assert.match(js, /window\.scrollTo\(0, editScreenScroll\)/);
assert.match(js, /get\("edit"\) === "1"/);
assert.match(js, /closeEditScreen\(false\);\n  \} catch \(error\)/, "saving closes the screen");
// Full screen, opaque, rows with chevrons, sticky Cancel/Save on phones.
assert.match(css, /body\.profile-editing \.edit-profile-panel:not\(\[hidden\]\)\{position:fixed;inset:0;z-index:10040;[^}]*background:#fff!important/);
assert.match(css, /\.profile-edit-section\{margin:0;padding:0;border:0;border-bottom:1px solid #e4e8ee;border-radius:0/);
assert.match(css, /\.profile-edit-section\[open\]>summary::after\{transform:rotate\(45deg\)\}/);
assert.match(css, /\.edit-actions\{position:sticky;bottom:0;/);
console.log("Edit profile screen checks passed: top bar (Back, title, Save), no explanation lines, no Moving Day box, own history entry with scroll restore, ?edit=1, full-screen opaque layer, rows with chevrons, sticky Cancel/Save.");
