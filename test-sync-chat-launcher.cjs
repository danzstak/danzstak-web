"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");
const feed = read("feed.html");
const messages = read("messages.html");
const mobileCss = read("assets/mobile-design-system.css");
const launcherPages = ["messages.html", "booking.html", "record-stores.html", "epk.html", "profile.html"];

assert.match(feed, /id="messagesNav"[^>]*class="sync-launcher"[^>]*aria-label="SYNC — open chats"[^>]*title="SYNC — open chats"/, "the feed launcher must be named SYNC accessibly");
assert.match(feed, /class="sync-launcher-label"[^>]*>SYNC<\/span>/, "desktop feed must show the SYNC name");
assert.match(feed, /href="messages\.html" aria-label="SYNC — open chats"[\s\S]*?<span class="menu-label">SYNC<\/span>/, "the application menu must offer the real SYNC destination");

for (const file of launcherPages) {
  const html = read(file);
  assert.match(html, /data-icon="chat"[^>]*data-launcher-label="SYNC"[^>]*aria-label="SYNC — open chats"[^>]*href="messages\.html"/, `${file} must route its SYNC launcher to the existing inbox`);
}

assert.match(messages, /<h1 id="messagesTitle">Chats<\/h1>/, "the internal inbox heading must remain plain Chats");
assert.match(messages, /<title>Messages \| DanzStak<\/title>/, "the existing Chat destination identity must remain intact");
assert.match(mobileCss, /a\[data-launcher-label\]::after\{content:attr\(data-launcher-label\)/, "the phone launcher must visibly render its SYNC label");

console.log("SYNC launcher checks passed: visible label, accessible name, real inbox route, and unchanged internal Chats heading.");
