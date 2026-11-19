"use strict";
// T2a (owner 2026-11-18, fix-it 18): tapping any profile picture opens that member's profile.
// Real browser: browser-checks/profile-picture-links.cjs (320-430px and 1280px).
const assert = require("node:assert/strict");
const fs = require("node:fs");
// Windows checkouts (CI) use CRLF line endings; compare text, not line endings.
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const profileEditor = read("assets/profile-editor.js"), dm = read("assets/direct-messages.js"), fe = read("assets/feed-enhancements.js"), feed = read("feed.html");
const feCss = read("assets/feed-enhancements.css"), profileCss = read("assets/profile-polish.css");

// Profile walls: the post author's photo and name are real links to their profile.
assert.match(profileEditor, /avatarLink\.className = "profile-post-avatar-link";\s*avatarLink\.href = authorHref;/);
assert.match(profileEditor, /authorLink\.className = "profile-post-author-link";\s*authorLink\.href = authorHref;/);
assert.match(profileEditor, /const authorHref = ownWall \? "profile\.html" : \/\^\[a-f0-9-\]\{36\}\$\/i\.test\(authorId\) \? "profile\.html\?member=" \+ encodeURIComponent\(authorId\) : "";/);
// SYNC chat list: the photo opens the profile, the rest of the row opens the chat.
assert.match(dm, /if \(rowProfileHref && event\.target\?\.closest\?\.\("\.conversation-avatar-wrap"\)\) \{ location\.href = rowProfileHref; return; \}/);
// Online friends: the photo is a link too (both renderers).
assert.match(fe, /const avatarWrap = document\.createElement\(personHref \? "a" : "span"\);/);
assert.match(feed, /const avatarWrap = document\.createElement\(\/\^\[a-f0-9-\]\{36\}\$\/\.test\(memberId\) \? "a" : "span"\);/);
// 44px tap areas around the small photos, without changing their look.
assert.match(feCss, /a\.post-avatar::after\{content:"";position:absolute;inset:-6px;border-radius:50%\}/);
assert.match(feCss, /a\.comment-avatar::after\{content:"";position:absolute;inset:-6px;border-radius:50%\}/);
assert.match(feCss, /a\.feed-online-avatar-wrap::after\{content:"";position:absolute;inset:min\(0px,calc\(50% - 22px\)\);border-radius:50%\}/);
assert.match(profileCss, /\.profile-post-avatar-link::after\{content:"";position:absolute;inset:-4px;border-radius:50%\}/);
assert.match(profileCss, /\.profile-page a\.profile-comment-avatar::after\{content:"";position:absolute;inset:-6px;border-radius:50%\}/);
// Owner 2026-11-19: your own profile picture opens "Change profile picture" (this phone or your DanzStak photos);
// someone else's does not; the post box always shows your picture (installed after it is in the row).
assert.match(profileEditor, /function markAvatarEditable\(on, profile = window\.danzstakCurrentProfile\)/);
assert.match(profileEditor, /function applyLoadedProfile\(profile = \{\}\) \{\n  markAvatarEditable\(profile\.isOwner === true, profile\);/);
assert.match(profileEditor, /else if \(viewingOtherProfile && window\.danzstakCurrentProfile\?\.picture\) void openProfilePictures\(\);/, "a visitor's tap opens the member's pictures (F4c)");
assert.match(profileEditor, /else if \(choice === "phone"\) \{ sheet\.close\(\); profilePhotoMediaButton\("avatar", "Change Profile Photo"\)\?\.click\(\); \}/);
assert.match(profileEditor, /const profile = await uploadCloudProfileMedia\(new File\(\[jpeg\], "profile-picture\.jpg", \{ type: "image\/jpeg" \}\), "avatarKey"\);/);
assert.match(profileEditor, /compact\.append\(compactAvatar, opener\);\n  if \(profile\.isOwner && profile\.picture\) installCompactAvatar\(profile\);/, "the composer photo is installed after the placeholder is in the row");
assert.match(profileCss, /\.avatar\.profile-avatar-editable::after\{/, "camera badge on your own picture");
console.log("Profile picture link checks passed: profile-wall authors, SYNC chat-list photos, online friends, 44px tap areas, your own picture changes from this phone or your DanzStak photos, the post box shows your picture.");
