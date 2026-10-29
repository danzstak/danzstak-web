const assert = require("node:assert/strict");
const fs = require("node:fs");

const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const infra = fs.readFileSync("infrastructure/engagement/template.yaml", "utf8");
const signaling = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const styles = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.match(api, /async function updateGroupCover/);
assert.match(api, /Only an Elder can change the Tribe cover/);
assert.match(api, /new HeadObjectCommand/);
assert.match(api, /coverKey = :cover/);
assert.match(api, /coverUrl: item\.coverKey/);
assert.match(api, /Deleted Tribe cover cleanup remains pending/);
assert.match(infra, /RouteKey: 'POST \/groups\/\{groupId\}\/cover'/);
assert.match(infra, /dynamodb:UpdateItem/);
assert.match(signaling, /postUpload=new RegExp/);
assert.match(signaling, /!storyUpload&&!postUpload/);
assert.match(enhancements, /group\.coverUrl/);
assert.match(enhancements, /tribe-cover-edit/);
assert.match(enhancements, /purpose: "post"/);
assert.match(enhancements, /\/cover"/);
assert.match(enhancements, /discardUploadedMedia/);
assert.match(styles, /\.tribe-hero-cover\{position:relative;background-position:center;background-size:cover\}/);
assert.match(feed, /feed-enhancements\.js\?v=375/);
assert.match(feed, /feed-enhancements\.css\?v=374/);

console.log("Elder-managed Tribe cover behavior verified");
