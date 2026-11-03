const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const js = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(html, /class="mobile-menu-control"[^>]+aria-controls="mobileNavMenu"[^>]+aria-expanded="false"/, "phone header exposes an accessible Menu control");
assert.match(html, /<aside class="left" id="mobileNavMenu" aria-label="DanzStak menu">/, "the complete navigation rail is identified as the mobile drawer");
assert.match(html, /class="mobile-menu-backdrop"[^>]+aria-label="Close menu"/, "drawer has a real dismissible backdrop");
assert.match(html, /class="mobile-menu-close"[^>]+aria-label="Close menu"/, "drawer has an accessible close control");
assert.match(html, /class="menu-profile"[^>]+href="profile\.html"/, "drawer header links to the signed-in profile");
for (const heading of ["Social", "Music &amp; Entertainment", "Account"]) assert.ok(html.includes(`>${heading}</h2>`), `${heading} navigation group is present`);
for (const destination of ["feed.html?view=feed", "profile.html", "#friends", "#groups", "messages.html", "#photos", "#videos", "#events", "booking.html", "record-stores.html", "epk.html", "#saved", "#settings"]) assert.ok(html.includes(`href="${destination}"`), `${destination} remains available`);
const drawerMarkup = html.slice(html.indexOf('<aside class="left" id="mobileNavMenu"'), html.indexOf('<main id="yourMixMain"'));
assert.doesNotMatch(drawerMarkup, /[🏠👤👥📷🎬🎤🚌💿🗂🔖⚙🔒📄🚪]/u, "drawer navigation does not mix emoji with SVG icons");
assert.ok((drawerMarkup.match(/class="menu-icon"/g) || []).length >= 17, "drawer uses consistent SVG icons for its destinations");
assert.match(html, /<button type="button" class="menu-action logout-menu-link" data-logout>/, "Logout is an action button rather than a fake page link");
assert.doesNotMatch(html, /<a href="#" data-logout>/, "Logout must not jump the feed to a hash destination");
assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.layout\{display:block;/, "phone feed uses the full single-column width");
assert.match(css, /#mobileNavMenu\.left\{position:fixed;[\s\S]*?width:85vw;max-width:340px;[\s\S]*?transform:translateX\(-102%\);visibility:hidden/, "phone navigation is an 85%-wide off-canvas drawer capped at 340px");
assert.match(css, /\.mobile-menu-open #mobileNavMenu\.left\{transform:translateX\(0\);visibility:visible/, "opening the menu reveals the drawer");
assert.match(css, /\.content-only \.layout>\.left\{display:block\}/, "the mobile drawer remains available in focused workspace views");
assert.match(css, /\.topbar \.topnav\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important\}/, "the phone header makes room for the Menu control");
assert.match(css, /#mobileNavMenu \.menu-section>a,#mobileNavMenu \.menu-section>\.menu-action\{min-height:48px;padding:8px 12px;font-size:14px;gap:12px\}/, "menu destinations use consistent compact 48px rows");
assert.match(css, /#mobileNavMenu \.menu-icon\{[^}]*flex:0 0 22px;width:22px;height:22px/, "menu icons use a consistent 22px size");
assert.match(js, /mobileMenuControl\?\.addEventListener\("click"/, "the Menu control opens and closes the drawer");
assert.match(js, /mobileMenuBackdrop\?\.addEventListener\("click"/, "tapping the backdrop closes the drawer");
assert.match(js, /mobileMenuClose\?\.addEventListener\("click"/, "the close button dismisses the drawer");
assert.match(js, /event\.key === "Escape"/, "keyboard users can dismiss the drawer");
assert.match(js, /event\.key !== "Tab"/, "keyboard focus is trapped inside the open drawer");
assert.match(js, /event\.target\.closest\("a,\.menu-action"\)/, "choosing a destination or action closes the drawer");
assert.match(js, /hydrateMobileMenuProfile/, "drawer header hydrates the signed-in user's identity");

console.log("Mobile navigation checks passed: grouped SVG navigation, compact rows, profile header, focus trap, backdrop, link and Escape dismissal.");
