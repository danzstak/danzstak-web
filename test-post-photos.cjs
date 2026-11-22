"use strict";
// Owner 2026-11-22: "should be able to upload multiple photos at once", "set a limit of 20 photos". A photo post holds
// its first photo (mediaKey) and up to 19 more (moreMediaKeys), each the member's own upload, and every photo is its own
// Daily. Runs the real createSecurePost handler from infrastructure/auth-api/index.mjs with a fake database, and checks
// that reading and deleting a post cover every photo. The browser half is browser-checks/post-photos.cjs.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const source = read("infrastructure/auth-api/index.mjs");
const email = "artist@example.com", prefix = crypto.createHash("sha256").update(email).digest("hex").slice(0, 24);
const key = (ext = "jpg", owner = prefix) => `users/${owner}/${crypto.randomUUID()}.${ext}`;

class Command { constructor(input) { this.input = input; } }
class PutItemCommand extends Command {}
class GetItemCommand extends Command {}
class UpdateItemCommand extends Command {}
class TransactWriteItemsCommand extends Command {}

function sandbox() {
  const sent = [];
  const context = vm.createContext({
    Buffer, Date, Math, JSON, String, Number, Boolean, Array, Object, Promise, Set, console: { error() {}, warn() {}, log() {} },
    corsHeaders: () => ({}), allowedOrigins: new Set(["https://danzstak.com"]), getAuthenticatedUser: async () => "artist-sub",
    accountForSub: async () => email, postForEngagement: async () => ({}), requireGroupMember: async () => ({}),
    postsTable: "DANZSTAK-Posts", storiesTable: "DANZSTAK-Stories", settingsTable: "DanzStak-UserSettings",
    friendsTable: "friends", sha256: value => crypto.createHash("sha256").update(value).digest("hex"), randomUUID: crypto.randomUUID,
    PutItemCommand, GetItemCommand, UpdateItemCommand, TransactWriteItemsCommand,
    db: { send: async command => { sent.push(command); return {}; } }
  });
  vm.runInContext(source.slice(source.indexOf("async function createSecurePost("), source.indexOf("async function deleteSecurePost(")), context);
  const post = async body => {
    const result = await context.createSecurePost({ headers: { origin: "https://danzstak.com", "content-type": "application/json" }, body: JSON.stringify({ originalContentCertified: true, content: "Three from the gig", audience: "public", ...body }) });
    return { status: result.statusCode, body: JSON.parse(result.body) };
  };
  const writes = table => sent.filter(command => command.input.TableName === table || command.input.TransactItems?.some(item => item.Put?.TableName === table));
  return { post, writes };
}

(async () => {
  // Three photos: one post, the first as mediaKey and two more, three Dailies in the post's order.
  let box = sandbox();
  const first = key(), more = [key("png"), key("webp")];
  let result = await box.post({ mediaKey: first, mediaType: "image", moreMediaKeys: more });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(box.writes("DANZSTAK-Posts").length, 1, "one post, not three");
  const item = box.writes("DANZSTAK-Posts")[0].input.Item;
  assert.equal(item.mediaKey.S, first);
  assert.deepEqual(item.moreMedia.L.map(entry => entry.S), more, "the post keeps the other photos in order");
  const dailies = box.writes("DANZSTAK-Stories").map(command => command.input.Item);
  assert.deepEqual(dailies.map(daily => daily.mediaKey.S), [first, ...more], "every photo is its own Daily, in order");
  assert.ok(dailies.every(daily => daily.postId.S === item.postId.S && daily.fromPost.BOOL === true), "each Daily points at the post");
  assert.ok(dailies.every((daily, index) => index === 0 || Date.parse(daily.createdAt.S) > Date.parse(dailies[index - 1].createdAt.S)), "Dailies keep the photos' order");
  assert.deepEqual(result.body.moreMediaKeys, more, "the answer says the other photos were kept (the browser relies on it)");
  assert.equal(result.body.dailyCreated, true);

  // A one-photo post has no moreMedia at all.
  box = sandbox();
  result = await box.post({ mediaKey: key(), mediaType: "image" });
  assert.equal(result.status, 201);
  assert.equal(box.writes("DANZSTAK-Posts")[0].input.Item.moreMedia, undefined);
  assert.deepEqual(result.body.moreMediaKeys, []);

  // Twenty photos in all is fine; twenty-one is not.
  box = sandbox();
  result = await box.post({ mediaKey: key(), mediaType: "image", moreMediaKeys: Array.from({ length: 19 }, () => key()) });
  assert.equal(result.status, 201, "20 photos in one post");
  assert.equal(box.writes("DANZSTAK-Stories").length, 20, "20 Dailies");
  const refused = [
    ["21 photos", { mediaKey: key(), mediaType: "image", moreMediaKeys: Array.from({ length: 20 }, () => key()) }],
    ["another member's photo", { mediaKey: key(), mediaType: "image", moreMediaKeys: [key("jpg", "f".repeat(24))] }],
    ["a video among the photos", { mediaKey: key(), mediaType: "image", moreMediaKeys: [key("mp4")] }],
    ["more photos on a video post", { mediaKey: key("mp4"), mediaType: "video", moreMediaKeys: [key()] }],
    ["more photos with no first photo", { moreMediaKeys: [key()] }],
    ["the same photo twice", (() => { const same = key(); return { mediaKey: same, mediaType: "image", moreMediaKeys: [same] }; })()],
    ["not a list", { mediaKey: key(), mediaType: "image", moreMediaKeys: key() }],
    ["a made-up path", { mediaKey: key(), mediaType: "image", moreMediaKeys: [`users/${prefix}/../x.jpg`] }]
  ];
  for (const [label, body] of refused) {
    box = sandbox();
    result = await box.post(body);
    assert.equal(result.status, 400, `${label} is refused`);
    assert.equal(box.writes("DANZSTAK-Posts").length, 0, `${label}: nothing is saved`);
  }

  // Reading and deleting cover every photo.
  assert.match(source, /moreMediaUrls: postMoreMedia\(item\)\.map\(key => signedMediaUrl\(key, 3600\)\)/, "Mix and profiles get a link for every photo");
  const remove = source.slice(source.indexOf("async function deleteSecurePost("), source.indexOf("async function deleteSecurePost(") + 6000);
  assert.match(remove, /const postMedia = found\.Item\.mediaKey\?\.S \? \[found\.Item\.mediaKey\.S, \.\.\.postMoreMedia\(found\.Item\)\]/, "deleting a post covers every photo");
  assert.match(remove, /postMedia\.some\(key => !key\.startsWith\(`users\/\$\{ownerPrefix\}\/`\)\)/, "every photo must be the owner's own");
  assert.match(remove, /mediaKey IN \(/, "every photo's Daily goes with the post");
  assert.match(remove, /runCleanup\(postMedia\.map\(key => \(\) => s3\.send\(new DeleteObjectCommand/, "every photo file is deleted");

  // The browser half: both composers take several photos, both pages load the shared piece.
  const photos = read("assets/post-photos.js");
  assert.match(photos, /const MAX = 20;/, "the browser keeps at most 20 photos");
  for (const page of ["feed.html", "profile.html"]) {
    const html = read(page);
    assert.match(html, /<script src="assets\/post-photos\.js\?v=\d+"><\/script>/, `${page} loads post-photos.js before posts are drawn`);
    assert.match(html, /assets\/post-photos\.css\?v=\d+/, `${page} loads post-photos.css`);
  }
  assert.match(read("assets/feed-enhancements.js"), /if \(kind === "image"\) input\.multiple = true;/, "Mix's photo picker takes several photos");
  assert.match(read("assets/profile-editor.js"), /mediaInput\.multiple = true;/, "the profile's picker takes several photos");
  assert.match(read("service-worker.js"), /"\/assets\/post-photos\.js", "\/assets\/post-photos\.css"/, "the app keeps post-photos offline");
  console.log("Post photos checks passed: up to 20 photos in one post, each its own Daily, only the member's own photos, read and deleted together.");
})().catch(error => { console.error(error); process.exit(1); });
