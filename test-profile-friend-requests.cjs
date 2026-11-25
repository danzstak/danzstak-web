"use strict";
// Owner 2026-11-17: the profile Friends tab shows requests you sent (and requests waiting for you).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
assert.match(template, /FilterExpression:'#s IN \(:friends, :incoming, :outgoing\)'/, "GET /friends must read pending requests, not only accepted friends");
assert.match(template, /return json\(200,\{friends:pick\('friends'\),incoming:pick\('incoming'\),outgoing:pick\('outgoing'\)\}\)/, "GET /friends returns friends, incoming and outgoing separately");
assert.doesNotMatch(template, /':blocked'[^\n]*incoming:pick/, "blocked members never appear in the request lists");

// Client: requests live on the one Friends screen (friends.html, UIKIT 4a), which the profile's Friends tab opens.
// The profile no longer draws a second copy of them (UIKIT 4b).
const editor = fs.readFileSync("assets/profile-editor.js", "utf8"), screen = fs.readFileSync("assets/friends-screen.js", "utf8");
assert.doesNotMatch(editor, /appendProfileFriendRequests|loadProfileFriends|profile-friend-grid/, "no second friends list on the profile");
assert.match(editor, /function showProfileFriendsLink\(\)[\s\S]*row\.href = friendsScreenUrl\(\);/, "the Friends tab, chosen from the keyboard, offers one row to the Friends screen");
assert.match(screen, /group\("Friend requests", incoming,/, "incoming requests with Accept / Delete");
assert.match(screen, /group\("Requests sent", outgoing,/, "requests you sent, with Cancel");
assert.match(screen, /api\("\/friends\/respond", \{ method: "POST", body: JSON\.stringify\(\{ email: person\.email, accept \}\) \}\)/);
console.log("Profile friend request checks passed: GET /friends returns pending requests; the Friends screen shows them, the profile links there.");
