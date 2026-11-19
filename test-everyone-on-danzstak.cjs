"use strict";
// Owner 2026-11-18: "I'm still not able to see all the users that have signed up ... members should be able to see
// all the users that have actually signed up until we get a ton of users." The Friends tab lists friends, requests,
// then Everyone on DanzStak (online first) from GET /people?all=1.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");

// Server: ?all=1 with no query skips the 2-character minimum and the name match, keeps every other rule.
assert.match(template, /everyone=event\.queryStringParameters\?\.all==='1'&&!raw;if\(!everyone&&tokens\.join\(''\)\.length<2\)return json\(400/);
assert.match(template, /\|\|blockedStatus\(states\[email\]\)\|\|!\/\^\[a-f0-9-\]\{36\}\$\/\.test\(memberId\)\|\|placeholderProfile\(name,handle\)\|\|\(!everyone&&!prefixMatch\(tokens,name,handle\)\)\)continue;/, "blocked, invalid and placeholder accounts stay out");
assert.match(template, /if\(everyone\)\{users\.sort\(\(a,b\)=>Number\(b\.online\)-Number\(a\.online\)\|\|a\.name\.localeCompare\(b\.name\)\);return json\(200,\{users:users\.slice\(0,500\),total:users\.length\}\);\}/, "online first, capped");
assert.match(template, /return json\(200,\{users:users\.slice\(0,20\)\}\);\}/, "normal search unchanged");
// The member list never carries email or phone.
const search = template.slice(template.indexOf("async function peopleSearch("), template.indexOf("async function groupMembership("));
assert.match(search, /users\.push\(\{memberId,name,handle,picture:[^}]*friendStatus:states\[email\]\|\|'none',online:onlineEmails\.has\(email\)\}\)/);

// Client: own Friends tab asks for everyone and falls back to Online now while the server is older.
assert.match(editor, /profileFetch\(profileApi \+ "\/people\?all=1", \{ credentials: "include", cache: "no-store" \}\)/);
assert.match(editor, /everyone \? `Everyone on DanzStak · \$\{onlineMembers\.length\}` : `Online now · \$\{onlineMembers\.length\}`/);
assert.match(editor, /user\.friendStatus !== "friends" && !friendIds\.has/, "friends are not listed twice");
console.log("Everyone on DanzStak ok");
