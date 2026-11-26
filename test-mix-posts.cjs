"use strict";
// Mix posts (fix-it 18, owner 2026-11-17). Real browser: browser-checks/mix-posts.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cards = fs.readFileSync("assets/link-preview-cards.js", "utf8");
const views = fs.readFileSync("assets/post-views.js", "utf8");
const polish = fs.readFileSync("assets/mix-polish.css", "utf8");
assert.match(cards, /const placeholder = card\(\{ url: href, host, image: "", title: "\u200b" \}\);/, "a fixed-size card holds the place at once");
assert.match(cards, /text\.after\(placeholder\);\s*hideRawLink\(text, anchor\);\s*const preview = await fetchPreview\(href\);/, "the raw link is hidden before the preview is fetched");
assert.match(cards, /url\.textContent = String\(preview\.host \|\| ""\)\.replace\(\/\^www\\.\/, ""\)/, "under the card: the source name, never the link");
assert.match(views, /row\.className = 'post-meta-line'; audience\.before\(row\); row\.appendChild\(audience\); \} row\.appendChild\(label\);/, "views ride in the header line");
assert.ok(views.includes("const countWatch = typeof MutationObserver === 'function' ? new MutationObserver"), "the label follows the post's real count (it used to read 0 views)");
assert.match(polish, /\.feed-online-avatar,\.friend-avatar,\.comment-avatar,\.comment-composer-avatar\{background:#121418!important;color:#ff5a1f!important/, "no gradient placeholder avatars");
assert.match(fs.readFileSync("tools/ui-kit/components.css", "utf8"), /\.ds \.ds-post-head__avatar\{[^}]*background:var\(--ds-ink\);color:var\(--ds-accent\)/, "a post author without a photo: their initial in orange on ink");
console.log("Mix post checks passed.");
// Owner 2026-11-18: The Roll is edge to edge on phones.
require("node:assert/strict").match(require("node:fs").readFileSync("assets/mix-polish.css", "utf8"), /\.reels-rail\.post \.reels-list\{margin-left:calc\(-1 \* var\(--mix-pad,12px\)\)!important;margin-right:calc\(-1 \* var\(--mix-pad,12px\)\)!important;[^}]*padding:0!important/, "The Roll runs edge to edge");
