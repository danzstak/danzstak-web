"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/mobile-design-system.css", "utf8");
const chatCss = fs.readFileSync("assets/chat.css", "utf8");
const profileCss = fs.readFileSync("assets/profile-editor.css", "utf8");
const feedCss = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const pages = ["feed.html", "messages.html", "booking.html", "record-stores.html", "epk.html", "profile.html"].map(file => [file, fs.readFileSync(file, "utf8")]);

assert.match(css, /--ds-mobile-header:50px/, "the shared mobile header dimension must be explicit");
assert.match(css, /\.ds-mobile-nav\{[\s\S]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/, "the shared mobile nav must keep five equal destinations");
assert.match(css, /\.post>\.post-media[\s\S]*margin-left:-10px/, "phone media must extend through the card gutters consistently");
assert.match(css, /\.post-actions\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/, "post actions must remain one compact row");
assert.match(chatCss, /body\.is-conversation-open \.conversation-header\{[\s\S]*grid-template-columns:44px minmax\(0,1fr\) auto/, "phone Chat must reserve readable space for the contact name");
assert.match(chatCss, /body\.is-conversation-open \.conversation-avatar\{display:none\}/, "phone Chat must remove the redundant header avatar instead of clipping the contact name");
assert.match(profileCss, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, "phone profile tabs must render complete labels without horizontal clipping");
assert.match(feedCss, /\.settings-row input\[type=checkbox\]\{accent-color:#1769e0/, "settings controls must use the shared application styling");
assert.match(worker, /danzstak-shell-v648/);
assert.match(worker, /\/assets\/mobile-design-system\.css/, "the installed PWA must cache the shared mobile system");

for (const [file, html] of pages) assert.match(html, /assets\/mobile-design-system\.css\?v=6/, `${file} must load the same mobile design system`);
for (const file of ["messages.html", "booking.html", "record-stores.html", "epk.html", "profile.html"]) {
  const html = pages.find(([name]) => name === file)[1];
  assert.match(html, /class="ds-mobile-nav"/, `${file} must expose the consistent mobile navigation`);
  for (const destination of ["Home", "Friends", "Chat", "Buzz", "Menu"]) assert.match(html, new RegExp(`aria-label="${destination}"`), `${file} is missing ${destination}`);
}

console.log("Shared mobile design-system checks passed: consistent tokens, edge media, action geometry, tool navigation, and PWA caching.");
