const fs = require("fs");
const assert = require("assert");

const source = fs.readFileSync("assets/media-visibility.js", "utf8");
const softUi = fs.readFileSync("assets/soft-ui.css", "utf8");
for (const page of ["feed.html", "profile.html", "messages.html"]) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /assets\/media-visibility\.js\?v=363/, `${page} must load automatic video preview frames`);
}
assert.match(source, /function prepareVideoPreview\(video\)/);
assert.match(source, /video\.addEventListener\('loadedmetadata',showFrame/);
assert.match(source, /video\.currentTime=previewTime/);
assert.match(source, /video\.currentTime=0/);
assert.match(source, /if\(video\.autoplay\)return/);
assert.match(source, /!element\.closest\('\.video-grid'\)/);
assert.match(softUi, /video::\-webkit-media-controls-overlay-play-button[^}]*display:none!important/);

console.log("Video preview checks passed: saved videos seek to a visible early frame and restart from zero when played.");
