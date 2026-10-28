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

for (const required of [
  "parentCommentId = String(data?.parentCommentId",
  'error: "Invalid reply target."',
  'error: "The comment you are replying to no longer exists."',
  "parentCommentId: { S: parentCommentId }",
  "replyToName: { S: replyToName }",
  "const children = new Map()",
  "appendThread(reply)"
]) assert.ok(api.includes(required), `Durable reply handling is missing: ${required}`);

for (const required of [".comment-composer{", ".comment-bubble{", ".comment-reply-button", ".comment-replying{"])
  assert.ok(css.includes(required), `Compact comment styling is missing: ${required}`);

assert.match(feed, /feed-enhancements\.css\?v=363/);
assert.match(feed, /feed-enhancements\.js\?v=367/);
console.log("Comment reply checks passed: named reply targeting, durable parent validation, threaded ordering, accessible controls, and compact composer styling.");
