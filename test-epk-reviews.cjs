"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("epk.html", "utf8");
const client = fs.readFileSync("assets/epk-reviews.js", "utf8");
const epkClient = fs.readFileSync("assets/epk.js", "utf8");
const css = fs.readFileSync("assets/epk-reviews.css", "utf8");
const backend = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(html, /id="epkReviews"[\s\S]*id="epkReviewForm"[\s\S]*id="epkReviewTarget"[\s\S]*id="epkReviewBody"/, "the public EPK needs a real review list and composer");
assert.match(html, /One review per show or release/);
assert.match(html, /No paid or fake reviews/);
assert.match(html, /do not upload audio/, "review copy must preserve the no-music-hosting boundary");
assert.match(html, /assets\/epk-reviews\.css\?v=1/);
assert.match(html, /assets\/epk-reviews\.js\?v=3/);
assert.match(epkClient, /danzstakEpkReviews\?\.load\?\.\(publicId, data\.kit\)/, "only a published EPK should start the review surface");

assert.match(client, /\/review-targets\?artist=/, "the composer must use canonical server-provided targets");
assert.match(client, /\/reviews\?artist=/, "the EPK must read the artist's canonical reviews");
assert.match(client, /Promise\.allSettled/, "optional sign-in and composer requests must not hide published reviews");
assert.match(client, /artistPublicId:currentPublicId,targetType:target\.targetType,targetId:target\.targetId/, "review creation must submit the selected canonical target");
assert.match(client, /action:"remove_from_here",surface:"epk"/, "authors need placement-only removal");
assert.match(client, /method:"DELETE"/, "authors need an explicit delete-everywhere path");
assert.match(client, /Screenshots or copies someone already made outside DanzStak cannot be recalled/, "delete-everywhere must disclose the real external-copy limit");
assert.match(client, /response\.ok[\s\S]*targetData\.canReview/, "the write form must stay behind a verified signed-in eligibility response");
assert.match(client, /section\.hidden = !reviews\.length && form\.hidden/, "an empty review surface must stay out of the booker's EPK");
assert.match(client, /setStatus\(""\); section\.hidden = true/, "optional review failures must not replace the public EPK with error UI");
assert.match(client, /textContent = value/, "member and review content must render as text");
assert.doesNotMatch(client, /innerHTML\s*=/, "review content must never be interpreted as markup");
assert.doesNotMatch(client, /\.mp3|\.wav|audio\//i, "the review UI must not add audio upload handling");

assert.match(backend, /canReview: Boolean\(userId && userId !== targets\[0\]\.artistUserId\)/, "artists cannot receive a composer for their own EPK");
assert.match(backend, /hiddenPlacements\?\.SS\?\.includes\(surface\)/, "placement removal must be enforced by the list API");
assert.match(backend, /SET updatedAt = :updated ADD hiddenPlacements :surface/, "placement removal must persist server-side");
assert.match(backend, /publishedReviewTargets\(view\.artistPublicId\)/, "unpublished or renamed targets must disappear from public review reads");

assert.match(css, /min-height:44px/, "review actions must remain touch-sized");
assert.match(css, /@media\(max-width:700px\)/, "the review surface needs a phone layout");
assert.match(css, /overflow-wrap:anywhere/, "long review text must not overflow narrow screens");
assert.match(worker, /danzstak-shell-v770/);
assert.match(worker, /\/assets\/epk-reviews\.css/);
assert.match(worker, /\/assets\/epk-reviews\.js/);

console.log("EPK review UI checks passed: canonical targets, public reading, eligible composing, safe rendering, creator removal choices, responsive controls, and PWA caching.");
