"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const { createPayouts, accountBody, payoutStatus, PAYOUT_COUNTRIES, STRIPE_V2_VERSION } = await import("./infrastructure/auth-api/payouts.mjs");
  const store = new Map();
  class GetItemCommand { constructor(input) { this.input = input; this.kind = "get"; } }
  class PutItemCommand { constructor(input) { this.input = input; this.kind = "put"; } }
  const db = { async send(cmd) { const k = cmd.input.Key ? cmd.input.Key.pk.S : cmd.input.Item.pk.S; if (cmd.kind === "get") return { Item: store.get(k) }; store.set(k, cmd.input.Item); return {}; } };
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    assert.equal(init.headers["Stripe-Version"], STRIPE_V2_VERSION);
    if (url.endsWith("/v2/core/accounts") && init.method === "POST") return { ok: true, json: async () => ({ id: "acct_TESTSELLER123" }) };
    if (url.includes("/v2/core/account_links")) return { ok: true, json: async () => ({ url: "https://connect.stripe.com/setup/e/acct_TESTSELLER123/abc" }) };
    if (url.includes("/v2/core/accounts/acct_TESTSELLER123")) return { ok: true, json: async () => ({ id: "acct_TESTSELLER123", configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: "active" } } } } } }) };
    throw new Error("unexpected " + url);
  };
  const corsHeaders = origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {};
  let key = "sk_test_abc";
  const payouts = createPayouts({ db, commands: { GetItemCommand, PutItemCommand }, authenticate: async e => e.user || "", corsHeaders, tableName: "T", getStripeKey: async () => key, emailForUser: async () => "seller@example.com", fetchImpl, env: {} });
  const ev = (method, path, body, user = "member-1234", origin = "https://danzstak.com") => ({ requestContext: { http: { method } }, rawPath: path, headers: { origin }, body: body ? JSON.stringify(body) : "", user });

  let r = await payouts(ev("GET", "/marketplace/payouts"));
  assert.equal(JSON.parse(r.body).payouts.status, "none");
  assert.equal(JSON.parse(r.body).payouts.testing, true, "sandbox is labelled as testing");
  r = await payouts(ev("POST", "/marketplace/payouts/onboarding", { country: "RU" }));
  assert.equal(r.statusCode, 400, "only supported payout countries");
  r = await payouts(ev("POST", "/marketplace/payouts/onboarding", { country: "IT" }, "member-1234", "https://evil.example"));
  assert.equal(r.statusCode, 403, "other sites cannot start onboarding");
  r = await payouts(ev("POST", "/marketplace/payouts/onboarding", { country: "IT" }, ""));
  assert.equal(r.statusCode, 401);
  r = await payouts(ev("POST", "/marketplace/payouts/onboarding", { country: "IT" }));
  assert.equal(r.statusCode, 200);
  assert.match(JSON.parse(r.body).url, /^https:\/\/connect\.stripe\.com\//);
  const created = calls.find(c => c.url.endsWith("/v2/core/accounts")).body;
  assert.equal(created.dashboard, "full");
  assert.deepEqual(created.defaults.responsibilities, { fees_collector: "stripe", losses_collector: "stripe" }, "Stripe carries seller-account losses");
  assert.equal(created.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested, true);
  assert.equal(JSON.stringify(created).includes("bank"), false, "DanzStak sends no bank details");
  const stored = store.get("SELLER#member-1234");
  assert.equal(stored.accountId.S, "acct_TESTSELLER123");
  assert.deepEqual(Object.keys(stored).sort(), ["accountId", "country", "createdAt", "pk", "sk", "status", "updatedAt"], "only the Stripe id and status are stored");
  const before = calls.filter(c => c.url.endsWith("/v2/core/accounts")).length;
  await payouts(ev("POST", "/marketplace/payouts/onboarding", {}));
  assert.equal(calls.filter(c => c.url.endsWith("/v2/core/accounts")).length, before, "a second tap reuses the same account");
  r = await payouts(ev("GET", "/marketplace/payouts"));
  assert.equal(JSON.parse(r.body).payouts.status, "active");
  key = "rk_live_xyz";
  r = await payouts(ev("POST", "/marketplace/payouts/onboarding", {}));
  assert.equal(r.statusCode, 503, "live keys are refused until the owner approves live payouts");
  assert.equal(payoutStatus(null), "none");
  assert.ok(PAYOUT_COUNTRIES.has("IT") && PAYOUT_COUNTRIES.has("US") && !PAYOUT_COUNTRIES.has("RU"));
  assert.equal(accountBody({ email: "a@b.c", name: "", country: "US", memberId: "m" }).identity.country, "us");
  const js = fs.readFileSync("assets/payouts.js", "utf8");
  assert.match(js, /DanzStak never sees them/, "members are told DanzStak never sees ID or bank numbers");
  assert.match(fs.readFileSync("store.html", "utf8"), /assets\/payouts\.js\?v=\d+/);
  console.log("Marketplace payout onboarding checks passed: sandbox only, Stripe-hosted, Stripe carries account losses, minimal data stored.");
})().catch(e => { console.error(e); process.exit(1); });
