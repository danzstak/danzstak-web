"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.match(source, /history\.pushState\(\{ \.\.\.currentState, danzstakMenuOpen: true \}, ""\)/, "opening the phone menu must create a browser Back entry");
assert.match(source, /function closeMobileMenuFromControl\(\)[\s\S]*?history\.back\(\)/, "Menu toggle, outside click and Escape must close through history");
assert.match(source, /setMobileMenu\(true, \{ updateHistory: false, fromHistory: true \}\)/, "Forward must restore the menu without creating a loop");
assert.match(source, /setMobileMenu\(false, \{ fromHistory: true \}\)/, "Back must close the menu without another history action");
assert.match(source, /event\.target\.closest\("a"\)\) setMobileMenu\(false\)/, "selecting a destination must still close immediately before routing");
assert.doesNotMatch(source, /danzstakMenuOpen:\s*(?:user|email|route|label|text)/, "menu history state must not contain user or navigation data");
assert.match(feed, /assets\/feed-enhancements\.js\?v=516/, "the feed must load the exclusive mobile-navigation build");

console.log("Mobile menu history checks passed: Back, Escape and outside click dismiss; Forward restores; route selection stays immediate; history contains no user data.");
