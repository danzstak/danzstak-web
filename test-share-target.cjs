"use strict";
// Task 32 (owner 2026-11-18): share a phone photo straight to DanzStak. Runs the real service worker's share handler in
// a sandbox with an in-memory cache. Real browser: browser-checks/share-target.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = file => fs.readFileSync(file, "utf8");
const ORIGIN = "https://danzstak.com";
const manifest = JSON.parse(read("manifest.webmanifest")), worker = read("service-worker.js"), receive = read("assets/share-receive.js"), feed = read("feed.html");

// Manifest: in the Share menu for photos and videos Mix can post; never audio, no HEIC (the posts API refuses it).
assert.deepEqual(Object.keys(manifest.share_target).sort(), ["action", "enctype", "method", "params"]);
assert.equal(manifest.share_target.action, "/share-target"); assert.equal(manifest.share_target.method, "POST"); assert.equal(manifest.share_target.enctype, "multipart/form-data");
const accept = manifest.share_target.params.files[0].accept;
assert.equal(manifest.share_target.params.files[0].name, "media");
assert.ok(accept.every(type => /^(image|video)\//.test(type)), "photos and videos only, never audio (CLAUDE.md: no music files)");
assert.deepEqual([...accept].sort(), ["image/gif", "image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"]);
const postTypes = read("infrastructure/call-signaling/template.yaml").match(/const mediaTypes=\{([^}]*)\}/)[1];
for (const type of accept) assert.ok(postTypes.includes(`'${type}'`), `${type} can actually be posted`);

function sandbox(now = Date.UTC(2026, 10, 19, 1, 0, 0)) {
  const stores = new Map(), handlers = {};
  const key = request => new URL(typeof request === "string" ? request : request.url, ORIGIN).href;
  const caches = {
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return { put: async (request, response) => { store.set(key(request), response); }, match: async request => store.get(key(request)), delete: async request => store.delete(key(request)),
        keys: async () => [...store.keys()].map(url => new Request(url)), addAll: async () => {} };
    },
    keys: async () => [...stores.keys()], delete: async name => stores.delete(name), match: async () => undefined
  };
  class SwResponse extends Response { static redirect(url, status) { return Response.redirect(new URL(url, ORIGIN), status); } }
  const clock = { now };
  const DateShim = class extends Date { static now() { return clock.now; } };
  const self = { location: { origin: ORIGIN }, addEventListener: (name, handler) => { handlers[name] = handler; }, clients: { claim: async () => {} }, registration: {} };
  vm.runInNewContext(worker, { self, caches, URL, Request, Response: SwResponse, FormData, File, Blob, Date: DateShim, Math, JSON, Number, String, Boolean, Promise, encodeURIComponent, fetch: async () => { throw new Error("offline"); } });
  async function share(fields) {
    const form = new FormData();
    for (const [name, value] of fields) form.append(name, value);
    let pending;
    handlers.fetch({ request: new Request(`${ORIGIN}/share-target`, { method: "POST", body: form }), respondWith: promise => { pending = promise; } });
    assert.ok(pending, "the worker answers the share POST");
    return pending;
  }
  const entries = async () => (stores.get("danzstak-share") ? [...stores.get("danzstak-share").keys()] : []);
  return { share, entries, stores, handlers, clock };
}
const png = name => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, { type: "image/png" });

(async () => {
  // A photo + text: kept for the composer, then Mix opens.
  let box = sandbox();
  let response = await box.share([["media", png("IMG_2041.png")], ["text", "Last night at the Central"], ["title", "Last night at the Central"]]);
  assert.equal(response.status, 303);
  const target = new URL(response.headers.get("location"));
  assert.equal(target.pathname, "/feed.html");
  const id = target.searchParams.get("share");
  assert.match(id, /^[a-z0-9]{6,24}$/, "share id the page accepts");
  const kept = await box.entries();
  assert.equal(kept.length, 2);
  const store = box.stores.get("danzstak-share");
  const file = store.get(kept.find(url => new URL(url).pathname === `/share-target/${id}/file/0`));
  assert.equal(file.headers.get("content-type"), "image/png");
  assert.equal(decodeURIComponent(file.headers.get("x-file-name")), "IMG_2041.png");
  const meta = await store.get(kept.find(url => new URL(url).pathname === `/share-target/${id}/meta`)).json();
  assert.deepEqual(meta, { text: "Last night at the Central", files: 1, left: 0, rejected: 0 }, "duplicate title/text collapse into one");

  // Audio and HEIC are refused; several photos all go in one post (up to 20, owner 2026-11-22), in the order shared.
  box = sandbox();
  response = await box.share([["media", new File([new Uint8Array(4)], "track.mp3", { type: "audio/mpeg" })], ["media", new File([new Uint8Array(4)], "IMG.heic", { type: "image/heic" })]]);
  let shareId = new URL(response.headers.get("location")).searchParams.get("share");
  let urls = await box.entries();
  assert.equal(urls.filter(url => url.includes("/file")).length, 0, "audio is never stored (no music files)");
  assert.deepEqual(await box.stores.get("danzstak-share").get(urls.find(url => url.includes(`/${shareId}/meta`))).json(), { text: "", files: 0, left: 0, rejected: 2 });
  box = sandbox();
  response = await box.share([["media", png("one.png")], ["media", png("two.png")], ["media", new File([new Uint8Array(4)], "voice.m4a", { type: "audio/mp4" })]]);
  shareId = new URL(response.headers.get("location")).searchParams.get("share");
  urls = await box.entries();
  const names = urls.filter(url => url.includes("/file/")).sort().map(url => decodeURIComponent(box.stores.get("danzstak-share").get(url).headers.get("x-file-name")));
  assert.deepEqual(names, ["one.png", "two.png"], "both photos kept, in order");
  assert.deepEqual(await box.stores.get("danzstak-share").get(urls.find(url => url.includes(`/${shareId}/meta`))).json(), { text: "", files: 2, left: 0, rejected: 1 });
  // 22 photos: the first 20 go in (a post's limit); a video shared with photos waits for its own post.
  box = sandbox();
  const many = Array.from({ length: 22 }, (_, i) => ["media", png(`p${String(i).padStart(2, "0")}.png`)]);
  response = await box.share([...many, ["media", new File([new Uint8Array(4)], "clip.mp4", { type: "video/mp4" })]]);
  shareId = new URL(response.headers.get("location")).searchParams.get("share");
  urls = await box.entries();
  const fileUrls = urls.filter(url => url.includes("/file/"));
  assert.equal(fileUrls.length, 20);
  assert.ok(fileUrls.every(url => box.stores.get("danzstak-share").get(url).headers.get("content-type") === "image/png"), "photos win over the video");
  assert.deepEqual(await box.stores.get("danzstak-share").get(urls.find(url => url.includes(`/${shareId}/meta`))).json(), { text: "", files: 20, left: 3, rejected: 0 });
  // One video alone goes in as the post's video; two videos keep the first.
  box = sandbox();
  response = await box.share([["media", new File([new Uint8Array(4)], "a.mp4", { type: "video/mp4" })], ["media", new File([new Uint8Array(4)], "b.mov", { type: "video/quicktime" })]]);
  shareId = new URL(response.headers.get("location")).searchParams.get("share");
  urls = await box.entries();
  assert.equal(urls.filter(url => url.includes("/file/")).length, 1);
  assert.deepEqual(await box.stores.get("danzstak-share").get(urls.find(url => url.includes(`/${shareId}/meta`))).json(), { text: "", files: 1, left: 1, rejected: 0 });

  // Cleanup: anything older than 10 minutes goes with the next share and when a new worker activates; the share cache
  // itself survives an update (a share in progress is not lost), other old caches are deleted.
  box = sandbox();
  await box.share([["media", png("old.png")]]);
  box.clock.now += 11 * 60 * 1000;
  await box.share([["media", png("new.png")]]);
  urls = await box.entries();
  assert.equal(urls.length, 2, "the 11-minute-old share was deleted");
  assert.ok(urls.every(url => Number(new URL(url).searchParams.get("at")) === box.clock.now));
  box.stores.set("danzstak-shell-v1", new Map());
  box.clock.now += 5 * 60 * 1000;
  let activated;
  box.handlers.activate({ waitUntil: promise => { activated = promise; } });
  await activated;
  assert.equal(box.stores.has("danzstak-shell-v1"), false, "old shell caches are still cleared");
  assert.equal((await box.entries()).length, 2, "a 5-minute-old share survives a service worker update");
  box.clock.now += 6 * 60 * 1000;
  box.handlers.activate({ waitUntil: promise => { activated = promise; } });
  await activated;
  assert.equal((await box.entries()).length, 0, "expired shares are dropped on activate");

  // Bad body: Mix opens and says the share failed.
  box = sandbox();
  let failed;
  box.handlers.fetch({ request: new Request(`${ORIGIN}/share-target`, { method: "POST", body: "not a form", headers: { "content-type": "multipart/form-data; boundary=x" } }), respondWith: promise => { failed = promise; } });
  assert.equal(new URL((await failed).headers.get("location")).search, "?share=failed");
  // Only a same-origin POST to /share-target is handled; other POSTs pass through.
  let touched = false;
  box.handlers.fetch({ request: new Request(`${ORIGIN}/feed.html`, { method: "POST", body: "x" }), respondWith: () => { touched = true; } });
  assert.equal(touched, false);

  // Mix side: composer hand-off, nothing posts on its own, signed-out shares wait, the copy is removed once attached.
  assert.match(feed, /<script src="assets\/share-receive\.js\?v=\d+" defer><\/script>/);
  assert.ok(worker.includes('"/assets/share-receive.js"'), "cached offline");
  assert.doesNotMatch(receive, /publish|\.click\(\)|secure-posts|submit/i, "nothing posts on its own: the member taps Post");
  assert.match(receive, /if \(session === false\) \{ say\("Sign in to post what you shared\. It waits on this phone for 10 minutes\.", true\); return; \}/);
  assert.match(receive, /for \(const key of keys\) await cache\.delete\(key\); \/\/ it is in the composer now/);
  assert.match(receive, /sessionStorage/); assert.doesNotMatch(receive, /localStorage/, "a pending share lives only in this tab");
  assert.match(receive, /input\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/, "the composer's own checks run on the shared file");
  // media-scale.js replays a photo's change event later with a smaller copy: wait for the composer, match by name.
  assert.match(receive, /await waitUntil\(\(\) => window\.danzstakSelectedMedia\?\.file\?\.name === first\)/, "waits for the composer after photo scaling");
  assert.match(receive, /for \(const file of files\) transfer\.items\.add\(file\)/, "every shared photo goes to the composer's own picker");
  // Log out / account switch: the share cache goes with the media cache.
  assert.match(worker, /CLEAR_MEDIA_CACHE"\) event\.waitUntil\(Promise\.all\(\[caches\.delete\(MEDIA_CACHE\), caches\.delete\(SHARE_CACHE\)\]\)\)/);
  assert.doesNotMatch(receive, /danzstakSelectedMedia\?\.file !== file/, "never compares the original file object (media-scale.js swaps it)");
  console.log("Share target checks passed: manifest share_target (photos/videos Mix can post, no audio), files kept for the composer, audio and HEIC refused, several photos in one post (up to 20), photos before a video, 10-minute cleanup that survives updates, failures handled, composer hand-off waits for sign-in and never posts by itself.");
})().catch(error => { console.error(error); process.exitCode = 1; });
