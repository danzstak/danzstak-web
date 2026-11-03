"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("assets/profile-editor.js", "utf8");
const styles = fs.readFileSync("assets/profile-editor.css", "utf8");

assert.match(source, /async function refreshProfilePostMedia\(post\)/, "profile posts need a signed-media refresh path");
assert.match(source, /candidate\.postId === post\.postId/, "profile recovery must match the durable post id");
assert.match(source, /media\.addEventListener\("error"[\s\S]*post\.mediaUrl = ""; showRecovery\(\)/, "expired profile media should become a retry card");
assert.match(source, /Retry media/, "profile media needs a retry action");
assert.match(source, /if \(post\.postId && \["image", "video"\]\.includes\(post\.mediaType\)\) installProfilePostMedia/, "post media without a current URL must still recover");
assert.match(styles, /\.shared-post-recovery,\.profile-media-recovery\{/, "profile recovery needs a compact treatment");

console.log("Profile post media recovery checks passed.");
