"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const client = fs.readFileSync("assets/epk.js", "utf8"), markup = fs.readFileSync("epk.html", "utf8");

assert.match(client, /async function request[\s\S]*AbortController[\s\S]*setTimeout\(\(\) => controller\.abort\(\), timeoutMs\)/,
  "EPK API reads and writes must use a bounded request helper");
assert.match(client, /request\(`\$\{api\}\/stories`[\s\S]*purpose:"epk"/,
  "upload-ticket requests must recover from a stalled API");
assert.match(client, /action:"discard",mediaKey[\s\S]*5000/,
  "failed upload cleanup must not hang the EPK interface indefinitely");
assert.match(client, /request\(`\$\{api\}\/epk`, \{ method:"POST"[\s\S]*20000\)/,
  "draft saves and publishing must have a bounded completion window");
assert.match(client, /request\(`\$\{api\}\/epk`, \{ method:"DELETE"[\s\S]*20000\)/,
  "permanent deletion must remain retryable after a stalled connection");
assert.match(client, /epk\/public[\s\S]*credentials:"omit"[\s\S]*cache:"no-store"/,
  "public EPK reads must not send the visitor's account session or use stale data");
assert.match(client, /epk\/shared[\s\S]*credentials:"omit"[\s\S]*cache:"no-store"/,
  "private review reads must use their secret without sending the visitor's account session or stale data");
assert.match(client, /upload\.timeout = Math\.max\(60000[\s\S]*upload\.ontimeout/,
  "large media uploads need an adaptive timeout and explicit recovery message");
assert.match(markup, /assets\/epk\.js\?v=15/, "the EPK page must load the guided, bounded-request release");

console.log("EPK network checks passed: loads, saves, publishing, deletion, tickets, and media uploads recover from stalls without exposing sessions on public kits.");
