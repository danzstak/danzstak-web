"use strict";
// Owner 2026-11-18: Privacy and Terms belong in the main Menu and on the signed-out landing pages only — not at the
// bottom of every signed-in page.
const fs = require("node:fs");
const assert = require("node:assert");
const allowed = new Set(["index.html", "answer.html", "privacy.html", "terms.html", "feed.html"]);
for (const file of fs.readdirSync(".").filter(n => n.endsWith(".html"))) {
  if (allowed.has(file)) continue;
  const html = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(html, /href="\/?(privacy|terms)\.html"/, `${file}: Privacy/Terms links belong in the Menu, not on this page`);
}
const feed = fs.readFileSync("feed.html", "utf8");
for (const m of feed.matchAll(/href="\/?(privacy|terms)\.html"/g)) {
  const before = feed.slice(Math.max(0, m.index - 4000), m.index);
  assert.ok(/class="[^"]*menu/.test(before), "feed.html: Privacy/Terms only inside the Menu");
}
console.log("Privacy/Terms links appear only in the Menu and on signed-out pages.");
