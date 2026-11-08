"use strict";

const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const postId = "11111111-1111-4111-a111-111111111111";
const parentId = "1700000000000#22222222-2222-4222-a222-222222222222";
const replyOneId = "1700000000001#33333333-3333-4333-a333-333333333333";
const replyTwoId = "1700000000002#44444444-4444-4444-a444-444444444444";
const unrelatedId = "1700000000003#55555555-5555-4555-a555-555555555555";
const postOwnerId = "post-owner";
const commentOwnerId = "comment-owner";
const replyOwnerId = "reply-owner";
const postOwnerEmail = "post-owner@example.com";
const commentOwnerEmail = "comment-owner@example.com";

class GetItemCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }

let actor = commentOwnerId;
let state;

function noticeKey(email, eventId) { return `${email}\u0000${eventId}`; }
function commentItem(commentId, userId, userEmail, parentCommentId = "") {
  return {
    postId: { S: postId }, commentId: { S: commentId }, userId: { S: userId }, userEmail: { S: userEmail },
    ...(parentCommentId ? { parentCommentId: { S: parentCommentId } } : {})
  };
}
function reactionItem(commentId, suffix) {
  return { postId: { S: postId }, userId: { S: `comment#${commentId}#${suffix}` }, commentId: { S: commentId } };
}
function freshState() {
  const comments = [
    commentItem(parentId, commentOwnerId, commentOwnerEmail),
    commentItem(replyOneId, replyOwnerId, "reply-one@example.com", parentId),
    commentItem(replyTwoId, "reply-two", "reply-two@example.com", parentId),
    commentItem(unrelatedId, "other-owner", "other@example.com")
  ];
  const reactions = [reactionItem(parentId, "reactor-a"), reactionItem(parentId, "reactor-b"), reactionItem(unrelatedId, "reactor-c")];
  const notices = new Set([
    noticeKey(postOwnerEmail, `comment#${parentId}`),
    noticeKey(postOwnerEmail, `comment#${replyOneId}`),
    noticeKey(postOwnerEmail, `comment#${replyTwoId}`),
    noticeKey(commentOwnerEmail, `reply#${replyOneId}`),
    noticeKey(commentOwnerEmail, `reply#${replyTwoId}`),
    noticeKey(postOwnerEmail, `comment#${unrelatedId}`)
  ]);
  return { comments, reactions, notices, operations: [], attempts: new Map(), failures: new Map() };
}

function operationLabel(input) {
  if (input.TableName === "reactions") return `reaction:${input.Key.userId.S}`;
  if (input.TableName === "notices") return `notice:${input.Key.userEmail.S}:${input.Key.eventId.S}`;
  if (input.TableName === "comments") return `comment:${input.Key.commentId.S}`;
  return `unknown:${input.TableName}`;
}

const context = vm.createContext({
  console,
  setTimeout,
  allowedOrigins: new Set(["https://danzstak.com"]),
  corsHeaders: () => ({}),
  getAuthenticatedUser: async () => actor,
  queryAll: async input => input.TableName === "comments" ? [...state.comments] : input.TableName === "reactions" ? [...state.reactions] : [],
  commentsTable: "comments",
  reactionsTable: "reactions",
  postsTable: "posts",
  engagementNotificationsTable: "notices",
  GetItemCommand,
  DeleteItemCommand,
  db: {
    send: async command => {
      const input = command.input;
      if (command instanceof GetItemCommand) {
        if (input.TableName === "comments") return { Item: state.comments.find(item => item.commentId.S === input.Key.commentId.S) };
        if (input.TableName === "posts") return { Item: { postId: { S: postId }, userId: { S: postOwnerId }, userEmail: { S: postOwnerEmail } } };
        return {};
      }
      const label = operationLabel(input);
      state.operations.push(label);
      state.attempts.set(label, (state.attempts.get(label) || 0) + 1);
      const failures = state.failures.get(label) || 0;
      if (failures > 0) {
        state.failures.set(label, failures - 1);
        throw new Error(`temporary ${label} failure`);
      }
      if (input.TableName === "reactions") state.reactions = state.reactions.filter(item => item.userId.S !== input.Key.userId.S);
      if (input.TableName === "notices") state.notices.delete(noticeKey(input.Key.userEmail.S, input.Key.eventId.S));
      if (input.TableName === "comments") {
        assert.equal(input.ConditionExpression, "userId = :owner", "the final comment delete must recheck the original owner");
        const current = state.comments.find(item => item.commentId.S === input.Key.commentId.S);
        assert.equal(input.ExpressionAttributeValues[":owner"].S, current?.userId.S, "the owner condition must match the stored comment");
        state.comments = state.comments.filter(item => item.commentId.S !== input.Key.commentId.S);
      }
      return {};
    }
  }
});

vm.runInContext(source.slice(source.indexOf("async function runCleanup("), source.indexOf("async function batchGetFriendships(")), context);
vm.runInContext(source.slice(source.indexOf("async function deleteComment("), source.indexOf("async function getEngagementNotifications(")), context);

function request(commentId) {
  return context.deleteComment({
    headers: { origin: "https://danzstak.com" },
    queryStringParameters: { postId },
    pathParameters: { commentId }
  });
}

(async () => {
  state = freshState();
  actor = commentOwnerId;
  let response = await request(parentId), body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(body, { deleted: true, cleanupPending: 0 });
  assert.ok(!state.comments.some(item => item.commentId.S === parentId), "the requested comment must be removed");
  assert.ok(state.comments.some(item => item.commentId.S === replyOneId), "another member's reply must remain independently owned");
  assert.ok(state.comments.some(item => item.commentId.S === replyTwoId), "all independent replies must remain");
  assert.ok(state.reactions.every(item => item.commentId.S !== parentId), "reactions to the removed comment must be deleted");
  assert.ok(state.reactions.some(item => item.commentId.S === unrelatedId), "unrelated reactions must remain");
  assert.ok(!state.notices.has(noticeKey(postOwnerEmail, `comment#${parentId}`)), "the removed comment alert must be deleted");
  assert.ok(!state.notices.has(noticeKey(commentOwnerEmail, `reply#${replyOneId}`)), "reply alerts tied to the removed parent must be deleted");
  assert.ok(!state.notices.has(noticeKey(commentOwnerEmail, `reply#${replyTwoId}`)), "every tied reply alert must be deleted");
  assert.ok(state.notices.has(noticeKey(postOwnerEmail, `comment#${replyOneId}`)), "alerts for a surviving independently owned reply must remain");
  const finalDelete = state.operations.indexOf(`comment:${parentId}`);
  assert.ok(finalDelete > -1 && state.operations.slice(0, finalDelete).every(label => !label.startsWith("comment:")), "dependencies must be removed before the comment record");

  state = freshState();
  const retryReaction = operationLabel({ TableName: "reactions", Key: { userId: state.reactions[0].userId } });
  state.failures.set(retryReaction, 2);
  state.failures.set(`comment:${parentId}`, 2);
  response = await request(parentId);
  assert.equal(response.statusCode, 200, "transient dependency and final-delete failures must recover");
  assert.equal(state.attempts.get(retryReaction), 3, "dependency deletion must retry twice before succeeding");
  assert.equal(state.attempts.get(`comment:${parentId}`), 3, "the final record deletion must retry twice before succeeding");

  state = freshState();
  state.failures.set(operationLabel({ TableName: "reactions", Key: { userId: state.reactions[0].userId } }), 3);
  response = await request(parentId); body = JSON.parse(response.body);
  assert.equal(response.statusCode, 503);
  assert.equal(body.deleted, false);
  assert.ok(state.comments.some(item => item.commentId.S === parentId), "a dependency failure must retain the retryable comment record");
  assert.equal(state.attempts.get(`comment:${parentId}`), undefined, "the comment cannot be destroyed while cleanup is pending");

  state = freshState();
  state.failures.set(`comment:${parentId}`, 3);
  response = await request(parentId); body = JSON.parse(response.body);
  assert.equal(response.statusCode, 503);
  assert.equal(body.deleted, false);
  assert.equal(state.attempts.get(`comment:${parentId}`), 3);
  assert.ok(state.comments.some(item => item.commentId.S === parentId), "a final-delete failure must remain retryable");

  state = freshState();
  actor = replyOwnerId;
  response = await request(replyOneId);
  assert.equal(response.statusCode, 200);
  assert.ok(!state.notices.has(noticeKey(postOwnerEmail, `comment#${replyOneId}`)), "deleting a reply must remove its post-owner alert");
  assert.ok(!state.notices.has(noticeKey(commentOwnerEmail, `reply#${replyOneId}`)), "deleting a reply must remove its parent-owner alert");
  assert.ok(state.comments.some(item => item.commentId.S === parentId), "deleting a reply cannot remove its parent");

  state = freshState();
  actor = "intruder";
  response = await request(parentId);
  assert.equal(response.statusCode, 403);
  assert.equal(state.operations.length, 0, "an unauthorized member cannot start cleanup");

  state = freshState();
  actor = postOwnerId;
  response = await request(parentId);
  assert.equal(response.statusCode, 200, "the post owner retains moderation authority");

  assert.match(source, /queryAll\(\{ TableName: reactionsTable[\s\S]*?Number\.MAX_SAFE_INTEGER\)/, "comment deletion must enumerate all reaction rows without a page ceiling");
  assert.match(source, /Comment dependency deletion remains pending/, "dependency failures must remain explicit and retryable");
  assert.match(source, /ConditionExpression: "userId = :owner"/, "the final destructive write must recheck ownership");
  console.log("Comment deletion checks passed: authorization, reactions, notices, independent replies, retries, and dependency-first ordering.");
})().catch(error => { console.error(error); process.exitCode = 1; });
