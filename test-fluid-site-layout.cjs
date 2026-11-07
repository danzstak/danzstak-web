"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/mobile-design-system.css", "utf8");
const hq = fs.readFileSync("assets/artist-hq.css", "utf8");
const feedSource = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const feedCss = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const bookingSelectionsCss = fs.readFileSync("assets/booking-selections.css", "utf8");

assert.match(css, /body:not\(\.public-mode\) :where\(\.panel,\.card\)[\s\S]*?border:0!important;[\s\S]*?background:transparent!important;[\s\S]*?box-shadow:none!important;/);
assert.match(css, /\.ds-tool-page :where\([^)]*\.booking-identity[^)]*\.epk-guide[^)]*\)[\s\S]*?border:0!important;[\s\S]*?background:transparent!important;/);
assert.match(css, /\.messages-page \.chat-shell[\s\S]*?border:0!important;[\s\S]*?background:transparent!important;[\s\S]*?box-shadow:none!important;/);
assert.doesNotMatch(hq, /artist-hq-card\{[^}]*border-(?:right|bottom):1px/, "HQ cards must not retain container divider lines");
assert.match(feedSource, /friendsHeading\.insertAdjacentElement\("afterend", invite\)/, "Friends invite must move into the title row");
assert.match(feedCss, /\.friends-heading-invite\{grid-column:2;margin-left:20px\}/, "Friends invite must sit five spacing units to the right of the heading");
assert.match(css, /\.ds-mobile-nav a\{transform:translateY\(-4px\)\}/, "tool navigation icons must sit above the footer baseline");
assert.match(css, /\.topbar \.topnav button\{transform:translateY\(-4px\)\}/, "social navigation icons must sit above the footer baseline");
assert.match(bookingSelectionsCss, /\.credit-panel,\.tour-manager-dashboard,\.tour-calendar-panel,\.artist-workspace,\.empty\{[\s\S]*?border:0;[\s\S]*?background:transparent;[\s\S]*?box-shadow:none;/, "Tour Manager outer sections must flow on the page canvas");
assert.match(bookingSelectionsCss, /\.tour-budget\{margin-top:6px;border-top:0;padding-top:4px\}/, "Tour estimate must not retain the divider or wasted vertical space");

console.log("Fluid site-layout checks passed: shared canvas, no decorative card shells, and no leftover HQ dividers.");
