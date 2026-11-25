"use strict";
// Owner 2026-11-25 ("make it very stop go kinda thing. these user will be all over the world"; "baby proof"): answering
// or refusing a call reads without words, in any language. Green = go (Accept/Answer), red = stop (Decline).
// - the lock-screen notification: Android draws its buttons, so each title starts with a green or red dot;
// - the incoming-call screen on every page: a round green Answer and a round red Decline;
// - the SYNC call screen already uses green Accept and red Decline.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const worker = fs.readFileSync("service-worker.js", "utf8");
assert.match(worker, /action: "answer", title: callButton\("🟢"/, "lock-screen Accept starts with a green dot");
assert.match(worker, /action: "decline", title: callButton\("🔴"/, "lock-screen Decline starts with a red dot");
const helper = new Function(`${worker.match(/function callButton\(mark, words\) \{[\s\S]*?\n\}/)[0]}; return callButton;`)();
assert.equal(helper("🟢", "Accetta"), "🟢 Accetta");
assert.equal(helper("🔴", "🔴 Rifiuta"), "🔴 Rifiuta", "a mark is never doubled");
assert.ok(helper("🟢", "x".repeat(80)).length <= 40, "titles stay short enough for the phone");

const css = fs.readFileSync("assets/incoming-calls.css", "utf8");
const rule = selector => (css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`)) || [])[1] || "";
// The pop-up became a full-screen ringing screen (#768): round green Answer, round red Decline, words under them.
assert.match(rule(".gic-circle"), /background:var\(--ds-btn-go,#15803d\)/, "Answer on the pop-up is green");
assert.match(rule(".global-call-decline .gic-circle"), /background:#dc2626/, "Decline on the pop-up is red");
assert.doesNotMatch(rule(".gic-circle"), /gradient/, "no blue/purple gradient on Answer");
// White icons on both stay readable (WCAG 3:1 for icons; both reach 4.5:1).
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
for (const hex of ["#15803d", "#dc2626"]) assert.ok(1.05 / (lum(hex) + 0.05) >= 4.5, `white on ${hex} reads at 4.5:1`);

const screen = fs.readFileSync("assets/sync-call-ui.css", "utf8");
assert.match(screen, /#acceptCall\{background:var\(--ds-btn-go/, "the SYNC call screen's Accept is green");
assert.match(screen, /#declineCall\{background:#df3347/, "the SYNC call screen's Decline is red");
console.log("Stop/go call buttons: green dot on Accept and red dot on Decline on the lock screen, a green Answer and red Decline on the pop-up, readable white text.");
