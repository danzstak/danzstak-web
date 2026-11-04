"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/icon-buttons.js", "utf8");
const css = fs.readFileSync("assets/icon-buttons.css", "utf8");
const pages = ["feed.html", "messages.html", "profile.html", "booking.html", "booking-selections.html", "record-stores.html", "epk.html"];

for (const icon of ["expand", "minimize", "close", "trash", "edit", "reply", "send", "search", "settings", "bell", "share", "download", "upload", "paperclip", "camera", "calendar", "map", "phone", "video", "more", "back", "refresh", "save", "eye", "link", "menu", "chevron", "chat", "home", "user", "users", "image", "film", "microphone", "bus", "disc", "folder", "bookmark", "help", "lock", "file", "logout", "tag", "moon", "sparkles", "wifi", "globe", "smartphone", "activity", "clock"]) {
  assert.match(source, new RegExp(`\\b${icon}: \\[`), `shared icon registry must include ${icon}`);
}
assert.match(source, /setAttribute\("aria-label", label\)/, "an icon-only control must retain an accessible name");
assert.match(source, /setAttribute\("title", label\)/, "an icon-only control must have a desktop tooltip");
assert.match(source, /MutationObserver/, "dynamic feed, comment and chat controls must be enhanced too");
assert.match(source, /querySelectorAll\?\.\("\[data-menu-icon\]"\)/, "drawer icons must use the shared SVG enhancer");
assert.doesNotMatch(source, /lucide|unpkg|cdnjs|jsdelivr/i, "icons must not add a remote dependency");
assert.match(css, /focus-visible/, "keyboard focus must be visible");
assert.match(css, /@media\(pointer:coarse\)[\s\S]*44px/, "coarse-pointer controls must retain a 44px touch target");
assert.match(css, /disabled[^{]*\{[^}]*opacity/, "disabled state must remain visually clear");

for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /assets\/icon-buttons\.css\?v=4/, `${page} must load the current shared icon styles`);
  assert.match(html, /assets\/icon-buttons\.js\?v=4/, `${page} must load the current shared icon behavior`);
}

const feedPage = fs.readFileSync("feed.html", "utf8");
assert.match(feedPage, /class="menu-icon menu-brand-icon"[^>]*>[\s\S]*?danzstak-d-icon\.png/, "Your Mix must use the official DanzStak brand mark");
for (const icon of ["user", "users", "image", "film", "microphone", "bus", "disc", "folder", "bookmark", "settings", "help", "lock", "file", "logout"]) {
  assert.match(feedPage, new RegExp(`data-menu-icon="${icon}"`), `mobile navigation must use the ${icon} SVG icon`);
}
assert.doesNotMatch(feedPage.match(/<aside class="left" id="mobileNavMenu"[\s\S]*?<\/aside>/)?.[0] || "", /🏠|👤|👥|📷|🎬|🎤|🚌|💿|🗂|🔖|⚙|🔒|📄|🚪/, "mobile navigation must not use emoji icons");

const messages = fs.readFileSync("messages.html", "utf8");
for (const icon of ["back", "bell", "edit", "phone", "video", "minimize", "more", "close", "trash", "paperclip", "camera", "send"]) assert.match(messages, new RegExp(`data-icon="${icon}"`), `Chat must use the ${icon} icon`);
assert.match(messages, /class="chat-search-icon" data-menu-icon="search"/, "Chat search must use the shared search icon rather than a text glyph");
assert.doesNotMatch(messages, />⌕</, "Chat must not retain the legacy search glyph");
const sendMarkup = messages.match(/<button type="submit" class="message-send"[^>]*>/)?.[0] || "";
assert.match(sendMarkup, /data-icon="send"/, "Chat send control must use the shared send icon");
assert.match(sendMarkup, /aria-label="Send message"/, "Chat send icon must retain its accessible name");
assert.match(sendMarkup, /title="Send message"/, "Chat send icon must retain its tooltip");

const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
assert.match(feed, /reply\.dataset\.icon = "reply"/, "comment replies must use the shared reply icon");
assert.match(feed, /button\.dataset\.icon = "trash"/, "comment deletion must use the shared trash icon");
assert.match(feed, /rollOpen\.dataset\.icon = "expand"/, "The Roll must use the expand icon");
assert.match(feed, /rollClose\.dataset\.icon = "close"/, "The Roll must use the close icon");
assert.match(feed, /const iconSvg = window\.danzstakIcons\?\.create\(icon\)/, "Settings rows must use the same shared SVG registry");
assert.doesNotMatch(feed.match(/workspace\.append\([\s\S]*?\n      button\n    \);/)?.[0] || "", /👤|🔒|🌙|✨|📶|🌐|🔔|📱|🗂|🕒|📄|🚪/, "Settings rows must not fall back to emoji artwork");
assert.match(feed, /danzstakConfirm\("This comment will be permanently removed\./, "comment deletion must preserve confirmation");

const worker = fs.readFileSync("service-worker.js", "utf8");
assert.match(worker, /"\/assets\/icon-buttons\.js", "\/assets\/icon-buttons\.css"/, "the PWA must cache the shared icon system");
console.log("Global icon interface checks passed: shared registry, accessible labels/tooltips, keyboard and touch states, dynamic controls, Chat actions, comment actions, Roll controls, and PWA caching.");
