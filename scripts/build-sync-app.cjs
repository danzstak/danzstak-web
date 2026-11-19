#!/usr/bin/env node
"use strict";
// Task 34 (owner 2026-11-18): SYNC installs as its own app. Chrome installs one app per scope, and DanzStak already owns
// "/", so SYNC lives under /sync/ with its own manifest (sync.webmanifest, scope /sync/). The SYNC screen itself is
// messages.html; sync/index.html is generated from it so there is one source:
//   - <base href="/"> so every relative asset, link and script navigation still resolves from the site root
//     (the CSP allows base-uri 'self' for that, nothing wider);
//   - the SYNC manifest, title and icons instead of DanzStak's;
//   - in-page "#" links point at /sync/ so the base does not send them to the homepage.
// scripts/bump-versions.cjs runs this after every bump, and test-sync-own-app.cjs fails if the copy drifts.
//
//   node scripts/build-sync-app.cjs          # write sync/index.html
//   node scripts/build-sync-app.cjs --check  # exit 1 if sync/index.html is out of date
const fs = require("node:fs");
const path = require("node:path");

const NOTICE = "<!-- Generated from messages.html by scripts/build-sync-app.cjs. Edit messages.html, then run the script (bump-versions.cjs runs it too). -->";

function replaceOnce(text, find, replacement, what) {
  const count = text.split(find).length - 1;
  if (count !== 1) throw new Error(`build-sync-app: expected exactly one ${what} in messages.html, found ${count}`);
  return text.replace(find, replacement);
}

function build(messagesHtml) {
  let html = String(messagesHtml).replace(/\r\n/g, "\n");
  html = replaceOnce(html, "<!DOCTYPE html>\n", `<!DOCTYPE html>\n${NOTICE}\n`, "doctype");
  html = replaceOnce(html, '<meta charset="UTF-8">\n', '<meta charset="UTF-8">\n<base href="/">\n', "charset meta");
  html = replaceOnce(html, "base-uri 'none'", "base-uri 'self'", "CSP base-uri");
  html = replaceOnce(html, '<meta name="theme-color" content="#121418">', '<meta name="theme-color" content="#0b0b0c">', "theme-color");
  html = replaceOnce(html, '<link rel="manifest" href="manifest.webmanifest">', '<link rel="manifest" href="/sync.webmanifest">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="SYNC">', "manifest link");
  html = replaceOnce(html, '<link rel="apple-touch-icon" href="assets/apple-touch-icon.png?v=3">', '<link rel="apple-touch-icon" href="assets/sync-apple-touch-icon.png?v=1">', "apple-touch-icon");
  html = html.replace(/<title>[^<]*<\/title>/, "<title>SYNC by DanzStak</title>");
  html = html.replace(/href="#/g, 'href="/sync/#');
  return html;
}

const root = path.resolve(__dirname, "..");
const source = () => fs.readFileSync(path.join(root, "messages.html"), "utf8");
const target = path.join(root, "sync", "index.html");
// Returns true when sync/index.html changed (or would change with dryRun).
function write({ dryRun = false } = {}) {
  const next = build(source());
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current === next) return false;
  if (!dryRun) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, next); }
  return true;
}

if (require.main === module) {
  if (process.argv.includes("--check")) {
    const stale = write({ dryRun: true });
    if (stale) { console.error("sync/index.html is out of date: run node scripts/build-sync-app.cjs"); process.exitCode = 1; }
    else console.log("sync/index.html is up to date.");
  } else console.log(write() ? "updated sync/index.html" : "sync/index.html already up to date");
}
module.exports = { build, write };
