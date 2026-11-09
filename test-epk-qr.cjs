"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const html = fs.readFileSync("epk.html", "utf8");
const client = fs.readFileSync("assets/epk.js", "utf8");
const css = fs.readFileSync("assets/epk.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
const packageJson = JSON.parse(fs.readFileSync("infrastructure/auth-api/package.json", "utf8"));

assert.match(html, /id="showEpkQr"[^>]*>QR code</);
assert.match(html, /<dialog id="epkQrDialog"[^>]*aria-labelledby="epkQrTitle"/);
assert.match(html, /id="epkQrImage"[^>]*alt="QR code for this EPK link"/);
assert.match(html, /id="downloadEpkQr"[^>]*download=/);
assert.match(html, /assets\/epk\.css\?v=10/);
assert.match(html, /assets\/epk\.js\?v=22/);
assert.match(client, /new URL\("https:\/\/danzstak\.com\/epk\.html"\)/);
assert.match(client, /\/epk\/qr[^\n]*method:"POST"/);
assert.match(client, /new Blob\(\[svg\], \{ type:"image\/svg\+xml" \}\)/);
assert.doesNotMatch(client, /epkQr[^\n]*innerHTML/i);
assert.match(css, /\.epk-qr-dialog button,.epk-qr-download\{min-height:44px/);
assert.equal(packageJson.dependencies.qrcode, "1.5.4");
assert.match(worker, /danzstak-shell-v791/);
assert.match(deploy, /POST \/epk\/qr/, "the guarded API deployment must expose the QR route");

(async () => {
  const api = await import(pathToFileURL(`${process.cwd()}/infrastructure/auth-api/index.mjs`).href);
  const token = "a".repeat(64);
  const valid = [
    "https://danzstak.com/epk.html?id=night-circuit",
    `https://danzstak.com/epk.html?share=night-circuit#token=${token}`,
    `https://danzstak.com/epk.html?outreach=${"b".repeat(32)}#token=${token}`
  ];
  const invalid = [
    "http://danzstak.com/epk.html?id=night-circuit",
    "https://www.danzstak.com/epk.html?id=night-circuit",
    "https://danzstak.com/feed.html?id=night-circuit",
    "https://danzstak.com/epk.html?id=night-circuit&next=https://example.com",
    `https://danzstak.com/epk.html?id=night-circuit#token=${token}`,
    "https://danzstak.com/epk.html?share=night-circuit",
    `https://danzstak.com/epk.html?share=night-circuit#token=${token}&extra=1`,
    "javascript:alert(1)"
  ];
  valid.forEach(value => assert.equal(api.validEpkQrUrl(value), true, value));
  invalid.forEach(value => assert.equal(api.validEpkQrUrl(value), false, value));

  const event = url => ({ rawPath:"/epk/qr", requestContext:{ http:{ method:"POST" } }, headers:{ origin:"https://danzstak.com" }, body:JSON.stringify({ url }) });
  const success = await api.handler(event(valid[1]));
  assert.equal(success.statusCode, 200);
  assert.match(success.headers["content-type"], /^image\/svg\+xml/);
  assert.equal(success.headers["cache-control"], "no-store, private");
  assert.match(success.body, /^<svg[\s>]/);
  assert.match(success.body, /<path/);
  const rejected = await api.handler(event("https://example.com/epk.html?id=bad"));
  assert.equal(rejected.statusCode, 400);
  const foreignOrigin = await api.handler({ ...event(valid[0]), headers:{ origin:"https://example.com" } });
  assert.equal(foreignOrigin.statusCode, 404);
  console.log("EPK QR checks passed: exact-link validation, private token preservation, secure SVG generation, accessible download UI, and PWA refresh.");
})().catch(error => { console.error(error); process.exitCode = 1; });
