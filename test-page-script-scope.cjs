"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const pages = fs.readdirSync(__dirname).filter(file => file.endsWith(".html"));
assert.ok(pages.length > 0, "at least one HTML page should be available for script-scope checks");

for (const page of pages) {
  const html = fs.readFileSync(path.join(__dirname, page), "utf8");
  const scripts = [];

  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1];
    if (/\btype=["']application\/(?:ld\+)?json["']/i.test(attributes)) continue;

    const source = attributes.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!source) {
      scripts.push(`\n// Inline script from ${page}\n${match[2]}`);
      continue;
    }

    const localPath = source.split("?")[0];
    if (/^(?:https?:)?\/\//i.test(localPath)) continue;
    const resolved = path.join(__dirname, localPath);
    if (!fs.existsSync(resolved)) continue;
    scripts.push(`\n// ${localPath}\n${fs.readFileSync(resolved, "utf8")}`);
  }

  assert.doesNotThrow(
    () => new vm.Script(scripts.join("\n"), { filename: page }),
    `${page} scripts must compile together without shared-global declaration collisions`
  );
}

console.log(`Page script-scope checks passed: ${pages.length} HTML pages compile with their local scripts.`);
