"use strict";
// Task 12 PR 3: prices are shown all-in (price + DanzStak's 6% fee + $1 under $30) wherever they first appear,
// and the browser's fee math matches the server's to the cent.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
(async () => {
  const server = await import("./infrastructure/auth-api/fees.mjs");
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync("assets/fees.js", "utf8"), sandbox);
  const fees = sandbox.window.DanzStakFees;
  assert.ok(fees, "assets/fees.js exposes window.DanzStakFees");
  for (let cents = 0; cents <= 12_000; cents += 1) assert.equal(fees.buyerFees(cents), server.buyerFees(cents), `browser and server agree at ${cents}c`);
  for (const cents of [50_000, 123_457, 5_000_000]) assert.equal(fees.buyerFees(cents), server.buyerFees(cents));
  assert.equal(fees.allIn(500), "$6.30 (incl. $1.30 fees)", "the spec's AI EPK example");
  assert.equal(fees.allIn(3000), "$31.80 (incl. $1.80 fees)", "$30 and up: no $1");
  assert.equal(fees.allIn(2999), "$32.79 (incl. $2.80 fees)");
  assert.equal(fees.allInShort(75), "$1.80 incl. fees");
  assert.deepEqual({ ...fees.withFees(2500 * 2) }, { subtotalCents: 5000, feeCents: 300, totalCents: 5300 }, "a cart crossing $30 drops the $1");

  const read = file => fs.readFileSync(file, "utf8");
  // Every first-appearance price uses the shared helper.
  assert.match(read("assets/bazaar.js"), /withFees\(product\.priceCents\)\.totalCents[\s\S]*incl\. \$\{window\.DanzStakFees\.money\(window\.DanzStakFees\.buyerFees\(product\.priceCents\)\)\} fees/, "Bazaar cards show the all-in total with the fee under it");
  assert.match(read("assets/product.js"), /fees\.withFees\(product\.priceCents\)\.totalCents[\s\S]*byId\("productFee"\)/, "product page shows the all-in total and the fee line");
  assert.match(read("assets/event.js"), /DanzStakFees\.allIn\(cents\)[\s\S]*price\(tier\.priceCents\)/, "event ticket tiers show the all-in price");
  const tickets = read("assets/event-tickets.js");
  assert.match(tickets, /withFees\(subtotal\)/, "ticket selector total includes fees");
  assert.match(tickets, /drops off at \$30/, "the selector explains the $1 dropping off at $30");
  assert.doesNotMatch(tickets, /no added fees/i, "old 'no added fees' copy is gone");
  assert.match(read("assets/events-page.js"), /Tickets from \$\{money\([^\n]*buyerFees\([^\n]*\} incl\. fees/, "the event post in Mix quotes the all-in ticket price");
  assert.match(read("assets/events-page.js"), /money\(price \+ buyerFees\(price\)\)/, "event posters show the all-in 'From' price");
  const selections = read("assets/booking-selections.js");
  assert.match(selections, /allInShort\(75\)/, "contact unlock button shows the all-in price");
  assert.match(selections, /allInShort\(150\)/, "single credit button shows the all-in price");
  assert.doesNotMatch(selections, /"Unlock booking contact · \$0\.75"|"Buy 1 credit · \$1\.50"/, "no fee-less button prices remain");
  assert.match(read("sync/index.html"), /Get a DS number · \$4\.18 incl\. fees · Test Mode/);
  assert.match(read("messages.html"), /Get a DS number · \$4\.18 incl\. fees · Test Mode/, "$3 + 18c + $1 = $4.18");
  assert.equal(300 + server.buyerFees(300), 418);
  const terms = read("assets/purchase-terms.js");
  assert.match(terms, /Price \$\{money\(subtotalCents\)\} · DanzStak fee \$\{money\(feeCents\)\}/, "purchase dialog breaks out the fee before payment");
  assert.match(terms, /Total \$\{money\(totalCents\)\} \(USD\)/);

  // Every page that prices something loads fees.js before the script that uses it.
  const pages = { "bazaar.html": "assets/bazaar.js", "product.html": "assets/product.js", "event.html": "assets/event-tickets.js", "booking-selections.html": "assets/purchase-terms.js", "messages.html": "assets/purchase-terms.js", "feed.html": "assets/events-page.js", "event.html": "assets/events-page.js", "sync/index.html": "assets/purchase-terms.js" };
  for (const [page, script] of Object.entries(pages)) {
    const html = read(page), at = html.indexOf('src="assets/fees.js?v=1"'), user = html.indexOf(`src="${script}?v=`);
    assert.ok(at > 0 && user > at, `${page} loads assets/fees.js before ${script}`);
  }
  assert.match(read("service-worker.js"), /"\/assets\/fees\.js"/, "the offline shell caches fees.js");
  console.log("All-in price checks passed: browser fee math equals the server's, every first price shows the total incl. fees, and the $1 drops off at $30.");
})().catch(error => { console.error(error); process.exit(1); });
