import { createHash } from "node:crypto";
import { ACCOUNT_TABLES, accountMediaPrefixes, conversationId, deletedMemberAddress } from "./account-erasure.mjs";

const KEY_FIELDS = Object.freeze({
  [ACCOUNT_TABLES.posts]: ["postId"],
  [ACCOUNT_TABLES.postViews]: ["postId", "viewerKey"],
  [ACCOUNT_TABLES.comments]: ["postId", "commentId"],
  [ACCOUNT_TABLES.reactions]: ["postId", "userId"],
  [ACCOUNT_TABLES.reviews]: ["pk", "sk"],
  [ACCOUNT_TABLES.notifications]: ["userEmail", "eventId"],
  [ACCOUNT_TABLES.friends]: ["userEmail", "friendEmail"],
  [ACCOUNT_TABLES.stories]: ["storyId"],
  [ACCOUNT_TABLES.groups]: ["userEmail", "groupId"],
  [ACCOUNT_TABLES.tours]: ["userId", "tourId"],
  [ACCOUNT_TABLES.settings]: ["userEmail"],
  [ACCOUNT_TABLES.profileNames]: ["claim"],
  [ACCOUNT_TABLES.presence]: ["email"],
  [ACCOUNT_TABLES.pushSubscriptions]: ["userEmail", "endpointHash"],
  [ACCOUNT_TABLES.sessionDevices]: ["userId", "deviceId"],
  [ACCOUNT_TABLES.callingDevices]: ["userEmail", "deviceId"],
  [ACCOUNT_TABLES.calls]: ["recipientEmail", "eventId"],
  [ACCOUNT_TABLES.plans]: ["planId", "participantEmail"],
  [ACCOUNT_TABLES.conversations]: ["userEmail", "contactEmail"],
  [ACCOUNT_TABLES.messages]: ["conversationId", "messageId"],
  [ACCOUNT_TABLES.messageReactions]: ["conversationId", "reactionId"]
});

const value = attribute => attribute?.S ?? attribute?.N ?? attribute?.BOOL ?? null;
const string = attribute => typeof attribute?.S === "string" ? attribute.S : "";

function itemKey(table, item) {
  const fields = KEY_FIELDS[table];
  if (!fields) throw new Error(`No account-erasure key schema for ${table}`);
  const key = {};
  for (const field of fields) {
    if (!item?.[field]) throw new Error(`Missing ${field} on ${table} erasure item`);
    key[field] = item[field];
  }
  return key;
}

function matchesAny(item, match) {
  return Object.entries(match).some(([field, expected]) => expected !== undefined && value(item?.[field]) === expected);
}

function sanitizedPaymentItem(item, retainedUserId) {
  const allowed = ["tourId", "entryType", "paymentMethod", "paymentReference", "priceId", "delta", "status", "description", "venueKey", "createdAt", "paidAt", "refundedAt", "environment", "sessionId"];
  return Object.fromEntries([
    ["userId", { S: retainedUserId }],
    ...allowed.filter(field => item[field]).map(field => [field, item[field]])
  ]);
}

export function createDynamoAccountErasureAdapters({ db, s3, cognito, commands, tables = ACCOUNT_TABLES, sessionsTable, mediaBucket, userPoolId }) {
  const {
    ScanCommand, QueryCommand, DeleteItemCommand, PutItemCommand, UpdateItemCommand,
    ListObjectsV2Command, DeleteObjectsCommand, AdminDeleteUserCommand, ListUsersCommand
  } = commands || {};
  for (const [name, Command] of Object.entries({ ScanCommand, QueryCommand, DeleteItemCommand, PutItemCommand, UpdateItemCommand })) {
    if (typeof Command !== "function") throw new TypeError(`${name} is required for account erasure`);
  }
  if (!sessionsTable) throw new TypeError("The sessions table is required for account erasure");
  const keyFor = (table, item) => table === sessionsTable
    ? (item?.sessionId ? { sessionId: item.sessionId } : (() => { throw new Error("Missing sessionId on account-erasure item"); })())
    : itemKey(table, item);

  async function scanAll(table, options = {}) {
    const items = [];
    let ExclusiveStartKey;
    do {
      const page = await db.send(new ScanCommand({ TableName: table, ConsistentRead: true, ...options, ExclusiveStartKey }));
      items.push(...(page.Items || []));
      ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
  }

  async function queryAll(table, keyName, keyValue) {
    const items = [];
    let ExclusiveStartKey;
    do {
      const page = await db.send(new QueryCommand({
        TableName: table,
        KeyConditionExpression: "#partition = :partition",
        ExpressionAttributeNames: { "#partition": keyName },
        ExpressionAttributeValues: { ":partition": { S: keyValue } },
        ConsistentRead: true,
        ExclusiveStartKey
      }));
      items.push(...(page.Items || []));
      ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
  }

  async function deleteItems(table, items) {
    for (let offset = 0; offset < items.length; offset += 10) {
      await Promise.all(items.slice(offset, offset + 10).map(item => db.send(new DeleteItemCommand({ TableName: table, Key: keyFor(table, item) }))));
    }
    return items.length;
  }

  async function deleteWhere(table, match) {
    const items = (await scanAll(table)).filter(item => matchesAny(item, match));
    return { deleted: await deleteItems(table, items) };
  }

  async function deleteOwnedSocialContent({ userId, accountEmail }) {
    const ownedPosts = (await scanAll(tables.posts)).filter(item => string(item.userId) === userId || string(item.userEmail) === accountEmail);
    const allPosts = await scanAll(tables.posts);
    const deletionRecords = new Map();
    for (const post of ownedPosts) {
      const postId = string(post.postId);
      deletionRecords.set(postId, post);
      if (!string(post.sharedPostId)) {
        for (const share of allPosts) if (string(share.sharedPostId) === postId) deletionRecords.set(string(share.postId), share);
      }
    }
    let deleted = 0;
    const ids = new Set(deletionRecords.keys());
    for (const [postId] of deletionRecords) {
      const [comments, reactions, views] = await Promise.all([
        queryAll(tables.comments, "postId", postId),
        queryAll(tables.reactions, "postId", postId),
        tables.postViews ? queryAll(tables.postViews, "postId", postId) : Promise.resolve([])
      ]);
      deleted += await deleteItems(tables.comments, comments);
      deleted += await deleteItems(tables.reactions, reactions);
      if (tables.postViews) deleted += await deleteItems(tables.postViews, views);
    }
    if (tables.postViews) {
      const viewerHash = createHash("sha256").update(userId).digest("hex");
      const views = (await scanAll(tables.postViews)).filter(item => string(item.viewerKey).endsWith(`#${viewerHash}`));
      deleted += await deleteItems(tables.postViews, views);
    }
    const linkedMedia = new Set(ownedPosts.map(post => string(post.mediaKey)).filter(Boolean));
    if (linkedMedia.size) {
      const linkedStories = (await scanAll(tables.stories)).filter(item => string(item.userEmail) === accountEmail && linkedMedia.has(string(item.mediaKey)));
      deleted += await deleteItems(tables.stories, linkedStories);
    }
    const notifications = (await scanAll(tables.notifications)).filter(item => {
      if (ids.has(string(item.postId)) || ids.has(string(item.sharedPostId)) || ids.has(string(item.sourcePostId))) return true;
      const eventId = string(item.eventId);
      for (const id of ids) if (eventId.includes(id)) return true;
      return false;
    });
    deleted += await deleteItems(tables.notifications, notifications);
    const shares = [...deletionRecords.values()].filter(item => string(item.sharedPostId));
    const originals = [...deletionRecords.values()].filter(item => !string(item.sharedPostId));
    deleted += await deleteItems(tables.posts, shares);
    deleted += await deleteItems(tables.posts, originals);
    return { deleted };
  }

  async function deleteAuthoredReviews({ userId, accountEmail }) {
    const rows = await scanAll(tables.reviews);
    const authored = rows.filter(item => string(item.authorUserId) === userId || string(item.authorEmail) === accountEmail);
    const reviewIds = new Set(authored.map(item => string(item.reviewId) || string(item.pk).replace(/^REVIEW#/, "")).filter(Boolean));
    const authoredKeys = new Set(authored.map(item => `${string(item.pk)}\u0000${string(item.sk)}`));
    const indexes = rows.filter(item => {
      if (authoredKeys.has(`${string(item.pk)}\u0000${string(item.sk)}`)) return false;
      return reviewIds.has(string(item.reviewId)) || reviewIds.has(string(item.pk).replace(/^REVIEW#/, ""));
    });
    let deleted = await deleteItems(tables.reviews, indexes);
    deleted += await deleteItems(tables.reviews, authored);
    return { deleted };
  }

  async function lookupUserIdByEmail(email) {
    if (typeof ListUsersCommand !== "function" || !cognito || !userPoolId) return "";
    const safeEmail = email.replace(/["\\]/g, "");
    const result = await cognito.send(new ListUsersCommand({ UserPoolId: userPoolId, Filter: `email = "${safeEmail}"`, Limit: 1 }));
    return result.Users?.[0]?.Attributes?.find(attribute => attribute.Name === "sub")?.Value || "";
  }

  async function removeGroupMemberships({ userId, accountEmail }) {
    const memberships = await queryAll(tables.groups, "userEmail", accountEmail);
    const meta = (await scanAll(tables.groups)).filter(item => string(item.groupId) === "META" && string(item.ownerId) === userId);
    let deleted = 0, anonymized = 0, retained = 0;
    for (const group of meta) {
      const groupId = string(group.userEmail).replace(/^GROUP#/, "");
      const candidates = (await scanAll(tables.groups)).filter(item => string(item.groupId) === groupId && string(item.userEmail) !== accountEmail && !string(item.userEmail).startsWith("GROUP#"));
      candidates.sort((left, right) => Number(string(right.role) === "elder") - Number(string(left.role) === "elder") || string(left.joinedAt).localeCompare(string(right.joinedAt)));
      const successor = candidates[0];
      if (successor) {
        const successorId = await lookupUserIdByEmail(string(successor.userEmail));
        if (!successorId) throw new Error(`Cannot transfer Tribe ${groupId} without a verified successor identity`);
        await db.send(new UpdateItemCommand({
          TableName: tables.groups,
          Key: itemKey(tables.groups, group),
          UpdateExpression: "SET ownerId = :owner, ownershipTransferredAt = :at",
          ExpressionAttributeValues: { ":owner": { S: successorId }, ":at": { S: new Date().toISOString() } }
        }));
        await db.send(new UpdateItemCommand({
          TableName: tables.groups,
          Key: itemKey(tables.groups, successor),
          UpdateExpression: "SET #role = :elder",
          ExpressionAttributeNames: { "#role": "role" },
          ExpressionAttributeValues: { ":elder": { S: "elder" } }
        }));
        anonymized += 1;
        retained += candidates.length;
      } else {
        deleted += await deleteItems(tables.groups, [group]);
      }
    }
    deleted += await deleteItems(tables.groups, memberships);
    return { deleted, anonymized, retained };
  }

  async function deleteProfessionalData({ userId }) {
    const items = await queryAll(tables.tours, "userId", userId);
    const retainedUserId = `DELETED_ACCOUNT#${createHash("sha256").update(userId).digest("hex")}`;
    let deleted = 0, anonymized = 0, retained = 0;
    for (const item of items) {
      const id = string(item.tourId);
      if (id.startsWith("TOUR_MANAGER#LEDGER#") || id.startsWith("TOUR_MANAGER#CHECKOUT#")) {
        await db.send(new PutItemCommand({ TableName: tables.tours, Item: sanitizedPaymentItem(item, retainedUserId) }));
        anonymized += 1;
        retained += 1;
      }
      deleted += await deleteItems(tables.tours, [item]);
    }
    const published = (await scanAll(tables.tours)).filter(item => string(item.ownerId) === userId);
    deleted += await deleteItems(tables.tours, published);
    return { deleted, anonymized, retained };
  }

  async function migrateSharedConversations({ userId, accountEmail, tombstoneEmail }) {
    const rows = (await scanAll(tables.conversations)).filter(item => string(item.userEmail) === accountEmail || string(item.contactEmail) === accountEmail);
    const others = [...new Set(rows.map(item => string(item.userEmail) === accountEmail ? string(item.contactEmail) : string(item.userEmail)).filter(Boolean))];
    let deleted = 0, anonymized = 0, retained = 0;
    for (const other of others) {
      const oldId = conversationId(accountEmail, other), newId = conversationId(tombstoneEmail, other);
      const [messages, reactions] = await Promise.all([
        queryAll(tables.messages, "conversationId", oldId),
        queryAll(tables.messageReactions, "conversationId", oldId)
      ]);
      const retainedMessageIds = new Set();
      for (const message of messages) {
        if (string(message.senderEmail) === accountEmail) continue;
        const moved = structuredClone(message);
        moved.conversationId = { S: newId };
        if (string(moved.recipientEmail) === accountEmail) moved.recipientEmail = { S: tombstoneEmail };
        await db.send(new PutItemCommand({ TableName: tables.messages, Item: moved }));
        retainedMessageIds.add(string(moved.messageId));
        anonymized += 1; retained += 1;
      }
      for (const reaction of reactions) {
        if (string(reaction.userEmail) === accountEmail || !retainedMessageIds.has(string(reaction.messageId))) continue;
        const moved = structuredClone(reaction);
        moved.conversationId = { S: newId };
        await db.send(new PutItemCommand({ TableName: tables.messageReactions, Item: moved }));
        anonymized += 1; retained += 1;
      }
      const remaining = rows.find(item => string(item.userEmail) === other && string(item.contactEmail) === accountEmail);
      if (remaining) {
        await db.send(new PutItemCommand({ TableName: tables.conversations, Item: { ...remaining, contactEmail: { S: tombstoneEmail }, contactDeleted: { BOOL: true } } }));
        anonymized += 1; retained += 1;
      }
      deleted += await deleteItems(tables.messages, messages);
      deleted += await deleteItems(tables.messageReactions, reactions);
    }
    deleted += await deleteItems(tables.conversations, rows);
    return { deleted, anonymized, retained };
  }

  async function deleteMediaPrefix(prefix) {
    if (!s3 || !mediaBucket || typeof ListObjectsV2Command !== "function" || typeof DeleteObjectsCommand !== "function") throw new Error("S3 account erasure is not configured");
    let deleted = 0, ContinuationToken;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: mediaBucket, Prefix: prefix, ContinuationToken }));
      const objects = (page.Contents || []).map(item => ({ Key: item.Key })).filter(item => item.Key);
      if (objects.length) {
        const result = await s3.send(new DeleteObjectsCommand({ Bucket: mediaBucket, Delete: { Objects: objects, Quiet: true } }));
        if (result.Errors?.length) throw new Error(`S3 account erasure left ${result.Errors.length} object(s) pending`);
        deleted += objects.length;
      }
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return { deleted };
  }

  async function deleteSessions({ userId }) {
    const items = (await scanAll(sessionsTable)).filter(item => string(item.userId) === userId && string(item.type) !== "account_deletion_request");
    return { deleted: await deleteItems(sessionsTable, items) };
  }

  async function deleteIdentity({ userId }) {
    if (!cognito || !userPoolId || typeof AdminDeleteUserCommand !== "function") throw new Error("Cognito account erasure is not configured");
    if (typeof ListUsersCommand !== "function") throw new Error("Cognito identity lookup is not configured");
    const safeSub = userId.replace(/["\\]/g, "");
    const result = await cognito.send(new ListUsersCommand({ UserPoolId: userPoolId, Filter: `sub = "${safeSub}"`, Limit: 1 }));
    const username = result.Users?.[0]?.Username;
    if (!username) return { deleted: 0 };
    try {
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }));
    } catch (error) {
      if (error?.name === "UserNotFoundException") return { deleted: 0 };
      throw error;
    }
    return { deleted: 1 };
  }

  return { deleteWhere, deleteOwnedSocialContent, deleteAuthoredReviews, removeGroupMemberships, deleteProfessionalData, migrateSharedConversations, deleteMediaPrefix, deleteSessions, deleteIdentity };
}
