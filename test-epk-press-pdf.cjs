"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const html = fs.readFileSync("epk.html","utf8"), client = fs.readFileSync("assets/epk.js","utf8"), css = fs.readFileSync("assets/epk.css","utf8"), worker = fs.readFileSync("service-worker.js","utf8");

assert.match(html,/id="printEpkOnePage"[^>]*>One-page press PDF</);
assert.match(html,/id="printEpk"[^>]*>Full press PDF</);
assert.match(html,/assets\/epk\.css\?v=10/);
assert.match(html,/assets\/epk\.js\?v=22/);
assert.match(client,/dataset\.epkSection/);
assert.match(client,/document\.querySelectorAll\("\.epk-pdf-action"\)/,"private booking permissions must govern both PDF actions");
assert.match(client,/printEpk\("one-page"\)/);
assert.match(client,/printEpk\("full"\)/);
assert.match(client,/afterprint[\s\S]*delete document\.body\.dataset\.epkPrint/);
for (const section of ["about","listen","watch","notable-shows","press","booking"]) assert.match(css,new RegExp(`data-epk-section="${section}"`));
assert.match(css,/@page\{size:letter;margin:\.4in\}/);
assert.match(css,/data-epk-print="one-page"[\s\S]*\.epk-embeds iframe\{display:none!important\}/);
assert.match(css,/\.epk-embeds>:nth-child\(n\+3\)/,"one-page press output must bound every rich-media card regardless of its semantic element");
assert.match(worker,/danzstak-shell-v811/);
console.log("EPK press PDF checks passed: explicit one-page/full modes, bounded summary content, permission parity, print cleanup, and PWA refresh.");
