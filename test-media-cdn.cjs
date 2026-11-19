"use strict";
// Task 38 (owner 2026-11-19 "build the CDN"): CloudFront signed media URLs that stay the same for a 6-hour block (so they
// cache), verify with the public key, fall back to S3 until configured; deletes drop the CDN copy; template wiring.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { generateKeyPairSync, createVerify } = require("node:crypto");
(async () => {
  const { windowExpiry, signCloudFrontUrl, createMediaCdn, createMediaInvalidator } = await import("./infrastructure/auth-api/media-cdn.mjs");
  // Same URL for every request in a block, at least an hour of life left.
  const block = 6 * 3600, start = 1_800_000_000 - (1_800_000_000 % block);
  assert.equal(windowExpiry(start + 10), windowExpiry(start + 3600 * 4), "same expiry within one block → same URL → cache hit");
  for (const now of [start, start + 1, start + block - 1, start + block - 3599]) assert.ok(windowExpiry(now) - now >= 3600, "never less than an hour of life");
  assert.ok(windowExpiry(start + block - 10) - (start + block - 10) <= block + 3600, "never more than one block + an hour");
  // Signature verifies against the public key (canned policy, CloudFront base64).
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const url = new URL(signCloudFrontUrl({ domain: "d123abc.cloudfront.net", key: "posts/u 1/photo (1).jpg", keyPairId: "K2ABCDEFGH", privateKey, expires: 1800021600 }));
  assert.equal(url.pathname, "/posts/u%201/photo%20%281%29.jpg", "key path encoded");
  assert.equal(url.searchParams.get("Key-Pair-Id"), "K2ABCDEFGH");
  const signature = Buffer.from(url.searchParams.get("Signature").replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64");
  const policy = JSON.stringify({ Statement: [{ Resource: `https://d123abc.cloudfront.net${url.pathname}`, Condition: { DateLessThan: { "AWS:EpochTime": 1800021600 } } }] });
  assert.ok(createVerify("RSA-SHA1").update(policy).verify(publicKey, signature), "CloudFront can verify the signature");
  // Fail-safe and secret handling.
  let loads = 0;
  const off = createMediaCdn({ domain: "", loadSecret: async () => { loads++; return "{}"; } });
  assert.equal(await off.ready(), false); assert.equal(off.url("posts/a.jpg"), "", "no domain → S3 URLs"); assert.equal(loads, 0);
  const broken = createMediaCdn({ domain: "d1.cloudfront.net", loadSecret: async () => { throw Object.assign(new Error("x"), { name: "ResourceNotFoundException" }); }, clock: () => 1e12 });
  assert.equal(await broken.ready(), false); assert.equal(broken.url("posts/a.jpg"), "", "missing secret → S3 URLs");
  assert.equal(createMediaCdn({ domain: "evil.example.com", loadSecret: async () => "{}" }).domain, "", "only CloudFront or danzstak.com hosts");
  let now = 1_800_000_000 * 1000;
  const on = createMediaCdn({ domain: "d1.cloudfront.net", loadSecret: async () => { loads++; return JSON.stringify({ keyPairId: "K2ABCDEFGH", privateKey }); }, clock: () => now });
  assert.equal(await on.ready(), true); await on.ready(); assert.equal(loads, 1, "secret read once per container");
  const first = on.url("posts/a.jpg"); now += 60_000;
  assert.equal(on.url("posts/a.jpg"), first, "a minute later the URL is identical (browser and edge cache hit)");
  assert.match(first, /^https:\/\/d1\.cloudfront\.net\/posts\/a\.jpg\?Expires=\d+&Signature=[A-Za-z0-9~_-]+&Key-Pair-Id=K2ABCDEFGH$/);
  // Invalidation on delete.
  const sent = [];
  class Cmd { constructor(input) { this.input = input; } }
  const invalidate = createMediaInvalidator({ distributionId: "E1ABCDEFGHIJ", send: async c => sent.push(c.input), CreateInvalidationCommand: Cmd });
  assert.equal(await invalidate(["posts/a b.jpg", "posts/a b.jpg"]), true);
  assert.deepEqual(sent[0].InvalidationBatch.Paths, { Quantity: 1, Items: ["/posts/a%20b.jpg"] });
  assert.equal(await createMediaInvalidator({ distributionId: "", send: async () => {}, CreateInvalidationCommand: Cmd })(["x"]), false, "no distribution → nothing");
  // Wiring.
  const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
  assert.match(api, /if \(!Object\.keys\(responseHeaders\)\.length\) \{ const cdn = mediaCdn\.url\(key\); if \(cdn\) return cdn; \}/, "Auth API viewing URLs use the CDN; downloads stay on S3");
  assert.match(api, /await mediaCdn\.ready\(\)\.catch\(\(\) => false\);/);
  assert.match(api, /command instanceof DeleteObjectCommand && command\.input\?\.Key\) mediaCdnInvalidate/, "every media delete drops the CDN copy");
  assert.match(template, /if\(method==='GET'\)\{const cdn=mediaCdn\.url\(key\);if\(cdn\)return cdn;\}/, "call-signaling viewing URLs use the CDN");
  assert.match(template, /OriginAccessControlId: !GetAtt MediaOriginAccessControl\.Id/, "bucket stays private (Origin Access Control)");
  assert.match(template, /TrustedKeyGroups: \[!Ref MediaKeyGroup\]/, "only DanzStak-signed URLs are served");
  assert.match(template, /QueryStringsConfig: \{QueryStringBehavior: none\}/, "path-only cache key");
  assert.match(template, /MEDIA_CDN_DOMAIN: !If \[ServeMediaCdn, !GetAtt MediaDistribution\.DomainName, ''\]/, "CDN URLs only once switched on (after the CSP step)");
  assert.match(template, /secret:danzstak\/cloudfront\/media-signing-key-\*/, "the role reads only the signing secret");
  assert.doesNotMatch(template + api, /BEGIN (RSA )?PRIVATE KEY-----[A-Za-z0-9+/]/, "no private key in the repo");
  console.log("Media CDN checks passed: cacheable 6-hour signed URLs verify, S3 fallback, one secret read, delete invalidation, private bucket, template wiring.");
})().catch(error => { console.error(error); process.exit(1); });
