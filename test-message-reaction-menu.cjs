const fs = require("fs");
const assert = require("assert");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(source, /palette\.setAttribute\("role", "menu"\)/,
  "message actions expose menu semantics");
assert.match(source, /item\.setAttribute\("aria-haspopup", "menu"\)/,
  "each message announces its contextual action menu");
assert.match(source, /item\.setAttribute\("aria-controls", palette\.id\)/,
  "each message identifies the active action menu");
assert.match(source, /setAttribute\("role", "menuitem"\)/,
  "message reactions and destructive choices expose menu-item semantics");
assert.match(source, /"ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"/,
  "message actions support directional keyboard navigation");
assert.match(source, /palette\.addEventListener\("focusout"/,
  "message actions dismiss when keyboard focus leaves");
assert.match(source, /document\.addEventListener\("pointerdown"[\s\S]*outsideController\.signal/,
  "message actions dismiss after an outside pointer interaction without leaking listeners");
assert.match(source, /item\.setAttribute\("aria-expanded", "false"\)/,
  "dismissing message actions publishes the closed state");

console.log("Message reaction menu accessibility checks passed.");
