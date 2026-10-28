const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");
const index = read("index.html");
const manifest = JSON.parse(read("manifest.webmanifest"));
const robots = read("robots.txt");
const sitemap = read("sitemap.xml");

assert.match(index, /DanzStak \| The Digital Clubhouse/);
assert.match(index, /DanzStak is the digital clubhouse/);
assert.match(index, /"@type":"WebSite"/);
assert.match(index, /"alternateName":"The Digital Clubhouse"/);
assert.equal(manifest.name, "DanzStak — The Digital Clubhouse");
assert.match(manifest.description, /digital clubhouse/i);
assert.match(robots, /Sitemap: https:\/\/danzstak\.com\/sitemap\.xml/);
assert.match(robots, /Disallow: \/messages\.html/);
assert.match(sitemap, /<loc>https:\/\/danzstak\.com\/<\/loc>/);
assert.doesNotMatch(sitemap, /feed\.html|messages\.html|profile\.html/);

for (const file of ["feed.html", "messages.html", "profile.html", "booking-selections.html"]) {
  assert.match(read(file), /<meta name="robots" content="noindex,nofollow,noarchive">/, `${file} must stay out of public search results`);
}

console.log("digital clubhouse branding and crawl policy verified");
