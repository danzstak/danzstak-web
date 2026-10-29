const assert = require("node:assert/strict");
const fs = require("node:fs");

const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const tribes = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const sharing = fs.readFileSync("assets/post-sharing.js", "utf8");

for (const required of [
  "const requestedGroupId = data.groupId",
  'const audience = requestedGroupId ? "group"',
  "await requireGroupMember(requestedGroupId, userId)",
  "...(requestedGroupId ? { groupId: { S: requestedGroupId } } : {})",
  "post.groupId?.S",
  "viewerGroupIds.has(item.groupId.S)",
  "groupId: item.groupId?.S || \"\""
]) assert.ok(api.includes(required), `Tribe post API guard missing: ${required}`);

for (const required of [
  "post.groupId",
  'body: JSON.stringify({ content: content || "Shared media", groupId: group.id, mediaKey, mediaType, originalContentCertified: true })',
  "renderTribePosts(group, feed)"
]) assert.ok(tribes.includes(required), `Tribe discussion UI missing: ${required}`);

for (const required of [
  "joinedTribes()",
  "Your DanzStak feed",
  "destination.value ? {groupId:destination.value}",
  "Share to ${tribe}"
]) assert.ok(sharing.includes(required), `Share-to-Tribe flow missing: ${required}`);

assert.ok(feed.includes('article.dataset.groupId = groupId'));
assert.ok(feed.includes('className = "post-tribe-link"'));
assert.match(feed, /post-sharing\.js\?v=\d+/);
console.log("Tribe post checks passed: membership-gated posts, Tribe feed rendering, and share destinations.");
