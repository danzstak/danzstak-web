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
// The declared size and type match the file, and it stays under 300 KB (WhatsApp skips bigger preview images).
const file = fs.readFileSync(__dirname + "/" + image[1]);
assert.ok(file.length < 300 * 1024, `og:image is ${file.length} bytes; keep it under 300 KB`);
assert.ok(file[0] === 0xff && file[1] === 0xd8, "og:image is a JPEG");
let at = 2, size = null;
while (at < file.length) { const marker = file[at + 1], length = file.readUInt16BE(at + 2); if (marker >= 0xc0 && marker <= 0xc2) { size = { height: file.readUInt16BE(at + 5), width: file.readUInt16BE(at + 7) }; break; } at += 2 + length; }
assert.deepEqual(size, { width: 1200, height: 630 }, "the share card is 1200x630");
assert.ok(/property="og:image:type" content="image\/jpeg"/.test(head) && /property="og:image:width" content="1200"/.test(head) && /property="og:image:height" content="630"/.test(head), "declared og:image type and size match the file");
console.log("profile share tags ok");
