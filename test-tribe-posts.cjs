const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

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
  "activeGroupIds.has(item.groupId.S)",
  'item.deletionState?.S !== "pending"',
  "groupId: item.groupId?.S || \"\""
]) assert.ok(api.includes(required), `Tribe post API guard missing: ${required}`);

for (const required of [
  "post.groupId",
  'body: JSON.stringify({ content: content || "Shared media", groupId: group.id, mediaKey, mediaType, originalContentCertified: true })',
  "renderTribePosts(group, feed)"
]) assert.ok(tribes.includes(required), `Tribe discussion UI missing: ${required}`);

for (const required of [
  "joinedTribes()",
  "Your Mix",
  "destination.value ? {groupId:destination.value}",
  "Share to ${tribe}"
]) assert.ok(sharing.includes(required), `Share-to-Tribe flow missing: ${required}`);

assert.ok(feed.includes('article.dataset.groupId = groupId'));
assert.ok(feed.includes('className = "post-tribe-link"'));
assert.match(feed, /post-sharing\.js\?v=\d+/);

(async () => {
  const groupId = "11111111-1111-4111-a111-111111111111";
  const post = { postId: { S: "22222222-2222-4222-a222-222222222222" }, userId: { S: "viewer" }, userEmail: { S: "viewer@example.com" }, groupId: { S: groupId }, content: { S: "Tribe post" }, audience: { S: "group" }, createdAt: { S: "2026-11-08T00:00:00Z" } };
  let pending = true;
  const context = vm.createContext({
    corsHeaders: () => ({}), getAuthenticatedUser: async () => "viewer", accountForSub: async () => "viewer@example.com",
    postsTable: "posts", groupsTable: "groups", defaultGroupIds: new Set(), postEditHistory: () => [],
    scanAll: async request => request.TableName === "posts" ? [post] : [
      { userEmail: { S: "viewer@example.com" }, groupId: { S: groupId } },
      { userEmail: { S: `GROUP#${groupId}` }, groupId: { S: "META" }, name: { S: "Road Crew" }, ...(pending ? { deletionState: { S: "pending" } } : {}) }
    ],
    loadFeedAuthorNames: async () => new Map([["viewer@example.com", "Viewer"]])
  });
  vm.runInContext(api.slice(api.indexOf("async function getSecurePosts("), api.indexOf("async function postForEngagement(")), context);
  let posts = JSON.parse((await context.getSecurePosts({ headers: {} })).body).posts;
  assert.equal(posts.length, 0, "a pending Tribe and its posts disappear from Mix even for the founder");
  pending = false;
  posts = JSON.parse((await context.getSecurePosts({ headers: {} })).body).posts;
  assert.equal(posts.length, 1, "an active joined Tribe still exposes its post");
  assert.equal(posts[0].groupName, "Road Crew");
  console.log("Tribe post checks passed: membership-gated posts, hidden pending deletion, Tribe feed rendering, and share destinations.");
})().catch(error => { console.error(error); process.exitCode = 1; });
