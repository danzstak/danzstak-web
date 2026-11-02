const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const source = fs.readFileSync("assets/people-search.js", "utf8");
assert.match(source, /\/people\?query=/, "search uses the authenticated public-member endpoint");
assert.match(source, /JSON\.stringify\(\{ memberId: id \}\)/, "friend request uses an opaque member ID");
assert.doesNotMatch(source, /JSON\.stringify\(\{ email:/, "member search never submits an account email");
assert.match(source, /danzstakMountPeopleFinder/, "the Friends workspace can mount its own name finder");
assert.match(source, /They do not need to be online/, "the finder explains that offline members are searchable");

function element(tag = "div") {
  return {
    tagName: tag.toUpperCase(), children: [], hidden: false, textContent: "", className: "", disabled: false,
    listeners: {}, setAttribute() {}, append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); },
    replaceChildren(...items) { this.children = items; }, addEventListener(type, fn) { this.listeners[type] = fn; }
  };
}
const created = [], timers = new Map(), requests = [], feedback = [];
let sequence = 0, inputHandler;
const input = element("input");
input.value = "";
input.addEventListener = (_, fn) => { inputHandler = fn; };
const feed = element();
feed.insertAdjacentElement = () => {};
const authors = [{ href: "https://danzstak.com/profile.html?member=11111111-1111-1111-1111-111111111111", textContent: "Alice" }];
const context = vm.createContext({
  document: {
    querySelector: () => input, getElementById: () => feed,
    createElement: tag => { const node = element(tag); created.push(node); return node; },
    querySelectorAll: () => authors
  },
  window: { dispatchEvent() {}, addEventListener() {}, danzstakShowFeedback: message => feedback.push(message) },
  CustomEvent: class {}, URL, AbortController, encodeURIComponent,
  location: { origin: "https://danzstak.com", href: "https://danzstak.com/feed.html" },
  setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
  fetch(url, options = {}) {
    requests.push({ url, options });
    if (url.includes("/people?query=")) return Promise.resolve({ ok: true, json: async () => ({ users: [
      { memberId: "22222222-2222-2222-2222-222222222222", name: "Liana", handle: "liana", friendStatus: "none", online: false },
      { memberId: "33333333-3333-3333-3333-333333333333", name: "Liana Friend", friendStatus: "friends", online: true }
    ] }) });
    return Promise.resolve({ ok: true, json: async () => ({ requested: true }) });
  }
});
vm.runInContext(source, context);

(async () => {
  input.value = "liana";
  inputHandler();
  const debounce = [...timers.values()].find(item => item.delay === 250);
  assert.ok(debounce, "search is debounced");
  await debounce.fn();
  await new Promise(resolve => setImmediate(resolve));
  const list = created.find(node => node.className === "user-search-list");
  assert.equal(list.children.length, 2, "offline strangers and existing friends are both listed");
  const stranger = list.children[0];
  assert.equal(stranger.children[1].children[0].textContent, "Liana");
  assert.equal(stranger.children[2].textContent, "Add Friend");
  assert.equal(stranger.children[1].children[0].tagName, "A", "a discoverable member can be opened before sending a friend request");
  assert.match(stranger.children[1].children[0].href, /profile\.html\?member=/, "the stranger profile route uses only the opaque member ID");
  await stranger.children[2].listeners.click();
  const request = requests.find(item => item.url.endsWith("/friends/request"));
  assert.deepEqual(JSON.parse(request.options.body), { memberId: "22222222-2222-2222-2222-222222222222" });
  assert.equal(stranger.children[2].textContent, "Requested");
  assert.match(feedback[0], /Friend request sent to Liana/);
  const friend = list.children[1];
  assert.equal(friend.children[1].children[0].tagName, "A");
  assert.match(friend.children[1].children[0].href, /profile\.html\?member=/);
  input.value = "";
  inputHandler();
  const section = created.find(node => node.className === "panel user-search-results");
  assert.equal(section.hidden, true);
  console.log("People search checks passed: public offline discovery, opaque friend requests, relationship actions, profile links, feedback, and clearing.");
})().catch(error => { console.error(error); process.exitCode = 1; });
