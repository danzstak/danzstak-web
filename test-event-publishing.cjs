"use strict";
// Event publishing (task 14-D moved it into assets/events-page.js): flyer required, explicit confirmation,
// the same API calls as before (upload flyer -> event -> ticket sections -> Mix post), no unsafe outside links.
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const sandbox = { window: {}, document: { documentElement: { lang: "en" } }, console, URL };
vm.runInNewContext(readFileSync("assets/events-page.js", "utf8"), sandbox);
const ev = sandbox.window.danzstakEvents;

(async () => {
  const requests = [];
  const deps = {
    timezone: "America/Los_Angeles",
    postActionFetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      const json = url === "/stories" ? { uploadUrl: "https://upload.example/x", mediaKey: "users/aaaaaaaaaaaaaaaaaaaaaaaa/11111111-1111-4111-8111-111111111111.png" } : url === "/marketplace/events" ? { event: { id: "33333333-3333-4333-8333-333333333333" } } : {};
      return { ok: true, json: async () => json };
    },
    fetchWithDeadline: async () => ({ ok: true }),
    discardUploadedMedia: async key => { requests.push({ url: "discard", body: key }); }
  };
  const ids = { event: "11111111-1111-4111-8111-111111111111", tiers: ["22222222-2222-4222-8222-222222222222", "44444444-4444-4444-8444-444444444444"] };
  const ready = () => Object.assign(ev.newDraft(), { media: { file: { type: "image/png" }, type: "image" }, title: "Basement Frequencies", startsLocal: "2027-02-06T22:00", venue: "The Pit", address: "Oakland", price: "15", lineup: "Headliner\nSupport", sections: [{ name: "General admission" }], certified: true });

  let draft = ready(); draft.media = null;
  assert.equal(ev.validate(draft).step, "flyer", "events without a flyer never reach the API");
  assert.equal(ev.validate(draft).message, "Drop your flyer first: an image, or a video of 15 seconds or less.");
  draft = ready(); draft.certified = false;
  assert.equal(ev.validate(draft).step, "publish", "uncertified events never reach the API");
  draft = ready(); draft.title = " ";
  assert.equal(ev.validate(draft).step, 0, "the creator goes back to the name question");
  draft = ready(); draft.startsLocal = "";
  assert.equal(ev.validate(draft).step, 1);
  draft = ready(); draft.venue = "";
  assert.equal(ev.validate(draft).step, 2);
  draft = ready(); draft.price = "0.20";
  assert.equal(ev.validate(draft).message, "Ticket prices start at $0.50.");
  draft = ready(); draft.audience = "friends";
  assert.match(ev.validate(draft).message, /must be Public/, "ticketed nights must be public");
  draft = ready(); draft.outsideUrl = "javascript:alert(1)";
  assert.match(ev.validate(draft).message, /https:\/\//, "unsafe outside ticket links never reach the API");
  draft = ready(); draft.endsLocal = "2027-02-06T21:00";
  assert.match(ev.validate(draft).message, /after doors/);
  assert.equal(ev.validate(ready()).ok, true);

  // Full publish: one ticket section.
  let result = await ev.publish(ready(), deps, ids);
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(requests.map(r => r.url), ["/stories", "/marketplace/events", "/marketplace/events/33333333-3333-4333-8333-333333333333/tiers", "/secure-posts"]);
  const created = requests[1].body;
  assert.equal(created.mediaType, "image");
  assert.match(created.mediaKey, /^users\//);
  assert.equal(created.description, "Headliner\nSupport", "the lineup is stored in the event description");
  assert.equal(created.status, "published");
  assert.equal(created.ticketSalesEnabled, true);
  assert.equal(created.namedTickets, true, "named tickets stay on by default");
  assert.equal(created.capacity, 100);
  assert.equal(created.timezone, "America/Los_Angeles");
  assert.equal(created.startsAt, new Date("2027-02-06T22:00").toISOString());
  assert.deepEqual([requests[2].body.name, requests[2].body.priceCents, requests[2].body.capacity, requests[2].body.clientTierId], ["General admission", 1500, 100, ids.tiers[0]]);
  assert.equal(requests[3].body.originalContentCertified, true);
  assert.equal(requests[3].body.mediaKey, created.mediaKey, "the Mix post carries the flyer");
  assert.match(requests[3].body.content, /^Event: Basement Frequencies\n/);
  assert.match(requests[3].body.content, /event\.html\?id=33333333/);

  // Seating sections become ticket tiers; the event capacity is their sum.
  requests.length = 0;
  draft = ready(); draft.sections = [{ name: "Floor" }, { name: "Balcony", price: "25", size: "40" }]; draft.sectionSize = "150";
  result = await ev.publish(draft, deps, ids);
  assert.equal(result.ok, true);
  assert.equal(requests[1].body.capacity, 190);
  assert.deepEqual(requests.filter(r => r.url.endsWith("/tiers")).map(r => [r.body.name, r.body.priceCents, r.body.capacity]), [["Floor", 1500, 150], ["Balcony", 2500, 40]]);

  // Free night with an outside ticket link: no tiers, the Mix post carries the link.
  requests.length = 0;
  draft = ready(); draft.sellTickets = false; draft.outsideUrl = "https://www.eventbrite.com/e/123";
  assert.equal(ev.validate(draft).ok, true);
  await ev.publish(draft, deps, ids);
  assert.equal(requests.filter(r => r.url.endsWith("/tiers")).length, 0);
  assert.equal(requests[1].body.ticketUrl, "https://www.eventbrite.com/e/123");
  assert.equal(requests[1].body.ticketSalesEnabled, false);
  assert.match(requests.at(-1).body.content, /eventbrite\.com/, "the Mix post carries the outside ticket link");

  // A failure after the upload discards the orphaned flyer.
  requests.length = 0;
  const failing = { ...deps, postActionFetch: async (url, options) => url === "/marketplace/events" ? { ok: false, json: async () => ({ error: "Enter a valid event" }) } : deps.postActionFetch(url, options) };
  result = await ev.publish(ready(), failing, ids);
  assert.deepEqual([result.ok, result.message], [false, "Enter a valid event"]);
  assert.equal(requests.at(-1).url, "discard", "an uploaded flyer is discarded when the event can't be saved");
  console.log("Event publishing checks passed: flyer and confirmation required, same API sequence, lineup, seating sections as tiers, outside links, flyer cleanup.");
})().catch(error => { console.error(error); process.exitCode = 1; });
