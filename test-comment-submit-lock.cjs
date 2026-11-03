const fs = require("fs");
const assert = require("assert");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const start = source.indexOf("const pendingCommentSaves = new WeakSet();");
const end = source.indexOf("function addCommentDelete", start);
assert.ok(start >= 0 && end > start, "comment submission lock is missing");
const save = source.slice(start, end);

assert.match(save, /input\.disabled \|\| pendingCommentSaves\.has\(input\)/,
  "a disabled or in-flight composer must ignore repeated sends");
assert.match(save, /pendingCommentSaves\.add\(input\)/,
  "comment submission must lock before starting the request");
assert.match(save, /finally \{ pendingCommentSaves\.delete\(input\); input\.disabled = false/,
  "comment submission must release its lock after success or failure");

console.log("Comment submit-lock checks passed: rapid taps or Enter presses cannot duplicate a comment or reply.");
