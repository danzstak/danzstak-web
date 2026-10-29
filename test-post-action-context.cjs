const fs = require("node:fs");
const assert = require("node:assert/strict");

const feed = fs.readFileSync("feed.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(feed, /id="postText"[\s\S]{0,120}aria-label="Post text"/, "the post composer has a stable accessible name");
assert.match(enhancements, /function describePostControls\(post\)/, "post controls share one contextual-description helper");
assert.match(enhancements, /author\.id \|\|= `post-\$\{postId\}-author`/, "post authors receive stable description IDs");
assert.match(enhancements, /content\.id \|\|= `post-\$\{postId\}-content`/, "post text receives stable description IDs");
assert.match(enhancements, /post\.querySelectorAll\("\.post-actions button, \.post-menu-toggle, \.comments input"\)/, "actions, options, and comment composer receive post context");
assert.match(enhancements, /control\.setAttribute\("aria-describedby", describedBy\)/, "post controls announce their author and text without replacing translated labels");
assert.ok((enhancements.match(/describePostControls\(/g) || []).length >= 3, "existing and newly rendered posts both receive contextual descriptions");

console.log("Post action-context checks passed: repeated controls identify their post while keeping familiar labels.");
