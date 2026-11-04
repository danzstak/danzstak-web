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
    { postId: { S: "post-owned" }, userId: { S: userId }, userEmail: { S: owner }, content: { S: "mine" }, audience: { S: "public" }, createdAt: { S: "2026-01-01" }, mediaKey: { S: "users/private/post.jpg" } },
    { postId: { S: "share-owned" }, userId: { S: userId }, userEmail: { S: owner }, content: { S: "my share" }, sharedPostId: { S: "post-friend" }, createdAt: { S: "2026-01-02" } },
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
    { conversationId: { S: oldConversation }, messageId: { S: "1700000000000#message-1" }, senderEmail: { S: owner }, recipientEmail: { S: friend }, content: { S: "hello" }, mediaKey: { S: messageMedia } }
  ],
  [ACCOUNT_TABLES.messageReactions]: [
    { conversationId: { S: oldConversation }, reactionId: { S: "reaction-1" }, messageId: { S: "1700000000000#message-1" }, userEmail: { S: owner }, reaction: { S: "👍" } }
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
  if (command instanceof ListUsersCommand) return { Users: [{ Attributes: [{ Name: "sub", Value: friendId }] }] };
  if (command instanceof AdminDeleteUserCommand) { deletedIdentities.push(command.input.Username); return {}; }
  throw new Error(`Unexpected Cognito command ${command.constructor.name}`);
} };

const adapters = createDynamoAccountErasureAdapters({
  db: fakeDb, s3: fakeS3, cognito: fakeCognito, mediaBucket: "media", userPoolId: "pool", sessionsTable: "Sessions",
  commands: { ScanCommand, QueryCommand, DeleteItemCommand, PutItemCommand, UpdateItemCommand, ListObjectsV2Command, DeleteObjectsCommand, CopyObjectCommand, AdminDeleteUserCommand, ListUsersCommand }
});

const social = await adapters.deleteOwnedSocialContent({ userId, accountEmail: owner });
assert.ok(social.deleted >= 4);
assert.equal(social.anonymized, 1);
assert.equal(social.retained, 1);
assert.deepEqual(tables.get(ACCOUNT_TABLES.posts).map(item => scalar(item.postId)).sort(), ["post-friend", "post-owned"]);
const revokedSource = tables.get(ACCOUNT_TABLES.posts).find(item => scalar(item.postId) === "post-owned");
assert.equal(scalar(revokedSource.sourceRevoked), true, "account deletion must revoke canonical source content for every share");
assert.match(scalar(revokedSource.userId), /^DELETED_ACCOUNT#/);
assert.match(scalar(revokedSource.userEmail), /^deleted\+/);
assert.equal(revokedSource.content, undefined, "a retained revocation marker must contain no source text");
assert.equal(revokedSource.mediaKey, undefined, "a retained revocation marker must contain no source media key");
assert.equal(tables.get(ACCOUNT_TABLES.posts).some(item => scalar(item.postId) === "share-owned"), false, "the departing member's own reshare placement must be deleted");
assert.equal(tables.get(ACCOUNT_TABLES.comments).some(item => scalar(item.postId) === "post-owned"), false, "other members' engagement on a deleted post must be removed with the post");
assert.equal(tables.get(ACCOUNT_TABLES.postViews).length, 0, "owned-post views and the deleting member's daily view keys must be erased");
await adapters.deleteWhere(ACCOUNT_TABLES.comments, { userId, accountEmail: owner });
await adapters.deleteWhere(ACCOUNT_TABLES.reactions, { userId, accountEmail: owner, actorUserId: userId });
assert.equal(tables.get(ACCOUNT_TABLES.comments).length, 0);
assert.equal(tables.get(ACCOUNT_TABLES.reactions).length, 0);

const migrated = await adapters.migrateSharedConversations({ userId, accountEmail: owner, tombstoneEmail: tombstone });
assert.equal(migrated.retained, 3);
assert.equal(tables.get(ACCOUNT_TABLES.messages).length, 1);
assert.equal(scalar(tables.get(ACCOUNT_TABLES.messages)[0].conversationId), newConversation);
assert.equal(scalar(tables.get(ACCOUNT_TABLES.messages)[0].senderEmail), tombstone);
assert.ok(scalar(tables.get(ACCOUNT_TABLES.messages)[0].mediaKey).startsWith(`shared-messages/${newConversation}/`));
assert.equal(tables.get(ACCOUNT_TABLES.conversations).length, 1, "deleted member's private conversation row must be removed");
assert.equal(scalar(tables.get(ACCOUNT_TABLES.conversations)[0].contactEmail), tombstone);
assert.equal(copied.length, 1, "delivered media must move before owner-prefix deletion");

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
assert.deepEqual(deletedIdentities, [userId]);

console.log("DynamoDB erasure adapter checks passed: pagination shape, bidirectional deletion, Tribe transfer, payment minimization, message/media migration, session revocation, and identity deletion.");
