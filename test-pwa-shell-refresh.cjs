"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const serviceWorker = read("service-worker.js");
const pwa = read("assets/pwa.js");

assert.match(serviceWorker, /danzstak-shell-v428/, "service-worker cache version must be current");
assert.match(serviceWorker, /async function refreshAppShell\(\)/, "service worker must refresh its app shell");
assert.match(serviceWorker, /Promise\.allSettled\(SHELL\.map/, "one failed shell request must not cancel the refresh");
assert.match(serviceWorker, /fetch\(path, \{ cache: "no-store" \}\)/, "shell refresh must bypass stale browser cache");
assert.match(serviceWorker, /60 \* 60 \* 1000/, "background shell refresh must be throttled");
assert.match(serviceWorker, /type === "REFRESH_SHELL"/, "service worker must accept refresh requests");

assert.match(pwa, /type: "REFRESH_SHELL"/, "PWA controller must request a shell refresh");
assert.match(pwa, /navigator\.connection\?\.saveData !== true/, "PWA must respect data-saver mode");
assert.ok((pwa.match(/refreshOfflineShell\(\)/g) || []).length >= 2, "PWA must refresh after registration and when visible again");

for (const [file, expected] of [
  ["feed.html", "assets/soft-ui.css?v=425"],
  ["messages.html", "assets/soft-ui.css?v=425"],
  ["profile.html", "assets/soft-ui.css?v=425"],
  ["feed.html", "assets/feed-enhancements.css?v=422"],
  ["feed.html", "assets/feed-enhancements.js?v=420"],
  ["feed.html", "assets/post-sharing.js?v=416"],
  ["feed.html", "assets/people-search.js?v=416"],
  ["messages.html", "assets/chat.js?v=415"],
  ["messages.html", "assets/chat.css?v=428"],
  ["messages.html", "assets/direct-messages.js?v=415"],
  ["profile.html", "assets/profile-sharing.js?v=415"],
  ["profile.html", "assets/post-sharing.js?v=416"],
  ["profile.html", "assets/profile.js?v=416"]
]) {
  assert.ok(read(file).includes(expected), `${file} must reference ${expected}`);
}

console.log("PWA shell refresh checks passed.");
