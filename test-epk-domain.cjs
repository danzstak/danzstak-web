"use strict";
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");

(async () => {
  Object.assign(process.env, { MEDIA_BUCKET:"example-private-media", AWS_REGION:"us-west-1", AWS_ACCESS_KEY_ID:"AKIAEXAMPLE", AWS_SECRET_ACCESS_KEY:"test-secret", AWS_SESSION_TOKEN:"test-token" });
  const { cleanEpk, epkForViewer, epkDeletionPlan, epkShareTokenMatches } = await import("./infrastructure/auth-api/index.mjs");
  const owner = "0123456789abcdef01234567";
  const photoKey = `epk/${owner}/11111111-1111-4111-a111-111111111111.jpg`;
  const riderKey = `epk/${owner}/22222222-2222-4222-a222-222222222222.pdf`;
  const kit = cleanEpk({
    artistName: "Codex Band",
    socialLinks: [
      { label:"Instagram", url:"https://www.instagram.com/codex-band" },
      { label:"Unsafe", url:"javascript:alert(1)" }
    ],
    bookingEmail:"book@codex.band",
    bookingPhone:"+1 555 010 1234",
    techRequirements:"Two vocal microphones",
    hospitalityRequirements:"Water",
    publicDetails:{ bookingEmail:true, bookingPhone:false, technical:true, hospitality:false },
    media: [
      { key: photoKey, id:"photo", role:"press-photo", name:"Press photo", public:true, featured:true },
      { key: riderKey, id:"rider", role:"technical-rider", name:"Private rider", public:false }
    ]
  }, owner);
  assert.equal(kit.artistName, "Codex Band");
  assert.deepEqual(kit.socialLinks, [{ label:"Instagram", url:"https://www.instagram.com/codex-band" }], "social links should persist while unsafe schemes are rejected");
  assert.equal(kit.media.length, 2, "valid owner-scoped media should remain in the artist draft");
  assert.equal(cleanEpk({ artistName:"Codex Band", media:[{ key:photoKey.replace(owner, "fedcba9876543210fedcba98"), role:"press-photo", name:"Stolen" }] }, owner), null, "another artist's object key must reject the entire update");
  assert.equal(cleanEpk({ artistName:"Codex Band", media:[{ key:photoKey, role:"executable", name:"Bad role" }] }, owner), null, "unknown media roles must be rejected");

  const ownerView = epkForViewer(kit, false), publicView = epkForViewer(kit, true), privateShareView = epkForViewer(kit, false, false);
  assert.equal(ownerView.media.length, 2, "the artist should retain private and public media");
  assert.equal(publicView.media.length, 1, "the public EPK must hide private media");
  assert.equal(publicView.bookingEmail, "book@codex.band", "artist-approved booking email should be public");
  assert.equal(publicView.bookingPhone, "", "private booking phone must not leave the owner response");
  assert.equal(publicView.techRequirements, "Two vocal microphones", "artist-approved technical rider should be public");
  assert.equal(publicView.hospitalityRequirements, "", "private hospitality rider must not leave the owner response");
  assert.equal("publicDetails" in publicView, false, "internal publication choices should not be emitted publicly");
  assert.equal(ownerView.bookingPhone, "+1 555 010 1234", "the artist should retain private contact details");
  assert.equal(privateShareView.media.length, 2, "a private reviewer should receive every artist-selected EPK file");
  assert.equal(privateShareView.bookingPhone, "+1 555 010 1234", "a private reviewer should receive private booking details");
  assert.equal("publicDetails" in privateShareView, false, "a private reviewer should not receive owner-only publication settings");
  assert.equal(publicView.media[0].key, photoKey);
  assert.match(publicView.media[0].url, /^https:\/\//, "public downloads should use a signed HTTPS URL");
  assert.equal(kit.media.some(item => "url" in item), false, "viewer serialization must not mutate stored EPK data");
  const ownerKey = { userId:{S:"artist-1"}, tourId:{S:"epk-workspace-v1"} };
  const deletion = epkDeletionPlan({ publicId:{S:"codex-band"}, plan:{S:JSON.stringify({media:[{key:photoKey},{key:photoKey.replace(owner,"fedcba9876543210fedcba98")}]})} }, owner, ownerKey);
  assert.equal(deletion.transaction.length, 3, "deletion should remove the private draft, published copy, and private share atomically");
  assert.deepEqual(deletion.transaction[0].Delete.Key, ownerKey);
  assert.equal(deletion.transaction[2].Delete.Key.userId.S, "epk-private-share", "deletion must revoke the private review copy");
  assert.deepEqual(deletion.mediaKeys, [photoKey], "deletion must clean up only media owned by the signed-in artist");
  const shareToken = "a".repeat(64), shareHash = createHash("sha256").update(`epk-share:${shareToken}`).digest("hex");
  assert.equal(epkShareTokenMatches(shareToken, shareHash), true, "the issued private token should match its stored hash");
  assert.equal(epkShareTokenMatches("b".repeat(64), shareHash), false, "a different private token must be rejected");
  assert.equal(epkShareTokenMatches("not-a-token", shareHash), false, "malformed private tokens must be rejected before comparison");
  console.log("EPK domain checks passed: owner isolation, role validation, private media filtering, signed-view serialization, and scoped permanent deletion.");
})().catch(error => { console.error(error); process.exitCode = 1; });
