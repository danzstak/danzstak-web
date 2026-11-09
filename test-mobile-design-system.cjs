"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/mobile-design-system.css", "utf8");
const chatCss = fs.readFileSync("assets/chat.css", "utf8");
const syncCss = fs.readFileSync("assets/sync.css", "utf8");
const profileCss = fs.readFileSync("assets/profile-editor.css", "utf8");
const feedCss = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const pages = ["feed.html", "messages.html", "booking.html", "record-stores.html", "epk.html", "profile.html"].map(file => [file, fs.readFileSync(file, "utf8")]);

assert.match(css, /--ds-mobile-header:50px/, "the shared mobile header dimension must be explicit");
for (const token of ["--ds-brand", "--ds-accent", "--ds-ink-soft", "--ds-surface-subtle", "--ds-font", "--ds-shadow-sm", "--ds-radius-lg"]) {
  assert.match(css, new RegExp(`${token}:`), `the shared visual system must define ${token}`);
}
assert.match(css, /--ui-blue:var\(--ds-brand\)/, "legacy UI controls must resolve through the shared brand token");
assert.match(css, /font-family:"DanzStak Sans";[\s\S]*fonts\/archivo\.woff2/, "the shared shell must use the self-hosted DanzStak typeface");
assert.match(css, /background-image:radial-gradient/, "the light canvas must carry a restrained DANZSTAK brand accent");
assert.match(css, /html\{[^}]*overflow-x:hidden;overflow-x:clip/, "horizontal containment must not create a scroll container that breaks sticky headers");
assert.match(css, /body\{[^}]*overflow-x:hidden;overflow-x:clip/, "body containment must preserve sticky headers during hash navigation");
assert.match(css, /\.ds-mobile-nav\{[\s\S]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/, "the shared mobile nav must keep five equal destinations");
assert.match(css, /\.ds-mobile-nav\{[\s\S]*background:rgba\(255,255,255,\.96\)/, "the shared mobile nav must use the light premium surface");
assert.match(css, /\.ds-mobile-nav a\[aria-current=page\]\{background:var\(--ds-accent-soft\);color:#b74708;box-shadow:inset 0 3px 0 var\(--ds-accent\)\}/, "the current destination must carry a DanzStak orange cue");
assert.match(css, /\.post>\.post-media[\s\S]*margin-left:-10px/, "phone media must extend through the card gutters consistently");
assert.match(css, /\.post-actions\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/, "post actions must remain one compact row");
assert.match(chatCss, /body\.is-conversation-open \.conversation-header\{[\s\S]*grid-template-columns:44px minmax\(0,1fr\) auto/, "phone Chat must reserve readable space for the contact name");
assert.match(chatCss, /body\.is-conversation-open \.conversation-avatar\{display:none\}/, "phone Chat must remove the redundant header avatar instead of clipping the contact name");
assert.match(chatCss, /body\.is-conversation-open #minimizeConversation\{display:none!important\}/, "phone Chat must override the shared icon display when hiding desktop-only minimize");
assert.doesNotMatch(chatCss, /body\.is-conversation-open #headerVideo\{display:none!important\}/, "video calling must remain discoverable on very narrow phones");
assert.match(syncCss, /@media\(min-width:761px\) and \(max-width:900px\)\{[\s\S]*grid-template-columns:minmax\(250px,290px\) minmax\(0,1fr\)!important/, "tablet Chat must leave enough room for the contact name and header actions");
assert.match(profileCss, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, "phone profile tabs must render complete labels without horizontal clipping");
assert.match(feedCss, /\.settings-row input\[type=checkbox\]\{accent-color:#1769e0/, "settings controls must use the shared application styling");
assert.match(feedCss, /mobile-menu-open>\.install-app-button,[^{]*mobile-menu-open>\.app-update-button\{display:none!important\}/, "install shortcuts must not compete with an open mobile menu");
assert.match(css, /body\{padding-bottom:calc\(50px \+ env\(safe-area-inset-bottom\) \+ 2px\)\}/, "the shared shell must clear fixed navigation despite fractional layout rounding");
assert.match(css, /body\.profile-page\{padding-bottom:calc\(54px \+ env\(safe-area-inset-bottom\) \+ 2px\)\}/, "Profile must clear its fixed mobile navigation");
assert.match(css, /\.messages-page:not\(\.is-conversation-open\)\{padding-bottom:calc\(54px \+ env\(safe-area-inset-bottom\) \+ 2px\)\}/, "the SYNC inbox must clear its fixed mobile navigation");
assert.match(feedCss, /\.notification-actions :is\(button,a\)\{[^}]*min-width:44px;min-height:44px/, "notification actions must retain 44px phone targets");
assert.match(worker, /danzstak-shell-v773/);
assert.match(worker, /\/assets\/mobile-design-system\.css/, "the installed PWA must cache the shared mobile system");

for (const [file, html] of pages) assert.match(html, /assets\/mobile-design-system\.css\?v=17/, `${file} must load the same mobile design system`);
for (const file of ["messages.html", "booking.html", "record-stores.html", "epk.html", "profile.html"]) {
  const html = pages.find(([name]) => name === file)[1];
  assert.match(html, /class="ds-mobile-nav"/, `${file} must expose the consistent mobile navigation`);
  for (const destination of ["Home", "Friends", "Chat", "Buzz", "Menu"]) assert.match(html, new RegExp(`aria-label="${destination}"`), `${file} is missing ${destination}`);
}
for (const file of ["booking.html", "record-stores.html", "epk.html", "profile.html"]) {
  const html = pages.find(([name]) => name === file)[1];
  assert.match(html, /data-icon="menu"[^>]*aria-current="page"/, `${file} must identify its secondary Menu destination`);
}
assert.match(pages.find(([name]) => name === "messages.html")[1], /data-icon="chat"[^>]*aria-current="page"/, "Chat must identify its direct mobile destination");
assert.match(pages.find(([name]) => name === "messages.html")[1], /assets\/sync\.css\?v=8/, "Chat must request the current compact mobile layout instead of a cached stylesheet");
assert.match(fs.readFileSync("assets/feed-enhancements.js", "utf8"), /function syncMobileMenuCurrent[\s\S]*directMobileDestinations\.has\(workspaceName\)/, "Feed workspaces must synchronize the shared Menu current state");

console.log("Shared mobile design-system checks passed: consistent tokens, edge media, action geometry, tool navigation, and PWA caching.");
assert.match(css, /body:not\(\.public-mode\) :where\(\.panel,\.card\)[\s\S]*?border:0!important;[\s\S]*?background:transparent!important;[\s\S]*?box-shadow:none!important;/, "shared application containers must flow on one transparent canvas");
assert.match(css, /\.ds-tool-page :where\([^)]*\.booking-identity[^)]*\.epk-guide[^)]*\)[\s\S]*?background:transparent!important;/, "music tools must use the same fluid canvas");
assert.match(css, /\.messages-page \.chat-shell[\s\S]*?background:transparent!important;[\s\S]*?box-shadow:none!important;/, "SYNC must not sit inside a decorative outer box");
