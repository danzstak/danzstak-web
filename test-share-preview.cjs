"use strict";
// SHARE (owner 2026-11-21, spec 44): "When a user share their profile it should show just like the image I uploaded."
// danzstak.com/@username is rewritten by Amplify to call-signaling's GET /share/profile/{username}, a tiny page whose
// Open Graph tags show the member's own card; its picture is GET /share/profile/{username}/card. This checks:
// - every link-preview crawler (Facebook, WhatsApp, X, Telegram, iMessage) gets the member's name, one-line bio and card,
//   with the domain danzstak.com, and people (who run scripts) are sent on to the profile;
// - a member who never turned the card on, turned it off, or doesn't exist gets the general DanzStak card and no name,
//   photo, bio or storage key; the card picture answers 404;
// - the page escapes everything it prints and needs no session (it runs before the sign-in check);
// - the profile save: turning the card on needs a username and claims it, remembers the member id for the redirect,
//   accepts only a JPEG card under 400 KB, and turning it off deletes the card; a removed picture no longer blocks every
//   later save (the empty key used to fail the "doesn't exist" check);
// - the two API routes and the Amplify rewrites (card first, both before the 404 rule) are in place.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const line = start => { const at = template.indexOf("          " + start); assert.ok(at > 0, `found ${start}`); return template.slice(at, template.indexOf("\n", at)).trim(); };
const between = (from, to) => template.slice(template.indexOf("          " + from), template.indexOf("          " + to)).trim();
const helpers = ["const securityHeaders=", "const profileString=", "const normalizeProfileClaim=", "const foldSearch=", "const looksPrivate=", "async function availableProfileSuggestion(", "const shareSite=", "const shareCardOn=", "async function shareProfile("].map(line).join("\n");
const profileSave = between("async function cleanupProfileMedia(", "async function sendMessage");

class GetItemCommand { constructor(input) { this.input = input; } }
class GetObjectCommand { constructor(input) { this.input = input; } }
class HeadObjectCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }
class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class ListUsersCommand { constructor(input) { this.input = input; } }

const MEMBER = "22222222-2222-4222-a222-222222222222";
const CARD = "users/aaaaaaaaaaaaaaaaaaaaaaaa/11111111-1111-4111-a111-111111111111.jpg";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
const clone = value => JSON.parse(JSON.stringify(value));

function routeHarness(settingsByEmail, claims) {
  const reads = [];
  const context = vm.createContext({
    process: { env: { SETTINGS_TABLE: "settings", PROFILE_NAMES_TABLE: "names", MEDIA_BUCKET: "media" } },
    GetItemCommand, GetObjectCommand, Buffer, JSON, String, Number, Boolean, Object, encodeURIComponent, decodeURIComponent,
    db: { send: async command => {
      const { TableName, Key } = command.input;
      if (TableName === "names") { const email = claims[Key.claim.S]; return email ? { Item: { claim: Key.claim, userEmail: { S: email } } } : {}; }
      if (TableName === "settings") return settingsByEmail[Key.userEmail.S] ? { Item: clone(settingsByEmail[Key.userEmail.S]) } : {};
      throw new Error("unexpected table " + TableName);
    } },
    s3: { send: async command => { reads.push(command.input.Key); return { Body: { transformToByteArray: async () => new Uint8Array(JPEG) } }; } }
  });
  vm.runInContext(helpers, context);
  const get = (path, userAgent) => { context.event = { rawPath: path, headers: { "user-agent": userAgent }, requestContext: { http: { method: "GET" } } }; return vm.runInContext("shareProfile(event)", context); };
  return { get, reads };
}
const tag = (html, attribute, key) => { const found = new RegExp(`<meta ${attribute}="${key.replace(/[.:]/g, "\\$&")}" content="([^"]*)">`).exec(html); return found ? found[1] : null; };

const CRAWLERS = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "WhatsApp/2.24.9.78 A",
  "Twitterbot/1.0",
  "TelegramBot (like TwitterBot)",
  "facebookexternalhit/1.1 Facebot Twitterbot/1.0" // iMessage
];

(async () => {
  // The member turned the card on: every crawler gets their card, name and bio on danzstak.com.
  const eroticon = { profileHandle: { S: "Eroticon" }, profileName: { S: "Eroticon" }, profileBio: { S: "Electro & techno since 1988" }, profileShareCard: { BOOL: true }, profileShareCardKey: { S: CARD }, profileShareCardSig: { S: "abcdef0123456789ff" }, profileShareMember: { S: MEMBER } };
  const site = routeHarness({ "eroticon@example.com": eroticon, "quiet@example.com": { profileHandle: { S: "quiet" }, profileName: { S: "Quiet Person" }, profileBio: { S: "Private bio" }, profileShareCardKey: { S: CARD }, profileShareMember: { S: MEMBER } }, "off@example.com": { ...eroticon, profileHandle: { S: "offnow" }, profileName: { S: "Turned Off" }, profileShareCard: { BOOL: false } } }, { "handle#eroticon": "eroticon@example.com", "handle#quiet": "quiet@example.com", "handle#offnow": "off@example.com" });
  for (const agent of CRAWLERS) {
    const page = await site.get("/share/profile/eroticon", agent);
    assert.equal(page.statusCode, 200, agent);
    assert.match(page.headers["content-type"], /^text\/html/);
    assert.match(page.headers["cache-control"], /^public/);
    assert.equal(tag(page.body, "property", "og:title"), "Eroticon on DanzStak", agent);
    assert.equal(tag(page.body, "property", "og:description"), "Electro &amp; techno since 1988");
    assert.equal(tag(page.body, "property", "og:url"), "https://danzstak.com/@Eroticon");
    assert.equal(tag(page.body, "property", "og:image"), "https://danzstak.com/@Eroticon/card.jpg?v=abcdef0123456789");
    assert.equal(tag(page.body, "property", "og:image:width"), "1200");
    assert.equal(tag(page.body, "property", "og:image:height"), "630");
    assert.equal(tag(page.body, "property", "og:image:type"), "image/jpeg");
    assert.equal(tag(page.body, "name", "twitter:card"), "summary_large_image");
    assert.equal(tag(page.body, "property", "og:type"), "website", "not \"profile\": Facebook shows those as a person, with the domain as the title");
    assert.equal(tag(page.body, "name", "twitter:image"), tag(page.body, "property", "og:image"));
  }
  const page = await site.get("/share/profile/eroticon", "Mozilla/5.0");
  assert.ok(page.body.includes(`<script>location.replace("/profile.html?member=${MEMBER}")</script>`), "people are sent on to the profile");
  assert.ok(page.body.includes(`<a href="/profile.html?member=${MEMBER}">`), "with a plain link when scripts are off");
  assert.match(page.headers["content-security-policy"], /default-src 'none'/);
  assert.ok(page.body.includes('<meta name="robots" content="noindex">'), "search engines stay out");
  assert.ok(!page.body.includes(CARD), "the storage key never leaves the server");

  // The card picture: the stored JPEG, read from the media bucket.
  const card = await site.get("/share/profile/Eroticon/card", CRAWLERS[0]);
  assert.equal(card.statusCode, 200);
  assert.equal(card.isBase64Encoded, true);
  assert.equal(card.headers["content-type"], "image/jpeg");
  assert.deepEqual(Buffer.from(card.body, "base64"), JPEG);
  assert.deepEqual(site.reads, [CARD]);

  // Never turned on, turned off, unknown, or not a username: the general card and nothing personal.
  for (const [path, target] of [["/share/profile/quiet", `/profile.html?member=${MEMBER}`], ["/share/profile/offnow", `/profile.html?member=${MEMBER}`], ["/share/profile/nobody", "/"], ["/share/profile/%3Cscript%3E", "/"], ["/share/profile/%E0%A4%A", "/"]]) {
    const general = await site.get(path, CRAWLERS[0]);
    assert.equal(general.statusCode, 200, path);
    assert.equal(tag(general.body, "property", "og:title"), "A profile on DanzStak", path);
    assert.equal(tag(general.body, "property", "og:image"), "https://danzstak.com/assets/danzstak-share-card.jpg", path);
    assert.ok(fs.existsSync("assets/danzstak-share-card.jpg"), "the general card exists");
    for (const secret of ["Quiet Person", "Private bio", "Turned Off", CARD, "Electro"]) assert.ok(!general.body.includes(secret), `${path} shows nothing personal (${secret})`);
    assert.ok(!general.body.includes("<script>location") || general.body.includes(`location.replace(${JSON.stringify(target)})`), path);
    assert.ok(general.body.includes(`location.replace(${JSON.stringify(target)})`), `${path} sends people to ${target}`);
    assert.ok(!/<script>(?!location\.replace)/.test(general.body), `${path} prints no script from the address`);
    assert.equal((await site.get(path + "/card", CRAWLERS[0])).statusCode, 404, `${path} has no card picture`);
  }
  assert.deepEqual(site.reads, [CARD], "no card is read for a profile that isn't shown");

  // Everything printed is escaped.
  const tricky = routeHarness({ "x@example.com": { ...eroticon, profileHandle: { S: "tricky" }, profileName: { S: `A "Band" <b>&</b>` }, profileBio: { S: `"><script>alert(1)</script>` } } }, { "handle#tricky": "x@example.com" });
  const escaped = await tricky.get("/share/profile/tricky", CRAWLERS[0]);
  assert.equal(tag(escaped.body, "property", "og:title"), "A &quot;Band&quot; &lt;b&gt;&amp;&lt;/b&gt; on DanzStak");
  assert.ok(!escaped.body.includes("<script>alert"), "a bio can't add a script");

  // The route runs before the sign-in check; the routes and the Amplify rewrites exist.
  const handler = template.slice(template.indexOf("exports.handler=async event=>{try{const method"));
  assert.ok(handler.indexOf("startsWith('/share/profile/'))return await shareProfile(event)") < handler.indexOf("const user=await identity(event)"), "no session needed");
  assert.ok(handler.indexOf("startsWith('/share/profile/'))return await shareProfile(event)") > 0);
  assert.match(template, /RouteKey: 'GET \/share\/profile\/\{handle\}'/);
  assert.match(template, /RouteKey: 'GET \/share\/profile\/\{handle\}\/card'/);
  const rules = JSON.parse(fs.readFileSync("infrastructure/amplify-custom-rules.json", "utf8"));
  const at = source => rules.findIndex(rule => rule.source === source);
  assert.ok(at("/@<handle>/card.jpg") >= 0 && at("/@<handle>/card.jpg") < at("/@<handle>") && at("/@<handle>") < at("/<*>"), "card rewrite, then page rewrite, then the 404 rule");
  assert.deepEqual(rules[at("/@<handle>")], { source: "/@<handle>", target: "https://api.danzstak.com/share/profile/<handle>", status: "200" });
  assert.deepEqual(rules[at("/@<handle>/card.jpg")], { source: "/@<handle>/card.jpg", target: "https://api.danzstak.com/share/profile/<handle>/card", status: "200" });
  const robots = fs.readFileSync("robots.txt", "utf8");
  assert.ok(!/Disallow: \/@/.test(robots), "robots.txt lets crawlers read /@ links");
  // The live check's robots.txt reading (scripts/verify-share-preview.cjs) agrees with how crawlers read this file.
  const { robotsAllows } = require("./scripts/verify-share-preview.cjs");
  for (const agent of ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "WhatsApp/2.24", "Twitterbot/1.0", "TelegramBot (like TwitterBot)"]) {
    assert.equal(robotsAllows(robots, agent, "/profile.html"), true, `${agent} may read profiles`);
    assert.equal(robotsAllows(robots, agent, "/@eroticon"), true, `${agent} may read /@ links`);
    assert.equal(robotsAllows(robots, agent, "/feed.html"), false, `${agent} stays out of Mix`);
  }
  assert.equal(robotsAllows(robots, "Googlebot/2.1", "/profile.html"), false, "search engines stay out of profiles");
  assert.equal(robotsAllows(robots, "Googlebot/2.1", "/@eroticon"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /profile.html\n", "facebookexternalhit/1.1", "/profile.html"), false, "the old robots.txt would fail the live check");

  // getProfile gives the share link only when the card is on, and the choice and signature only to the owner.
  const getProfile = line("async function getProfile(");
  assert.ok(getProfile.includes("shareUrl:shareCardOn(item)?shareLink(item.profileHandle.S):undefined"));
  assert.ok(getProfile.includes("shareCard:isOwner&&typeof item?.profileShareCard?.BOOL==='boolean'"));
  assert.ok(getProfile.includes("shareCardSig:isOwner?"));

  // The profile save.
  await saveChecks();
  console.log("Share preview checks passed: crawlers get the member's card only when they turned it on, the general card otherwise, escaped, no session; the save claims the username, takes only a small JPEG, and deletes the card when turned off.");
})().catch(error => { console.error(error); process.exit(1); });

async function saveChecks() {
  function harness(item, { size = 120000 } = {}) {
    const state = clone(item), claimsTable = new Map(), deleted = [], heads = new Map();
    const db = { send: async command => {
      const input = command.input;
      if (command instanceof GetItemCommand) {
        if (input.TableName === "names") { const owner = claimsTable.get(input.Key.claim.S); return owner ? { Item: { userEmail: { S: owner } } } : {}; }
        return { Item: clone(state) };
      }
      if (command instanceof TransactWriteItemsCommand) {
        for (const entry of input.TransactItems) {
          if (entry.Put) { claimsTable.set(entry.Put.Item.claim.S, entry.Put.Item.userEmail.S); continue; }
          const update = entry.Update, values = update.ExpressionAttributeValues, names = update.ExpressionAttributeNames || {};
          // The real media conditions: each expected key matches, and a removed ('') key counts as missing or empty.
          for (const condition of update.ConditionExpression.split(" AND ")) {
            const equal = /\(?(profile\w+Key) = :(\w+)\)?$/.exec(condition), missing = /^\(attribute_not_exists\((profile\w+Key)\)\)$/.exec(condition);
            if (equal && !condition.includes("attribute_not_exists") && (state[equal[1]]?.S ?? null) !== values[":" + equal[2]].S) throw Object.assign(new Error("conflict"), { name: "TransactionCanceledException" });
            if (missing && state[missing[1]] !== undefined) throw Object.assign(new Error("conflict"), { name: "TransactionCanceledException" });
            const either = /^\(attribute_not_exists\((profile\w+Key)\) OR \1 = :(\w+)\)$/.exec(condition);
            if (either && state[either[1]] !== undefined && state[either[1]].S !== values[":" + either[2]].S) throw Object.assign(new Error("conflict"), { name: "TransactionCanceledException" });
          }
          const sets = update.UpdateExpression.replace(/^SET /, "").split(" REMOVE ")[0].split(", ");
          for (const assignment of sets) { const [left, right] = assignment.split(" = "); const name = names[left] || left; if (values[right]) state[name] = clone(values[right]); }
          if (values[":profileCleanup"]) state.profileMediaCleanup = clone(values[":profileCleanup"]); else delete state.profileMediaCleanup;
        }
        return {};
      }
      if (command instanceof UpdateItemCommand) {
        const v = input.ExpressionAttributeValues || {};
        if (input.UpdateExpression.startsWith("SET profileMediaCleanupClaim")) {
          assert.match(input.ConditionExpression, /profileShareCardKey <> :candidate/, "the clean-up never claims the live card");
          if (state.profileShareCardKey?.S === v[":candidate"].S) throw Object.assign(new Error("conflict"), { name: "ConditionalCheckFailedException" });
        }
        return {};
      }
      return {};
    } };
    const context = vm.createContext({
      process: { env: { SETTINGS_TABLE: "settings", PROFILE_NAMES_TABLE: "names", MEDIA_BUCKET: "media", USER_POOL_ID: "pool" } },
      GetItemCommand, UpdateItemCommand, TransactWriteItemsCommand, DeleteItemCommand, DeleteObjectCommand, HeadObjectCommand, ListUsersCommand,
      json: (statusCode, body) => ({ statusCode, body }), ownerPrefix: () => "owner", now: () => 100,
      randomUUID: () => "00000000-0000-4000-a000-000000000001", scanAll: async () => [], getProfile: async () => ({ statusCode: 200 }),
      console: { ...console, error() {} }, db,
      s3: { send: async command => {
        if (command instanceof HeadObjectCommand) { if (!command.input.Key.startsWith("users/owner/")) throw new Error("not found"); heads.set(command.input.Key, true); return { ContentLength: size, ContentType: "image/jpeg" }; }
        deleted.push(command.input.Key); return {};
      } }
    });
    vm.runInContext(helpers + "\n" + profileSave, context);
    const save = body => { context.event = { body: JSON.stringify(body) }; return vm.runInContext(`updateProfileUnique(event,{email:"artist@example.com",userId:"${MEMBER}"})`, context); };
    return { state, save, claimsTable, deleted };
  }
  const card = n => `users/owner/0000000${n}-1111-4111-a111-111111111111.jpg`;

  // No username yet: the card can't be turned on.
  const none = harness({});
  assert.equal((await none.save({ shareCard: true, shareCardKey: card(1), shareCardSig: "abcdef01" })).statusCode, 400);

  // Turning it on: the card, its signature, the member id for the redirect, and the username claimed.
  const h = harness({ profileHandle: { S: "Eroticon" }, profileName: { S: "Eroticon" } });
  assert.equal((await h.save({ shareCard: true, shareCardKey: card(1), shareCardSig: "abcdef0123" })).statusCode, 200);
  assert.equal(h.state.profileShareCard.BOOL, true);
  assert.equal(h.state.profileShareCardKey.S, card(1));
  assert.equal(h.state.profileShareCardSig.S, "abcdef0123");
  assert.equal(h.state.profileShareMember.S, MEMBER);
  assert.equal(h.claimsTable.get("handle#eroticon"), "artist@example.com", "the username is claimed so the link finds the member");

  // A new card replaces the old one, which is cleaned up; the live card is never cleaned up.
  assert.equal((await h.save({ shareCardKey: card(2), shareCardSig: "abcdef0124" })).statusCode, 200);
  assert.equal(h.state.profileShareCardKey.S, card(2));
  assert.ok(h.deleted.includes(card(1)) || (h.state.profileMediaCleanup?.SS || []).includes(card(1)), "the old card goes");
  assert.ok(!h.deleted.includes(card(2)), "the live card stays");

  // Turning it off deletes the card.
  assert.equal((await h.save({ shareCard: false })).statusCode, 200);
  assert.equal(h.state.profileShareCard.BOOL, false);
  assert.equal(h.state.profileShareCardKey.S, "");
  assert.ok(h.deleted.includes(card(2)) || (h.state.profileMediaCleanup?.SS || []).includes(card(2)), "turning it off deletes the card");
  // ... and the empty key no longer blocks the next save (it used to fail "attribute_not_exists").
  assert.equal((await h.save({ shareCard: true, shareCardKey: card(3), shareCardSig: "abcdef0125" })).statusCode, 200, "a removed card doesn't block later saves");
  assert.equal(h.state.profileShareCardKey.S, card(3));
  const removed = harness({ profileHandle: { S: "x.y" }, profileAvatarKey: { S: "" } });
  assert.equal((await removed.save({ bio: "still saves" })).statusCode, 200, "a removed profile picture doesn't block later saves");

  // Only a small JPEG of the member's own, and a hex signature.
  assert.equal((await h.save({ shareCardKey: "users/owner/00000004-1111-4111-a111-111111111111.png" })).statusCode, 400, "a JPEG");
  assert.equal((await harness({ profileHandle: { S: "big" } }, { size: 500000 }).save({ shareCard: true, shareCardKey: card(5) })).statusCode, 400, "under 400 KB");
  assert.equal((await h.save({ shareCardKey: "users/someone-else/00000006-1111-4111-a111-111111111111.jpg" })).statusCode, 403, "the member's own upload");
  assert.equal((await h.save({ shareCardSig: "not hex!" })).statusCode, 400);
  assert.equal((await h.save({ shareCard: "yes" })).statusCode, 400);
}
