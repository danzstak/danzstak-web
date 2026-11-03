const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const js = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(html, /class="mobile-menu-control"[^>]+aria-controls="mobileNavMenu"[^>]+aria-expanded="false"/, "phone header exposes an accessible Menu control");
assert.match(html, /<aside class="left" id="mobileNavMenu" aria-label="DanzStak menu">/, "the complete navigation rail is identified as the mobile drawer");
assert.match(html, /class="menu-profile-header"/, "the drawer begins with a compact signed-in profile header");
assert.match(html, /id="menuProfileName">My Profile</, "the profile header has a safe fallback while account details load");
assert.match(html, /class="menu-close"[^>]+data-menu-close[^>]+aria-label="Close menu"/, "the drawer has an accessible close control");
for (const section of ["Social", "Music &amp; Entertainment", "Account"]) assert.match(html, new RegExp(`class="menu-section-heading">${section}<`), `the drawer includes the ${section} group`);
assert.match(html, /<button type="button" class="menu-action logout-menu-link" data-logout>/, "Logout is an action button rather than a fake page link");
assert.doesNotMatch(html, /<a href="#" data-logout>/, "Logout must not jump the feed to a hash destination");
assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.layout\{display:block;/, "phone feed uses the full single-column width");
assert.match(css, /\.left\{display:block;position:fixed;[\s\S]*?transform:translateX\(-105%\);visibility:hidden/, "phone navigation is off-canvas until requested");
assert.match(css, /\.mobile-menu-open \.left\{transform:translateX\(0\);visibility:visible/, "opening the menu reveals the drawer");
assert.match(css, /width:min\(340px,86vw\)/, "the drawer uses the requested compact responsive maximum width");
assert.match(css, /env\(safe-area-inset-top\)/, "the drawer respects the phone safe area");
assert.match(css, /\.menu-profile-header\{display:flex;align-items:center/, "the profile shortcut and close control share one compact row");
assert.match(css, /\.content-only \.layout>\.left\{display:block\}/, "the mobile drawer remains available in focused workspace views");
assert.match(css, /\.topbar \.topnav\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important\}/, "the phone header makes room for the Menu control");
assert.match(css, /\.menu \.menu-action\{grid-template-columns:18px minmax\(0,1fr\)/, "menu actions share the compact phone navigation layout");
assert.match(js, /mobileMenuControl\?\.addEventListener\("click"/, "the Menu control opens and closes the drawer");
assert.match(js, /\[data-menu-close\]"\)\?\.addEventListener\("click", closeMobileMenuFromControl\)/, "the close control uses the same history-safe dismissal path");
assert.match(js, /event\.key === "Escape"/, "keyboard users can dismiss the drawer");
assert.match(js, /event\.target\.closest\("a"\)/, "choosing a destination closes the drawer");

console.log("Mobile navigation checks passed: full-width feed, accessible Menu drawer, link and Escape dismissal.");
