"use strict";
// Fix-it 18, Profile page items 4 and 5 (owner 2026-11-17): profile navigation members already know. Phone top bar is
// back / name / search; a visitor's action row is Add friend / Message / more; owner-only controls stay hidden for
// visitors; no instructional copy; tidy tab row. Real-browser check: browser-checks/profile-mirror.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const nav = fs.readFileSync("assets/profile-nav.js", "utf8");
const friend = fs.readFileSync("assets/profile-friend.js", "utf8");
const polish = fs.readFileSync("assets/profile-polish.css", "utf8");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
const html = fs.readFileSync("profile.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const people = fs.readFileSync("assets/i18n-people.js", "utf8");

// Root cause of visitors seeing Edit / Open my shop / Invite: display:grid!important beat the hidden attribute.
// UIKIT 4b part 2: the row is kit icon buttons with no display rule of their own, and no old rule targets it.
assert.doesNotMatch(polish, /\.profile-actions/, "no old action-row rule can override [hidden]");
assert.match(html, /<style>\r?\n\*\{box-sizing:border-box\}\[hidden\]\{display:none!important\}/, "[hidden] always wins on the profile");
assert.match(fs.readFileSync("assets/profile-sharing.js", "utf8"), /share\.hidden = share\.classList\.contains\('profile-share-hidden'\)/, "the visitor's Share stays in ⋯");

// Race: a fast profile load must still get Add friend (deferred scripts run before the row exists).
assert.match(friend, /let parsed = false; document\.addEventListener\("DOMContentLoaded", \(\) => \{ parsed = true; \}, \{ once: true \}\);/, "profile-friend tracks parsing itself");
assert.match(friend, /if \(!actions && !target && !parsed\) \{ document\.addEventListener\("DOMContentLoaded", \(\) => install\(profile\), \{ once: true \}\); return; \}/, "Add friend retries once the action row exists");
assert.match(nav, /if \(document\.readyState === "complete"\) start\(\); else document\.addEventListener\("DOMContentLoaded", start, \{ once: true \}\);/, "profile-nav starts after the action row exists");

// Top bar: back (same-site history or Mix), the member's name, a search toggle that opens the existing search form.
assert.match(nav, /back\.dataset\.icon = "back";/);
assert.match(nav, /if \(sameSite && history\.length > 1\) history\.back\(\); else location\.href = "feed\.html\?view=feed";/, "Back never leaves DanzStak");
assert.match(nav, /search\.dataset\.icon = "search";[\s\S]*aria-controls", "profileHeaderSearch"/, "search toggle controls the existing search field");
assert.match(polish, /@media\(max-width:700px\)\{[\s\S]*body\.profile-page>header\.profile-app-header>\.brand,body\.profile-page>header\.profile-app-header>\.header-actions\{display:none!important\}/, "phone top bar drops brand and text links");
assert.match(polish, /grid-template-columns:44px minmax\(0,1fr\) 44px 44px 44px!important/, "phone top bar: back, name, search, Pivot (directive F15j), bell (owner 2026-11-23)");
assert.match(nav, /bell\.className = "profile-bell"; bell\.href = "feed\.html#notifications";/, "the bell opens Notifications in Mix");
assert.match(nav, /\["notifications", "engagement-notifications"\]/, "the bell counts the same two lists as Mix");
assert.match(polish, /color:#f5f5f2!important;-webkit-tap-highlight-color:transparent\}/, "top-bar icons are light on the dark bar");

// Visitor row: Message joins the row as an icon; Share moves into ⋯.
assert.match(nav, /message\.dataset\.icon = "chat";/);
assert.match(nav, /fmt\("Message \{name\}"/, "Message has the member's name as its accessible name");
assert.match(nav, /more\.dataset\.icon = "more";[\s\S]*aria-haspopup", "dialog"/, "more opens a sheet");
assert.match(nav, /words\.textContent = t\("Share profile"\);/);
assert.match(nav, /window\.danzstakSheet\?\.open\(\{ title: profile\.name \|\| t\("More"\), content: list, opener: more, className: "ds--day" \}\)/, "⋯ is a kit sheet, Day on the not-yet-moved profile");
assert.match(html, /assets\/ds-sheet\.js\?v=\d+/, "profile loads the kit sheet");

// No instructional copy where there's nothing to do.
assert.doesNotMatch(editor, /note\.textContent = profile\.profilePostPermission === "friends"/, "visitors see no 'only … can post' note");

// Wiring and translations.
assert.ok(html.indexOf("assets/profile-nav.js") > 0, "profile loads profile-nav.js");
assert.ok(worker.includes('"/assets/profile-nav.js"'), "the PWA shell caches profile-nav.js");
for (const [lang, word] of [["it", "Scrivi a {name}"], ["fr", "Écrire à {name}"], ["es", "Escribir a {name}"]]) assert.ok(people.includes(`"Message {name}": "${word}"`), `${lang} Message label`);
console.log("Profile navigation checks passed: back/name/search bar, Add friend/Message/More, hidden owner controls, no instructional copy.");
