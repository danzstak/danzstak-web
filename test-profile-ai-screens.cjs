"use strict";
// "Write it with AI" on Edit profile (task 19, queue 5b2): contract checks. Real browser: browser-checks/profile-ai.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("profile.html", "utf8"), js = fs.readFileSync("assets/profile-ai.js", "utf8"), css = fs.readFileSync("assets/epk-ai.css", "utf8");
const sw = fs.readFileSync("service-worker.js", "utf8"), people = fs.readFileSync("assets/i18n-people.js", "utf8");
assert.ok(html.indexOf("assets/profile-editor.js?v=") < html.indexOf("assets/profile-ai.js?v="), "loads after the profile editor");
assert.match(html, /assets\/epk-ai\.css\?v=\d+/, "shares the AI sheet styles");
assert.ok(sw.includes('"/assets/profile-ai.js"'));
// One row right under the title; the price only until bought; "AI coming soon" without the key.
assert.match(js, /form\.querySelector\("h2"\)\?\.after\(row, status\)/);
assert.match(js, /price\.textContent = state\.available && !state\.owned \? money\(state\.totalCents\) : ""/);
assert.ok(js.includes('"AI coming soon"'));
// Purchase: refund rule + disclaimer, Stripe Checkout only, kind=profile.
assert.match(js, /post\("\/tour-manager\/ai-epk\/checkout", \{ kind: "profile" \}\)/);
assert.ok(js.includes(String.raw`/^https:\/\/checkout\.stripe\.com\//.test(res.data.checkoutUrl`), "only Stripe Checkout URLs are followed");
assert.ok(js.includes("No refund once a draft is made.") && js.includes("state.disclaimer"));
// The quick questions from the spec and the provider notice.
for (const q of ["What do you do?", "Scene or genres", "City", "One line about you", "Your links (one per line)", "never used to train AI"]) assert.ok(js.includes(q), q);
// "Use this" fills the editor; never auto-saved (no POST /profiles here).
assert.ok(!/\/profiles"/.test(js), "this script never saves the profile");
assert.match(js, /AI draft filled in\. Check every word, then Save\./);
// Back closes the sheet; 44px+ rows.
assert.match(js, /history\.pushState\(\{ profileAiSheet: true \}, ""\)/);
assert.match(css, /\.profile-ai-row\{[^}]*min-height:48px/);
for (const word of ["Scrivilo con l'AI", "L'écrire avec l'IA", "Escríbelo con IA", "Qualche domanda veloce", "Quelques questions rapides", "Unas preguntas rápidas"]) assert.ok(people.includes(word), word);
console.log("Write it with AI screen checks passed: row under the title, price until bought, coming soon, Stripe-only kind=profile checkout, refund rule + disclaimer, the spec's questions, fill without saving, Back, 44px rows, it/fr/es.");
