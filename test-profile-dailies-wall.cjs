"use strict";
// Fix-it 18, Profile page items 2 and 3 (owner 2026-11-17): a Dailies strip edge to edge directly above the posts, and
// one continuous wall on a phone (no side gutters, no boxes, no gaps). Real-browser check: browser-checks/profile-mirror.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const dailies = fs.readFileSync("assets/profile-dailies.js", "utf8");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
const polish = fs.readFileSync("assets/profile-polish.css", "utf8");
const html = fs.readFileSync("profile.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const people = fs.readFileSync("assets/i18n-people.js", "utf8");

// Wiring: the strip mounts right after the composer, before any post, only on the Posts wall.
assert.match(editor, /tabMessage\.appendChild\(profileWallComposer\(window\.danzstakCurrentProfile\)\); if \(collection === "posts" && !mediaOnly\) window\.danzstakProfileDailies\?\.mount\(tabMessage, profileMemberId\);/, "Dailies mount directly after the composer on the Posts wall");
assert.ok(html.indexOf("assets/profile-dailies.js") > 0 && html.indexOf("assets/profile-dailies.js") < html.indexOf("assets/profile-editor.js"), "profile-dailies.js loads before the editor");
assert.ok(worker.includes('"/assets/profile-dailies.js"'), "the PWA shell caches the Dailies strip");

// Behaviour: only the profile member's Dailies, oldest first; hidden when none; real mute toggle; Back closes.
assert.match(dailies, /stories\.filter\(story => story\.memberId === memberId && story\.mediaUrl && \["image", "video"\]\.includes\(story\.mediaType\)\)/, "keeps only this member's Dailies");
assert.match(dailies, /if \(!own\.length\) \{ strip\.remove\(\); return; \}/, "no empty strip");
assert.match(dailies, /media\.muted = viewerMuted; media\.playsInline = true; media\.autoplay = true;/, "viewer video starts muted and inline");
assert.match(dailies, /profile-daily-mute/, "viewer has a mute toggle");
assert.match(dailies, /history\.pushState\(\{ profileDaily: true \}, ""\)/, "opening pushes a history entry so device Back closes the viewer");
assert.match(dailies, /window\.addEventListener\("popstate", \(\) => \{ if \(viewer\?\.open\)/, "Back closes the viewer");
assert.doesNotMatch(dailies, /innerHTML\s*=\s*[^;]*story\./, "story data never goes into innerHTML");

// Filtering really runs: simulate the strip with a fake DOM and a mocked /stories.
const memberId = "11111111-1111-4111-8111-111111111111";
const made = [];
const element = tag => { const node = { tagName: tag.toUpperCase(), children: [], dataset: {}, attributes: {}, hidden: false, isConnected: true, className: "", appendChild(child) { this.children.push(child); return child; }, replaceChildren(...kids) { this.children = kids; }, remove() { this.isConnected = false; }, setAttribute(k, v) { this.attributes[k] = v; }, getAttribute(k) { return this.attributes[k]; }, addEventListener() {} }; made.push(node); return node; };
const sandbox = { window: {}, document: { createElement: element }, fetch: async () => ({ ok: true, json: async () => ({ stories: [
  { memberId, mediaType: "image", mediaUrl: "https://x/b.jpg", createdAt: "2026-11-17T10:00:00Z" },
  { memberId, mediaType: "video", mediaUrl: "https://x/a.mp4", createdAt: "2026-11-17T09:00:00Z" },
  { memberId: "22222222-2222-4222-8222-222222222222", mediaType: "image", mediaUrl: "https://x/c.jpg", createdAt: "2026-11-17T11:00:00Z" },
  { memberId, mediaType: "audio", mediaUrl: "https://x/d.mp3", createdAt: "2026-11-17T12:00:00Z" }
] }) }), AbortController, setTimeout, clearTimeout, Date, history: {}, console };
vm.createContext(sandbox);
vm.runInContext(dailies, sandbox);
(async () => {
  const container = element("div");
  const strip = sandbox.window.danzstakProfileDailies.mount(container, memberId);
  assert.equal(container.children[0], strip, "strip is appended in place, before posts render");
  await new Promise(resolve => setTimeout(resolve, 20));
  const row = strip.children[0];
  assert.equal(strip.hidden, false);
  assert.equal(row.children.length, 2, "two of the member's photo/video Dailies (not someone else's, not audio)");
  assert.equal(row.children[0].children[0].tagName, "VIDEO", "oldest first");
  const empty = element("div");
  const none = sandbox.window.danzstakProfileDailies.mount(empty, "not-a-member-id");
  assert.equal(none.isConnected, false, "no strip without a valid member");

  // Continuous wall on phones.
  assert.match(polish, /@media\(max-width:560px\)\{\s*\.profile-page main\{margin:0!important;width:100%!important;max-width:none!important\}/, "profile reaches both screen edges on phones");
  assert.match(polish, /\.profile-page \.profile-post-card\{margin-left:-16px!important;margin-right:-16px!important\}/, "posts bleed to the edges");
  assert.match(polish, /\.profile-page \.profile-wall-composer\{margin:0 -16px!important/, "composer has no grey gap bands");
  assert.match(polish, /\.profile-daily\{[^}]*aspect-ratio:9\/16[^}]*border:0;border-radius:0/, "Dailies tiles are tall, borderless, square-edged");
  assert.match(polish, /\.profile-dailies-row\{[^}]*gap:2px[^}]*scroll-snap-type:x mandatory/, "tiles sit with hairline seams and snap");
  for (const [lang, word] of [["it", "Apri il Daily delle {time}"], ["fr", "Ouvrir le Daily de {time}"], ["es", "Abrir el Daily de las {time}"]]) assert.ok(people.includes(`"Open Daily from {time}": "${word}"`), `${lang} tile label`);
  console.log("Profile Dailies strip and continuous wall checks passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
