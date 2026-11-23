"use strict";
// EPK link previews (owner 2026-11-23: a private EPK link posted in Mix showed only "EPK Builder | DanzStak" — "Should have
// a preview", then the builder's ALL ACCESS laminate: "Like this"). Checks the page danzstak.com/e/<id> serves to link
// crawlers, the card-key rule, the Auth API wiring, the Amplify rewrites, and that Mix's own link cards read it for old
// epk.html links.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const preview = await import(pathToFileURL(path.join(__dirname, "infrastructure/auth-api/epk-share-preview.mjs")).href);
  const { epkSharePage, epkPreviewLine, validCardKey, validEpkId, epkShareLink } = preview;

  // A published EPK with its card on.
  const kit = { artistName: "Eroticon", genres: ["Techno", "Electro"], hometown: "San Francisco" };
  let page = epkSharePage({ id: "eroticon", kit, cardSig: "abcdef0123456789abcdef" });
  assert.equal(page.statusCode, 200);
  assert.match(page.headers["content-type"], /text\/html/);
  assert.match(page.body, /<meta property="og:title" content="Eroticon · EPK">/);
  assert.match(page.body, /<meta property="og:description" content="Techno · San Francisco · Electronic press kit on DanzStak">/);
  assert.match(page.body, /<meta property="og:image" content="https:\/\/danzstak\.com\/e\/eroticon\/card\.jpg\?v=abcdef0123456789">/, "the card picture, versioned so a new card is fetched again");
  assert.match(page.body, /<meta property="og:url" content="https:\/\/danzstak\.com\/e\/eroticon">/);
  assert.match(page.body, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(page.headers["content-security-policy"], /default-src 'none'; script-src 'unsafe-inline'/);
  assert.equal(epkPreviewLine({ genres: "House, Disco", hometown: "Bologna" }), "House · Bologna");

  // The page opens the EPK: the private review view when the link carries its token, the published EPK otherwise.
  const script = page.body.match(/<script>([\s\S]*?)<\/script>/)[1];
  const open = hash => { let target = ""; new Function("location", script)({ hash, replace: value => { target = value; } }); return target; };
  assert.equal(open(`#token=${"a".repeat(64)}`), `/epk.html?share=eroticon#token=${"a".repeat(64)}`, "the token stays in the #fragment and opens the review view");
  assert.equal(open(""), "/epk.html?id=eroticon", "without a token: the published EPK");
  assert.equal(open("#token=nothex"), "/epk.html?id=eroticon#token=nothex");

  // No kit (unpublished, card off): the general card, no name.
  page = epkSharePage({ id: "eroticon", kit: null, cardSig: "" });
  assert.match(page.body, /<meta property="og:title" content="An EPK on DanzStak">/);
  assert.match(page.body, /<meta property="og:image" content="https:\/\/danzstak\.com\/assets\/danzstak-share-card\.jpg">/);
  assert.doesNotMatch(page.body, /Eroticon/);

  // Names are escaped.
  page = epkSharePage({ id: "x-act", kit: { artistName: `"><script>alert(1)</script>`, hometown: "A & B" }, cardSig: "" });
  assert.doesNotMatch(page.body, /<script>alert/);
  assert.match(page.body, /&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt; · EPK/);
  assert.match(page.body, /A &amp; B/);

  // Card keys: only the artist's own users/<prefix>/<uuid>.jpg upload.
  const prefix = "0123456789abcdef01234567", uuid = "11111111-2222-4333-8444-555555555555";
  assert.equal(validCardKey(`users/${prefix}/${uuid}.jpg`, prefix), true);
  assert.equal(validCardKey(`users/${"f".repeat(24)}/${uuid}.jpg`, prefix), false, "another member's upload");
  assert.equal(validCardKey(`users/${prefix}/${uuid}.png`, prefix), false, "JPEG only");
  assert.equal(validCardKey(`epk/${prefix}/${uuid}.jpg`, prefix), false, "EPK media is cleaned up with the EPK; the card is its own upload");
  assert.equal(validCardKey(`users/${prefix}/../x.jpg`, prefix), false);
  assert.equal(validEpkId("eroticon"), true);
  assert.equal(validEpkId("Ero/../x"), false);
  assert.equal(epkShareLink("eroticon"), "https://danzstak.com/e/eroticon");

  // Auth API wiring.
  const api = fs.readFileSync(path.join(__dirname, "infrastructure/auth-api/index.mjs"), "utf8");
  assert.match(api, /if \(method === "POST" && path === "\/epk\/share-card"\) return await epkShareCard\(event\);/);
  assert.match(api, /path\.match\(\/\^\\\/share\\\/epk\\\/\(\[a-z0-9-\]\{3,64\}\)\(\\\/card\)\?\\\/\?\$\/\)/);
  assert.match(api, /if \(current && current\.ownerId\?\.S !== userId\) return reply\(409/, "only the EPK's own artist sets its card");
  assert.match(api, /size < 1000 \|\| size > CARD_MAX_BYTES/, "the card is at most 300 KB");
  assert.match(api, /const cardOn = Boolean\(owner\) && card\?\.ownerId\?\.S === owner && Boolean\(card\?\.cardKey\?\.S\);/, "a card shows only for the EPK's current owner");
  assert.match(api, /const plan = published\?\.plan\?\.S \|\| \(cardOn \? shared\?\.plan\?\.S : ""\) \|\| "";/, "a private EPK's name shows only once its artist turned the card on");
  assert.match(api, /transaction\.push\(\{ Delete: \{ TableName: toursTable, Key: \{ userId: \{ S: EPK_CARD_PARTITION \}/, "deleting the EPK deletes its card");

  // Routes (deploy script) and the Amplify rewrites, before the catch-all.
  const deploy = fs.readFileSync(path.join(__dirname, "aws-deploy-auth-api.ps1"), "utf8");
  for (const route of ["POST /epk/share-card", "GET /share/epk/{publicId}", "GET /share/epk/{publicId}/card"]) assert.ok(deploy.includes(`"${route}"`), `${route} is created by the deploy`);
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, "infrastructure/amplify-custom-rules.json"), "utf8"));
  const at = source => rules.findIndex(rule => rule.source === source);
  assert.deepEqual(rules[at("/e/<id>")], { source: "/e/<id>", target: "https://api.danzstak.com/share/epk/<id>", status: "200" });
  assert.deepEqual(rules[at("/e/<id>/card.jpg")], { source: "/e/<id>/card.jpg", target: "https://api.danzstak.com/share/epk/<id>/card", status: "200" });
  assert.ok(at("/e/<id>/card.jpg") < at("/e/<id>") && at("/e/<id>") < at("/<*>"), "the card rule comes first and both before the catch-all");

  // Mix's own link cards: an old epk.html?share=…#token=… link reads danzstak.com/e/<id>, and the post keeps its own link.
  const { linkPreview } = await import(pathToFileURL(path.join(__dirname, "infrastructure/auth-api/link-preview.mjs")).href);
  const fetched = [];
  const html = epkSharePage({ id: "eroticon", kit, cardSig: "abcdef0123456789" }).body;
  const fetcher = async url => { fetched.push(url); return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }); };
  const resolver = async () => [{ address: "13.32.1.1", family: 4 }];
  const card = await linkPreview(`https://danzstak.com/epk.html?share=eroticon#token=${"b".repeat(64)}`, { fetcher, resolver });
  assert.deepEqual(fetched, ["https://danzstak.com/e/eroticon"], "the preview is read from /e/<id>");
  assert.equal(card.title, "Eroticon · EPK");
  assert.equal(card.image, "https://danzstak.com/e/eroticon/card.jpg?v=abcdef0123456789");
  assert.equal(card.url, "https://danzstak.com/epk.html?share=eroticon", "the post keeps its own EPK link (the token never left the browser)");
  fetched.length = 0;
  await linkPreview("https://danzstak.com/feed.html?x=1", { fetcher, resolver });
  assert.deepEqual(fetched, ["https://danzstak.com/feed.html?x=1"], "other DanzStak links are read as they are");

  console.log("EPK share preview checks passed: danzstak.com/e/<id> gives crawlers the name, genre · home town and the artist's card (general card when off), opens the review view with the token or the published EPK, escapes names, accepts only the artist's own JPEG upload, is wired into the Auth API, deploy and Amplify, and Mix's link cards read it for old epk.html links.");
})().catch(error => { console.error(error); process.exit(1); });
