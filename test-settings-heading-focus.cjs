const fs = require("fs");
const assert = require("assert");

const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const html = fs.readFileSync("feed.html", "utf8");
const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(css, /#featureTitle:focus,#featureTitle:focus-visible\{outline:none\}/, "Programmatic workspace focus must not make the non-interactive heading look like an input");
assert.match(html, /assets\/feed-enhancements\.css\?v=\d+/, "Feed must request a versioned enhancements stylesheet");
assert.match(source, /appSettings\.setAttribute\("aria-label", "Manage app and device settings"\)/);
assert.match(source, /activityButton\.setAttribute\("aria-label", "View your DanzStak activity"\)/);
assert.match(source, /exportButton\.setAttribute\("aria-label", "Download my DanzStak data"\)/);
assert.match(source, /alertSettings\.setAttribute\("aria-label", `\$\{alertSettings\.textContent\} call and message alerts`\)/);
assert.match(source, /logout\.setAttribute\("aria-label", "Log out of DanzStak"\)/);

console.log("Settings heading focus treatment is visually clear while retaining programmatic announcement.");
