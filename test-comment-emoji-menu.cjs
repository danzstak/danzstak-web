const fs = require("fs");
const assert = require("assert");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(source, /emoji\.setAttribute\("aria-haspopup", "menu"\)/,
  "the comment emoji control announces its popup menu");
assert.match(source, /emoji\.setAttribute\("aria-controls", emojiMenu\.id\)/,
  "the comment emoji control identifies its popup");
assert.match(source, /emojiMenu\.setAttribute\("role", "menu"\)/,
  "the emoji popup exposes menu semantics");
assert.match(source, /choice\.setAttribute\("role", "menuitem"\)/,
  "emoji choices expose menu-item semantics");
assert.match(source, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/,
  "keyboard users can move among emoji choices");
assert.match(source, /event\.key === "Escape"/,
  "Escape closes the emoji menu");
assert.match(source, /emojiMenu\.addEventListener\("focusout"/,
  "the emoji menu closes when focus leaves it");

console.log("Comment emoji menu accessibility checks passed.");
