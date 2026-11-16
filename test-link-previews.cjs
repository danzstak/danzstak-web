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
  assert.ok(!/link-preview-desc|link-preview-title/.test(js), "the card shows the image and the link only");
  console.log("Link preview cleanup checks passed: tracking parameters stripped, image + clean link only.");
}
