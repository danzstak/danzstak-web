"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");
const art = fs.readFileSync("assets/danzstak-original-feed.css", "utf8");
const foundation = fs.readFileSync("assets/mobile-design-system.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(feed, /<body class="danzstak-original">/, "the scoped art direction must be explicit");
assert.match(feed, /assets\/mobile-design-system\.css\?v=13[\s\S]*assets\/danzstak-original-feed\.css\?v=7/, "the Feed layer must extend the shared foundation");
assert.doesNotMatch(feed, /\.menu \.app-menu-link\s*\{[^}]*min-height:\s*42px/, "legacy application links must not undercut the shared touch target");
assert.doesNotMatch(art, /--mix-/, "the Feed must not introduce a competing token palette");
for (const token of ["--ds-brand", "--ds-accent", "--ds-ink", "--ds-canvas", "--ds-surface", "--ds-border", "--ds-touch"]) {
  assert.match(foundation, new RegExp(token.replace("--", "--")), `shared foundation must define ${token}`);
  assert.match(art, new RegExp(`var\\(${token}\\)`), `Feed art direction must consume ${token}`);
}
assert.doesNotMatch(art, /#feed \.post :is\(img,video\)\s*\{[^}]*max-width:100%/, "Feed art direction must not reintroduce inset media");
assert.match(art, /\.menu :is\(a,\.menu-action\)[\s\S]*min-height:max\(44px,var\(--ds-touch\)\)/, "menu rows must preserve the shared 44px target");
assert.match(art, /\.menu-section-heading\s*\{[\s\S]*?margin:8px 8px 4px;/, "Feed art direction must not stretch mobile menu section spacing");
assert.match(art, /@media\(min-width:701px\)[\s\S]*post-composer:not\(\.is-expanded\)[\s\S]*height:46px!important/, "the initial desktop composer must be a compact prompt");
assert.match(worker, /danzstak-shell-v717/);
assert.match(worker, /\/assets\/danzstak-original-feed\.css/, "the installed PWA must cache the art-direction layer");

console.log("Original Feed art-direction checks passed: shared tokens, edge media, touch targets, and PWA caching.");
