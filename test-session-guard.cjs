"use strict";
// Directive L1: every signed-in page loads assets/session-guard.js as its first script (so every API call goes through
// it), the offline shell caches it, logging out forgets the tab's session, and the return page after "Sign in again"
// can only be a DanzStak page. Browser behaviour: browser-checks/session-guard.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const pages = ["bazaar", "booking-selections", "booking", "epk", "feed", "messages", "moving-day", "profile", "record-stores", "store", "support", "sync", "trusted-contacts"];
for (const page of [...pages.map(name => `${name}.html`), "sync/index.html"]) {
  const html = fs.readFileSync(page, "utf8");
  const first = html.match(/<script src="([^"]+)"[^>]*>/);
  assert.ok(first, `${page}: no script`);
  assert.match(first[1], /^assets\/session-guard\.js\?v=\d+$/, `${page}: session-guard.js must be the first script, found ${first[1]}`);
  assert.doesNotMatch(first[0], /\b(defer|async)\b/, `${page}: session-guard.js must run before the page's other scripts`);
}
// Public pages a signed-out visitor opens keep their own handling (no guard).
for (const page of ["index.html", "shop.html", "privacy.html", "terms.html"]) assert.doesNotMatch(fs.readFileSync(page, "utf8"), /session-guard\.js/, `${page} should not load the guard`);

assert.match(fs.readFileSync("service-worker.js", "utf8"), /"\/assets\/session-guard\.js"/, "the offline shell caches session-guard.js");
const cleanup = fs.readFileSync("assets/session-cleanup.js", "utf8");
for (const key of ["danzstak_session_seen", "danzstak_session_drafts", "danzstak_return_to"]) assert.ok(cleanup.includes(`removeItem("${key}")`), `logging out clears ${key}`);

const guard = fs.readFileSync("assets/session-guard.js", "utf8");
assert.doesNotMatch(guard, /\bdefer\b.*session-guard/);
for (const lang of ["it", "fr", "es", "de", "pt"]) assert.match(guard, new RegExp(`\\b${lang}: \\{ "Sign in again to keep going"`), `sheet translated into ${lang}`);

// home.js: only a DanzStak page path is accepted as the return page.
const home = fs.readFileSync("assets/home.js", "utf8");
const source = home.slice(home.indexOf("function returnPage()"), home.indexOf("async function checkSession()"));
const check = stored => {
  const sessionStorage = { getItem: () => stored, removeItem() {} };
  return vm.runInNewContext(`${source}; returnPage()`, { sessionStorage });
};
assert.equal(check("/profile.html?member=11111111-1111-4111-8111-111111111111"), "./profile.html?member=11111111-1111-4111-8111-111111111111");
assert.equal(check("/sync/"), "./sync/");
assert.equal(check("/messages.html"), "./messages.html");
for (const bad of ["//evil.example/x.html", "https://evil.example/", "/index.html", "/../x.html", "/profile.html#x", "javascript:alert(1)", "/feed.html?x=<a>", ""]) assert.equal(check(bad), "", `rejects ${bad}`);

console.log("Session guard tests passed: first script on every signed-in page, cached offline, cleared on log out, return page limited to DanzStak pages, sheet in 6 languages.");
