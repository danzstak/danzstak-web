"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/profile.js", "utf8");
const page = fs.readFileSync("profile.html", "utf8");

assert.match(source, /const profilePath = "\/profiles"/, "owner and visitor profiles need one reusable refresh endpoint");
assert.match(source, /async function fetchProfileRecord\(\)/, "identity media recovery must fetch a fresh profile record");
assert.match(source, /function loadRecoverableProfileImage\(target, url, field, onReady\)/, "avatar and cover need a shared recovery path");
assert.match(source, /identityImageRefreshes\.get\(target\)[\s\S]*>= 1/, "an expired identity image must not start an infinite refresh loop");
assert.match(source, /freshUrl === String\(url \|\| ""\)/, "recovery must not retry the same expired signed URL");
assert.match(source, /loadRecoverableProfileImage\(avatar, profile\.picture, "picture"/, "avatar failures must request a fresh signed URL");
assert.match(source, /loadRecoverableProfileImage\(cover, profile\.cover, "cover"/, "cover failures must request a fresh signed URL");
assert.match(source, /Keep the accessible initial or branded cover gradient/, "failed recovery must preserve a usable fallback");
assert.match(page, /assets\/profile\.js\?v=420/, "the profile page must load the refreshed identity-media controller");

console.log("Profile identity media recovery checks passed.");
