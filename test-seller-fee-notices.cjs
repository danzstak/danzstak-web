"use strict";
// Task 12 PR 6: sellers and promoters are told how the buyer-paid fee works, with a live "Buyer pays · You get" preview.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = file => fs.readFileSync(file, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(read("assets/fees.js"), sandbox);
const fees = sandbox.window.DanzStakFees;
const SELLER = "Buyers pay your price plus DanzStak's 6% fee ($1 more on orders under $30). You receive your full price plus your shipping. No fees come out of your payout.";
assert.equal(fees.SELLER_NOTICE, SELLER, "seller notice is the owner's wording");
assert.match(fees.PROMOTER_NOTICE, /^Buyers pay your ticket price plus DanzStak's 6% fee \(\$1 more on orders under \$30\)\. You receive your full ticket price\. No fees come out of your payout\.$/);
assert.equal(fees.payoutPreview(2500, 600), "Buyer pays $33.50 · You get $31.00", "$25 item + $6 shipping: buyer $25 + $2.50 fee + $6; seller $31");
assert.equal(fees.payoutPreview(3000, 0), "Buyer pays $31.80 · You get $30.00");
assert.equal(fees.payoutPreview(1500), "Buyer pays $16.90 · You get $15.00", "one $15 ticket");

const store = read("store.html"), storeJs = read("assets/store.js");
assert.ok(store.includes("<strong>How you get paid</strong>"), "shop listing form explains the payout");
assert.ok(store.includes(SELLER.replace("'", "&#39;")), "shop listing form shows the seller notice");
assert.ok(store.indexOf('src="assets/fees.js?v=') < store.indexOf('src="assets/store.js?v='), "store loads fees.js first");
assert.match(storeJs, /fees\.payoutPreview\(price, shipping\)/, "live preview includes shipping");
assert.match(storeJs, /productShipping"\)\.addEventListener\("input",updateFeePreview\)/, "preview updates when shipping changes");
assert.match(storeJs, /if \(managing\) window\.DanzStakFees\?\.feeChangeBanner\(/, "one-time banner in the shop dashboard");
assert.doesNotMatch(storeJs, /Math\.round\(price \* 0\.06\)/, "old seller-deducted math is gone");

const composer = read("assets/feed-enhancements.js");
assert.match(composer, /buyers pay DanzStak's 6% fee on top/, "ticket-sales toggle says buyers pay the fee");
assert.match(composer, /window\.DanzStakFees\?\.PROMOTER_NOTICE/, "event composer shows the promoter notice");
assert.match(composer, /One ticket: \$\{window\.DanzStakFees\.payoutPreview\(priceCents\)\}/, "event composer shows a live preview");
assert.match(composer, /ticketPrice\.wrap, ticketPreview, namedLabel/);
assert.doesNotMatch(composer, /comes out of your payout after the show|DanzStak keeps 6%/, "old promoter-paid copy is gone");
assert.match(read("assets/event-tickets.js"), /feeChangeBanner\(holder\.parentElement, window\.DanzStakFees\.PROMOTER_NOTICE\)/, "one-time banner in the promoter's event view");

const terms = read("terms.html");
assert.match(terms, /DanzStak's fee covers payment processing by Stripe and the cost of running the marketplace\./, "terms say where the fee goes");
assert.match(terms, /<strong>Promoters get their full price\.<\/strong>/);
assert.doesNotMatch(terms, /DanzStak adds no service or booking fee|Promoters pay the fees/, "old 8B fee rules are gone");
console.log("Seller and promoter fee notice checks passed: owner wording, live Buyer pays / You get previews, one-time banners and Terms 8A/8B.");
