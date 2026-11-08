"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("feed.html", "utf8");
const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const originalFeedCss = fs.readFileSync("assets/danzstak-original-feed.css", "utf8");

assert.ok(html.indexOf('id="storiesRail"') < html.indexOf('id="postComposer"'), "Dailies must lead the phone Mix before the composer");
assert.match(html, /#feedStatus\.feed-load-error\s*\{[\s\S]*?justify-content: space-between;[\s\S]*?flex-wrap: nowrap;/, "feed recovery must use one compact row");
assert.match(html, /story-create-detail">Add today's photo or video</, "empty Dailies must explain how to fill the row");
assert.match(originalFeedCss, /#storiesRail \.story\s*\{[\s\S]*?aspect-ratio:1;/, "Dailies media cards must stay square");
assert.match(originalFeedCss, /--daily-card-size:clamp\(128px,36vw,140px\);[\s\S]*?min-height:var\(--daily-card-size\)!important;[\s\S]*?height:var\(--daily-card-size\)!important;/, "phone Dailies cards must keep the responsive square size");
assert.match(originalFeedCss, /#newsFeedView \.post-composer,[\s\S]*?#feedStatus\.feed-load-error,[\s\S]*?\.reels-rail\s*\{[\s\S]*?border:0!important;[\s\S]*?background:transparent!important;[\s\S]*?box-shadow:none!important;/, "the top Mix must flow without stacked container boxes");
assert.match(originalFeedCss, /#feed \{gap:0\}[\s\S]*?#feed > \.post \{padding-block:4px!important\}/, "consecutive phone posts must use one continuous eight-pixel rhythm");
assert.match(source, /rollClose\.hidden = true;/, "the fullscreen close control must not appear in the inline Roll");
assert.match(source, /reelForm\.hidden = true;/, "the external-link form must start collapsed");
assert.match(source, /function setReelFormOpen\(open\)/, "The Roll must expose one intentional add-video disclosure");
assert.match(source, /reelsRail\.classList\.toggle\("has-reels", reels\.length > 0\)/, "empty and populated Roll layouts must have explicit state");
assert.match(css, /\.reels-rail:not\(\.has-reels\):not\(\.is-adding\)[^{]*\{padding:10px 12px!important\}/, "the empty Roll must remain compact");
assert.match(css, /\.reel-import-form\[hidden\],\.roll-close\[hidden\],\.roll-open\[hidden\]\{display:none!important\}/, "hidden Roll controls must not be revived by shared icon styles");
assert.match(html, /assets\/feed-enhancements\.css\?v=503/);
assert.match(html, /assets\/feed-enhancements\.js\?v=535/);
assert.match(html, /assets\/danzstak-original-feed\.css\?v=16/);
assert.match(worker, /danzstak-shell-v732/);

console.log("Feed density checks passed: Dailies-first order, compact recovery, collapsed Roll authoring, and PWA refresh.");
