"use strict";
// SYNC chat wallpaper (task 16-B, owner 2026-11-17). Static contract; the real-browser check is
// browser-checks/sync-wallpaper.cjs (photo strip + per-chat override + contrast chips at 360/390).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const js = fs.readFileSync("assets/sync-wallpaper.js", "utf8");
const css = fs.readFileSync("assets/sync-wallpaper.css", "utf8");
const settings = fs.readFileSync("assets/sync-settings.js", "utf8");
const setup = fs.readFileSync("assets/phone-setup.js", "utf8");
const cleanup = fs.readFileSync("assets/session-cleanup.js", "utf8");
const dm = fs.readFileSync("assets/direct-messages.js", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const i18n = fs.readFileSync("assets/i18n-sync.js", "utf8");

// Privacy: the photo never leaves the device, is re-drawn on a canvas (drops EXIF/GPS), images only, 4 MB max.
assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|api\.danzstak\.com/, "the wallpaper is never uploaded or sent anywhere");
assert.match(js, /canvas\.getContext\("2d"\)\.drawImage\(bitmap/, "the photo is re-encoded on a canvas (metadata dropped)");
assert.match(js, /canvas\.toBlob\(resolve, "image\/jpeg"/);
assert.match(js, /MAX_BYTES = 4 \* 1024 \* 1024/);
assert.match(js, /IMAGE_TYPES = \["image\/jpeg", "image\/png", "image\/webp", "image\/gif"\]/, "images only, no video or audio");
assert.doesNotMatch(js, /audio\/|video\//, "no audio or video wallpaper");
assert.match(js, /indexedDB\.open\(DB, 1\)/, "stored in this browser's IndexedDB (works offline)");
assert.match(cleanup, /danzstakSyncWallpaper\.clearAll\(\)|deleteDatabase\("danzstak-sync-wallpaper"\)/, "logout deletes the private wallpaper");
// Chats are keyed by a hash; the contact address is not stored with the wallpaper.
assert.match(js, /crypto\.subtle\.digest\("SHA-256"/);
// Per-chat overrides global; reset is one tap; dim 0-60.
assert.match(js, /return \(key && await read\(key\)\) \|\| await read\("global"\) \|\| DEFAULT;/, "per-chat wallpaper wins over all chats");
assert.match(js, /MAX_DIM = 60/);
assert.match(js, /data-reset data-t="Reset to default"/);
for (const preset of ["techno", "punk", "metal", "house"]) assert.match(js, new RegExp(`${preset}: \\{ name:`), `genre wallpaper ${preset}`);
assert.match(js, /dark: "/, "a dark variant exists");
// Contrast: dim layer, opaque bubbles, chips behind date/system lines.
assert.match(css, /linear-gradient\(rgba\(0,0,0,var\(--sync-wp-dim,0\)\),rgba\(0,0,0,var\(--sync-wp-dim,0\)\)\),var\(--sync-wp-image,none\)/);
assert.match(css, /\.message-list\[data-wallpaper\] \.system-message[^{]*\{[^}]*background:rgba\(255,255,255,\.94\);color:#273142/);
assert.match(css, /\.sync-wp-swatch\{width:44px;height:44px/, "44px targets");
// Two places to set it: SYNC settings (all chats) and the chat's ⋮ menu (this chat).
assert.match(js, /danzstakSyncSettings\?\.add\(\{ id: "wallpaper"[^}]*run: \(\) => open\("all"\) \}\)/);
assert.match(js, /item\.id = "headerWallpaperMenu"[\s\S]*open\("chat"\)/);
assert.match(settings, /button\.id = "syncSettings"/);
assert.match(dm, /dispatchEvent\?\.\(new CustomEvent\("danzstak:sync-conversation-opened"\)\)/, "the thread re-paints when a chat opens");
// "Set up this phone": wallpaper is the first step.
assert.match(setup, /if \(window\.danzstakSyncWallpaper\) list\.push\(\{ id: "wallpaper"/);
assert.ok(setup.indexOf('id: "wallpaper"') < setup.indexOf('id: "alerts"'), "wallpaper before alerts, like a new phone");
// Shipped and cached.
for (const file of ["sync-settings.js", "sync-wallpaper.js"]) { assert.match(html, new RegExp(`<script src="assets/${file.replace(".", "\\.")}\\?v=\\d+" defer></script>`)); assert.ok(worker.includes(`"/assets/${file}"`)); }
assert.match(html, /<link rel="stylesheet" href="assets\/sync-wallpaper\.css\?v=\d+">/);
assert.ok(worker.includes('"/assets/sync-wallpaper.css"'));
assert.ok(html.indexOf("sync-settings.js") < html.indexOf("sync-wallpaper.js"), "settings registry loads before the wallpaper row");
// it/fr/es
for (const lang of ["it", "fr", "es"]) {
  const block = i18n.slice(i18n.indexOf(`"${lang}": {`), i18n.indexOf("\n}", i18n.indexOf(`"${lang}": {`)));
  for (const key of ["Chat wallpaper", "Reset to default", "Only you see your wallpaper. Your photo stays on this device and is never sent to the other person.", "SYNC settings", "Pick a chat wallpaper"]) assert.ok(block.includes(JSON.stringify(key) + ":"), `${lang}: ${key}`);
}
console.log("SYNC wallpaper checks passed: device-only photo with metadata stripped, per-chat override, dim + chips for contrast, settings + chat menu + setup step, logout clears it, it/fr/es.");
