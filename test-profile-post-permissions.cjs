"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");

const profile = fs.readFileSync("assets/profile-editor.js", "utf8");
const collections = require("./assets/profile-collections.js");
const auth = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const signaling = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const settings = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(profile, /Who can post on your profile\?/);
assert.match(profile, /Only me/);
assert.match(profile, /Friends/);
assert.match(profile, /Anyone on DanzStak/);
assert.match(profile, /get\("edit"\) === "privacy"/);
assert.match(profile, /panel\.elements\.profilePostPermission\.focus/);
assert.match(settings, /profile\.html\?edit=privacy/);
assert.match(settings, /Profile posting and tagging/);
assert.match(settings, /settingRow\("✎", "Profile posting and tagging"/, "the settings row uses a widely supported symbol instead of a missing-glyph emoji");
assert.match(profile, /Allow accepted friends to tag me in photos and videos/);
assert.match(profile, /profile\.allowTags = panel\.elements\.allowTags\.checked/);
assert.match(profile, /profileMemberId:\s*profile\.memberId/);
assert.match(profile, /Remove from my profile/);
assert.match(auth, /profilePostPermission/);
assert.match(auth, /Only accepted friends can post on this profile/);
assert.match(auth, /Only the author or profile owner can remove this post/);
assert.match(auth, /profileOwnerId:\s*\{\s*S:\s*profileOwnerId\s*\}/);
assert.match(signaling, /canPostToProfile/);
assert.match(signaling, /allowTags:item\?\.allowTags\?\.BOOL!==false/);
assert.match(signaling, /Valid tagging permission required/);
assert.match(signaling, /\['owner','friends','anyone'\]/);

const posts = [
  { postId: "own", userId: "member-1" },
  { postId: "wall", userId: "friend-member", profileOwnerMemberId: "member-1" },
  { postId: "elsewhere", userId: "member-1", profileOwnerMemberId: "member-2" }
];
assert.deepEqual(collections.select(posts, "posts", "owner@example.com", true, new Date(), "member-1").map(post => post.postId), ["own", "wall"]);

console.log("Profile posting permission checks passed: saved choices, server authorization, wall filtering, and profile-owner removal are present.");
