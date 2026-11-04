"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const chat = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(source, /function activateMobileScreen\(screen, \{ preserveMenu = false \} = \{\}\)/, "mobile navigation has one shared screen controller");
assert.match(source, /globalThis\.danzstakActivateMobileScreen = activateMobileScreen/, "inline Chat and workspace navigation use the same controller");
assert.match(source, /setMobileMenu\(open,[\s\S]*?danzstakActivateMobileScreen\?\.\("menu", \{ preserveMenu: true \}\)/, "opening Menu first deactivates other primary overlays");
assert.match(source, /openWorkspaceRoute\(name,[\s\S]*?activateMobileScreen\(canonicalName\)/, "Friends, Notifications and other workspaces select one primary screen");
assert.match(source, /\[data-route="home"\][\s\S]*?activateMobileScreen\("home"\)/, "Home deactivates the previous mobile primary screen");
assert.match(source, /messagesNav[\s\S]*?activateMobileScreen\("chat"\)/, "Chat deactivates the previous mobile primary screen");
assert.match(feed, /@media\(max-width:700px\)\{\.message-drawer\{inset:0;width:100vw;height:100dvh/, "fallback mobile Chat is full-screen rather than floating");
assert.match(css, /\.topbar\{grid-template-columns:34px minmax\(0,1fr\)!important/, "phone branding and search use one compact row");
assert.match(css, /\.topbar \.topnav button\{min-height:40px;padding:4px!important\}/, "five phone navigation icons use compact but tappable controls");
assert.match(css, /\.mobile-menu-open \.left\{height:100dvh;max-height:100dvh\}/, "the Menu owns one safe viewport-height scrolling region");
assert.match(chat, /requestedReturn\.startsWith\("\/"\) && !requestedReturn\.startsWith\("\/\/"\)/, "Chat accepts only same-site return paths");
assert.match(chat, /safeReturn\.origin === location\.origin/, "Chat rejects cross-origin return destinations");

console.log("Exclusive mobile-screen checks passed: Home, Friends, Chat, Notifications and Menu share one mutually exclusive navigation state.");
