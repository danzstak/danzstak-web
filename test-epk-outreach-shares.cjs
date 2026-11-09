"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const { epkForViewer, epkOutreachTokenMatches, epkOutreachLinkParts } = await import("./infrastructure/auth-api/index.mjs");
  const token = "a".repeat(64);
  const crypto = require("node:crypto");
  const hash = crypto.createHash("sha256").update(`epk-outreach:${token}`).digest("hex");
  assert.equal(epkOutreachTokenMatches(token, hash), true, "the stored hash must verify the exact secret");
  assert.equal(epkOutreachTokenMatches("b".repeat(64), hash), false, "another secret must fail closed");
  const shareId = "1234567890abcdef1234567890abcdef";
  const link = `https://danzstak.com/epk.html?outreach=${shareId}#token=${token}`;
  assert.deepEqual(epkOutreachLinkParts(link), { shareId, token, href: link });
  assert.equal(epkOutreachLinkParts(`https://evil.example/epk.html?outreach=${shareId}#token=${token}`), null);
  assert.equal(new URL(link).searchParams.has("token"), false, "the secret must remain in the URL fragment, which is not sent in HTTP requests");

  const kit = { artistName:"Test Act", publicDetails:{}, media:[{ id:"one", key:"epk/owner/one.pdf", role:"technical-rider", name:"Rider.pdf", public:true }] };
  const restricted = epkForViewer(kit, false, false, false);
  assert.equal(typeof restricted.media[0].url, "string");
  assert.equal("downloadUrl" in restricted.media[0], false, "venue downloads must be omitted when the artist did not allow them");
  const downloadable = epkForViewer(kit, false, false, true);
  assert.equal(typeof downloadable.media[0].downloadUrl, "string");

  const backend = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  const frontend = fs.readFileSync("assets/epk.js", "utf8");
  const booking = fs.readFileSync("assets/booking-selections.js", "utf8");
  assert.match(backend, /openCount = if_not_exists\(openCount, :zero\) \+ :one/);
  assert.match(backend, /DanzStak does not store who viewed it/);
  assert.match(backend, /expiresAt = now\(\) \+ 45 \* 86400/);
  assert.match(frontend, /sessionStorage\.getItem\(`danzstakEpkOpen:/, "one browser session should not inflate the open count on reload");
  assert.match(frontend, /data\.permissions\?\.allowPdf !== true/);
  assert.match(frontend, /privateView = Boolean\(privateId \|\| outreachId \|\| data\.private\)/, "private and per-venue EPK views must suppress reusable share controls");
  assert.match(frontend, /byId\("copyEpkLink"\)\.hidden = privateView/);
  assert.match(frontend, /byId\("showEpkQr"\)\.hidden = privateView/);
  assert.match(frontend, /actions\.hidden = \[\.\.\.actions\.children\]\.every\(control => control\.hidden\)/, "an empty action row must collapse instead of leaving dead space");
  assert.match(booking, /createVenueEpkShare/);
  assert.match(booking, /replaceAll\(currentArtist\.epk, share\.shareUrl\)/, "the reviewed email must contain the exact private venue link");
  assert.doesNotMatch(backend, /viewerIp|userAgentHistory|fingerprint/i, "outreach-open evidence must not retain viewer identity data");
  console.log("Per-venue EPK share checks passed: hashed secrets, fragment-only tokens, venue-bound review links, 45-day expiry, download permission, privacy disclosure, hidden token-reshare controls, and session-deduplicated opens.");
})().catch(error => { console.error(error); process.exit(1); });
