"use strict";
// SYNC list at 390px (owner check 2026-11-18): one ⋮ in the header, actions moved into the SYNC settings sheet,
// no explanatory sub-line, no gradient placeholder avatars, broken pictures fall back to the initial.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = file => fs.readFileSync(file, "utf8");
const html = read("messages.html"), js = read("assets/sync-list-polish.js"), css = read("assets/sync-list-polish.css"), worker = read("service-worker.js"), i18n = read("assets/i18n-sync.js");

assert.match(html, /assets\/sync-list-polish\.css\?v=2/);
assert.ok(html.indexOf("assets/sync-settings.js") < html.indexOf("assets/sync-list-polish.js"), "loads after the settings sheet it adds rows to");
assert.match(worker, /"\/assets\/sync-list-polish\.js", "\/assets\/sync-list-polish\.css"/, "cached for offline use");
assert.match(css, /:is\(#inviteFriend,#newVideoCall,#callingDevices,#enableRinging\)\{display:none!important\}/, "the four header buttons leave the header");
assert.match(css, /#syncSectionNote\{display:none!important\}/, "no sub-line");
assert.match(css, /span\.conversation-list-avatar[^{]*\{background:#121418!important[^}]*color:#ff5a1f!important/, "initials on DanzStak colours");
assert.match(js, /gear\.dataset\.icon = "more"/, "the settings gear becomes the ⋮");
assert.match(js, /document\.addEventListener\("error", event => \{[\s\S]*?\}, true\);/, "image errors are caught in the capture phase");

// Behaviour: the rows are added to the settings sheet and each clicks the original (hidden) button.
const added = [], clicked = [];
const doc = { readyState: "complete", body: { classList: { add() {} } }, getElementById: id => ({ click: () => clicked.push(id), setAttribute() {}, dataset: {}, parentElement: null }), querySelector: () => null, addEventListener() {} };
const sandbox = { window: { danzstakSyncSettings: { add: row => added.push(row) } }, document: doc, MutationObserver: class { observe() {} disconnect() {} }, HTMLImageElement: class {} };
vm.runInNewContext(js, sandbox);
assert.deepEqual(added.map(r => r.label), ["Invite a friend", "New video call", "Call alerts"]);
added.forEach(r => r.run());
assert.deepEqual(clicked, ["inviteFriend", "newVideoCall", "enableRinging"], "each row runs the original control");
assert.equal(sandbox.window.danzstakSyncListPolish.initial("  the pit"), "T");
assert.equal(sandbox.window.danzstakSyncListPolish.initial(""), "·", "no empty circle even without a name");

for (const word of ["More options", "New video call", "Call alerts", "Invite a friend", "Share your DanzStak link", "Pick someone from your chats", "Ring this device when someone calls"]) {
  assert.equal((i18n.match(new RegExp(`"${word}":`, "g")) || []).length, 3, `it/fr/es for "${word}"`);
}
// Fix-it 18 (SYNC list canvas): no music-staff box on the list (wallpaper belongs in threads), and an empty list is
// one centred line + a "Start a chat" action that opens the same new-chat picker as the floating button.
assert.match(css, /\.chat-list-panel\{min-height:0!important;border-radius:0!important;background:transparent!important;background-image:none!important/, "the list has no framed staves box");
assert.match(css, /\.chat-list-panel::after\{content:none!important/, "no watermark on the list");
const dm = read("assets/direct-messages.js");
assert.match(dm, /\? "No chats yet\."/, "one short empty line");
assert.match(dm, /start\.textContent = messageTranslate\("Start a chat"\);[\s\S]{0,120}querySelector\("\.sync-new-chat"\)\?\.click\(\)/, "Start a chat runs the floating new-chat button");
assert.doesNotMatch(read("assets/sync.css").match(/\.message-list\{[^}]*\}|\.chat-list-panel,\.message-list\{[^}]*\}/)[0], /background-image:none/, "threads keep their wallpaper");
for (const word of ["No chats yet.", "Start a chat"]) assert.equal((i18n.match(new RegExp(`"${word.replace(".", "\\.")}":`, "g")) || []).length, 5, `it/fr/es/de/pt for "${word}"`);
console.log("SYNC list polish checks passed: one ⋮, actions in the sheet, no sub-line, DanzStak-colour initials, broken-picture fallback, no staves box on the list, one-line empty state, it/fr/es.");
