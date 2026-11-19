"use strict";
// Audit 36 B4: one short, localized time label for posts and comments (assets/time-label.js), used by Mix posts, Mix
// comments, profile posts and profile comments — no second formatter, no US-only "11/17/2026, 4:34:35 PM".
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/time-label.js", "utf8");
function load(lang) {
  const window = { danzstakTranslate: value => (lang === "it" && value === "now" ? "ora" : value) };
  vm.runInNewContext(source, { window, document: { documentElement: { lang } }, Intl, Date, Math, Number, Object });
  return window.danzstakTimeLabel;
}

const now = new Date("2026-11-19T18:00:00Z").getTime();
const ago = seconds => new Date(now - seconds * 1000).toISOString();
const en = load("en");
assert.equal(en.label(ago(20), now).text, "now");
assert.equal(en.label(ago(5 * 60), now).text, "5m");
assert.equal(en.label(ago(3 * 3600), now).text, "3h");
assert.equal(en.label(ago(2 * 86400), now).text, "2d");
assert.equal(en.label("2026-11-01T12:00:00Z", now).text, "Nov 1");
assert.equal(en.label("2025-11-01T12:00:00Z", now).text, "Nov 1, 2025", "another year shows the year");
assert.match(en.label(ago(3 * 3600), now).title, /Nov 19, 2026/, "the title carries the full date");
assert.equal(en.label(ago(3 * 3600), now).iso, ago(3 * 3600));
assert.deepEqual({ ...en.label("not a date", now) }, { text: "", title: "", iso: "" });
const it = load("it");
assert.equal(it.label(ago(20), now).text, "ora", "'now' goes through the translation layer");
assert.equal(it.label(ago(2 * 86400), now).text, "2gg", "units follow the account language");
assert.equal(it.label("2026-11-01T12:00:00Z", now).text, "1 nov");

// paint() writes text, title and (on <time>) dateTime; it refuses an invalid date so callers can fall back.
const time = { tagName: "TIME", textContent: "", title: "", dateTime: "" };
assert.equal(en.paint(time, new Date(Date.now() - 2 * 86400 * 1000)), true);
assert.deepEqual([time.textContent, Boolean(time.title), Boolean(time.dateTime)], ["2d", true, true]);
assert.equal(en.paint({ tagName: "DIV" }, ""), false);

// The four places that show a post or comment time all use it; the old formatters are gone.
const feedHtml = fs.readFileSync("feed.html", "utf8"), feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const profileEditor = fs.readFileSync("assets/profile-editor.js", "utf8"), profileInteractions = fs.readFileSync("assets/profile-interactions.js", "utf8");
assert.match(feedHtml, /window\.danzstakTimeLabel\.paint\(time, createdAt\)/, "Mix posts use the shared label");
assert.match(feed, /window\.danzstakTimeLabel\?\.paint\(time, time\?\.dateTime\)/, "Mix comments use the shared label");
assert.match(profileEditor, /window\.danzstakTimeLabel\?\.paint\(time, post\.createdAt\)/, "profile posts use the shared label");
assert.match(profileInteractions, /window\.danzstakTimeLabel\?\.paint\(time, comment\.createdAt\)/, "profile comments use the shared label");
assert.doesNotMatch(feedHtml, /function shortPostTime/, "Mix's own formatter is gone");
assert.doesNotMatch(profileInteractions, /function relativeTime/, "the profile's own formatter is gone");
assert.doesNotMatch(profileEditor, /toLocaleString\(\)/, "no US-only full date on profile posts");
for (const page of ["feed.html", "profile.html"]) assert.match(fs.readFileSync(page, "utf8"), /assets\/time-label\.js\?v=\d+/, `${page} loads the shared label`);
assert.match(fs.readFileSync("service-worker.js", "utf8"), /"\/assets\/time-label\.js"/, "the label is cached for offline use");

console.log("Time label checks passed: now/5m/3h/2d/Nov 1/Nov 1, 2025 in the account language with the full date as title; Mix posts and comments and profile posts and comments all use it.");
