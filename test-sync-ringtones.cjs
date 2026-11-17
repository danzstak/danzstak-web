"use strict";
// SYNC ringtones (task 16-B2, owner 2026-11-17). Static contract; real-browser check: browser-checks/sync-ringtones.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const tones = fs.readFileSync("assets/sync-tones.js", "utf8");
const chat = fs.readFileSync("assets/chat.js", "utf8");
const incoming = fs.readFileSync("assets/incoming-calls.js", "utf8");
const dm = fs.readFileSync("assets/direct-messages.js", "utf8");
const setup = fs.readFileSync("assets/phone-setup.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const i18n = fs.readFileSync("assets/i18n-sync.js", "utf8");

// No music files, ever: tones are synthesized, nothing is fetched or uploaded.
assert.doesNotMatch(tones, /\.(mp3|wav|ogg|m4a|aac|flac|aiff?)\b|fetch\(|new Audio\(|<input[^>]*file/i, "tones are synthesized; no audio files, no uploads");
assert.match(tones, /createOscillator\(\)/);
// Load the module in a sandbox and check the catalogue and the choice rules.
const store = new Map();
const sandbox = { window: { addEventListener() {}, danzstakTranslate: null }, document: { readyState: "complete", hidden: false, getElementById: () => null, addEventListener() {} }, localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) }, navigator: {}, setTimeout, clearTimeout, setInterval, clearInterval, Math, JSON, Object, Date, String, Number, Boolean };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(tones, sandbox);
const api = sandbox.window.danzstakSyncTones;
const rings = api.list("ring"), messages = api.list("message");
assert.ok(rings.length + messages.length >= 12, "about 12 tones to start");
for (const kind of ["punk", "metal", "techno", "house", "industrial", "classic"]) assert.ok(rings.some(tone => tone.id.includes(kind)), `a ${kind} ringtone`);
for (const tone of [...rings, ...messages]) assert.ok(tone.seconds > 0 && tone.seconds <= 3, `${tone.id} is 1-3 s per loop`);
assert.equal(api.toneFor("ring", "a@b.test"), "classic");
api.choose("ring", "metal-gallop");
api.choose("ring", "techno-pulse", "Friend@Example.test");
assert.equal(api.toneFor("ring", "friend@example.test"), "techno-pulse", "per-contact override wins");
assert.equal(api.toneFor("ring", "other@example.test"), "metal-gallop");
assert.equal(api.choose("ring", "not-a-tone"), false, "unknown tones are refused");
assert.equal(api.choose("ring", "pop"), false, "a message tone is not a ringtone");
assert.doesNotMatch(store.get("danzstak_sync_tones"), /friend|example/i, "the store never holds the contact's address");
api.setVibrate("ring", false, "friend@example.test");
assert.equal(api.vibrates("ring", "friend@example.test"), false);
assert.equal(api.vibrates("ring", "other@example.test"), true);
api.reset("friend@example.test");
assert.equal(api.toneFor("ring", "friend@example.test"), "metal-gallop");
// One tone at a time, 30 s cap, message tone never over a ring.
assert.match(tones, /MAX_RING_MS = 30000/);
assert.match(tones, /function play\(id, \{[^)]*\} = \{\}\) \{\r?\n    stop\(\);/, "starting a tone stops the previous one");
assert.match(tones, /function messageArrived\(contact\) \{\r?\n    if \(active \|\| document\.hidden\) return false;/);
assert.match(tones, /navigator\.audioSession\.type = type/, "respects the silent switch where the browser exposes it");
// Wired into both ringers; answering/declining stops through the handle.
assert.match(chat, /if\(window\.danzstakSyncTones\)\{ringTimer=window\.danzstakSyncTones\.startRing\(audioContext,\{contact:pending\.senderEmail\|\|contact,durationMs:remaining\}\);return;\}/);
assert.match(chat, /function stopIncomingRingtone\(\)\{if\(ringTimer\?\.stop\)ringTimer\.stop\(\);/);
assert.match(incoming, /ringtoneTimer = window\.danzstakSyncTones\.startRing\(ringtoneContext, \{ contact: current\.senderEmail \|\| "", durationMs: remaining \}\)/);
assert.match(incoming, /if \(ringtoneTimer\?\.stop\) ringtoneTimer\.stop\(\);/);
assert.match(dm, /if \(incomingArrived\) window\.danzstakSyncTones\?\.messageArrived\?\.\(contact\);/);
assert.match(dm, /if \(toneFor && unreadPrimed\) globalThis\.danzstakSyncTones\?\.messageArrived\?\.\(toneFor\);/);
// Settings row, chat menu, setup step, honest locked-phone note.
assert.match(tones, /danzstakSyncSettings\?\.add\(\{ id: "tones"/);
assert.match(tones, /item\.id = "headerRingtoneMenu"/);
assert.match(tones, /your phone's own notification sound plays/);
assert.match(setup, /list\.push\(\{ id: "tones"/);
assert.ok(setup.indexOf('id: "wallpaper"') < setup.indexOf('id: "tones"') && setup.indexOf('id: "tones"') < setup.indexOf('id: "alerts"'), "setup order: wallpaper, ringtone, alerts");
for (const page of ["messages.html", "feed.html", "profile.html"]) assert.match(fs.readFileSync(page, "utf8"), /<script src="assets\/sync-tones\.js\?v=\d+" defer><\/script>/, `${page} loads the tones`);
assert.ok(worker.includes('"/assets/sync-tones.js"') && worker.includes('"/assets/sync-tones.css"'));
for (const lang of ["it", "fr", "es"]) {
  const block = i18n.slice(i18n.indexOf(`"${lang}": {`), i18n.indexOf("\n}", i18n.indexOf(`"${lang}": {`)));
  for (const key of ["Ringtones", "Message tone", "Vibrate", "With SYNC closed or the phone locked, your phone's own notification sound plays. Your SYNC tone takes over while SYNC is open.", "Pick your ringtone"]) assert.ok(block.includes(JSON.stringify(key) + ":"), `${lang}: ${key}`);
}
console.log("SYNC ringtone checks passed: 12 synthesized tones (no files), contact override, vibrate per tone, one at a time, 30 s cap, both ringers wired, message tone, settings + chat menu + setup step, it/fr/es.");
