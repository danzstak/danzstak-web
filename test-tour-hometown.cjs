"use strict";
// Task 15-C (+15-D): the Tour Manager wears the hometown as accents only, from the same hometownSkin setting as the
// EPK (no EPK: the booking workspace's home town, then off); every count opens what it counts and says what it counts.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = file => fs.readFileSync(file, "utf8");
const looks = require("./assets/hometown-looks.js");

// Accents on the light Tour Manager pages stay at 4.5:1 or better, even over the motif.
for (const city of looks.CITIES) {
  const tuned = looks.accentOn({ tokens: city }, "#ffffff");
  assert.ok(looks.contrast(tuned.accent, "#ffffff") >= 4.5 && looks.contrast(tuned.accent, tuned.worstGround) >= 4.5, `${city.id} accent on the Tour Manager`);
}
for (const town of ["Springfield, IL", "Gdańsk", "Ogden UT"]) { const tuned = looks.accentOn(looks.hometownLook(town), "#ffffff"); assert.ok(looks.contrast(tuned.accent, "#ffffff") >= 4.5, town); }

// One setting for both places.
const sandbox = { window: {}, document: { readyState: "complete", body: { dataset: {}, style: { setProperty() {}, removeProperty() {} } }, querySelectorAll: () => [], querySelector: () => null, getElementById: () => null, addEventListener() {} }, CustomEvent: class {}, MutationObserver: class { observe() {} }, fetch: async () => ({ ok: false }), setTimeout, clearTimeout, AbortController, console };
sandbox.window.dispatchEvent = () => {};
vm.runInNewContext(read("assets/hometown-looks.js"), sandbox);
vm.runInNewContext(read("assets/tour-hometown.js"), sandbox);
const T = sandbox.window.danzstakTourHometown;
assert.equal(T.fromKit({ hometown: "Tacoma, WA" }).id, "tacoma", "old kits act as auto");
assert.equal(T.fromKit({ hometown: "Bologna", hometownSkin: { mode: "city", city: "tacoma" } }).id, "tacoma", "another city");
assert.equal(T.fromKit({ hometown: "Tacoma", hometownSkin: { mode: "off" } }), null, "off");
assert.equal(T.fromKit({ hometownSkin: { mode: "auto" } }), undefined, "auto with no hometown falls back to the workspace");
assert.equal(T.fromKit(null), undefined);
const js = read("assets/tour-hometown.js");
assert.match(js, /if \(fromEpk !== undefined\) return fromEpk;/, "the EPK decides, including off");
assert.match(js, /getElementById\("pitchHometown"\)[\s\S]*\/booking-pipeline/, "no EPK: the booking workspace's home town");
assert.doesNotMatch(js.replace(/https:\/\/api\.danzstak\.com/, ""), /https?:\/\//, "nothing is sent to a third party");

// Wiring on both Tour Manager pages and the offline shell.
for (const page of ["booking.html", "booking-selections.html"]) {
  const html = read(page);
  assert.match(html, /assets\/tour-hometown\.css\?v=1/, page);
  assert.ok(html.indexOf("assets/hometown-looks.js") < html.indexOf("assets/tour-hometown.js"), `${page} loads the data first`);
}
const worker = read("service-worker.js");
for (const file of ["tour-hometown.css", "tour-hometown.js", "hometown-looks.js"]) assert.ok(worker.includes(`"/assets/${file}"`), file);

// Accents only: forms, buttons, map and pipeline keep the DanzStak frame.
const css = read("assets/tour-hometown.css");
assert.match(css, /body\[data-tour-hometown\]\{background-color:#fff;background-image:linear-gradient\(var\(--tour-accent\),var\(--tour-accent\)\),var\(--tour-motif,none\)/, "the skin wraps the page");
assert.match(css, /body\[data-tour-hometown\] \.eyebrow\{color:var\(--tour-accent\)\}/);
assert.match(css, /header\.tool-header\{box-shadow:inset 0 -6px 0 var\(--tour-accent\)!important\}/, "header accent stripe, drawn inside so the header keeps its height");
assert.match(css, /\.tour-day-sheet-head\{[^}]*border-top:6px solid var\(--tour-accent/, "day-sheet header");
assert.doesNotMatch(css, /(?:input|select|textarea|\.pipeline-chip|\.leaflet|#venueMap)[^{]*\{[^}]*--tour-accent/, "no hometown colour on forms, the pipeline or the map");
assert.doesNotMatch(css, /button(?!\.tour-stat)[^{,]*\{[^}]*background:var\(--tour-accent/, "buttons are not repainted");

// 15-D: counts are buttons that open what they count, with one-line words and spoken names.
const selections = read("assets/booking-selections.js"), selectionsHtml = read("booking-selections.html");
for (const [id, metric, word] of [["tmSelected", "selected", "Clubs"], ["tmSent", "sent", "Sent"], ["tmReplies", "replied", "Replies"], ["tmConfirmed", "confirmed", "Booked"], ["tmDeclined", "declined", "Passed"], ["psSent", "pitched", "Sent"], ["psDelivered", "delivered", "Delivered"], ["psOpened", "opened", "Opened"], ["psReplied", "replied", "Replied"], ["psBooked", "booked", "Booked"]])
  assert.match(selectionsHtml, new RegExp(`<button type="button" class="tour-stat" data-metric="${metric}"><strong id="${id}">0</strong><span>${word}</span></button>`), id);
assert.match(selectionsHtml, /class="tour-stat tour-stat-inline" data-metric="credits"><strong id="bookingCreditBalance">/);
assert.match(selections, /opened: \{ label: "Opened", test: venue => opensFor\(venue\) > 0, say: n => `\$\{n\} venue\$\{n === 1 \? "" : "s"\} opened your private EPK` \}/, "spoken name says exactly what is counted");
assert.match(selections, /if \(metricFilter && !METRICS\[metricFilter\]\.test\(venue\)\) return;/, "a tap opens exactly those clubs");
assert.match(selections, /labelStat\(id, metric, venues\.filter\(METRICS\[metric\]\.test\)\.length\)/, "tour counts come from the same tests as the filter");
assert.match(selections, /button\.disabled = !\(n > 0\);/, "a count that opens nothing is not a live button");
const agent = read("assets/booking-agent.js");
assert.match(agent, /statButton\("Days", days, `\$\{days\} day\$\{days === 1 \? "" : "s"\} on the day sheet\. Show every day\.`, false\)/);
assert.match(agent, /if \(venue\) row\.dataset\.show = "1";/);
assert.match(read("assets/booking-legs.js"), /legsButton\.dataset\.metric = "legs"/);
const hq = read("assets/artist-hq.js");
assert.match(hq, /const metric = counted \? node\("a", String\(value\), "artist-hq-metric"\)/, "Music HQ counts are links");
assert.match(hq, /`\$\{needs\.length\} booking thread\$\{needs\.length === 1 \? "" : "s"\} waiting for your answer`/);

// Shortened labels keep their full wording for screen readers.
assert.match(selectionsHtml, /<h1 aria-label="Your booking pipeline">Pipeline<\/h1>/);
assert.match(read("booking.html"), /<h1 id="bookingBriefTitle" aria-label="Where do you want to play\?">Where to play\?<\/h1>/);

// Translations, including the spoken counts as number patterns.
const t = { window: {} };
vm.runInNewContext(read("assets/i18n-music.js"), t);
for (const text of ["Clubs", "Sent", "Replies", "Booked", "Passed", "Delivered", "Opened", "Replied", "Pitch numbers", "Email credits", "Day sheet", "Days", "Shows", "Legs", "Show all", "Out of", "Pipeline", "Save", "Print sheet", "Where to play?", "Map or manual", "More options", "Playable rooms", "My gigs", "Club research"])
  for (const lang of ["it", "fr", "es"]) assert.ok(t.window.danzstakTranslations[lang][text], `${lang} "${text}"`);
for (const lang of ["it", "fr", "es"]) for (const pattern of ["{} venues opened your private EPK. Show them.", "{} clubs replied on this list", "{} days on the day sheet. Show every day.", "{} booking-email credits ready to send. Show credit activity."])
  assert.ok(t.window.danzstakPatterns[lang].some(([en]) => en === pattern), `${lang} pattern "${pattern}"`);
console.log("Tour Manager hometown checks passed: one hometownSkin setting with fallbacks, accents at 4.5:1 on the light pages, frame untouched, counts that open what they count with spoken names, short labels with full accessible names, it/fr/es.");
