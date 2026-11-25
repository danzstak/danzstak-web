"use strict";
// Directive F4 (owner 2026-11-19): name beside the avatar, the picture band below the name row at full width, actions
// under it. Behaviour check: browser-checks/profile-showcase-fit.cjs (320-430px, short and very long names).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8"), css = fs.readFileSync("assets/profile-shop.css", "utf8");
const polish = fs.readFileSync("assets/profile-polish.css", "utf8");
assert.match(css, /#profileContent\.profile\{position:relative;display:grid;grid-template-columns:auto minmax\(0,1fr\)/, "header grid: avatar | name");
assert.match(css, /#profileContent\.profile>#profileName\{grid-column:2;grid-row:1;/, "the name sits right of the avatar");
assert.match(css, /\.profile-showcase-frame\{display:block;width:100%;aspect-ratio:16\/7;overflow:hidden;/, "a full-width 16:7 frame that clips a zoomed photo (F12)");
assert.match(css, /\.profile-showcase-photo\{display:block;width:100%;height:100%;object-fit:cover\}/, "the photo fills the frame");
assert.match(fs.readFileSync("tools/ui-kit/components.css", "utf8"), /\.ds\.ds-actions\{[^}]*margin:0;/, "the header sets each gap once (the kit action row has no margin of its own)");
const fit = editor.match(/function fitProfileName\(\) \{[\s\S]*?\r?\n\}\r?\n/)[0]; // CRLF on Windows checkouts
assert.match(fit, /size >= 18; size -= 1/, "one line down to 18px");
assert.match(fit, /size >= 15; size -= 1/, "then two lines down to 15px");
assert.match(fit, /textHeight <= line \* 2 \+ 2/, "two lines, measured without the padding");
assert.match(editor, /new MutationObserver\(refit\)\.observe\(name, \{ childList: true, characterData: true, subtree: true \}\)/, "a rename re-fits the name");
assert.match(editor, /menu\.className = "profile-showcase-menu"/, "the owner gets one ⋯ on the photo");
assert.doesNotMatch(editor, /placeProfileShopPreview|--showcase-room/, "the old box-beside-the-avatar sizing is gone");
console.log("Profile header (F4) wiring checks passed: avatar | name grid, full-width 16:7 band, name fit to 18px then two lines, rename re-fit, owner ⋯.");
