"use strict";
// AI EPK screens (task 08, PR 2): contract checks. The real-browser walk is browser-checks/epk-ai.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("epk.html", "utf8"), js = fs.readFileSync("assets/epk-ai.js", "utf8"), css = fs.readFileSync("assets/epk-ai.css", "utf8");
const sw = fs.readFileSync("service-worker.js", "utf8"), music = fs.readFileSync("assets/i18n-music.js", "utf8");

// Loaded on the EPK builder, after epk.js, and cached for the installed app.
assert.match(html, /<link rel="stylesheet" href="assets\/epk-ai\.css\?v=\d+">/);
assert.ok(html.indexOf("assets/epk.js?v=") < html.indexOf("assets/epk-ai.js?v="), "epk-ai.js runs after epk.js");
assert.ok(sw.includes('"/assets/epk-ai.js"') && sw.includes('"/assets/epk-ai.css"'));

// Five screens, in order, and the server routes they use.
for (const title of ["Let AI build your EPK", "Tell us who you are", "Is this you?", "Pay for your AI EPK", "Building your EPK"]) assert.ok(js.includes(`"${title}"`), title);
for (const route of ['"/epk/ai"', '"/epk/ai/identify"', '"/epk/ai/confirm"', '"/epk/ai/build"', '"/epk/ai/step"', '"/epk/ai/review"', '"/tour-manager/ai-epk/checkout"']) assert.ok(js.includes(route), route);
// Price only when the artist chooses AI and hasn't bought it (owner 2026-11-18); building by hand never shows one.
assert.match(js, /price\.textContent = offer\.owned \|\| offer\.credits > 0 \? "" : money\(offer\.totalCents\)/);
assert.ok(!/self[\s\S]{0,200}money\(/.test(js.slice(js.indexOf('const self = button("Build it myself"'), js.indexOf("aiButton.addEventListener"))), "no price on Build it myself");
// What's included, the refund rule and the AI disclaimer before paying.
for (const text of ["1 booking pitch email to one venue, included", "No refund once a draft is made. If you don't use it, the refund is the price minus Stripe's fee.", "offer.disclaimer"]) assert.ok(js.includes(text), text);
assert.ok(js.includes("They are never used to train AI."), "the provider notice on Tell us who you are");
// Only Stripe Checkout URLs are followed.
assert.match(js, /\/\^https:\\\/\\\/checkout\\\.stripe\\\.com\\\/\/\.test\(res\.data\.checkoutUrl/);
// The draft never overwrites what the artist wrote; every AI section is marked with its sources; editing or
// "Looks right" checks it; the gate text matches the spec.
assert.match(js, /if \(!next \|\| input\.value\.trim\(\)\) return false; \/\/ never overwrite/);
assert.ok(js.includes('"AI draft — check it"') && js.includes('"Sources:"') && js.includes('"Looks right"'));
assert.match(js, /input\.addEventListener\("input", \(\) => reviewed\(field\), \{ once: true \}\)/);
assert.ok(js.includes("I reviewed all AI-written sections and have permission for every quote and image."));
assert.match(js, /post\("\/epk\/ai\/review", \{ all: true, confirmed: true \}\)/);
// Device Back closes the sheet instead of leaving the builder.
assert.match(js, /history\.pushState\(\{ epkAiSheet: true \}, ""\)/);
// Phone first: full screen under 760px, 44px+ targets.
assert.match(css, /@media \(max-width:759px\)\{\s*\.epk-ai-sheet\{width:100vw;height:100dvh/);
assert.match(css, /\.epk-ai-actions button\{min-height:48px/);
// it/fr/es for the screens and the disclaimer.
for (const word of ["Fai costruire il tuo EPK all'AI", "Laisse l'IA créer ton EPK", "Deja que la IA cree tu EPK", "Le bozze AI possono essere sbagliate", "Les brouillons IA peuvent être faux", "Los borradores con IA pueden tener errores", "Bozza AI — controllala", "Brouillon IA — à vérifier", "Borrador con IA — revísalo"]) assert.ok(music.includes(word), word);
console.log("AI EPK screen checks passed: loaded and cached, five screens and routes, price only until bought, included/refund/disclaimer, Stripe-only redirect, no overwrite, marks + sources + review gate, Back, phone layout, it/fr/es.");
