"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");

assert.match(feed, /const usesMobileStoryHistory = \(\) => matchMedia\("\(max-width: 700px\)"\)\.matches/, "Flash history must be limited to the mobile viewer");
assert.match(feed, /history\.pushState\(\{ \.\.\.currentState, danzstakStoryOpen: true \}, ""\)/, "opening a Flash on a phone must create a browser Back entry");
assert.match(feed, /if \(usesMobileStoryHistory\(\)\) \{\s*history\.back\(\);\s*return true;/, "Close, outside tap and Escape must return through mobile history");
assert.match(feed, /openStoryViewer\(storyViewerActiveStory, \{ updateHistory: false \}\)/, "Forward must restore the active Flash without creating a history loop");
assert.match(feed, /closeStoryViewer\(\{ fromHistory: true \}\)/, "Back must close the Flash without adding another history action");
assert.match(feed, /viewer\.addEventListener\("cancel", event => \{ event\.preventDefault\(\); closeStoryViewer\(\); \}\)/, "Escape must use the same history-safe close path");
assert.doesNotMatch(feed, /danzstakStoryOpen:\s*(?:story|media|url|user|title|caption)/, "Flash history state must not contain story or account data");

console.log("Mobile Flash history checks passed: Back closes the viewer, Forward restores it, Escape is history-safe, and history contains no story data.");
