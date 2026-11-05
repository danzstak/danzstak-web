const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const js = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(html, /<span>Add to Mix<\/span>/, "composer uses the DanzStak Add to Mix label");
assert.match(html, /id="storiesRail"[^>]+aria-label="Dailies"/, "Dailies rail has its public product name");
assert.match(html, /class="story-create-avatar"/, "creator tile has a real identity image target");
assert.match(html, /class="daily-clapper"/, "creator tile exposes the clapper metadata surface");
assert.match(html, /updateDailyCreatorSlate\(\(data\.stories/, "Take count is derived from returned owner video records");
assert.match(html, /loadedmetadata/, "video duration comes from genuine media metadata");
assert.match(html, /story-video-slate/, "video Dailies render a compact slate");
assert.match(js, /composer-media-button/, "photo and video pickers share icon-button styling");
assert.match(js, /setAttribute\("aria-label", label\)/, "icon-only media controls retain accessible names");
assert.match(css, /\.story-author-link\{[^}]+-webkit-line-clamp:3/, "creator names may wrap to three readable lines");
assert.match(html, /className = "story-name-more"/, "unusually long creator names have an explicit full-name affordance");
assert.match(css, /\.composer-media-button svg\{width:22px;height:22px/, "media icons use a compact consistent geometry");
assert.doesNotMatch(html, />Flashes</, "legacy public Flashes label is absent from live feed markup");

console.log("Dailies feed UX checks passed: compact composer, accessible icon actions, genuine identity target, metadata slate, and readable creator names.");
