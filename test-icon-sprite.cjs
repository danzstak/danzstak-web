"use strict";
// Lucide sprite (docs/tasks/39-modern-look.md section 2, 39a): the sprite holds exactly the icons listed in
// tools/ui-kit/icons.json, geometry only (no fill/stroke/colour of its own, so .ds-icon decides outline or filled),
// every icons.svg#name used in a page or script exists, and the ISC licence ships beside it.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = __dirname;
const sprite = fs.readFileSync(path.join(root, "assets", "icons.svg"), "utf8");
const listed = require("./tools/ui-kit/icons.json").icons;
const ids = [...sprite.matchAll(/<symbol id="([a-z0-9-]+)" viewBox="0 0 24 24">/g)].map(m => m[1]);
assert.deepEqual(ids, listed, "icons.svg has exactly the icons in tools/ui-kit/icons.json, in order");
assert.equal(new Set(listed).size, listed.length, "no icon listed twice");
assert.doesNotMatch(sprite.replace(/<svg[^>]*>/, ""), /\b(fill|stroke|stroke-width|class|style)=/, "symbols carry geometry only");
assert.doesNotMatch(sprite, /<script|on[a-z]+=|href=/i, "nothing active in the sprite");
assert.ok(fs.existsSync(path.join(root, "assets", "vendor", "lucide-LICENSE.txt")), "Lucide licence beside the sprite");

const used = new Set();
const files = fs.readdirSync(root).filter(f => f.endsWith(".html")).map(f => path.join(root, f))
  .concat(fs.readdirSync(path.join(root, "assets")).filter(f => f.endsWith(".js")).map(f => path.join(root, "assets", f)));
for (const file of files) for (const m of fs.readFileSync(file, "utf8").matchAll(/icons\.svg#([a-z0-9-]+)/g)) used.add(m[1]);
// Kit icon buttons name their icon in code: danzstakIconButton(control, "pencil", …), danzstakIcon("share"), and the
// profile's kit(button, "user-plus", …) wrappers. Every literal name must be in the sprite (UIKIT 4b part 2).
for (const file of files) for (const m of fs.readFileSync(file, "utf8").matchAll(/(?:danzstakIconButton\(\w+|\bkit(?:Button)?\(\w+), (?:[^,]*\? )?"([a-z0-9-]+)"/g)) used.add(m[1]);
for (const m of fs.readFileSync(path.join(root, "assets", "profile-friend.js"), "utf8").matchAll(/"(user-check|user-plus|clock)"/g)) used.add(m[1]);
for (const m of fs.readFileSync(path.join(root, "assets", "ds-icon.js"), "utf8").matchAll(/danzstakIcon\("([a-z0-9-]+)"/g)) used.add(m[1]);
const unknown = [...used].filter(name => !ids.includes(name));
assert.deepEqual(unknown, [], `icons used but not in the sprite: ${unknown.join(", ")}`);
console.log(`icons.svg: ${ids.length} symbols, ${used.size} referenced, all present`);
