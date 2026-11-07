"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const {
    reviewTargetId,
    cleanReviewDraft,
    reviewEntityToView,
    reviewTargetsFromPublishedEpk,
    reviewRecordKeys
  } = await import("./infrastructure/auth-api/index.mjs");

  const artistId = "11111111-1111-4111-a111-111111111111";
  const releaseId = reviewTargetId("release", artistId, "First Record — 2026");
  assert.match(releaseId, /^[a-f0-9]{32}$/);
  assert.equal(reviewTargetId("release", artistId, "First Record — 2026"), releaseId, "the same artist-owned target must keep a stable review identifier");
  assert.notEqual(reviewTargetId("show", artistId, "First Record — 2026"), releaseId, "show and release identifiers must not collide");
  assert.equal(reviewTargetId("unknown", artistId, "Anything"), "", "unknown target types must be rejected");

  const publicItem = {
    ownerId: { S: artistId },
    plan: { S: JSON.stringify({
      artistName: "Example Artist",
      releases: ["First Record — 2026", "Second Record — 2027"],
      notableShows: ["Example Club — Berlin — 2026-11-01"],
      musicLinks: [{ label: "Bandcamp", url: "https://example.bandcamp.com" }]
    }) }
  };
  const targets = reviewTargetsFromPublishedEpk(publicItem);
  assert.equal(targets.length, 3, "published EPK shows and releases should become reviewable targets without copying or hosting music");
  assert.equal(targets.filter(target => target.targetType === "release").length, 2);
  assert.equal(targets.find(target => target.title === "First Record — 2026").targetId, releaseId, "reordering an EPK must not change a target identifier");
  assert.equal(targets.filter(target => target.targetType === "show").length, 1);
  assert.equal(targets.every(target => target.artistUserId === artistId && target.artistName === "Example Artist"), true);
  assert.deepEqual(reviewTargetsFromPublishedEpk({ ownerId: { S: artistId }, plan: { S: "not-json" } }), [], "malformed EPK records must fail closed");

  const valid = cleanReviewDraft({ artistPublicId: "example-artist", targetType: "release", targetId: releaseId, body: "A direct, thoughtful review." });
  assert.deepEqual(valid, { artistPublicId: "example-artist", targetType: "release", targetId: releaseId, body: "A direct, thoughtful review." });
  assert.equal(cleanReviewDraft({ artistPublicId: "example-artist", targetType: "release", targetId: releaseId, body: "Too short" }), null, "reviews shorter than ten characters must be rejected");
  assert.equal(cleanReviewDraft({ artistPublicId: "example-artist", targetType: "release", targetId: releaseId, body: "A valid review body", media: [{ key: "unsafe.mp3" }] }), null, "media must fail closed until the server-verified review pipeline exists");
  assert.equal(cleanReviewDraft({ artistPublicId: "example-artist", targetType: "release", targetId: "made-up", body: "A valid review body" }), null, "clients cannot invent review targets");

  const review = {
    reviewId: "a".repeat(32),
    authorUserId: "22222222-2222-4222-a222-222222222222",
    artistUserId: artistId,
    artistPublicId: "example-artist",
    targetType: "release",
    targetId: releaseId,
    createdAt: "2026-11-07T12:00:00.000Z"
  };
  const keys = reviewRecordKeys(review);
  assert.equal(keys.length, 6, "review creation and deletion must cover the entity, uniqueness lock, global, target, artist, and author records");
  assert.equal(keys[0].pk.S, `REVIEW#${review.reviewId}`);
  assert.equal(keys[1].pk.S, `UNIQUE#${review.authorUserId}#release#${releaseId}`);
  assert.equal(keys[2].pk.S, "REVIEWS");
  assert.equal(keys[3].pk.S, `TARGET#release#${releaseId}`);

  const view = reviewEntityToView({
    reviewId: { S: review.reviewId }, authorUserId: { S: review.authorUserId }, artistUserId: { S: artistId }, artistPublicId: { S: "example-artist" },
    targetType: { S: "release" }, targetId: { S: releaseId }, targetTitle: { S: "First Record — 2026" },
    targetDetail: { S: "Release" }, body: { S: "A direct, thoughtful review." },
    createdAt: { S: review.createdAt }, updatedAt: { S: review.createdAt }, internalSecret: { S: "must-not-leak" }
  });
  assert.equal(view.body, "A direct, thoughtful review.");
  assert.equal(view.artistPublicId, "example-artist");
  assert.equal("internalSecret" in view, false, "review responses must use an explicit public field allowlist");

  const backend = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  const deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
  for (const route of ["GET /review-targets", "GET /reviews", "POST /reviews", "PATCH /reviews/{reviewId}", "DELETE /reviews/{reviewId}"]) {
    assert.match(deploy, new RegExp(route.replace(/[{}]/g, "\\$&")), `${route} must be provisioned through the existing Auth API deployment`);
  }
  assert.match(deploy, /DANZSTAK-Reviews/);
  assert.match(deploy, /PointInTimeRecoveryEnabled=true/);
  assert.match(backend, /await isBlockedPair\(authorEmail, artistEmail\)/, "review creation must enforce account blocks server-side");
  assert.match(backend, /ConditionExpression: "attribute_not_exists\(pk\)"/, "the one-review rule must be enforced atomically rather than only in the browser");
  assert.match(backend, /ConditionExpression: "authorUserId = :author"/, "only the original reviewer may edit a review");

  console.log("Reviews domain checks passed: canonical published targets, bounded prose, media fail-closed, atomic uniqueness, author ownership, block enforcement, and deployment wiring.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
