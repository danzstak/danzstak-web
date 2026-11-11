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
assert.match(originalFeedCss, /--daily-card-size:clamp\(148px,42vw,168px\);[\s\S]*?min-height:var\(--daily-card-size\)!important;[\s\S]*?height:var\(--daily-card-size\)!important;/, "phone Dailies cards must keep the responsive square profile size");
assert.match(originalFeedCss, /story-create-avatar[\s\S]*?inset:0;[\s\S]*?width:100%!important;[\s\S]*?height:100%!important;[\s\S]*?border-radius:18px!important;[\s\S]*?background-size:cover!important;/, "Dailies must expand the member image to the complete rounded-square tile bounds despite shared image sizing");
assert.match(originalFeedCss, /story-create-avatar[\s\S]*?object-fit:cover;[\s\S]*?object-position:center 28%;/, "the Dailies member photo must crop edge-to-edge inside the tile");
assert.match(source, /dailyImage\.className = "story-create-avatar-pending";[\s\S]*?dailyImage\.hidden = true;[\s\S]*?dailyImage\.onload = \(\) => \{[\s\S]*?dailyImage\.className = "story-create-avatar story-create-avatar-image";[\s\S]*?currentAvatar\.replaceWith\(dailyImage\);[\s\S]*?danzstakIdentityMedia\?\.install\(dailyImage, profile,[\s\S]*?identity\.appendChild\(dailyImage\);[\s\S]*?dailyImage\.src = picture;/, "Dailies must keep the visible fallback until the signed-in member's resilient profile image has loaded");
assert.match(originalFeedCss, /story-create-art\s*\{[\s\S]*?border-radius:18px;[\s\S]*?background:transparent!important;/, "Dailies must keep the space behind the full-size profile image transparent");
assert.match(originalFeedCss, /daily-clapper[\s\S]*?inset:auto auto 8px 8px;[\s\S]*?width:58px;/, "the clapper must overlay the image's lower-left corner");
assert.match(originalFeedCss, /#newsFeedView \.post-composer,[\s\S]*?#feedStatus\.feed-load-error,[\s\S]*?\.reels-rail:not\(\.roll-fullscreen\)\s*\{[\s\S]*?border:0!important;[\s\S]*?background:transparent!important;[\s\S]*?box-shadow:none!important;/, "the inline Mix must flow without stacked container boxes while fullscreen Roll remains isolated");
assert.match(originalFeedCss, /#feed \{gap:16px!important\}[\s\S]*?#feed > \.post \{[\s\S]*?--post-inline-padding:12px!important;[\s\S]*?width:100vw;[\s\S]*?padding:12px!important;/, "standard and large phones must use a 16px post gap with 12px internal padding");
assert.match(originalFeedCss, /@media\(max-width:375px\)\s*\{[\s\S]*?#feed \{gap:12px!important\}/, "compact phones must reduce the inter-post gap to 12px");
assert.match(originalFeedCss, /#feed \.post > :is\(\.post-media,\.feed-media-gallery,\.danzstak-media-shell,\.post-media-recovery\)\s*\{[\s\S]*?width:100vw!important;[\s\S]*?margin-inline:-12px!important;/, "phone media must break through card padding to exactly 100vw");
assert.match(originalFeedCss, /\.post-author\s*\{[\s\S]*?font-size:15px;[\s\S]*?font-weight:600;[\s\S]*?line-height:20px;/, "post names must use the familiar 15px semibold hierarchy");
assert.match(originalFeedCss, /\.post :is\(\.post-time,\.post-audience\)[\s\S]*?font-size:13px;[\s\S]*?font-weight:400;[\s\S]*?line-height:16px;/, "post metadata must use the compact 13px hierarchy");
assert.match(originalFeedCss, /\.post-content\s*\{[\s\S]*?font-size:15px;[\s\S]*?line-height:21px;/, "post copy must use the readable 15px body hierarchy");
assert.match(originalFeedCss, /\.post\.is-short-text \.post-content\s*\{[\s\S]*?font-size:17px;[\s\S]*?line-height:22px;/, "short text posts must receive the familiar modest size boost");
assert.match(originalFeedCss, /\.post-content\.is-collapsed\s*\{[\s\S]*?-webkit-line-clamp:7;/, "long post previews must clamp to seven lines");
assert.match(html, /normalizedPostContent\.length > 0 && normalizedPostContent\.length <= 35[\s\S]*?normalizedPostContent\.length > 280[\s\S]*?className = "post-text-toggle"/, "the Feed must apply short-copy and See more thresholds consistently");
assert.match(originalFeedCss, /#feed \.post > img\.post-media\s*\{[\s\S]*?width:100vw!important;[\s\S]*?height:125vw!important;[\s\S]*?aspect-ratio:4\/5;[\s\S]*?object-fit:cover!important;/, "phone image previews must use a full-bleed 4:5 frame");
assert.match(originalFeedCss, /grid-template-columns:minmax\(184px,222px\) minmax\(470px,500px\) minmax\(190px,244px\)/, "desktop Mix content must stay within the requested 470–500px center column");
assert.match(source, /rollClose\.hidden = true;/, "the fullscreen close control must not appear in the inline Roll");
assert.match(source, /reelForm\.hidden = true;/, "the external-link form must start collapsed");
assert.match(source, /function setReelFormOpen\(open\)/, "The Roll must expose one intentional add-video disclosure");
assert.match(source, /reelsRail\.classList\.toggle\("has-reels", reels\.length > 0\)/, "empty and populated Roll layouts must have explicit state");
assert.match(css, /\.reels-rail:not\(\.has-reels\):not\(\.is-adding\)[^{]*\{padding:10px 12px!important\}/, "the empty Roll must remain compact");
assert.match(css, /\.reel-import-form\[hidden\],\.roll-close\[hidden\],\.roll-open\[hidden\]\{display:none!important\}/, "hidden Roll controls must not be revived by shared icon styles");
assert.match(html, /assets\/feed-enhancements\.css\?v=510/);
assert.match(html, /assets\/feed-enhancements\.js\?v=548/);
assert.match(html, /assets\/danzstak-original-feed\.css\?v=32/);
assert.match(worker, /danzstak-shell-v812/);

console.log("Feed density checks passed: Dailies-first order, compact recovery, collapsed Roll authoring, and PWA refresh.");
