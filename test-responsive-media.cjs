"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/responsive-media.css", "utf8");
const script = fs.readFileSync("assets/responsive-media.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(css, /\.ds-responsive-media\{[\s\S]*width:100%;[\s\S]*max-width:100%;[\s\S]*margin:0/, "shared media must occupy its complete container without offsets");
assert.match(css, /video\.ds-responsive-media\{[\s\S]*aspect-ratio:var\(--ds-media-aspect,auto 16\/9\);[\s\S]*object-fit:contain/, "native video must preserve its source geometry");
assert.match(css, /iframe\.ds-responsive-media\{[\s\S]*aspect-ratio:[\s\S]*min-height:0/, "third-party players need responsive framing without forced object fitting");
assert.match(css, /\.post>\.ds-responsive-media[\s\S]*margin-inline:calc\(var\(--post-inline-padding,12px\) \* -1\)/, "direct post media must align to both card edges");
assert.match(css, /\.ds-media-control--sound\{right:10px;bottom:10px\}/);
assert.match(css, /\.ds-media-control--fullscreen\{right:10px;top:10px\}/);

assert.match(script, /video\.videoWidth/);
assert.match(script, /ratio < \.82 \? "portrait" : ratio > 1\.18 \? "landscape" : "square"/, "portrait, landscape and square videos must be classified from intrinsic dimensions");
assert.match(script, /loadedmetadata/, "video geometry must update from real metadata");
assert.match(script, /HTMLIFrameElement/, "third-party embeds must use the shared component without rewriting provider content");
assert.match(script, /MutationObserver/, "dynamically loaded feed, Chat and Roll media must be enhanced consistently");

for (const file of ["feed.html", "messages.html", "profile.html", "epk.html"]) {
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /assets\/responsive-media\.css\?v=2/, `${file} must load the shared responsive-media styles`);
  assert.match(html, /assets\/responsive-media\.js\?v=1/, `${file} must load the shared responsive-media behavior`);
}
assert.match(worker, /danzstak-shell-v646/);
assert.match(worker, /\/assets\/responsive-media\.js/);
assert.match(worker, /\/assets\/responsive-media\.css/);

console.log("Responsive-media checks passed: exact width, source ratios, layouts, overlays, dynamic content, embeds, and PWA caching.");
