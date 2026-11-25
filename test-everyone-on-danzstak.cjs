"use strict";
// Owner 2026-11-18: "I'm still not able to see all the users that have signed up ... members should be able to see
// all the users that have actually signed up until we get a ton of users." The Friends tab lists friends, requests,
// then Everyone on DanzStak (online first) from GET /people?all=1. Since UIKIT 4b that list lives on the one Friends
// screen (friends.html, your own), which every Friends tap opens.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const screen = fs.readFileSync("assets/friends-screen.js", "utf8");

// Server: ?all=1 with no query skips the 2-character minimum and the name match, keeps every other rule.
assert.match(template, /everyone=event\.queryStringParameters\?\.all==='1'&&!raw;if\(!everyone&&tokens\.join\(''\)\.length<2\)return json\(400/);
assert.match(template, /\|\|blockedStatus\(states\[email\]\)\|\|!\/\^\[a-f0-9-\]\{36\}\$\/\.test\(memberId\)\|\|placeholderProfile\(name,handle\)\|\|\(!everyone&&!prefixMatch\(tokens,name,handle\)\)\)continue;/, "blocked, invalid and placeholder accounts stay out");
assert.match(template, /if\(everyone\)\{users\.sort\(\(a,b\)=>Number\(b\.online\)-Number\(a\.online\)\|\|a\.name\.localeCompare\(b\.name\)\);return json\(200,\{users:users\.slice\(0,500\),total:users\.length\}\);\}/, "online first, capped");
assert.match(template, /return json\(200,\{users:users\.slice\(0,20\)\}\);\}/, "normal search unchanged");
// The member list never carries email or phone.
const search = template.slice(template.indexOf("async function peopleSearch("), template.indexOf("async function groupMembership("));
assert.match(search, /users\.push\(\{memberId,name,handle,picture:[^}]*friendStatus:states\[email\]\|\|'none',online:onlineEmails\.has\(email\)\}\)/);

// Client: your own Friends screen asks for everyone, after your friends, never listing a friend twice.
assert.match(screen, /of\.isOwner \? api\("\/people\?all=1"\)\.catch\(\(\) => null\) : null/);
assert.match(screen, /t\("Everyone on DanzStak · \{count\}", \{ count: others\.length \}\)/);
assert.match(screen, /user\.friendStatus !== "friends" && !friendIds\.has\(user\.memberId\)/, "friends are not listed twice");
assert.match(fs.readFileSync("friends.html", "utf8"), /id="friendsEveryone" hidden/);
console.log("Everyone on DanzStak ok");
