const fs = require("node:fs");
const assert = require("node:assert/strict");

const ui = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

for (const required of [
  "function beginCommentReply(post, comment, item)",
  'input.placeholder = "Reply to " + name + "…"',
  'reply.textContent = "Reply"',
  'reply.setAttribute("aria-label", "Reply to "',
  "parentCommentId = String(input.dataset?.replyToCommentId",
  "ensureCommentComposer(post)",
  'send.setAttribute("aria-label", "Post comment")'
]) assert.ok(ui.includes(required), `Comment reply UI is missing: ${required}`);
assert.ok(ui.includes('comment.authorPicture ? document.createElement("img")'), "Comments must use the member's profile photo when available");
assert.ok(ui.includes('engagementFetch("/profiles", { credentials: "include", cache: "no-store" })'), "The comment composer must load the signed-in member profile through the guarded API helper");
assert.ok(ui.includes('image.className = "comment-composer-avatar"'), "The comment composer must render the signed-in member photo");
const replyContractCheck = ui.indexOf('if (parentCommentId && data.comment?.parentCommentId !== parentCommentId)');
const clearReplyText = ui.indexOf('input.value = "";', replyContractCheck);
const clearReplyTarget = ui.indexOf('clearCommentReply(input)', replyContractCheck);
assert.ok(replyContractCheck >= 0, "A reply response must prove that the server preserved its parent target");
assert.ok(clearReplyText > replyContractCheck && clearReplyTarget > replyContractCheck, "A rejected reply must retain its typed text and target");

for (const required of [
  "parentCommentId = String(data?.parentCommentId",
  'error: "Invalid reply target."',
  'error: "The comment you are replying to no longer exists."',
  "parentCommentId: { S: parentCommentId }",
  "replyToName: { S: replyToName }",
  "const children = new Map()",
  "appendThread(reply)"
]) assert.ok(api.includes(required), `Durable reply handling is missing: ${required}`);
assert.ok(api.includes("authorPicture:authorProfiles.get("), "Loaded comments must include signed member profile photos");
assert.ok(api.includes('authorPicture: actorProfile.picture || ""'), "A newly posted comment must render with the current member photo immediately");

for (const required of [".comment-composer{", ".comment-bubble{", ".comment-reply-button", ".comment-replying{"])
  assert.ok(css.includes(required), `Compact comment styling is missing: ${required}`);

assert.match(feed, /feed-enhancements\.css\?v=374/);
assert.match(feed, /feed-enhancements\.js\?v=377/);
console.log("Comment reply checks passed: named reply targeting, durable parent validation, threaded ordering, accessible controls, and compact composer styling.");
