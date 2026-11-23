"use strict";
// Task 38 step 3: pages allow the media CDN host, the installed app keeps CDN photos by path (signed query ignored),
// capped and cleared on log out. Runs the real service-worker.js in a sandbox with fake caches/fetch.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const CDN = "https://dk7kawr758jtd.cloudfront.net", BUCKET = "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com";
for (const page of ["answer.html", "event.html", "feed.html", "messages.html", "profile.html", "store.html"]) {
  const csp = fs.readFileSync(page, "utf8").match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || "";
  for (const directive of csp.split(";").map(part => part.trim()).filter(part => part.includes(BUCKET))) assert.ok(directive.includes(CDN), `${page}: ${directive.split(" ")[0]} allows the media CDN wherever it allows the bucket`);
}
assert.match(fs.readFileSync("assets/logout.js", "utf8"), /postMessage\(\{ type: "CLEAR_MEDIA_CACHE" \}\)/, "log out drops CDN photos kept on the phone");
(async () => {
  const stores = new Map(), listeners = {};
  const store = name => { if (!stores.has(name)) stores.set(name, new Map()); const map = stores.get(name); return { match: async key => map.get(String(key.url || key)), put: async (key, value) => { map.set(String(key.url || key), value); }, keys: async () => [...map.keys()], delete: async key => map.delete(String(key)) }; };
  let fetches = 0;
  const sandbox = { self: { addEventListener: (type, fn) => { listeners[type] = fn; }, location: { origin: "https://danzstak.com" }, clients: { claim() {} }, registration: {} },
    caches: { open: async name => store(name), delete: async name => stores.delete(name), keys: async () => [...stores.keys()], match: async () => undefined },
    fetch: async request => { fetches++; return new Response(new Blob(["img"]), { status: 200, headers: { "content-type": "image/jpeg" } }); },
    Headers, Response, Blob, URL, Date, Promise, Number, String, console, setTimeout };
  vm.runInNewContext(fs.readFileSync("service-worker.js", "utf8"), sandbox);
  const respond = async url => { let promise; listeners.fetch({ request: { url, method: "GET", mode: "no-cors", destination: "image" }, respondWith: value => { promise = value; } }); return promise; };
  await respond(`${CDN}/posts/a.jpg?Expires=1&Signature=x&Key-Pair-Id=K1`);
  await respond(`${CDN}/posts/a.jpg?Expires=2&Signature=y&Key-Pair-Id=K1`);
  assert.equal(fetches, 1, "the same photo with a new signature comes from the phone, not the network");
  assert.ok(stores.get("danzstak-media-v1")?.has(`${CDN}/posts/a.jpg`), "kept by path only");
  let waited; listeners.message({ data: { type: "CLEAR_MEDIA_CACHE" }, waitUntil: value => { waited = value; } }); await waited;
  assert.equal(stores.has("danzstak-media-v1"), false, "log out clears the CDN photos");
  let other; listeners.fetch({ request: { url: "https://evil.example/x.jpg", method: "GET", destination: "image" }, respondWith: value => { other = value; } });
  assert.equal(other, undefined, "other hosts are never cached by the app");
  console.log("Media CDN page checks passed: CSP allows the CDN, photos kept by path across signature windows, cleared on log out.");
})().catch(error => { console.error(error); process.exit(1); });
