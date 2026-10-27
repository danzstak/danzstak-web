const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");

assert.match(html, /avatarWrap\.className = "feed-online-avatar-wrap"/);
assert.match(html, /avatar\.className = "feed-online-avatar"/);
assert.match(html, /onlineDot\.className = "feed-online-dot"/);
assert.match(html, /onlineDot\.setAttribute\("aria-label", "Online"\)/);
assert.match(html, /if \(user\.picture\) \{ avatar\.src = user\.picture;/);
assert.match(html, /row\.append\(avatarWrap, name, action\)/);
assert.match(css, /\.feed-online-row\{[^}]*grid-template-columns:34px minmax\(0,1fr\) auto/);
assert.match(css, /\.feed-online-dot\{[^}]*background:#20b15a/);
assert.match(html, /assets\/feed-enhancements\.css\?v=337/);

console.log("Online user card checks passed: photos, names, green presence dots, and actions share one compact row.");
