const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");

assert.match(api, /authorPicture: authorPicture\(item\.userEmail\?\.S\)/, "Post API must return the signed author photo");
assert.match(api, /ProjectionExpression: "profileName, profileAvatarKey"/, "Only public identity fields should be loaded for feed authors");
assert.match(html, /avatar\.className = "post-avatar"/);
assert.match(html, /if \(authorPicture\) \{ avatar\.src = authorPicture;/);
assert.match(html, /else \{ avatar\.textContent = String\(author \|\| "D"\)\.charAt\(0\)\.toUpperCase\(\)/, "Posts without photos need an initials fallback");
assert.match(html, /post\.authorPicture,\s*\n\s*post\.groupId,/, "Loaded post photos must reach the renderer");
assert.match(css, /\.post-header\{[^}]*grid-template-columns:42px minmax\(0,1fr\)/);
assert.match(css, /\.post-avatar\{[^}]*border-radius:50%/);

console.log("Post author avatar checks passed: signed profile photos and initials render in Facebook-familiar headers.");
