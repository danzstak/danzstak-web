const fs = require("node:fs");
const assert = require("node:assert/strict");

const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

for (const width of [360, 700, 1050]) {
  assert.ok(css.includes(`max-width:${width}px`) || css.includes(`max-width: ${width}px`), `Responsive coverage is missing for ${width}px`);
}

for (const requirement of [
  "grid-template-columns:repeat(5,minmax(0,1fr))",
  "grid-template-rows:40px 44px",
  "min-height:44px!important",
  "env(safe-area-inset-top)",
  "env(safe-area-inset-bottom)",
  ".comment-action-row{grid-column:2;display:flex;align-items:center;justify-content:space-between;flex-wrap:nowrap",
  ".deleteCommentBtn{display:grid;place-items:center;flex:0 0 40px",
  ".comment-composer-field{min-height:44px",
  ".post-media{display:block;width:calc(100% + 24px)!important",
  "object-fit:contain"
]) assert.ok(css.includes(requirement), `Mobile feed redesign is missing: ${requirement}`);

for (const action of ["Like", "Dislike", "Comment", "Share"]) {
  assert.match(css, new RegExp(`content:\"${action}\"`), `${action} must have a compact visible action label`);
}

assert.ok(feed.includes('class="topnav"'), "The familiar five-item top navigation must remain in the real feed");
assert.ok(feed.includes('feed-enhancements.css?v=485'), "The feed must request the redesigned stylesheet release");
assert.doesNotMatch(css.slice(css.lastIndexOf("/* Polished mobile feed")), /font-size:[0-8]px/, "The redesign must not solve space use with unreadably tiny text");

console.log("Mobile feed redesign checks passed: five-action row, compact navigation/cards/comments/composer, safe areas, and responsive media.");
