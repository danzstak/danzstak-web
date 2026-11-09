"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/responsive-media.css", "utf8");
const feedCss = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const script = fs.readFileSync("assets/responsive-media.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(css, /\.ds-responsive-media\{[\s\S]*width:100%;[\s\S]*max-width:100%;[\s\S]*margin:0/, "shared media must occupy its complete container without offsets");
assert.match(css, /video\.ds-responsive-media\{[\s\S]*aspect-ratio:var\(--ds-media-aspect,auto\);[\s\S]*object-fit:contain/, "native video must preserve its source geometry without a black fallback strip");
assert.match(css, /iframe\.ds-responsive-media\{[\s\S]*aspect-ratio:[\s\S]*min-height:0/, "third-party players need responsive framing without forced object fitting");
assert.match(css, /\.danzstak-media-shell\{[^}]*background:transparent;line-height:0/, "the shared wrapper must not paint a black strip or create an inline gap");
assert.match(css, /\.danzstak-reel-shell\{[^}]*aspect-ratio:var\(--ds-media-aspect,16\/9\);background:transparent/, "Roll audio wrappers must retain the provider ratio instead of stretching");
assert.match(css, /\.roll-fullscreen \.reel-media-stage\{[^}]*flex:1;[^}]*display:flex;[^}]*align-items:center;[^}]*justify-content:center/, "full-screen Roll media needs a dedicated centered stage");
assert.match(css, /\.roll-fullscreen \.danzstak-reel-shell\{[^}]*flex:0 1 auto;[^}]*width:100%;[^}]*max-height:100%;[^}]*aspect-ratio:var\(--ds-media-aspect,16\/9\)/, "the Roll audio wrapper should retain the framed media area instead of expanding into empty stage space");
assert.match(css, /\.roll-fullscreen \.danzstak-reel-shell>\.reel-player\{[^}]*height:100%;[^}]*max-height:100%;[^}]*object-fit:contain/, "the full-screen player must fill its audio wrapper while containing the source image");
assert.match(css, /\.post>\.ds-responsive-media[\s\S]*margin-inline:calc\(var\(--post-inline-padding,12px\) \* -1\)/, "direct post media must align to both card edges");
assert.match(css, /\.ds-media-control--sound\{right:10px;bottom:10px\}/);
assert.match(css, /\.ds-media-control--fullscreen\{right:10px;top:10px\}/);
assert.match(css, /#feed \.post>\.danzstak-native-video-shell\[data-video-layout="portrait"\]\{[\s\S]*?aspect-ratio:4\/5!important;[\s\S]*?overflow:hidden;/,
  "portrait videos must use a compact 4:5 Mix preview instead of swallowing the phone viewport");
assert.match(css, /#feed \.post>\.danzstak-native-video-shell\[data-video-layout="portrait"\]>video\{[\s\S]*?height:100%;[\s\S]*?object-fit:cover;/,
  "the 4:5 portrait preview must fill its frame without stretching");
assert.match(css, /#feed \.post>\.danzstak-native-video-shell\[data-video-layout="portrait"\]>video:fullscreen\{[\s\S]*?object-fit:contain;/,
  "fullscreen portrait playback must restore the complete uncropped source");
assert.match(feedCss, /\.reels-list \.reel-card\{position:relative\}/, "each Roll preview must contain its own fullscreen control instead of covering the Roll header launcher");
assert.match(feedCss, /\.story-viewer\{--story-safe-top:13vh;--story-safe-bottom:13vh;[\s\S]*?height:100vh;[\s\S]*?\.story-viewer-media\{position:absolute;inset:var\(--story-safe-top\) 0 var\(--story-safe-bottom\)/, "phone Dailies must reserve proportional 13vh top and bottom safe zones");
assert.match(feedCss, /@media\(max-width:700px\)\{\.reels-rail\.roll-fullscreen\{--roll-safe-top:8vh;--roll-safe-right:11vw;--roll-safe-bottom:22vh;?\}/, "phone Roll must define proportional full-screen safe zones without wasting desktop space");
assert.match(feedCss, /\.roll-fullscreen \.reel-details\{[\s\S]*?right:var\(--roll-safe-right\);[\s\S]*?min-height:var\(--roll-safe-bottom\);[\s\S]*?max-height:var\(--roll-safe-bottom\);/, "Roll captions must stay inside the lower safe zone and outside the right control tray");
assert.match(feedCss, /\.roll-fullscreen \.ds-media-control--fullscreen\{display:none!important\}/, "provider fullscreen buttons must not overlap The Roll close control");

assert.match(script, /video\.videoWidth/);
assert.match(script, /ratio < \.82 \? "portrait" : ratio > 1\.18 \? "landscape" : "square"/, "portrait, landscape and square videos must be classified from intrinsic dimensions");
assert.match(script, /loadedmetadata/, "video geometry must update from real metadata");
assert.match(script, /shell\.style\.setProperty\("--ds-media-aspect"/, "intrinsic video geometry must propagate to the audio-control wrapper");
assert.match(script, /function classifyFrame\(frame\)/, "provider players must receive an appropriate default geometry");
assert.match(script, /HTMLIFrameElement/, "third-party embeds must use the shared component without rewriting provider content");
assert.match(script, /MutationObserver/, "dynamically loaded feed, Chat and Roll media must be enhanced consistently");

for (const file of ["feed.html", "messages.html", "profile.html", "epk.html"]) {
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /assets\/responsive-media\.css\?v=6/, `${file} must load the shared responsive-media styles`);
  assert.match(html, /assets\/responsive-media\.js\?v=2/, `${file} must load the shared responsive-media behavior`);
}
assert.match(worker, /danzstak-shell-v774/);
assert.match(worker, /\/assets\/responsive-media\.js/);
assert.match(worker, /\/assets\/responsive-media\.css/);

console.log("Responsive-media checks passed: exact width, source ratios, layouts, overlays, dynamic content, embeds, and PWA caching.");
