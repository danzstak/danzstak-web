const fs = require("fs");
const assert = require("assert");

const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const html = fs.readFileSync("feed.html", "utf8");

assert.match(css, /#featureTitle:focus,#featureTitle:focus-visible\{outline:none\}/, "Programmatic workspace focus must not make the non-interactive heading look like an input");
assert.match(html, /assets\/feed-enhancements\.css\?v=336/, "Feed must request the updated stylesheet");

console.log("Settings heading focus treatment is visually clear while retaining programmatic announcement.");
