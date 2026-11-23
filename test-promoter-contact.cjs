"use strict";
// Owner 2026-11-17: "get all the info" — read the promoter's own page and its contact page for the booking email and phone.
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const c = await import("./infrastructure/auth-api/promoter-contact.mjs");
  const home = `<html><head><script>var x="track@sentry.io"</script></head><body><a href="/contatti">Contatti</a>
    <p>Scrivici: booking [at] crewbologna.it</p><a href="mailto:info@crewbologna.it?subject=hi">mail</a>
    <img src="logo@2x.png"><a href="https://www.instagram.com/crewbologna/">IG</a><a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a>
    <a href="https://www.facebook.com/crewbologna">FB</a><p>Evento 2026-11-27 alle 22</p></body></html>`;
  const found = c.extractContacts(home, "https://crewbologna.it/");
  assert.deepEqual(found.emails, ["booking@crewbologna.it", "info@crewbologna.it"]);
  assert.equal(found.social.instagram, "https://www.instagram.com/crewbologna");
  assert.equal(found.social.facebook, "https://www.facebook.com/crewbologna", "share buttons are not the promoter's page");
  assert.equal(found.contactPage, "https://crewbologna.it/contatti");
  assert.deepEqual(found.phones, [], "dates are not phone numbers");
  // A contact page fills in the phone; unsafe or private addresses are never fetched.
  const pages = { "https://crewbologna.it/": home, "https://crewbologna.it/contatti": `<a href="tel:+39 051 234 5678">Chiama</a>` };
  const fetcher = async url => ({ status: 200, ok: true, headers: { get: name => name === "content-type" ? "text/html" : "" }, text: async () => pages[url] || "" });
  const resolver = async host => host === "crewbologna.it" ? [{ address: "93.184.216.34" }] : [{ address: "10.0.0.5" }];
  const lead = await c.enrichPromoter({ sourceUrl: "https://crewbologna.it/", emails: [], phones: [] }, { fetcher, resolver });
  assert.deepEqual(lead.phones, ["+39 051 234 5678"]); assert.equal(lead.bookingSuitability, "contact-found"); assert.equal(lead.contactChecked, true);
  const blocked = await c.enrichPromoter({ sourceUrl: "https://intranet.example/", emails: [] }, { fetcher, resolver });
  assert.equal(blocked.contactChecked, undefined, "private network addresses are never read");
  const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  assert.match(api, /enriched\[index\] = await enrichPromoter\(lead\)/);
  assert.match(fs.readFileSync("assets/booking-agent.js", "utf8"), /place\.social\?\.\[key\]/);
  console.log("Promoter contact checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
