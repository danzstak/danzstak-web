// A shared profile link must never preview as a bare grey box (owner 2026-11-21).
// Until the per-profile card (spec 44) ships, profile.html carries the general DanzStak card.
const fs = require("fs");
const assert = require("assert");
const html = fs.readFileSync(__dirname + "/profile.html", "utf8");
const head = html.slice(0, html.indexOf("</head>"));
for (const tag of ["og:title", "og:description", "og:image", "og:site_name"]) {
  assert.ok(new RegExp(`property="${tag}" content="[^"]+"`).test(head), `profile.html is missing ${tag}`);
}
assert.ok(/name="twitter:card" content="summary_large_image"/.test(head), "profile.html is missing twitter:card");
const image = head.match(/property="og:image" content="https:\/\/danzstak\.com\/([^"]+)"/);
assert.ok(image && fs.existsSync(__dirname + "/" + image[1]), "og:image must be an existing danzstak.com asset");
console.log("profile share tags ok");
