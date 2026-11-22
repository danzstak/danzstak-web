"use strict";
// Queue 5a2: Albums row and album pages on the profile Photos tab (owner and visitor), new album, upload many.
//   python3 -m http.server 8132   (repo root), then: node browser-checks/profile-albums.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = (process.env.DANZSTAK_WIDTHS || "320,360,390,430,768,1024").split(",").map(Number);
const output = path.resolve("docs/screenshots/profile-albums");
fs.mkdirSync(output, { recursive: true });
const ME = "00000000-0000-4000-8000-000000000001", MARA = "00000000-0000-4000-8000-000000000002";
const pic = color => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${color}"/></svg>`)}`;
const albumId = n => String(n).padStart(32, "a");
const BUCKET = "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com";
const png = path.join(os.tmpdir(), "danzstak-album-photo.png");
fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL ? { channel: process.env.DANZSTAK_BROWSER_CHANNEL } : {});
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", reducedMotion: "reduce", deviceScaleFactor: 1 });
      const page = await context.newPage(), errors = [], calls = [];
      let albums = [
        { albumId: albumId(1), name: "Hellfest 2026", date: "2026-06-21", place: "Clisson", visibility: "public", photoCount: 3, videoCount: 1, cover: { url: pic("#c0392b"), mediaType: "image" } },
        { albumId: albumId(2), name: "Mike & Ana's wedding", date: "", place: "", visibility: "friends", photoCount: 2, videoCount: 0, cover: { url: pic("#1f4e99"), mediaType: "image" } }
      ];
      const uploaded = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${BUCKET}/**`, route => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "PUT", "access-control-allow-headers": "content-type" }, body: "" }));
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request(), url = new URL(request.url()), method = request.method(), body = request.postData() ? request.postDataJSON() : null;
        calls.push(`${method} ${url.pathname}`);
        const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
        const visitor = url.searchParams.get("member") === MARA;
        if (url.pathname === "/auth/session") return reply({ authenticated: true, user: { sub: ME } });
        if (url.pathname === "/profiles") return reply(visitor ? { memberId: MARA, isOwner: false, name: "Mara Voss", handle: "maravoss" } : { memberId: ME, isOwner: true, name: "Sam Ortiz", handle: "samortiz" });
        if (url.pathname === "/secure-posts") return reply({ posts: [1, 2, 3, 4].map(n => ({ postId: `p${n}`, userId: visitor ? MARA : ME, isOwner: !visitor, authorId: visitor ? MARA : ME, content: `Post ${n}`, createdAt: `2026-11-1${n}T10:00:00Z`, mediaUrl: pic(["#16794a", "#8a3a0c", "#5d5d5d", "#ef6c20"][n - 1]), mediaType: "image", audience: "public" })) });
        if (url.pathname === "/albums" && method === "GET") return reply({ isOwner: !visitor, albums: visitor ? albums.filter(album => album.visibility === "public") : albums });
        if (url.pathname === "/albums" && method === "POST") { const album = { albumId: albumId(3), ...body, photoCount: 0, videoCount: 0, cover: null }; albums = [album, ...albums]; return reply({ album }, 201); }
        const albumMatch = url.pathname.match(/^\/albums\/([a-f0-9]{32})(\/items)?$/);
        if (albumMatch && method === "GET") { const album = albums.find(item => item.albumId === albumMatch[1]); return reply({ isOwner: !visitor, album, items: albumMatch[1] === albumId(1) ? [1, 2, 3].map(n => ({ itemId: String(n).padStart(32, "c"), mediaType: "image", url: pic(["#c0392b", "#e5452e", "#121110"][n - 1]), createdAt: "2026-06-21T20:00:00Z" })).concat([{ itemId: "d".repeat(32), mediaType: "video", url: pic("#000"), createdAt: "2026-06-21T21:00:00Z" }]) : uploaded }); }
        if (albumMatch && albumMatch[2] && method === "POST") { for (const item of body.items) uploaded.push({ itemId: String(uploaded.length).padStart(32, "e"), mediaType: item.mediaType, url: pic("#ffc93c"), createdAt: "2026-11-18T22:00:00Z" }); albums[0].photoCount = uploaded.length; return reply({ added: body.items }); }
        if (url.pathname === "/stories" && method === "POST" && body?.contentType) { assert.equal(body.purpose, "post"); return reply({ uploadUrl: `${BUCKET}/upload-${calls.length}`, mediaKey: `users/${"a".repeat(24)}/00000000-0000-4000-8000-0000000001${String(calls.length).padStart(2, "0")}.png`, mediaType: "image" }); }
        return reply({});
      });

      // Owner: Albums row on the Photos tab with "All photos", the albums and "+ New album".
      await page.goto(`${origin}/profile.html#photos`, { waitUntil: "domcontentloaded" });
      const row = page.locator(".profile-albums");
      await row.waitFor();
      assert.deepEqual(await row.locator(".profile-album-tile strong").allInnerTexts(), ["All photos", "Hellfest 2026", "Mike & Ana's wedding"]);
      assert.match(await row.locator(".profile-album-tile small").nth(2).innerText(), /2 photos · Friends/, "the owner sees who can see each album");
      await row.getByRole("button", { name: /Hellfest 2026/ }).click();
      await page.locator(".profile-album-page h3", { hasText: "Hellfest 2026" }).waitFor();
      assert.match(await page.locator(".profile-album-title p").innerText(), /Clisson · Public/);
      assert.equal(await page.locator(".profile-album-page .profile-photo-tile").count(), 3, "the album's photos in the same grid");
      assert.match(await page.locator(".profile-album-note").innerText(), /1 video from this album is on the Videos tab/);
      assert.equal(await page.locator("[data-album-hidden]").first().isHidden(), true, "the All photos grid steps aside");
      await page.screenshot({ path: path.join(output, `owner-album-${width}.png`) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `${width}px: no horizontal overflow (${overflow})`);
      for (const target of await page.locator(".profile-albums-new, .profile-album-actions button").all()) assert.ok((await target.boundingBox()).height >= 44, `${width}px: 44px targets`);

      // New album, then upload two photos at once.
      await row.getByRole("button", { name: "+ New album" }).click();
      const dialog = page.locator(".profile-album-dialog");
      await dialog.getByLabel("Name").fill("Basement show");
      await dialog.getByLabel("Who can see it").selectOption("private");
      await dialog.getByRole("button", { name: "Create album" }).click();
      await page.locator(".profile-album-page h3", { hasText: "Basement show" }).waitFor();
      assert.match(await page.locator(".profile-album-title p").innerText(), /Only me/);
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Add photos" }).click();
      await (await chooser).setFiles([png, png]);
      await page.locator(".profile-album-status", { hasText: "2 files added to Basement show." }).waitFor();
      await page.locator(".profile-album-page .profile-photo-tile").nth(1).waitFor();
      assert.equal(await page.locator(".profile-album-page .profile-photo-tile").count(), 2, "both uploads show in the album");
      await page.locator(".profile-albums .profile-album-tile", { hasText: "All photos" }).click();
      assert.equal(await page.locator(".profile-album-page").count(), 0);
      assert.equal(await page.locator("[data-album-hidden]").count(), 0, "All photos brings the grid back");

      // Visitor: only albums they may see, no owner buttons.
      await page.goto(`${origin}/profile.html?member=${MARA}#photos`, { waitUntil: "domcontentloaded" });
      await page.locator(".profile-albums").waitFor();
      assert.deepEqual(await page.locator(".profile-album-tile strong").allInnerTexts(), ["All photos", "Hellfest 2026"]);
      assert.equal(await page.locator(".profile-albums-new").count(), 0);
      await page.locator(".profile-album-tile", { hasText: "Hellfest 2026" }).click();
      await page.locator(".profile-album-page h3").waitFor();
      assert.equal(await page.locator(".profile-album-actions").count(), 0, "visitors never get owner actions");
      await page.screenshot({ path: path.join(output, `visitor-${width}.png`) });
      assert.deepEqual(errors, [], `${width}px: no page errors`);
      await context.close();
      console.log(`ok ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
