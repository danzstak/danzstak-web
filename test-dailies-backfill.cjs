"use strict";
// Owner 2026-11-19: every photo/video post into Dailies (24 h), every video into The Roll, TAKE = videos posted.
const assert = require("node:assert/strict");
(async () => {
  const { plan, dailyFor, mediaPost, memberEmailArg } = await import("./infrastructure/auth-api/dailies-backfill-plan.mjs");
  const now = 1_800_000_000;
  const post = (id, email, type, extra = {}) => ({ postId: { S: id }, userEmail: { S: email }, content: { S: "hi" }, audience: { S: "public" }, ...(type ? { mediaKey: { S: `posts/${id}` }, mediaType: { S: type } } : {}), ...extra });
  const posts = [
    post("v1", "me@x.test", "video"), post("v2", "me@x.test", "video", { reel: { BOOL: true } }), post("v3", "me@x.test", "video"),
    post("p1", "me@x.test", "image"), post("p2", "me@x.test", "image"), post("t1", "me@x.test", ""),
    post("s1", "me@x.test", "video", { sharedPostId: { S: "v1" } }), post("g1", "me@x.test", "image", { groupId: { S: "tribe" } })
  ];
  const stories = [{ storyId: { S: "a" }, postId: { S: "p1" }, expiresAt: { N: String(now + 100) } }, { storyId: { S: "b" }, postId: { S: "v1" }, expiresAt: { N: String(now - 100) } }];
  const result = plan(posts, stories, now);
  assert.deepEqual(result.media.map(p => p.postId.S), ["v1", "v2", "v3", "p1", "p2", "g1"], "photo and video posts only; shared posts and text posts left out");
  assert.deepEqual(result.dailies.map(p => p.postId.S), ["v1", "v2", "v3", "p2", "g1"], "every media post gets a Daily unless it already has a live one");
  assert.deepEqual(result.reels.map(p => p.postId.S), ["v1", "v3"], "every video joins The Roll");
  assert.equal(result.takes.get("me@x.test"), 3, "TAKE = number of videos posted");
  const daily = dailyFor(posts[0], now, "id");
  assert.equal(daily.expiresAt.N, String(now + 86400), "lasts 24 hours from now");
  assert.equal(daily.fromPost.BOOL, true); assert.equal(daily.mediaKey.S, "posts/v1", "same media, no second upload");
  assert.equal(dailyFor(posts[7], now, "id").audience.S, "private", "a Tribe post's Daily stays private to the poster");
  assert.equal(mediaPost(posts[5]), false);
  // Owner run 2026-11-19: "--apply" alone must not become the email filter.
  assert.equal(memberEmailArg(["--apply"]), "", "--apply alone keeps every member");
  assert.equal(memberEmailArg([]), "");
  assert.equal(memberEmailArg(["--apply", "--member-email", "Me@X.test"]), "me@x.test");
  assert.throws(() => memberEmailArg(["--member-email", "--apply"]), /needs an address/);
  assert.equal(plan(posts, stories, now, memberEmailArg(["--apply"])).dailies.length, 5, "the apply run sees the same posts as the dry run");
  console.log("Dailies backfill checks passed: every photo/video post into Dailies (24 h), videos into The Roll, TAKE = videos posted, no duplicates.");
})().catch(error => { console.error(error); process.exit(1); });
