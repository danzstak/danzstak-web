"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("feed.html", "utf8");
const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.ok(html.indexOf('id="storiesRail"') < html.indexOf('id="postComposer"'), "Dailies must lead the phone Mix before the composer");
assert.match(html, /#feedStatus\.feed-load-error\s*\{[\s\S]*?justify-content: space-between;[\s\S]*?flex-wrap: nowrap;/, "feed recovery must use one compact row");
assert.match(source, /rollClose\.hidden = true;/, "the fullscreen close control must not appear in the inline Roll");
assert.match(source, /reelForm\.hidden = true;/, "the external-link form must start collapsed");
assert.match(source, /function setReelFormOpen\(open\)/, "The Roll must expose one intentional add-video disclosure");
assert.match(source, /reelsRail\.classList\.toggle\("has-reels", reels\.length > 0\)/, "empty and populated Roll layouts must have explicit state");
assert.match(css, /\.reels-rail:not\(\.has-reels\):not\(\.is-adding\)[^{]*\{padding:10px 12px!important\}/, "the empty Roll must remain compact");
assert.match(css, /\.reel-import-form\[hidden\],\.roll-close\[hidden\],\.roll-open\[hidden\]\{display:none!important\}/, "hidden Roll controls must not be revived by shared icon styles");
assert.match(html, /assets\/feed-enhancements\.css\?v=502/);
assert.match(html, /assets\/feed-enhancements\.js\?v=534/);
assert.match(html, /assets\/danzstak-original-feed\.css\?v=8/);
assert.match(worker, /danzstak-shell-v721/);

console.log("Feed density checks passed: Dailies-first order, compact recovery, collapsed Roll authoring, and PWA refresh.");
