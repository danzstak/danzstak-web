"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("assets/post-sharing.js", "utf8");
const feedStyles = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const profileStyles = fs.readFileSync("assets/profile-editor.css", "utf8");

assert.match(source, /async function refreshSharedPostMedia\(source\)/, "shared posts need a signed-media refresh path");
assert.match(source, /post\.postId === source\.postId/, "recovery must match the durable original post id");
assert.match(source, /media\.addEventListener\('error'[\s\S]*source\.mediaUrl = ''; showRecovery\(\)/, "expired shared media should become a retry card");
assert.match(source, /Retry media/, "the shared-media recovery card needs a retry action");
assert.match(source, /if \(\['image','video'\]\.includes\(source\.mediaType\)\) installSharedPostMedia/, "media without a current URL must still get recovery behavior");
assert.match(feedStyles, /\.shared-post-recovery\{/, "Your Mix should style shared-media recovery");
assert.match(profileStyles, /\.shared-post-recovery\{/, "profiles should style shared-media recovery");

console.log("Shared post media recovery checks passed.");
