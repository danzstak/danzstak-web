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
assert.ok(cacheVersion >= 639, "service-worker cache version must include the shared professional-tool and Chat quality release");
assert.match(serviceWorker, /"\/assets\/profile-onboarding\.css"/, "the offline shell must include first-login naming styles");
assert.match(serviceWorker, /"\/assets\/profile-onboarding\.js"/, "the offline shell must include first-login naming behavior");
assert.match(serviceWorker, /"\/assets\/brand-language-aliases\.js"/, "the offline shell must keep branded social labels translatable");
assert.match(serviceWorker, /"\/assets\/booking-map\.js"/, "the installable shell must keep the Booking Agent map controls available");
assert.match(serviceWorker, /"\/assets\/booking-discovery\.js"/, "the installable shell must keep natural-language venue discovery available");
assert.match(serviceWorker, /"\/assets\/booking-discovery\.css"/, "the installable shell must keep venue discovery readable offline");
assert.match(serviceWorker, /"\/booking-selections\.html"/, "the installable shell must keep the reviewed booking workspace available");
assert.match(serviceWorker, /"\/assets\/booking-selections\.js"/, "the installable shell must keep pitch review behavior available");
assert.match(serviceWorker, /"\/assets\/booking-selections\.css"/, "the installable shell must keep pitch review readable offline");
assert.match(serviceWorker, /"\/assets\/record-stores-pagination\.css"/, "the installable shell must keep record-store pagination readable offline");
assert.match(serviceWorker, /"\/assets\/epk-media\.css"/, "the installable shell must keep EPK media management styled offline");
assert.match(serviceWorker, /"\/assets\/user-content-links\.js"/, "the offline shell must keep user links clickable");
assert.match(serviceWorker, /"\/assets\/user-content-links\.css"/, "the offline shell must keep user links visibly styled");
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
  ["feed.html", "assets/soft-ui.css?v=427"],
  ["messages.html", "assets/soft-ui.css?v=427"],
  ["profile.html", "assets/soft-ui.css?v=427"],
  ["feed.html", "assets/mobile-design-system.css?v=15"],
  ["feed.html", "assets/danzstak-original-feed.css?v=21"],
  ["messages.html", "assets/mobile-design-system.css?v=15"],
  ["booking.html", "assets/mobile-design-system.css?v=15"],
  ["epk.html", "assets/mobile-design-system.css?v=15"],
  ["profile.html", "assets/mobile-design-system.css?v=15"],
  ["record-stores.html", "assets/mobile-design-system.css?v=15"],
  ["feed.html", "assets/feed-enhancements.css?v=506"],
  ["feed.html", "assets/pwa.js?v=424"],
  ["messages.html", "assets/pwa.js?v=424"],
  ["profile.html", "assets/pwa.js?v=424"],
  ["record-stores.html", "assets/record-stores-pagination.css?v=2"],
  ["record-stores.html", "assets/record-stores.js?v=6"],
  ["feed.html", "assets/identity-media.js?v=1"],
  ["messages.html", "assets/identity-media.js?v=1"],
  ["profile.html", "assets/identity-media.js?v=1"],
  ["feed.html", "assets/feed-enhancements.js?v=536"],
  ["feed.html", "assets/profile-onboarding.js?v=8"],
  ["feed.html", "assets/post-sharing.js?v=421"],
  ["feed.html", "assets/people-search.js?v=423"],
  ["feed.html", "assets/media-visibility.js?v=391"],
  ["messages.html", "assets/media-visibility.js?v=391"],
  ["profile.html", "assets/media-visibility.js?v=391"],
  ["messages.html", "assets/chat.js?v=452"],
  ["messages.html", "assets/chat.css?v=457"],
  ["messages.html", "assets/direct-messages.js?v=493"],
  ["profile.html", "assets/profile-sharing.js?v=416"],
  ["profile.html", "assets/profile-editor.js?v=484"],
  ["booking.html", "assets/booking-agent.js?v=488"],
  ["profile.html", "assets/post-sharing.js?v=421"],
  ["profile.html", "assets/profile.js?v=419"]
]) {
  assert.ok(read(file).includes(expected), `${file} must reference ${expected}`);
}

console.log("PWA shell refresh checks passed.");
