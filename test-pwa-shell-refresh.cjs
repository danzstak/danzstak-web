"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const serviceWorker = read("service-worker.js");
const pwa = read("assets/pwa.js");
const hostingHeaders = read("customHttp.yml");

const cacheVersion = Number(serviceWorker.match(/danzstak-shell-v(\d+)/)?.[1] || 0);
assert.ok(cacheVersion >= 464, "service-worker cache version must include the current profile privacy wording release");
assert.match(serviceWorker, /"\/assets\/booking-map\.js"/, "the installable shell must keep the Booking Agent map controls available");
assert.match(serviceWorker, /async function refreshAppShell\(\)/, "service worker must refresh its app shell");
assert.match(serviceWorker, /Promise\.allSettled\(SHELL\.map/, "one failed shell request must not cancel the refresh");
assert.match(serviceWorker, /fetch\(path, \{ cache: "no-store" \}\)/, "shell refresh must bypass stale browser cache");
assert.match(serviceWorker, /60 \* 60 \* 1000/, "background shell refresh must be throttled");
assert.match(serviceWorker, /type === "REFRESH_SHELL"/, "service worker must accept refresh requests");

assert.match(pwa, /type: "REFRESH_SHELL"/, "PWA controller must request a shell refresh");
assert.match(pwa, /navigator\.connection\?\.saveData !== true/, "PWA must respect data-saver mode");
assert.ok((pwa.match(/refreshOfflineShell\(\)/g) || []).length >= 2, "PWA must refresh after registration and when visible again");
assert.match(hostingHeaders, /Cache-Control'[\s\S]*public, max-age=300, must-revalidate/, "Amplify must not cache app-shell files at the edge for a year");
assert.doesNotMatch(hostingHeaders, /s-maxage\s*=\s*31536000/i, "the app shell must not receive a one-year shared-cache lifetime");

for (const [file, expected] of [
  ["feed.html", "assets/soft-ui.css?v=425"],
  ["messages.html", "assets/soft-ui.css?v=425"],
  ["profile.html", "assets/soft-ui.css?v=425"],
  ["feed.html", "assets/feed-enhancements.css?v=473"],
  ["feed.html", "assets/feed-enhancements.js?v=471"],
  ["feed.html", "assets/post-sharing.js?v=416"],
  ["feed.html", "assets/people-search.js?v=416"],
  ["messages.html", "assets/chat.js?v=434"],
  ["messages.html", "assets/chat.css?v=438"],
  ["messages.html", "assets/direct-messages.js?v=467"],
  ["profile.html", "assets/profile-sharing.js?v=415"],
  ["profile.html", "assets/profile-editor.js?v=469"],
  ["booking.html", "assets/booking-agent.js?v=471"],
  ["profile.html", "assets/post-sharing.js?v=416"],
  ["profile.html", "assets/profile.js?v=416"]
]) {
  assert.ok(read(file).includes(expected), `${file} must reference ${expected}`);
}

console.log("PWA shell refresh checks passed.");
