const fs = require("fs");
const assert = require("assert");

const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const html = fs.readFileSync("feed.html", "utf8");

assert.match(css, /#featureTitle:focus\{outline:none\}/, "Programmatic workspace focus must not make the heading look like an input");
assert.match(css, /#featureTitle:focus-visible\{outline:2px solid #0866ff/, "Keyboard-visible focus must remain available");
assert.match(html, /assets\/feed-enhancements\.css\?v=335/, "Feed must request the updated stylesheet");

console.log("Settings heading focus treatment is clear and keyboard accessible.");
