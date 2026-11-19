"use strict";
// T0-A1 (owner 2026-11-18): every photo or video a member posts goes into their Dailies for 24 hours, and every video
// goes into The Roll — automatically, from ANY composer, decided on the server. Runs the real createSecurePost handler
// from infrastructure/auth-api/index.mjs in a sandbox with a fake database.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
// Windows checkouts (CI) use CRLF; compare text, not line endings.
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const source = read("infrastructure/auth-api/index.mjs");
const email = "artist@example.com", prefix = crypto.createHash("sha256").update(email).digest("hex").slice(0, 24);
const mediaKey = ext => `users/${prefix}/${crypto.randomUUID()}.${ext}`;

class Command { constructor(input) { this.input = input; this.name = this.constructor.name; } }
class PutItemCommand extends Command {}
class GetItemCommand extends Command {}
class UpdateItemCommand extends Command {}
class TransactWriteItemsCommand extends Command {}

function sandbox({ storiesFail = false } = {}) {
  const sent = [];
  const context = vm.createContext({
    Buffer, Date, Math, JSON, String, Number, Boolean, Array, Object, Promise, console: { error() {}, warn() {}, log() {} },
    corsHeaders: () => ({}), allowedOrigins: new Set(["https://danzstak.com"]), getAuthenticatedUser: async () => "artist-sub",
    accountForSub: async () => email, postForEngagement: async () => ({}), requireGroupMember: async () => ({}),
    postsTable: "DANZSTAK-Posts", storiesTable: "DANZSTAK-Stories", settingsTable: "DanzStak-UserSettings",
    friendsTable: "friends", sha256: value => crypto.createHash("sha256").update(value).digest("hex"), randomUUID: crypto.randomUUID,
    PutItemCommand, GetItemCommand, UpdateItemCommand, TransactWriteItemsCommand,
    db: { send: async command => {
      sent.push(command);
      if (storiesFail && command.input.TableName === "DANZSTAK-Stories") { const error = new Error("denied"); error.name = "AccessDeniedException"; throw error; }
      return {};
    } }
  });
  vm.runInContext(source.slice(source.indexOf("async function createSecurePost("), source.indexOf("async function deleteSecurePost(")), context);
  const post = async body => {
    const result = await context.createSecurePost({ headers: { origin: "https://danzstak.com", "content-type": "application/json" }, body: JSON.stringify({ originalContentCertified: true, ...body }) });
    return { status: result.statusCode, body: JSON.parse(result.body) };
  };
  const writes = table => sent.filter(c => c.input.TableName === table || c.input.TransactItems?.some(item => item.Put?.TableName === table));
  return { post, sent, writes };
}

(async () => {
  // A photo post (no flags from the client): Dailies for 24 h, not The Roll.
  let box = sandbox();
  const photoKey = mediaKey("jpg");
  let result = await box.post({ content: "Load-in", audience: "friends", mediaKey: photoKey, mediaType: "image" });
  assert.equal(result.status, 201);
  const photoPost = box.writes("DANZSTAK-Posts")[0].input.Item;
  assert.equal(photoPost.reel, undefined, "a photo is not a Roll video");
  let daily = box.writes("DANZSTAK-Stories")[0].input.Item;
  assert.equal(daily.mediaKey.S, photoKey, "the Daily points at the post's own media (no second upload)");
  assert.equal(daily.postId.S, photoPost.postId.S);
  assert.equal(daily.fromPost.BOOL, true);
  assert.equal(daily.audience.S, "friends", "the Daily keeps the post's audience");
  assert.equal(Number(daily.expiresAt.N) - Math.floor(Date.parse(daily.createdAt.S) / 1000), 86400, "Dailies last 24 hours");
  assert.equal(result.body.dailyCreated, true);
  assert.equal(result.body.daily.storyId, daily.storyId.S);
  assert.equal(box.writes("DanzStak-UserSettings").length, 0, "photos do not change the video take count");

  // A video post from ANY composer (no reel flag sent): The Roll and Dailies, and the clapper's take count goes up.
  box = sandbox();
  result = await box.post({ content: "Set clip", audience: "public", mediaKey: mediaKey("mp4"), mediaType: "video" });
  assert.equal(result.status, 201);
  assert.equal(box.writes("DANZSTAK-Posts")[0].input.Item.reel.BOOL, true, "every posted video goes into The Roll");
  assert.equal(result.body.reel, true);
  assert.equal(box.writes("DANZSTAK-Stories").length, 1, "the video also goes into Dailies");
  assert.match(box.writes("DanzStak-UserSettings")[0].input.UpdateExpression, /ADD dailyTakeCount :one/);

  // A Tribe post keeps Tribe privacy: its Daily is visible only to the poster.
  box = sandbox();
  result = await box.post({ content: "Tribe clip", groupId: "tribe-1", mediaKey: mediaKey("mp4"), mediaType: "video" });
  assert.equal(result.status, 201);
  assert.equal(box.writes("DANZSTAK-Stories")[0].input.Item.audience.S, "private");

  // Text-only posts add nothing.
  box = sandbox();
  result = await box.post({ content: "Just words", audience: "public" });
  assert.equal(result.status, 201);
  assert.equal(box.writes("DANZSTAK-Stories").length, 0);
  assert.equal(result.body.dailyCreated, false);

  // If the Daily cannot be written (e.g. the permission is not deployed yet), the post still succeeds and says so.
  box = sandbox({ storiesFail: true });
  result = await box.post({ content: "Still posted", audience: "public", mediaKey: mediaKey("jpg"), mediaType: "image" });
  assert.equal(result.status, 201, "a failed Daily never fails the post");
  assert.equal(result.body.dailyCreated, false, "the client can fall back to adding the Daily itself");

  // Facebook imports keep their history out of Dailies and The Roll.
  box = sandbox();
  result = await box.post({ content: "Old clip", audience: "private", mediaKey: mediaKey("mp4"), mediaType: "video", importSource: "facebook", importKey: "a".repeat(64), originalCreatedAt: "2019-05-01T10:00:00.000Z" });
  assert.equal(result.status, 201);
  assert.equal(box.writes("DANZSTAK-Posts")[0].input.Item.reel, undefined);
  assert.equal(box.writes("DANZSTAK-Stories").length, 0);

  // The composers: no Dailies / The Roll checkboxes; every composer sends reel for videos (the current server honours it).
  const feed = read("feed.html"), enhancements = read("assets/feed-enhancements.js"), profileEditor = read("assets/profile-editor.js");
  assert.doesNotMatch(feed, /id="shareToStory"|id="shareToReels"/);
  assert.match(feed, /reel: mediaType === "video", originalContentCertified: true/);
  assert.match(feed, /if \(selectedMedia\?\.file && savedPost\?\.dailyCreated !== true\) \{/, "Mix only uploads a Daily itself when the server did not add one");
  assert.match(enhancements, /groupId: group\.id, mediaKey, mediaType, reel: mediaType === "video"/, "Tribe composer");
  // Task 14-D: the event composer moved to events-page.js.
  assert.match(fs.readFileSync("assets/events-page.js", "utf8"), /reel: media\.mediaType === "video"/, "event composer");
  assert.match(profileEditor, /mediaKey, mediaType, reel: mediaType === "video" \};/, "profile composer");
  assert.doesNotMatch(enhancements, /toggle = document\.getElementById\("shareToReels"\)/, "linked videos go to The Roll without a checkbox");

  // Deploy: the managed policy for the Stories write, attached to the Auth API role.
  const deploy = read("aws-deploy-auth-api.ps1");
  assert.match(deploy, /\$dailiesPolicyName = "DanzStakPostDailies"/);
  assert.match(deploy, /Action = @\("dynamodb:PutItem"\)\s*\n\s*Resource = "arn:aws:dynamodb:us-west-1:\$\(\$identity\.Account\):table\/DANZSTAK-Stories"/);
  assert.match(deploy, /aws iam attach-role-policy --role-name \$RoleName --policy-arn \$dailiesPolicyArn/);

  // Backfill (owner session, once): existing video posts become Roll videos; imports, shares and photos are left alone.
  const backfill = read("infrastructure/auth-api/backfill-video-reels.mjs");
  const needsReel = new vm.Script(`(${backfill.match(/export function needsReel\(item\) \{[\s\S]*?\n\}/)[0].replace("export ", "")})`).runInNewContext({});
  assert.equal(needsReel({ mediaType: { S: "video" }, mediaKey: { S: "users/x/y.mp4" } }), true);
  assert.equal(needsReel({ mediaType: { S: "video" }, mediaKey: { S: "users/x/y.mp4" }, reel: { BOOL: true } }), false);
  assert.equal(needsReel({ mediaType: { S: "video" }, mediaKey: { S: "users/x/y.mp4" }, importSource: { S: "facebook" } }), false);
  assert.equal(needsReel({ mediaType: { S: "image" }, mediaKey: { S: "users/x/y.jpg" } }), false);
  assert.equal(needsReel({ mediaType: { S: "video" }, mediaKey: { S: "users/x/y.mp4" }, sharedPostId: { S: "abc" } }), false);
  assert.match(backfill, /const apply = process\.argv\.includes\("--apply"\);/, "dry run unless --apply");
  console.log("Post Dailies/Roll checks passed: photos and videos from any composer go to Dailies (24 h, own media, audience kept, Tribe private), videos to The Roll, take count, failures never block the post, imports excluded, no checkboxes, managed policy, backfill.");
})().catch(error => { console.error(error); process.exitCode = 1; });
