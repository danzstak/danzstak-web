"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const pages = fs.readdirSync(root).filter((file) => file.endsWith(".html"));
let referenceCount = 0;

function targetMarkup(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

for (const page of pages) {
  const markup = targetMarkup(page);
  for (const match of markup.matchAll(/<(a|link|script|img)\b[^>]*?\b(href|src)=["']([^"']*)["'][^>]*>/gi)) {
    const [, tag, attribute, raw] = match;
    assert.ok(raw.trim(), `${page} contains an empty ${tag.toLowerCase()} ${attribute.toLowerCase()}`);
    if (/^(?:https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(raw)) continue;
    referenceCount += 1;
    const [pathAndQuery, fragment = ""] = raw.split("#", 2);
    const cleanPath = pathAndQuery.split("?")[0].replace(/^\.\//, "");
    const target = cleanPath || page;
    assert.ok(fs.existsSync(path.join(root, target)), `${page} points to missing internal target ${raw}`);
    if (!fragment || !target.endsWith(".html")) continue;
    const targetHtml = targetMarkup(target);
    const escapedFragment = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasTarget = new RegExp(`\\bid=["']${escapedFragment}["']`, "i").test(targetHtml);
    const isScriptedWorkspace = target === "feed.html" && new RegExp(`href=["']#${escapedFragment}["'][^>]+data-feature=`, "i").test(targetHtml);
    const isInstallAction = fragment === "install-danzstak" && /data-app-platform=["']apple["']/i.test(markup);
    assert.ok(hasTarget || isScriptedWorkspace || isInstallAction, `${page} points to unresolved fragment ${raw}`);
  }

  for (const button of markup.matchAll(/<button\b([^>]*)>/gi)) {
    assert.match(button[1], /\btype=["'](?:button|submit|reset)["']/i, `${page} has a button without an explicit type`);
  }
}

assert.ok(referenceCount >= 150, "the integrity crawl should cover the full static site, not a small fixture");
console.log(`Static navigation checks passed: ${pages.length} pages and ${referenceCount} internal links/assets resolve, fragments are handled, and buttons have explicit types.`);
