import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createDynamoAccountErasureAdapters } from "./infrastructure/auth-api/account-erasure-dynamodb.mjs";
import { ACCOUNT_TABLES, accountMediaPrefixes, conversationId, deletedMemberAddress } from "./infrastructure/auth-api/account-erasure.mjs";

class ScanCommand { constructor(input) { this.input = input; } }
class QueryCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class PutItemCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }
class ListObjectsV2Command { constructor(input) { this.input = input; } }
class DeleteObjectsCommand { constructor(input) { this.input = input; } }
class CopyObjectCommand { constructor(input) { this.input = input; } }
class AdminDeleteUserCommand { constructor(input) { this.input = input; } }
class ListUsersCommand { constructor(input) { this.input = input; } }

const owner = "owner@example.com", friend = "friend@example.com", userId = "owner-sub", friendId = "friend-sub";
const oldConversation = conversationId(owner, friend), tombstone = deletedMemberAddress(userId), newConversation = conversationId(tombstone, friend);
const messageMedia = `${accountMediaPrefixes(owner)[2]}photo.jpg`;
const tables = new Map(Object.entries({
  [ACCOUNT_TABLES.posts]: [
    { postId: { S: "post-owned" }, userId: { S: userId }, userEmail: { S: owner }, content: { S: "mine" }, mediaKey: { S: `${accountMediaPrefixes(owner)[0]}post.jpg` } },
    { postId: { S: "post-share" }, sharedPostId: { S: "post-owned" }, userId: { S: friendId }, userEmail: { S: friend }, content: { S: "friend share caption" } },
    { postId: { S: "post-friend" }, userId: { S: friendId }, userEmail: { S: friend }, content: { S: "friend" } }
  ],
  [ACCOUNT_TABLES.comments]: [
    { postId: { S: "post-owned" }, commentId: { S: "comment-friend" }, userId: { S: friendId }, userEmail: { S: friend } },
    { postId: { S: "post-friend" }, commentId: { S: "comment-owner" }, userId: { S: userId }, userEmail: { S: owner } }
  ],
  [ACCOUNT_TABLES.reactions]: [
    { postId: { S: "post-owned" }, userId: { S: friendId }, userEmail: { S: friend } },
    { postId: { S: "post-friend" }, userId: { S: userId }, userEmail: { S: owner } }
  ],
  [ACCOUNT_TABLES.postViews]: [
    { postId: { S: "post-owned" }, viewerKey: { S: `2026-11-04#${createHash("sha256").update(friendId).digest("hex")}` } },
    { postId: { S: "post-friend" }, viewerKey: { S: `2026-11-04#${createHash("sha256").update(userId).digest("hex")}` } }
  ],
  [ACCOUNT_TABLES.stories]: [
    { storyId: { S: "story-owned-media" }, userEmail: { S: owner }, mediaKey: { S: `${accountMediaPrefixes(owner)[0]}post.jpg` } },
    { storyId: { S: "story-friend" }, userEmail: { S: friend }, mediaKey: { S: "users/friend/photo.jpg" } }
  ],
  [ACCOUNT_TABLES.notifications]: [
    { userEmail: { S: friend }, eventId: { S: "share#post-share" }, postId: { S: "post-share" } },
    { userEmail: { S: friend }, eventId: { S: "unrelated" }, postId: { S: "post-friend" } }
  ],
  [ACCOUNT_TABLES.reviews]: [
    { pk: { S: "REVIEW#review-owned" }, sk: { S: "META" }, reviewId: { S: "review-owned" }, authorUserId: { S: userId }, authorEmail: { S: owner } },
    { pk: { S: "SHOW#show-1" }, sk: { S: "REVIEW#review-owned" }, reviewId: { S: "review-owned" }, entityType: { S: "review-index" } },
    { pk: { S: "REVIEW#review-friend" }, sk: { S: "META" }, reviewId: { S: "review-friend" }, authorUserId: { S: friendId }, authorEmail: { S: friend } }
  ],
  [ACCOUNT_TABLES.friends]: [
    { userEmail: { S: owner }, friendEmail: { S: friend }, status: { S: "friends" } },
    { userEmail: { S: friend }, friendEmail: { S: owner }, status: { S: "friends" } }
  ],
  [ACCOUNT_TABLES.groups]: [
    { userEmail: { S: "GROUP#group-1" }, groupId: { S: "META" }, ownerId: { S: userId } },
    { userEmail: { S: owner }, groupId: { S: "group-1" }, role: { S: "elder" }, joinedAt: { S: "2026-01-01" } },
    { userEmail: { S: friend }, groupId: { S: "group-1" }, joinedAt: { S: "2026-01-02" } }
  ],
  [ACCOUNT_TABLES.tours]: [
    { userId: { S: userId }, tourId: { S: "tour-1" }, plan: { S: "private tour" } },
    { userId: { S: userId }, tourId: { S: "TOUR_MANAGER#LEDGER#2026#evt" }, paymentReference: { S: "cs_test_1" }, description: { S: "purchase" } },
    { userId: { S: "epk-public" }, tourId: { S: "artist" }, ownerId: { S: userId }, plan: { S: "public epk" } }
  ],
  [ACCOUNT_TABLES.conversations]: [
    { userEmail: { S: owner }, contactEmail: { S: friend }, preview: { S: "hello" } },
    { userEmail: { S: friend }, contactEmail: { S: owner }, preview: { S: "hello" } }
  ],
  [ACCOUNT_TABLES.messages]: [
    { conversationId: { S: oldConversation }, messageId: { S: "1700000000000#message-owner" }, senderEmail: { S: owner }, recipientEmail: { S: friend }, content: { S: "owner content must disappear" }, mediaKey: { S: messageMedia } },
    { conversationId: { S: oldConversation }, messageId: { S: "1700000000001#message-friend" }, senderEmail: { S: friend }, recipientEmail: { S: owner }, content: { S: "friend-owned message" } }
  ],
  [ACCOUNT_TABLES.messageReactions]: [
    { conversationId: { S: oldConversation }, reactionId: { S: "reaction-owner" }, messageId: { S: "1700000001#message-friend" }, userEmail: { S: owner }, reaction: { S: "👍" } },
    { conversationId: { S: oldConversation }, reactionId: { S: "reaction-friend" }, messageId: { S: "1700000000001#message-friend" }, userEmail: { S: friend }, reaction: { S: "❤️" } }
  ],
  Sessions: [
    { sessionId: { S: "session-a" }, type: { S: "user_session" }, userId: { S: userId } },
    { sessionId: { S: "session-b" }, type: { S: "user_session" }, userId: { S: friendId } }
  ]
}));

const scalar = attr => attr?.S ?? attr?.N ?? attr?.BOOL;
const sameKey = (item, key) => Object.entries(key).every(([field, attr]) => scalar(item[field]) === scalar(attr));
const fakeDb = { async send(command) {
  const input = command.input, items = tables.get(input.TableName) || [];
  if (command instanceof ScanCommand) return { Items: structuredClone(items) };
  if (command instanceof QueryCommand) {
    const field = input.ExpressionAttributeNames["#partition"], expected = scalar(input.ExpressionAttributeValues[":partition"]);
    return { Items: structuredClone(items.filter(item => scalar(item[field]) === expected)) };
  }
  if (command instanceof DeleteItemCommand) {
    tables.set(input.TableName, items.filter(item => !sameKey(item, input.Key)));
    return {};
  }
  if (command instanceof PutItemCommand) {
    const keyFields = Object.keys(input.Item).filter(field => ["postId", "storyId", "claim", "sessionId", "eventId", "endpointHash", "commentId", "userId", "tourId", "userEmail", "friendEmail", "groupId", "contactEmail", "conversationId", "messageId", "reactionId", "email"].includes(field));
    const natural = keyFields.filter(field => ["sessionId", "claim", "email", "postId", "storyId"].includes(field) || ["userId", "tourId"].every(key => keyFields.includes(key)) && ["userId", "tourId"].includes(field) || ["userEmail", "contactEmail"].every(key => keyFields.includes(key)) && ["userEmail", "contactEmail"].includes(field) || ["conversationId", "messageId"].every(key => keyFields.includes(key)) && ["conversationId", "messageId"].includes(field) || ["conversationId", "reactionId"].every(key => keyFields.includes(key)) && ["conversationId", "reactionId"].includes(field));
    const index = items.findIndex(item => natural.length && natural.every(field => scalar(item[field]) === scalar(input.Item[field])));
    if (index >= 0) items[index] = structuredClone(input.Item); else items.push(structuredClone(input.Item));
    tables.set(input.TableName, items);
    return {};
  }
  if (command instanceof UpdateItemCommand) {
    const item = items.find(candidate => sameKey(candidate, input.Key));
    if (!item) throw new Error("Update target missing");
    if (input.ExpressionAttributeValues[":owner"]) item.ownerId = input.ExpressionAttributeValues[":owner"];
    if (input.ExpressionAttributeValues[":elder"]) item.role = input.ExpressionAttributeValues[":elder"];
    return {};
  }
  throw new Error(`Unexpected database command ${command.constructor.name}`);
} };

const objects = new Set([messageMedia, `${accountMediaPrefixes(owner)[0]}avatar.jpg`]);
const copied = [];
const fakeS3 = { async send(command) {
  if (command instanceof CopyObjectCommand) { copied.push(command.input); objects.add(command.input.Key); return {}; }
  if (command instanceof ListObjectsV2Command) return { Contents: [...objects].filter(key => key.startsWith(command.input.Prefix)).map(Key => ({ Key })), IsTruncated: false };
  if (command instanceof DeleteObjectsCommand) { for (const item of command.input.Delete.Objects) objects.delete(item.Key); return {}; }
  throw new Error(`Unexpected S3 command ${command.constructor.name}`);
} };
const deletedIdentities = [];
const fakeCognito = { async send(command) {
  if (command instanceof ListUsersCommand && command.input.Filter.startsWith("sub =")) return { Users: [{ Username: "owner-cognito-username", Attributes: [{ Name: "sub", Value: userId }] }] };
  if (command instanceof ListUsersCommand) return { Users: [{ Username: "friend-cognito-username", Attributes: [{ Name: "sub", Value: friendId }] }] };
  if (command instanceof AdminDeleteUserCommand) { deletedIdentities.push(command.input.Username); return {}; }
  throw new Error(`Unexpected Cognito command ${command.constructor.name}`);
} };

const adapters = createDynamoAccountErasureAdapters({
  db: fakeDb, s3: fakeS3, cognito: fakeCognito, mediaBucket: "media", userPoolId: "pool", sessionsTable: "Sessions",
  commands: { ScanCommand, QueryCommand, DeleteItemCommand, PutItemCommand, UpdateItemCommand, ListObjectsV2Command, DeleteObjectsCommand, CopyObjectCommand, AdminDeleteUserCommand, ListUsersCommand }
});

const social = await adapters.deleteOwnedSocialContent({ userId, accountEmail: owner });
assert.ok(social.deleted >= 4);
assert.deepEqual(tables.get(ACCOUNT_TABLES.posts).map(item => scalar(item.postId)), ["post-friend"]);
assert.equal(tables.get(ACCOUNT_TABLES.posts).some(item => scalar(item.postId) === "post-share"), false, "every in-service share of an owned original must disappear");
assert.equal(tables.get(ACCOUNT_TABLES.comments).some(item => scalar(item.postId) === "post-owned"), false, "other members' engagement on a deleted post must be removed with the post");
assert.equal(tables.get(ACCOUNT_TABLES.postViews).length, 0, "owned-post views and the deleting member's daily view keys must be erased");
assert.deepEqual(tables.get(ACCOUNT_TABLES.stories).map(item => scalar(item.storyId)), ["story-friend"], "linked owner story placements must disappear with their media");
assert.deepEqual(tables.get(ACCOUNT_TABLES.notifications).map(item => scalar(item.eventId)), ["unrelated"], "share/post notifications must not leak deleted content");
await adapters.deleteWhere(ACCOUNT_TABLES.comments, { userId, accountEmail: owner });
await adapters.deleteWhere(ACCOUNT_TABLES.reactions, { userId, accountEmail: owner, actorUserId: userId });
assert.equal(tables.get(ACCOUNT_TABLES.comments).length, 0);
assert.equal(tables.get(ACCOUNT_TABLES.reactions).length, 0);
const reviews = await adapters.deleteAuthoredReviews({ userId, accountEmail: owner });
assert.equal(reviews.deleted, 2, "authored review metadata and every index placement must be deleted");
assert.deepEqual(tables.get(ACCOUNT_TABLES.reviews).map(item => scalar(item.reviewId)), ["review-friend"]);

const migrated = await adapters.migrateSharedConversations({ userId, accountEmail: owner, tombstoneEmail: tombstone });
assert.equal(migrated.retained, 3);
assert.equal(tables.get(ACCOUNT_TABLES.messages).length, 1);
assert.equal(scalar(tables.get(ACCOUNT_TABLES.messages)[0].conversationId), newConversation);
assert.equal(scalar(tables.get(ACCOUNT_TABLES.messages)[0].senderEmail), friend);
assert.equal(scalar(tables.get(ACCOUNT_TABLES.messages)[0].recipientEmail), tombstone);
assert.equal(scalar(tables.get(ACCOUNT_TABLES.messages)[0].content), "friend-owned message");
assert.equal(tables.get(ACCOUNT_TABLES.messages).some(item => scalar(item.content) === "owner content must disappear"), false, "the deleting member's sent content must not be retained in another thread");
assert.equal(tables.get(ACCOUNT_TABLES.conversations).length, 1, "deleted member's private conversation row must be removed");
assert.equal(scalar(tables.get(ACCOUNT_TABLES.conversations)[0].contactEmail), tombstone);
assert.equal(copied.length, 0, "the deleting member's message media must not be copied into retained storage");

const relationships = await adapters.deleteWhere(ACCOUNT_TABLES.friends, { userEmail: owner, friendEmail: owner });
assert.equal(relationships.deleted, 2, "both directions of a friendship must be removed");
const groups = await adapters.removeGroupMemberships({ userId, accountEmail: owner });
assert.equal(groups.anonymized, 1);
assert.equal(scalar(tables.get(ACCOUNT_TABLES.groups).find(item => scalar(item.groupId) === "META").ownerId), friendId);
assert.equal(tables.get(ACCOUNT_TABLES.groups).some(item => scalar(item.userEmail) === owner), false);

const professional = await adapters.deleteProfessionalData({ userId, accountEmail: owner });
assert.equal(professional.retained, 1);
assert.equal(tables.get(ACCOUNT_TABLES.tours).some(item => scalar(item.userId) === userId), false);
assert.equal(tables.get(ACCOUNT_TABLES.tours).some(item => scalar(item.userId).startsWith("DELETED_ACCOUNT#") && scalar(item.paymentReference) === "cs_test_1"), true);
assert.equal(tables.get(ACCOUNT_TABLES.tours).some(item => scalar(item.ownerId) === userId), false);

await adapters.deleteMediaPrefix(accountMediaPrefixes(owner)[0]);
assert.equal([...objects].some(key => key.startsWith(accountMediaPrefixes(owner)[0])), false);
await adapters.deleteSessions({ userId });
assert.deepEqual(tables.get("Sessions").map(item => scalar(item.userId)), [friendId]);
await adapters.deleteIdentity({ userId });
assert.deepEqual(deletedIdentities, ["owner-cognito-username"], "Cognito deletion must use the provider Username resolved from the immutable sub");

console.log("DynamoDB erasure adapter checks passed: global share deletion, review/index deletion, bidirectional relationships, Tribe transfer, payment minimization, owner-message purge, session revocation, and provider-username identity deletion.");
