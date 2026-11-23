"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
for (const page of ["feed.html", "profile.html"]) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /assets\/link-preview-cards\.js\?v=\d+/, `${page} loads link previews`);
  assert.match(html, /img-src 'self' data: blob: https:/, `${page} allows source preview images over https`);
}
(async () => {
  const { parseHead, safePublicUrl, linkPreview } = await import("./infrastructure/auth-api/link-preview.mjs");
  const head = parseHead('<head><title>x</title><meta property="og:title" content="Deep &amp; Dark Mix"><meta property="og:image" content="/img/cover.jpg"><meta property="og:site_name" content="Mixcloud"></head>', "https://www.mixcloud.com/a/b/");
  assert.equal(head.title, "Deep & Dark Mix");
  assert.equal(head.image, "https://www.mixcloud.com/img/cover.jpg");
  assert.equal(head.site, "Mixcloud");
  const publicDns = async () => [{ address: "93.184.216.34" }];
  assert.equal(await safePublicUrl("http://example.com", publicDns), null, "https only");
  assert.equal(await safePublicUrl("https://localhost/x", publicDns), null);
  assert.equal(await safePublicUrl("https://10.0.0.1/x", publicDns), null);
  assert.equal(await safePublicUrl("https://evil.example/x", async () => [{ address: "169.254.169.254" }]), null, "blocks metadata service (SSRF)");
  const yt = await linkPreview("https://youtu.be/dQw4w9WgXcQ", { resolver: publicDns, fetcher: async () => ({ status: 200, ok: true, headers: new Map([["content-type", "text/html"]]), text: async () => "<head><meta property='og:title' content='Track'></head>" }) });
  assert.equal(yt.title, "Track");
  assert.equal(yt.image, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", "YouTube falls back to its thumbnail");
  assert.equal(yt.video, true);
  console.log("Link preview checks passed: source image/title parsing, https-only, SSRF guard, YouTube thumbnail.");
})().catch(e => { console.error(e); process.exit(1); });
{
  const js = fs.readFileSync("assets/link-preview-cards.js", "utf8");
  const vm = require("node:vm");
  const ctx = { globalThis: {}, document: { readyState: "complete", body: { querySelectorAll: () => [], nodeType: 1, matches: () => false } }, MutationObserver: class { observe() {} }, URL };
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
  const clean = ctx.danzstakCleanUrl;
  assert.equal(clean("https://music.youtube.com/watch?v=1hA_OW9B0CA&si=AXoMHBR7og_"), "https://music.youtube.com/watch?v=1hA_OW9B0CA", "YouTube share tracking removed");
  assert.equal(clean("https://www.facebook.com/x/posts/1?mibextid=abc&fbclid=zz&__cft__[0]=q"), "https://www.facebook.com/x/posts/1", "Facebook tracking removed");
  assert.equal(clean("https://www.mixcloud.com/a/b/?utm_source=clipboard&utm_medium=text"), "https://www.mixcloud.com/a/b/", "utm removed");
  assert.equal(clean("https://youtu.be/abc?t=42&si=x"), "https://youtu.be/abc?t=42", "timestamps kept");
  assert.ok(!/link-preview-desc/.test(js), "the card shows the image, the source title and the clean link — no scraped description");
  console.log("Link preview cleanup checks passed: tracking parameters stripped, image + clean link only.");
}
// Owner 2026-11-23: "Before adding to the epk need to make sure the video is there and playable." oEmbed decides.
(async () => {
  const { linkPreview } = await import("./infrastructure/auth-api/link-preview.mjs");
  const publicDns = async () => [{ address: "93.184.216.34" }];
  const page = { status: 200, ok: true, headers: new Map([["content-type", "text/html"]]), text: async () => "<head><title>- YouTube</title></head>" };
  const answer = status => async target => /oembed/.test(target)
    ? { status, ok: status === 200, json: async () => ({ title: "The Delta (More Machine Than Human)", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" }) }
    : page;
  const ok = await linkPreview("https://www.youtube.com/watch?v=AAAAAAAAAA1", { resolver: publicDns, fetcher: answer(200) });
  assert.equal(ok.playable, true); assert.equal(ok.title, "The Delta (More Machine Than Human)");
  const off = await linkPreview("https://www.youtube.com/watch?v=AAAAAAAAAA2", { resolver: publicDns, fetcher: answer(401) });
  assert.deepEqual([off.playable, off.reason], [false, "embed_off"], "embedding turned off by the video's owner");
  const gone = await linkPreview("https://youtu.be/AAAAAAAAAA3", { resolver: publicDns, fetcher: answer(404) });
  assert.deepEqual([gone.playable, gone.reason, gone.image], [false, "unavailable", ""], "removed or private: no thumbnail of a video that isn't there");
  const vimeo = await linkPreview("https://vimeo.com/123456", { resolver: publicDns, fetcher: answer(403) });
  assert.deepEqual([vimeo.playable, vimeo.reason], [false, "embed_off"], "Vimeo: embedding limited to other domains");
  let calls = 0;
  const down = async target => { if (/oembed/.test(target)) { calls++; throw new Error("network"); } return page; };
  assert.equal((await linkPreview("https://youtu.be/AAAAAAAAAA4", { resolver: publicDns, fetcher: down })).playable, null, "unknown when YouTube can't be reached");
  await linkPreview("https://youtu.be/AAAAAAAAAA4", { resolver: publicDns, fetcher: down });
  assert.equal(calls, 2, "an unknown answer isn't cached");
  const music = await linkPreview("https://example.bandcamp.com/album/x", { resolver: publicDns, fetcher: async () => page });
  assert.equal(music.playable, null, "only YouTube and Vimeo are checked");
  const index = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  assert.match(index, /item\.embed === false \? \{ embed: false \}/, "the EPK keeps a video's embed:false mark");
  console.log("Video check passed: YouTube/Vimeo oEmbed decides playable (200), embedding off (401/403), removed (400/404), unknown on network errors (not cached); EPK keeps embed:false.");
})().catch(e => { console.error(e); process.exit(1); });
