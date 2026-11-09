"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");
const art = fs.readFileSync("assets/danzstak-original-feed.css", "utf8");
const foundation = fs.readFileSync("assets/mobile-design-system.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(feed, /<body class="danzstak-original">/, "the scoped art direction must be explicit");
assert.match(feed, /assets\/mobile-design-system\.css\?v=18[\s\S]*assets\/danzstak-original-feed\.css\?v=30/, "the Feed layer must extend the shared foundation");
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
assert.match(art, /\.topbar\s*\{[\s\S]*?background:#101722;[\s\S]*?border-bottom:3px solid var\(--ds-accent\)/, "the first viewport must use the DanzStak stage-and-orange header instead of stock social blue");
assert.match(art, /\.topbar \.topnav\s*\{[\s\S]*?background:rgba\(255,255,255,\.96\)/, "the phone navigation must use the premium light application bar");
assert.match(art, /\.story-create:hover \.story-create-avatar \{transform:scale\(1\.025\)\}/, "Dailies artwork needs a restrained interactive finish");
assert.match(art, /#storiesRail \.story-create-avatar\s*\{[\s\S]*?inset:0;[\s\S]*?width:100%!important;[\s\S]*?height:100%!important;[\s\S]*?background-size:cover!important;/, "the member image must fill the complete Dailies tile despite shared image sizing");
assert.match(art, /#storiesRail \.story-create-avatar\s*\{[\s\S]*?object-fit:cover;[\s\S]*?object-position:center 28%;/, "the member profile photo must crop cleanly to the full Dailies tile");
assert.match(art, /#storiesRail \.story-create-avatar\s*\{[\s\S]*?width:100%!important;[\s\S]*?height:100%!important;[\s\S]*?border-radius:50%!important/, "Dailies must keep the member profile image round while expanding it to the full tile bounds");
assert.match(art, /\.layout\s*\{[\s\S]*?grid-template-columns:minmax\(184px,222px\) minmax\(470px,500px\) minmax\(190px,244px\)/, "the desktop center column must use the owner-selected 470–500px feed width");
assert.match(art, /#feed\s*\{[\s\S]*?display:grid;[\s\S]*?gap:16px;/, "posts must keep a 16px vertical gap");
assert.match(art, /\.post\s*\{[\s\S]*?--post-inline-padding:14px;[\s\S]*?padding:14px;[\s\S]*?margin-bottom:16px;/, "desktop post cards must keep 14px internal padding and a 16px rhythm");
assert.match(worker, /danzstak-shell-v789/);
assert.match(worker, /\/assets\/danzstak-original-feed\.css/, "the installed PWA must cache the art-direction layer");

console.log("Original Feed art-direction checks passed: shared tokens, edge media, touch targets, and PWA caching.");
