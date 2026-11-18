"use strict";
// Task 16-A wiring (owner 2026-11-17). The behavior itself is checked in Edge by browser-checks/sync-native-shell.cjs
// (200-message thread, header/composer overlap, page scroll, keyboard, overflow).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("messages.html", "utf8"), js = fs.readFileSync("assets/sync-shell.js", "utf8"), css = fs.readFileSync("assets/sync-shell.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8"), messages = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.ok(html.indexOf("assets/sync-shell.css") > html.indexOf("assets/sync.css?v="), "the shell styles load after sync.css");
assert.ok(html.indexOf("assets/sync-shell.js") > html.indexOf("assets/direct-messages.js?v="), "the shell script loads after the thread code");
for (const file of ["sync-shell.css", "sync-shell.js"]) assert.ok(worker.includes(`"/assets/${file}"`), `offline shell caches ${file}`);

// The owner's bug: the page must never scroll inside a thread; the thread is sized to the visual viewport.
assert.match(js, /visualViewport\?\.addEventListener\("resize", fit\)/);
assert.match(js, /visualViewport\?\.addEventListener\("scroll", fit\)/);
assert.match(js, /if \(phone\.matches && inThread\(\) && scrollY\) scrollTo\(0, 0\)/, "a page scroll inside a thread is undone");
assert.match(css, /body\.messages-page\.is-conversation-open:not\(\[data-call-mode\]\)\{position:fixed;inset:0;height:var\(--sync-view-height,100dvh\);overflow:hidden\}/);
assert.match(css, /\.conversation-header\{position:relative;z-index:3;[^}]*background:#fff\}/, "the header paints above the list");
assert.match(css, /\.message-form\{position:relative;z-index:3;[^}]*background:#fff\}/, "the composer paints above the list");
assert.match(css, /\.message-list\{position:relative;z-index:1;[^}]*overflow-y:auto;overscroll-behavior:contain;[^}]*contain:paint/, "only the list scrolls, clipped to itself");
assert.match(css, /\.ds-mobile-nav\{display:none!important\}/, "no global bottom nav inside a thread");

// Date chips can't re-trigger their own observer (that froze the page once during development).
assert.match(js, /observer\.takeRecords\(\)/);
assert.match(js, /every\(node => node\.classList\?\.contains\("message-date-chip"\)\)/);
assert.match(messages, /if \(message\.createdAt\) item\.dataset\.createdAt = message\.createdAt;/);
assert.doesNotMatch(messages, /meta\.textContent = \(mine \? messageTranslate\("You"\)/, "bubbles show the time, not \"You ·\"");
// Finite load-older at the top: only the existing one-page button, once per page.
assert.match(js, /\.load-earlier-messages:not\(\[disabled\]\)[\s\S]*older\.dataset\.autoRequested = "1"; older\.click\(\)/);

// Translations.
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync("assets/i18n-sync.js", "utf8"), sandbox);
for (const lang of ["it", "fr", "es"]) for (const word of ["Today", "Yesterday", "Jump to the latest message", "{count} new messages, jump to the latest"]) {
  assert.ok(sandbox.window.danzstakTranslations[lang]?.[word], `${lang}: ${word}`);
}
console.log("SYNC native shell wiring passed: visual-viewport thread, page never scrolls, header/composer above the list, date chips, jump to latest, it/fr/es.");
