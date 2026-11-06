const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("booking.html", "utf8");
const css = fs.readFileSync("assets/booking-workspace.css", "utf8");
const conversation = fs.readFileSync("assets/booking-conversation.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(html, /class="tool-header"/);
assert.match(html, /class="tool-brand"[\s\S]*?<span>DANZSTAK<\/span>/);
assert.match(html, /<section class="booking-start"[\s\S]*?<section class="booking-identity"[\s\S]*?<section class="booking-brief"/);
assert.match(html, /<h1 id="bookingBriefTitle">Where do you want to play\?<\/h1>/);
assert.match(html, />Plan my run<\/button>/);
assert.match(html, /id="bookingBriefExample">Example<\/button>/);
assert.match(html, /<details class="booking-tools">[\s\S]*?<summary>Use the map or fill in the details yourself<\/summary>/);
assert.match(html, /<details class="planner-drawer">[\s\S]*?<summary>More tour options: genre, crew, van and budget<\/summary>/);
assert.match(html, /assets\/booking-workspace\.css\?v=2/);
assert.match(html, /assets\/booking-conversation\.js\?v=478/);

assert.match(css, /\.booking-start[\s\S]*grid-template-columns: minmax\(270px, \.8fr\) minmax\(420px, 1\.2fr\)/);
assert.match(css, /\.booking-page \.booking-lead[\s\S]*border-top: 3px solid var\(--booking-orange\)/);
assert.match(css, /\.booking-page \.booking-brief-actions[\s\S]*grid-template-columns: minmax\(150px, 1fr\) auto/);
assert.match(css, /\.booking-page \.venue-quick-search[\s\S]*grid-template-columns: minmax\(240px, \.8fr\) minmax\(340px, 1\.2fr\)/);
assert.match(css, /@media \(max-width: 700px\)/);
assert.match(css, /min-height: 44px/);

assert.match(conversation, /let requestStarted = false/);
assert.match(conversation, /requestStarted = true/);
assert.match(conversation, /if \(requestStarted\) status\.textContent = routeStatus\.textContent/);
assert.match(conversation, /const home = field\("startCity"\)\?\.value\.trim\(\)/);
assert.match(conversation, /then press Plan my run again/);
assert.doesNotMatch(conversation, /Momo, Italy|The Rats\./);

assert.match(worker, /danzstak-shell-v696/);
assert.match(worker, /"\/assets\/booking-workspace\.css"/);

console.log("Booking workspace design checks passed: one compact planning card, truthful status timing, shared tool header, optional advanced controls, and PWA coverage.");
