"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const start = source.indexOf("function renderOnlineFriendList(");
const end = source.indexOf("\nasync function groupFetch", start);
assert.ok(start >= 0 && end > start, "the online-friend renderer must remain independently testable");

function element(tagName) {
  return {
    tagName: String(tagName).toUpperCase(),
    children: [],
    className: "",
    textContent: "",
    attributes: {},
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}

const context = vm.createContext({
  document: { createElement: element },
  feedTranslate: value => value,
  feedFormat: (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), key),
  encodeURIComponent
});
vm.runInContext(source.slice(start, end), context);

const unavailable = element("div");
context.renderOnlineFriendList(unavailable, [], false);
assert.equal(unavailable.children[0].attributes.role, "status");
assert.match(unavailable.children[0].textContent, /unavailable/i,
  "a failed presence request must not claim that nobody is online");

const empty = element("div");
context.renderOnlineFriendList(empty, [], true);
assert.match(empty.children[0].textContent, /No other users are online/i,
  "a successful empty presence response should retain the honest empty state");

const online = element("div");
context.renderOnlineFriendList(online, [{
  memberId: "11111111-1111-4111-a111-111111111111",
  name: "Liana",
  online: true,
  friendStatus: "outgoing"
}], true);
assert.equal(online.children.length, 1);
assert.equal(online.children[0].children[1].textContent, "Liana");
assert.equal(online.children[0].children[2].textContent, "Requested");

const workspace = source.slice(source.indexOf('if (name === "Friends")'), source.indexOf('if (["Photos", "Videos"]'));
assert.match(workspace,
  /presenceAvailable = directoryResponse\?\.ok === true;[\s\S]*directoryUsers = \(await directoryResponse\.json\(\)\)\.users \|\| \[\];[\s\S]*if \(!friendsResponse\?\.ok\)/,
  "the unified directory must preserve a truthful presence result before handling a friends-list failure");
assert.match(workspace, /Friends could not be loaded\.[\s\S]*Retry friends/,
  "the accepted-friends failure needs its own clear retry action");

console.log("Friends workspace resilience checks passed: online discovery and accepted friends fail independently with truthful status.");
