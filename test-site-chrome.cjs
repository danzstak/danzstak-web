"use strict";
// Whole-site fix-it items (owner 2026-11-17). Real browser: browser-checks/site-chrome.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const hq = fs.readFileSync("assets/artist-hq.js", "utf8");
const css = fs.readFileSync("assets/site-chrome.css", "utf8");
const js = fs.readFileSync("assets/site-chrome.js", "utf8");
for (const intro of ["Posts, photos and videos you saved.", "Friend requests and account activity appear here.", "Find friends, answer requests and open SYNC", "Photos shared in Your Mix.", "Shows coming up. Promoters:", "Manage account privacy, device preferences", "Discover Tribes,"]) assert.ok(!feed.includes(intro), `no explanatory sub-line: ${intro}`);
assert.ok(!hq.includes("Your EPK and booking work in one place."), "no HQ sub-line");
for (const status of ["Publishing event…", "Settings saved to your DanzStak account.", "Outside ticket links must start with https://"]) assert.ok(feed.includes(status), `status messages still shown: ${status}`);
assert.match(css, /footer\.site-ownership\{display:none!important\}/);
assert.match(css, /#featureDescription:empty\{display:none!important\}/);
assert.match(feed, /ownership\.textContent = "© 2026 DanzStak LLC\. User content belongs to its creators\.";\s*legalLinks\.append\(privacyLink, termsLink, ownership\);/, "© moves into Settings");
for (const page of ["feed.html", "profile.html", "bazaar.html", "epk.html", "booking.html", "record-stores.html", "store.html"]) assert.match(fs.readFileSync(page, "utf8"), /<script src="assets\/site-chrome\.js\?v=\d+" defer><\/script>/, `${page} loads the external-link guard`);
// The guard really decides: outside links open outside; DanzStak links stay.
const sandbox = { location: { host: "danzstak.com", href: "https://danzstak.com/feed.html" }, URL, HTMLAnchorElement: class {}, document: { readyState: "complete", addEventListener() {}, querySelectorAll: () => [], body: {} }, MutationObserver: class { observe() {} }, window: {} };
sandbox.window = sandbox; vm.createContext(sandbox); vm.runInContext(js, sandbox);
const anchor = href => Object.assign(Object.create(sandbox.HTMLAnchorElement.prototype), { href, hasAttribute: () => false });
assert.equal(sandbox.danzstakIsExternalLink(anchor("https://soundcloud.com/a/b")), true);
assert.equal(sandbox.danzstakIsExternalLink(anchor("https://www.mixcloud.com/x/?utm_source=y")), true);
assert.equal(sandbox.danzstakIsExternalLink(anchor("https://danzstak.com/epk.html")), false);
assert.equal(sandbox.danzstakIsExternalLink(anchor("mailto:a@b.c")), false);
console.log("Site chrome checks passed.");
