"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { normalizeUserUrl, userLinkTokens } = require("./assets/user-content-links.js");

const links = value => userLinkTokens(value).filter(token => token.type === "link");
const text = value => userLinkTokens(value).map(token => token.text).join("");

for (const [entered, destination] of [
  ["sfscoop.com", "https://sfscoop.com/"],
  ["www.sfscoop.com", "https://www.sfscoop.com/"],
  ["https://sfscoop.com", "https://sfscoop.com/"],
  ["app.sfscoop.com", "https://app.sfscoop.com/"],
  ["youtube.com", "https://youtube.com/"],
  ["spotify.com", "https://spotify.com/"]
]) {
  assert.deepEqual(links(entered), [{ type: "link", text: entered, href: destination }], `${entered} should link to ${destination}`);
}

const multiple = userLinkTokens("Hear sfscoop.com, then youtube.com.");
assert.deepEqual(multiple.filter(token => token.type === "link").map(token => token.href), ["https://sfscoop.com/", "https://youtube.com/"]);
assert.equal(multiple.map(token => token.text).join(""), "Hear sfscoop.com, then youtube.com.", "displayed punctuation and text must stay unchanged");

const path = "example.com/music/show?id=42&from=mobile";
assert.equal(links(path)[0]?.href, "https://example.com/music/show?id=42&from=mobile", "paths and query parameters should survive");
assert.equal(text(`(${path})`), `(${path})`, "surrounding parentheses must not enter the destination");
assert.equal(links(`(${path})`)[0]?.href, "https://example.com/music/show?id=42&from=mobile");
assert.equal(links("münchen.de")[0]?.href, "https://xn--mnchen-3ya.de/", "internationalized domains should normalize safely");

assert.equal(links("user@example.com").length, 0, "email addresses must not become website links");
assert.equal(links("not_a_website").length, 0, "invalid text must stay plain");
assert.equal(normalizeUserUrl("javascript:alert(1)"), null, "script URLs must be rejected");
assert.equal(normalizeUserUrl("https://user:password@example.com"), null, "credential-bearing URLs must be rejected");
assert.equal(normalizeUserUrl("999.1.2.3"), null, "invalid IP addresses must be rejected");

const helper = fs.readFileSync("assets/user-content-links.js", "utf8");
assert.match(helper, /link\.rel = "noopener noreferrer nofollow ugc"/, "external links must not control the opener or inherit site trust");
assert.match(helper, /link\.target = "_blank"/, "external links should preserve the DanzStak page");
assert.doesNotMatch(helper, /innerHTML/, "user text must never be rendered through HTML parsing");

const feedEnhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const directMessages = fs.readFileSync("assets/direct-messages.js", "utf8");
const chat = fs.readFileSync("assets/chat.js", "utf8");
const profileEditor = fs.readFileSync("assets/profile-editor.js", "utf8");
const sharing = fs.readFileSync("assets/post-sharing.js", "utf8");
assert.match(feedEnhancements, /danzstakLinkifyUserText\?\.\(body\)/, "edited feed posts should be linkified immediately");
assert.match(directMessages, /danzstakRenderUserText\?\.\(text, message\.content\)/, "saved chat messages should render links");
assert.match(chat, /danzstakRenderUserText\?\.\(item,text\)/, "live chat messages should render links");
assert.match(profileEditor, /danzstakLinkifyUserText\?\.\(bioElement\)/, "profile bios should render links");
assert.match(profileEditor, /danzstakRenderUserText\?\.\(text, post\.content/, "profile posts should render links");
assert.match(sharing, /danzstakRenderUserText\?\.\(body, source\.content\)/, "shared post content should render links");

for (const pageName of ["feed.html", "profile.html", "messages.html"]) {
  const page = fs.readFileSync(pageName, "utf8");
  assert.ok(page.includes("user-content-links.js?v=1"), `${pageName} should load the shared link parser`);
  assert.ok(page.includes("user-content-links.css?v=1"), `${pageName} should load shared link styling`);
}

console.log("Clickable user-link checks passed across posts, comments, chats, profiles, edits, and shared content.");
