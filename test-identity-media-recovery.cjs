"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const identity = fs.readFileSync("assets/identity-media.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const search = fs.readFileSync("assets/people-search.js", "utf8");
const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const profile = fs.readFileSync("assets/profile-editor.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const feedPage = fs.readFileSync("feed.html", "utf8");

assert.match(identity, /fetchFreshProfile\(person\)/, "expired identity media needs a fresh profile lookup");
assert.match(identity, /member=.+encodeURIComponent\(id\)/, "opaque member ids must be preferred for recovery");
assert.match(identity, /credentials: "include"/, "identity recovery must remain authenticated");
assert.match(identity, /cache: "no-store"/, "recovery must not reuse an expired profile response");
assert.match(identity, /if \(attempted\)/, "a broken replacement URL must not cause an infinite retry loop");
assert.match(identity, /replaceWithInitial\(image, person\)/, "unavailable photos need an accessible visual fallback");
assert.match(identity, /typeof options\.onFailure === "function"/, "callers that preserve an existing portrait need an explicit failure callback");
assert.match(feed, /danzstakIdentityMedia\?\.install/g, "feed social avatars must use identity recovery");
assert.match(feed, /story-create-avatar-pending/, "Dailies must preload a signed portrait before replacing its visible fallback");
assert.match(feed, /currentAvatar\.replaceWith\(dailyImage\)/, "Dailies must swap the portrait only after it loads");
assert.match(feedPage, /danzstakIdentityMedia\?\.install\(image, \{ memberId: authorMemberId, name: author, picture: authorPicture \}\)/, "post author photos must use identity recovery");
assert.ok(feedPage.indexOf("assets/identity-media.js?v=2") < feedPage.indexOf("function createPostElement"), "post author recovery must load before the inline post renderer can run");
assert.match(search, /danzstakIdentityMedia\?\.install\(avatar, person\)/, "member search avatars must recover");
assert.match(messages, /danzstakIdentityMedia\?\.install\(avatar, conversation\)/, "saved-chat avatars must recover");
assert.match(profile, /danzstakIdentityMedia\?\.install\(avatar, friend\)/, "profile friend avatars must recover");
assert.match(worker, /"\/assets\/identity-media\.js"/, "the installable app must cache identity recovery");

for (const page of ["feed.html", "messages.html", "profile.html"]) {
  assert.match(fs.readFileSync(page, "utf8"), /assets\/identity-media\.js\?v=2/, `${page} must load identity recovery`);
}

(async () => {
  let errorHandler;
  let replacedWith;
  let fetches = 0;
  const image = {
    tagName: "IMG",
    className: "friend-avatar",
    src: "https://media.test/expired",
    currentSrc: "https://media.test/expired",
    isConnected: true,
    addEventListener(name, handler) { if (name === "error") errorHandler = handler; },
    replaceWith(node) { replacedWith = node; this.isConnected = false; }
  };
  const window = {};
  const document = { createElement() { return { className: "", textContent: "", setAttribute() {} }; } };
  const context = vm.createContext({
    window, document, AbortController, setTimeout, clearTimeout,
    fetch: async () => ({ ok: true, json: async () => ({ profile: { picture: "https://media.test/fresh" } }) })
  });
  context.fetch = async (...args) => { fetches += 1; return { ok: true, json: async () => ({ profile: { picture: "https://media.test/fresh" } }) }; };
  vm.runInContext(identity, context);
  window.danzstakIdentityMedia.install(image, { memberId: "11111111-1111-1111-1111-111111111111", name: "Sigmund" });
  await errorHandler();
  assert.equal(fetches, 1, "the first image failure should fetch one fresh profile");
  assert.equal(image.src, "https://media.test/fresh", "the recovered signed URL should replace the expired URL");
  await errorHandler();
  assert.equal(fetches, 1, "a failed replacement must not refetch forever");
  assert.equal(replacedWith.textContent, "S", "a second failure should become the member initial");
  console.log("Identity media recovery checks passed across Friends, notifications, comments, search, Tribes, and saved chats.");
})().catch(error => { console.error(error); process.exitCode = 1; });
