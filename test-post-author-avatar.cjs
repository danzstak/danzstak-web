const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("tools/ui-kit/components.css", "utf8");
const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");

assert.match(api, /authorPicture: authorPicture\(item\.userEmail\?\.S\)/, "Post API must return the signed author photo");
assert.match(api, /ProjectionExpression: "profileName, profileAvatarKey"/, "Only public identity fields should be loaded for feed authors");
assert.match(html, /avatar\.className = "post-avatar ds-post-head__avatar"/);
assert.match(html, /const avatar = document\.createElement\(authorProfileUrl \? "a" : "span"\)/, "Post avatars must become profile links when a public member ID exists");
assert.match(html, /if \(authorPicture\) \{ const image = document\.createElement\("img"\)/);
assert.match(html, /else \{ avatar\.textContent = String\(author \|\| "D"\)\.charAt\(0\)\.toUpperCase\(\)/, "Posts without photos need an initials fallback");
assert.match(html, /post\.authorPicture,\s*\n\s*post\.groupId,/, "Loaded post photos must reach the renderer");
// UIKIT screen 5 part 1: the kit's post header (40px round photo beside the name and one meta line).
assert.match(html, /header\.className = "post-header ds ds--day ds-post-head"/);
assert.match(css, /\.ds\.ds-post-head\{[^}]*grid-template-columns:40px minmax\(0,1fr\)/);
assert.match(css, /\.ds \.ds-post-head__avatar\{[^}]*border-radius:50%/);
assert.match(css, /\.ds \.ds-post-head__avatar>img\{[^}]*border-radius:50%/, "Linked post avatars must preserve circular image framing");

console.log("Post author avatar checks passed: signed profile photos and initials render in Facebook-familiar headers.");
