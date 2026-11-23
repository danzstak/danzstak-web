"use strict";
// Owner 2026-11-17: the profile Friends tab shows requests you sent (and requests waiting for you).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
assert.match(template, /FilterExpression:'#s IN \(:friends, :incoming, :outgoing\)'/, "GET /friends must read pending requests, not only accepted friends");
assert.match(template, /return json\(200,\{friends:pick\('friends'\),incoming:pick\('incoming'\),outgoing:pick\('outgoing'\)\}\)/, "GET /friends returns friends, incoming and outgoing separately");
assert.doesNotMatch(template, /':blocked'[^\n]*incoming:pick/, "blocked members never appear in the request lists");

const source = fs.readFileSync("assets/profile-editor.js", "utf8");
const start = source.indexOf("function appendProfileFriendRequests("), end = source.indexOf("let profileShop = null;", start);
assert.ok(start > 0 && end > start);
function node(tag) {
  return { tag, children: [], dataset: {}, attrs: {}, textContent: "", className: "",
    append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    addEventListener(type, handler) { this["on" + type] = handler; }, querySelectorAll() { return this.children.flatMap(c => c.tag === "button" ? [c] : []); } };
}
const tabMessage = node("div");
const requests = [];
const context = vm.createContext({ tabMessage, document: { createElement: node }, window: {}, profileApi: "https://api.danzstak.com",
  profileFetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({}) }; },
  loadProfileFriends: () => { context.reloaded = true; } });
vm.runInContext(source.slice(start, end), context);
const id = n => `0000000${n}-0000-4000-8000-000000000000`;
context.appendProfileFriendRequests([{ memberId: id(1), name: "Zed", email: "zed@example.com" }, { memberId: id(2), name: "Ana", email: "ana@example.com" }], "outgoing");
const texts = n => [n.textContent, ...n.children.flatMap(texts)];
const [sentHeading, sentGrid] = tabMessage.children;
assert.equal(sentHeading.textContent, "Requests sent · 2");
assert.deepEqual(sentGrid.children.map(card => card.children[0].children[1].children[0].textContent), ["Ana", "Zed"], "sorted by name");
assert.ok(texts(sentGrid).includes("Request sent"), "each sent request is labelled");
assert.equal(sentGrid.children[0].children.length, 1, "sent requests have no accept/decline buttons");
assert.equal(sentGrid.children[0].children[0].href, "profile.html?member=" + encodeURIComponent(id(2)), "a sent request links to that profile");

context.appendProfileFriendRequests([{ memberId: id(3), name: "Mary", email: "mary@example.com" }, { memberId: "bad", name: "x" }], "incoming");
const [inHeading, inGrid] = tabMessage.children.slice(2);
assert.equal(inHeading.textContent, "Friend requests · 1", "invalid member ids are dropped");
const accept = inGrid.children[0].children[1].children[0];
assert.equal(accept.getAttribute("aria-label"), "Accept: Mary");
(async () => {
  await accept.onclick();
  assert.deepEqual(requests, [{ url: "https://api.danzstak.com/friends/respond", body: { email: "mary@example.com", accept: true } }]);
  assert.equal(context.reloaded, true, "the Friends tab refreshes after answering");
  context.appendProfileFriendRequests([], "outgoing");
  assert.equal(tabMessage.children.length, 4, "no empty section when nothing is pending");
  console.log("Profile friend request checks passed: GET /friends returns pending requests; Friends tab shows requests sent and incoming requests with accept/decline.");
})().catch(error => { console.error(error); process.exitCode = 1; });
