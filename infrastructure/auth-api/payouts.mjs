// "Get paid" — seller/promoter payout onboarding through Stripe Connect (Accounts v2).
// Approved plan: claude/stripe-connect-plan.md (owner 2026-11-16). Sandbox only until the owner approves live.
// Risk controls: Stripe verifies every seller (ID, bank, tax forms) on Stripe's own pages; DanzStak stores only the
// Stripe account id and status — never ID or bank numbers. Payouts (later PRs) are released only from held funds and
// only to accounts whose transfers capability Stripe reports as active.
export const STRIPE_V2_VERSION = "2026-10-28.endive";
// US platform: cross-border transfers are supported to the US, UK, EEA, Canada and Switzerland.
export const PAYOUT_COUNTRIES = new Set(["US", "GB", "CA", "CH", "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS"]);
const MEMBER = /^[A-Za-z0-9_-]{8,128}$/;
const ACCOUNT = /^acct_[A-Za-z0-9]{8,64}$/;
const APP = "https://danzstak.com";

export function payoutStatus(account) {
  if (!account) return "none";
  if (account.closed) return "closed";
  const transfers = account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  if (transfers === "active") return "active";
  const due = account?.requirements?.entries || [];
  if (transfers === "restricted" && due.some(entry => entry?.minimum_deadline?.status === "past_due")) return "action_required";
  return "onboarding";
}

export function accountBody({ email, name, country, memberId }) {
  return {
    contact_email: email,
    display_name: String(name || "DanzStak seller").slice(0, 80),
    dashboard: "full",
    identity: { country: country.toLowerCase() },
    configuration: {
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      merchant: { capabilities: { card_payments: { requested: true } } }
    },
    defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
    metadata: { danzstak_member: memberId, danzstak_purpose: "marketplace_payouts" }
  };
}

export function createPayouts({ db, commands, authenticate, corsHeaders, tableName, getStripeKey, emailForUser, nameForUser = async () => "", fetchImpl = fetch, clock = Date.now, env = process.env }) {
  const { GetItemCommand, PutItemCommand } = commands;
  const key = userId => ({ pk: { S: `SELLER#${userId}` }, sk: { S: "PAYOUTS" } });
  const json = (statusCode, data, headers) => ({ statusCode, headers: { ...headers, "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(data) });

  async function stripeKey() {
    const value = await getStripeKey();
    // Sandbox only until the owner approves live payouts.
    if (!/^sk_test_|^rk_test_/.test(value || "") && env.MARKETPLACE_PAYOUTS_LIVE !== "approved") throw Object.assign(new Error("Payouts are in testing."), { status: 503 });
    return value;
  }
  async function stripe(method, path, body) {
    const response = await fetchImpl("https://api.stripe.com" + path, { method, headers: { Authorization: "Bearer " + await stripeKey(), "Stripe-Version": STRIPE_V2_VERSION, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data?.error?.message || "Stripe request failed."), { status: 502 });
    return data;
  }
  async function record(userId) {
    const result = await db.send(new GetItemCommand({ TableName: tableName, Key: key(userId), ConsistentRead: true }));
    const item = result.Item;
    return item ? { accountId: item.accountId?.S || "", country: item.country?.S || "", status: item.status?.S || "onboarding", createdAt: item.createdAt?.S || "" } : null;
  }
  async function save(userId, value) {
    const stamp = new Date(clock()).toISOString();
    await db.send(new PutItemCommand({ TableName: tableName, Item: { ...key(userId), accountId: { S: value.accountId }, country: { S: value.country }, status: { S: value.status }, createdAt: { S: value.createdAt || stamp }, updatedAt: { S: stamp } } }));
  }
  async function refresh(userId, current) {
    if (!current?.accountId || !ACCOUNT.test(current.accountId)) return current;
    const account = await stripe("GET", `/v2/core/accounts/${current.accountId}?include=configuration.recipient&include=requirements`);
    const status = payoutStatus(account);
    if (status !== current.status) await save(userId, { ...current, status });
    return { ...current, status };
  }
  async function signedIn(event) {
    const headers = corsHeaders(event?.headers?.origin);
    const userId = String(await authenticate(event) || "");
    return { headers, userId: MEMBER.test(userId) ? userId : "" };
  }

  async function getStatus(event) {
    const { headers, userId } = await signedIn(event);
    if (!userId) return json(401, { error: "Authentication required." }, headers);
    let current = await record(userId);
    try { current = await refresh(userId, current); } catch (error) { if (error.status === 503) return json(503, { error: error.message }, headers); }
    return json(200, { payouts: { status: current?.status || "none", country: current?.country || "", testing: env.MARKETPLACE_PAYOUTS_LIVE !== "approved" } }, headers);
  }

  async function onboarding(event) {
    const { headers, userId } = await signedIn(event);
    if (!headers?.["access-control-allow-origin"]) return json(403, { error: "Forbidden origin" }, headers);
    if (!userId) return json(401, { error: "Authentication required." }, headers);
    let body = {};
    try { body = JSON.parse(event?.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event?.body || "{}"); } catch { return json(400, { error: "Invalid request." }, headers); }
    const back = body.from === "event" ? "event" : "shop";
    try {
      let current = await record(userId);
      if (!current?.accountId) {
        const country = String(body.country || "").toUpperCase();
        if (!PAYOUT_COUNTRIES.has(country)) return json(400, { error: "Choose the country where your bank account is. DanzStak can pay out in the US, UK, EU/EEA, Canada and Switzerland." }, headers);
        const email = await emailForUser(userId);
        if (!email) return json(409, { error: "Your account needs an email address first." }, headers);
        const account = await stripe("POST", "/v2/core/accounts", accountBody({ email, name: await nameForUser(userId), country, memberId: userId }));
        if (!ACCOUNT.test(account?.id || "")) throw Object.assign(new Error("Stripe did not create the payout account."), { status: 502 });
        current = { accountId: account.id, country, status: "onboarding" };
        await save(userId, current);
      }
      const page = back === "event" ? `${APP}/feed.html?payouts=` : `${APP}/store.html?manage=1&payouts=`;
      const urls = { refresh_url: page + "refresh", return_url: page + "return" };
      let link;
      try { link = await stripe("POST", "/v2/core/account_links", { account: current.accountId, use_case: { type: "account_onboarding", account_onboarding: { configurations: ["recipient", "merchant"], ...urls } } }); }
      catch { link = await stripe("POST", "/v2/core/account_links", { account: current.accountId, use_case: { type: "account_onboarding", account_onboarding: urls } }); }
      if (!/^https:\/\/[a-z0-9.-]*stripe\.com\//.test(link?.url || "")) throw Object.assign(new Error("Stripe did not return a sign-up page."), { status: 502 });
      return json(200, { url: link.url }, headers);
    } catch (error) {
      return json(error.status || 500, { error: error.status ? error.message : "Payout sign-up is unavailable right now." }, headers);
    }
  }

  return async function payouts(event) {
    const method = event?.requestContext?.http?.method || "", path = event?.rawPath || "";
    if (path === "/marketplace/payouts" && method === "GET") return getStatus(event);
    if (path === "/marketplace/payouts/onboarding" && method === "POST") return onboarding(event);
    return null;
  };
}
