import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { marketplaceFeeCents, productKey as catalogProductKey, shopKey as catalogShopKey } from "./marketplace.mjs";
import { verifyStripeSignature } from "./tour-manager-billing.mjs";

const MEMBER_ID = /^[A-Za-z0-9_-]{8,128}$/;
const PRODUCT_ID = /^[a-f0-9-]{36}$/i;
const ORDER_ID = /^[a-f0-9-]{36}$/i;
const STRIPE_ACCOUNT_ID = /^acct_[A-Za-z0-9]{8,64}$/;
const STRIPE_SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{8,200}$/;
const STRIPE_CHARGE_ID = /^ch_[A-Za-z0-9]{8,200}$/;
const STRIPE_TRANSFER_ID = /^tr_[A-Za-z0-9]{8,200}$/;
const STRIPE_REVERSAL_ID = /^trr_[A-Za-z0-9]{8,200}$/;
const STRIPE_DISPUTE_ID = /^dp_[A-Za-z0-9]{8,200}$/;
const EASYPOST_TRACKER_ID = /^trk_[A-Za-z0-9]{8,200}$/;
const EASYPOST_EVENT_ID = /^evt_[A-Za-z0-9]{8,200}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TRACKING_CODE = /^[A-Za-z0-9][A-Za-z0-9 -]{4,79}$/;
const CARRIER = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,39}$/;
const SFS_MINT = "H2147Ppmd4CESHuCzPQf89rNnEgKrx98NDF4vi6HZZeK";
const SFS_PAIR = "AzeRe3RMmHPTG2Tkh4HLV3npHz1BsQhS856QVK4y1FQN";
const SFS_SETTLEMENT_WALLET = "8Cx5YqBgS43uqDrBzeSpDyBoQSp9fH71SwQ1e39m631C";
const SFS_SETTLEMENT_TOKEN_ACCOUNT = "8haVhbmoDEkRNp3TGzbgmM4zjDbxy5BMhVp9m1Gtn548";
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const SFS_DECIMALS = 2;
const SFS_QUOTE_LIFETIME_SECONDS = 3 * 60;
const SFS_MIN_LIQUIDITY_USD = 5_000;
const SFS_MAX_ORDER_LIQUIDITY_RATIO = 0.01;
const STRIPE_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
  "charge.dispute.created"
]);
const SECURITY_HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
};
const CHECKOUT_LIFETIME_SECONDS = 30 * 60;
const EASYPOST_TOLERANCE_SECONDS = 60;
const EASYPOST_FUTURE_SKEW_SECONDS = 30;

function response(statusCode, data, headers = {}) {
  return { statusCode, headers: { ...SECURITY_HEADERS, ...headers }, body: JSON.stringify(data) };
}

function rawBody(event) {
  if (typeof event?.body !== "string") return "";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

function parseBody(event) {
  try { return JSON.parse(rawBody(event) || "{}"); } catch { return null; }
}

function string(item, name) { return item?.[name]?.S || ""; }
function number(item, name) { const value = Number(item?.[name]?.N); return Number.isFinite(value) ? value : 0; }
function bool(item, name) { return item?.[name]?.BOOL === true; }
function orderKey(orderId) { return { pk: { S: `ORDER#${orderId}` }, sk: { S: "ORDER" } }; }
function productKey(sellerId, productId) { return catalogProductKey(sellerId, productId); }
function shopKey(sellerId) { return catalogShopKey(sellerId); }
function payoutKey(sellerId, livemode = false) { return { pk: { S: `SELLER#${sellerId}` }, sk: { S: `PAYOUT#STRIPE#${livemode ? "LIVE" : "TEST"}` } }; }
function trackerKey(trackerId) { return { pk: { S: `TRACKER#${trackerId}` }, sk: { S: "ORDER" } }; }
function chargeKey(chargeId) { return { pk: { S: `CHARGE#${chargeId}` }, sk: { S: "ORDER" } }; }
function eventKey(provider, eventId) {
  return { pk: { S: `PAYMENT_EVENT#${provider}` }, sk: { S: createHash("sha256").update(eventId).digest("hex") } };
}

function checkoutCountries(env) {
  const configured = String(env.MARKETPLACE_SHIPPING_COUNTRIES || "US")
    .split(",")
    .map(value => value.trim().toUpperCase())
    .filter(value => /^[A-Z]{2}$/.test(value));
  return [...new Set(configured)].slice(0, 50);
}

function liveKey(env) { return env.STRIPE_SECRET_KEY?.startsWith("sk_live_"); }
function testKey(env) { return env.STRIPE_SECRET_KEY?.startsWith("sk_test_"); }
function paymentsAllowed(env) {
  if (env.MARKETPLACE_CHECKOUT_ENABLED !== "true" || !env.STRIPE_MARKETPLACE_WEBHOOK_SECRET?.startsWith("whsec_")) return false;
  if (testKey(env)) return true;
  return liveKey(env) && env.MARKETPLACE_LIVE_PAYMENTS === "true";
}

function stripeObjectId(value) { return typeof value === "string" ? value : value?.id || ""; }

function connectedAccountTransferStatus(account) {
  return String(account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status || "");
}

export function marketplaceAmounts(itemPriceCents, shippingCents) {
  if (!Number.isSafeInteger(itemPriceCents) || itemPriceCents < 0 || !Number.isSafeInteger(shippingCents) || shippingCents < 0) throw new TypeError("Marketplace amounts must be non-negative integer cents");
  const platformFeeCents = marketplaceFeeCents(itemPriceCents);
  return {
    itemPriceCents,
    shippingCents,
    platformFeeCents,
    sellerPayoutCents: itemPriceCents - platformFeeCents + shippingCents,
    subtotalCents: itemPriceCents + shippingCents
  };
}

function decimalParts(value) {
  const match = String(value ?? "").trim().match(/^(0|[1-9]\d*)(?:\.(\d{1,18}))?$/);
  if (!match) throw new TypeError("DEX price must be a positive decimal");
  const fraction = match[2] || "", scale = 10n ** BigInt(fraction.length);
  const units = BigInt(match[1]) * scale + BigInt(fraction || "0");
  if (units <= 0n) throw new TypeError("DEX price must be a positive decimal");
  return { units, scale };
}

function ceilDivide(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

function tokenUnitsText(units, decimals) {
  const scale = 10n ** BigInt(decimals), whole = units / scale, fraction = String(units % scale).padStart(decimals, "0");
  return decimals ? `${whole}.${fraction}` : String(whole);
}

export function createSfsDexQuote({ pairResponse, usdCents, fetchedAt = Date.now(), minimumLiquidityUsd = SFS_MIN_LIQUIDITY_USD, maximumOrderLiquidityRatio = SFS_MAX_ORDER_LIQUIDITY_RATIO }) {
  if (!Number.isSafeInteger(usdCents) || usdCents <= 0) throw new TypeError("SFS quote requires positive integer USD cents");
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) throw new TypeError("SFS quote fetch time is invalid");
  if (!Number.isFinite(minimumLiquidityUsd) || minimumLiquidityUsd <= 0 || !Number.isFinite(maximumOrderLiquidityRatio) || maximumOrderLiquidityRatio <= 0 || maximumOrderLiquidityRatio > 0.1) throw new TypeError("SFS quote risk limits are invalid");
  const pairs = Array.isArray(pairResponse?.pairs) ? pairResponse.pairs : Array.isArray(pairResponse) ? pairResponse : [];
  const pair = pairs.find(candidate => candidate?.pairAddress === SFS_PAIR);
  if (!pair || pair.chainId !== "solana" || pair.dexId !== "raydium" || pair.baseToken?.address !== SFS_MINT || pair.quoteToken?.address !== WRAPPED_SOL_MINT) throw new TypeError("DexScreener returned the wrong SFS market");
  const liquidityUsd = Number(pair?.liquidity?.usd);
  if (!Number.isFinite(liquidityUsd) || liquidityUsd < minimumLiquidityUsd) throw new TypeError("SFS market liquidity is below the checkout minimum");
  const maximumOrderUsdCents = Math.floor(liquidityUsd * 100 * maximumOrderLiquidityRatio);
  if (usdCents > maximumOrderUsdCents) throw new TypeError("This order is too large for protected SFS pricing");
  const price = decimalParts(pair.priceUsd);
  const priceNative = Number(pair.priceNative);
  if (!Number.isFinite(priceNative) || priceNative <= 0) throw new TypeError("DexScreener returned an invalid SFS/SOL price");
  const smallestUnits = ceilDivide(BigInt(usdCents) * price.scale * (10n ** BigInt(SFS_DECIMALS)), 100n * price.units);
  return {
    source: "dexscreener",
    sourceUrl: `https://api.dexscreener.com/latest/dex/pairs/solana/${SFS_PAIR}`,
    chain: "solana-mainnet",
    dex: "raydium",
    pairAddress: SFS_PAIR,
    mint: SFS_MINT,
    recipient: SFS_SETTLEMENT_WALLET,
    destinationTokenAccount: SFS_SETTLEMENT_TOKEN_ACCOUNT,
    tokenDecimals: SFS_DECIMALS,
    priceUsd: String(pair.priceUsd),
    priceSol: String(pair.priceNative),
    sfsPerSol: String(Math.round((1 / priceNative) * 10_000) / 10_000),
    liquidityUsd,
    usdCents,
    tokenAmount: tokenUnitsText(smallestUnits, SFS_DECIMALS),
    tokenAmountSmallestUnits: String(smallestUnits),
    fetchedAt: new Date(fetchedAt).toISOString(),
    expiresAt: new Date(fetchedAt + SFS_QUOTE_LIFETIME_SECONDS * 1000).toISOString(),
    maximumOrderUsdCents
  };
}

export function createSfsSolanaPayUrl({ quote, reference, memoReference }) {
  if (!quote || quote.mint !== SFS_MINT || quote.recipient !== SFS_SETTLEMENT_WALLET || !/^\d+\.\d{2}$/.test(quote.tokenAmount || "")) throw new TypeError("Verified SFS quote required");
  if (!SOLANA_ADDRESS.test(reference || "")) throw new TypeError("Unique Solana Pay reference required");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(memoReference || "")) throw new TypeError("Opaque order memo required");
  const parameters = new URLSearchParams({
    amount: quote.tokenAmount,
    "spl-token": SFS_MINT,
    reference,
    label: "DanzStak",
    message: "DanzStak order payment",
    memo: `DS-${memoReference}`
  });
  return `solana:${SFS_SETTLEMENT_WALLET}?${parameters.toString()}`;
}

export function verifyEasyPostSignature({ payload, method = "POST", requestPath, timestamp, signedPath, signature, secret, currentTime = Date.now() }) {
  if (typeof payload !== "string" || !payload || method !== "POST" || typeof secret !== "string" || !secret || typeof timestamp !== "string" || typeof signedPath !== "string" || signedPath !== requestPath) return false;
  const sentAt = Date.parse(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  const ageSeconds = (currentTime - sentAt) / 1000;
  if (ageSeconds > EASYPOST_TOLERANCE_SECONDS || ageSeconds < -EASYPOST_FUTURE_SKEW_SECONDS) return false;
  const encoded = String(signature || "").replace(/^hmac-sha256-hex=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(encoded)) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}${method}${signedPath}${payload}`, "utf8").digest();
  const candidate = Buffer.from(encoded, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function publicOrder(item, viewerId) {
  const buyer = string(item, "buyerId") === viewerId;
  const seller = string(item, "sellerId") === viewerId;
  if (!buyer && !seller) return null;
  return {
    id: string(item, "orderId"),
    role: buyer ? "buyer" : "seller",
    productId: string(item, "productId"),
    productTitle: string(item, "productTitle"),
    itemPriceCents: number(item, "itemPriceCents"),
    shippingCents: number(item, "shippingCents"),
    platformFeeCents: seller ? number(item, "platformFeeCents") : undefined,
    sellerPayoutCents: seller ? number(item, "sellerPayoutCents") : undefined,
    taxCents: number(item, "taxCents"),
    currency: string(item, "currency"),
    status: string(item, "status"),
    payoutStatus: seller ? string(item, "payoutStatus") : undefined,
    trackingCode: string(item, "trackingCode") || undefined,
    carrier: string(item, "carrier") || undefined,
    createdAt: string(item, "createdAt"),
    paidAt: string(item, "paidAt") || undefined,
    deliveredAt: string(item, "deliveredAt") || undefined
  };
}

export function createMarketplaceCommerce({ db, commands, authenticate, corsHeaders, tableName, env = process.env, fetcher = fetch, clock = Date.now, uuid = randomUUID }) {
  const { GetItemCommand, PutItemCommand, UpdateItemCommand, TransactWriteItemsCommand } = commands;
  const nowIso = () => new Date(clock()).toISOString();
  const browserHeaders = event => corsHeaders(event?.headers?.origin || event?.headers?.Origin);

  async function stripe(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await fetcher(`https://api.stripe.com/v1${path}`, {
        ...options,
        signal: controller.signal,
        headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(options.headers || {}) }
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) { const error = new Error("Stripe request failed"); error.statusCode = result.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }

  async function stripeV2(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await fetcher(`https://api.stripe.com/v2${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "stripe-version": env.STRIPE_CONNECT_API_VERSION || "2026-10-28.preview",
          ...(options.headers || {})
        }
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) { const error = new Error("Stripe Connect request failed"); error.statusCode = result.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }

  async function easyPost(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const auth = Buffer.from(`${env.EASYPOST_API_KEY || ""}:`).toString("base64");
      const result = await fetcher(`https://api.easypost.com/v2${path}`, {
        ...options,
        signal: controller.signal,
        headers: { authorization: `Basic ${auth}`, "content-type": "application/json", ...(options.headers || {}) }
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) { const error = new Error("Shipping provider request failed"); error.statusCode = result.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }

  async function requireUser(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return { error: response(403, { error: "Forbidden origin." }, headers), headers };
    const id = await authenticate(event);
    if (!MEMBER_ID.test(id || "")) return { error: response(401, { error: "Sign in required." }, headers), headers };
    return { id, headers };
  }

  async function retrieveConnectedAccount(accountId) {
    const query = new URLSearchParams();
    query.append("include[]", "configuration.recipient");
    query.append("include[]", "requirements");
    const account = await stripeV2(`/core/accounts/${encodeURIComponent(accountId)}?${query}`);
    if (!STRIPE_ACCOUNT_ID.test(account?.id || "") || account.id !== accountId) throw new Error("Stripe connected account is invalid");
    return account;
  }

  async function storePayoutStatus(sellerId, account, at = nowIso()) {
    const transferStatus = connectedAccountTransferStatus(account), ready = transferStatus === "active", livemode = Boolean(liveKey(env));
    await db.send(new PutItemCommand({
      TableName: tableName,
      Item: {
        ...payoutKey(sellerId, livemode),
        entityType: { S: "seller_payout" },
        sellerId: { S: sellerId },
        stripeAccountId: { S: account.id },
        status: { S: ready ? "ready" : "onboarding" },
        transferCapabilityStatus: { S: transferStatus || "pending" },
        payoutsEnabled: { BOOL: ready },
        livemode: { BOOL: livemode },
        updatedAt: { S: at }
      }
    }));
    return { ready, transferStatus: transferStatus || "pending" };
  }

  async function payoutStatus(event) {
    const access = await requireUser(event);
    if (access.error) return access.error;
    if (!paymentsAllowed(env)) return response(503, { error: "Bazaar seller payouts are not enabled." }, access.headers);
    const stored = (await db.send(new GetItemCommand({ TableName: tableName, Key: payoutKey(access.id, Boolean(liveKey(env))), ConsistentRead: true }))).Item;
    const accountId = string(stored, "stripeAccountId");
    if (!STRIPE_ACCOUNT_ID.test(accountId)) return response(200, { connected: false, ready: false }, access.headers);
    try {
      const account = await retrieveConnectedAccount(accountId), status = await storePayoutStatus(access.id, account);
      return response(200, { connected: true, ready: status.ready, transferCapabilityStatus: status.transferStatus }, access.headers);
    } catch {
      return response(502, { error: "Seller payout status could not be verified." }, access.headers);
    }
  }

  async function payoutOnboarding(event) {
    const access = await requireUser(event);
    if (access.error) return access.error;
    if (!paymentsAllowed(env)) return response(503, { error: "Bazaar seller payouts are not enabled." }, access.headers);
    const body = parseBody(event), country = String(body?.country || "US").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) return response(400, { error: "Choose a valid seller country." }, access.headers);
    const mode = Boolean(liveKey(env)), stored = (await db.send(new GetItemCommand({ TableName: tableName, Key: payoutKey(access.id, mode), ConsistentRead: true }))).Item;
    let accountId = string(stored, "stripeAccountId");
    try {
      if (!STRIPE_ACCOUNT_ID.test(accountId)) {
        const account = await stripeV2("/core/accounts", {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": `marketplace-connect-${mode ? "live" : "test"}-${access.id}` },
          body: JSON.stringify({
            display_name: "DanzStak seller",
            dashboard: "express",
            identity: { country: country.toLowerCase() },
            defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
            configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
            include: ["configuration.recipient", "identity", "requirements"]
          })
        });
        if (!STRIPE_ACCOUNT_ID.test(account?.id || "")) throw new Error("Stripe did not create a connected account");
        accountId = account.id;
        await storePayoutStatus(access.id, account);
      } else {
        const account = await retrieveConnectedAccount(accountId);
        await storePayoutStatus(access.id, account);
      }
      const link = await stripeV2("/core/account_links", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": `marketplace-onboarding-${access.id}-${Math.floor(clock() / 300000)}` },
        body: JSON.stringify({
          account: accountId,
          use_case: {
            type: "account_onboarding",
            account_onboarding: {
              collection_options: { fields: "eventually_due" },
              refresh_url: "https://danzstak.com/store.html?payout=refresh",
              return_url: "https://danzstak.com/store.html?payout=return"
            }
          }
        })
      });
      if (!String(link?.url || "").startsWith("https://connect.stripe.com/") || !Number.isSafeInteger(Number(link?.expires_at))) throw new Error("Stripe did not return a safe onboarding link");
      return response(201, { onboardingUrl: link.url, expiresAt: Number(link.expires_at) }, access.headers);
    } catch {
      return response(502, { error: "Seller payout onboarding could not be started." }, access.headers);
    }
  }

  async function releaseReservation(order, finalStatus) {
    if (bool(order, "reservationReleased") || ["paid_pending_shipment", "shipped", "delivered"].includes(string(order, "status"))) return false;
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Update: {
        TableName: tableName,
        Key: productKey(string(order, "sellerId"), string(order, "productId")),
        UpdateExpression: "SET reservedInventory = reservedInventory - :one, updatedAt = :at",
        ConditionExpression: "reservedInventory >= :one",
        ExpressionAttributeValues: { ":one": { N: "1" }, ":at": { S: nowIso() } }
      } },
      { Update: {
        TableName: tableName,
        Key: orderKey(string(order, "orderId")),
        UpdateExpression: "SET #status = :status, reservationReleased = :yes, updatedAt = :at",
        ConditionExpression: "attribute_not_exists(reservationReleased) OR reservationReleased = :no",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": { S: finalStatus }, ":yes": { BOOL: true }, ":no": { BOOL: false }, ":at": { S: nowIso() } }
      } }
    ] }));
    return true;
  }

  async function abortCheckoutSession(order, session) {
    if (STRIPE_SESSION_ID.test(session?.id || "")) {
      const expired = await stripe(`/checkout/sessions/${encodeURIComponent(session.id)}/expire`, {
        method: "POST",
        headers: { "idempotency-key": `marketplace-expire-${string(order, "orderId")}` }
      });
      if (expired.id !== session.id || expired.status !== "expired") throw new Error("Stripe Checkout Session could not be expired");
    }
    await releaseReservation(order, "checkout_failed");
  }

  async function checkout(event) {
    const access = await requireUser(event);
    if (access.error) return access.error;
    if (!paymentsAllowed(env)) return response(503, { error: "Bazaar Test Mode checkout is not enabled." }, access.headers);
    const body = parseBody(event), sellerId = String(body?.sellerId || ""), productId = String(body?.productId || "");
    if (!MEMBER_ID.test(sellerId) || !PRODUCT_ID.test(productId)) return response(400, { error: "Choose a valid Bazaar item." }, access.headers);
    if (sellerId === access.id) return response(409, { error: "You cannot buy your own listing." }, access.headers);

    const [shopResult, productResult, payoutResult] = await Promise.all([
      db.send(new GetItemCommand({ TableName: tableName, Key: shopKey(sellerId), ConsistentRead: true })),
      db.send(new GetItemCommand({ TableName: tableName, Key: productKey(sellerId, productId), ConsistentRead: true })),
      db.send(new GetItemCommand({ TableName: tableName, Key: payoutKey(sellerId, Boolean(liveKey(env))), ConsistentRead: true }))
    ]);
    const shop = shopResult.Item, product = productResult.Item, payout = payoutResult.Item;
    if (!shop || string(shop, "status") !== "published" || !product || string(product, "status") !== "published" || number(product, "inventory") < 1) return response(409, { error: "This item is no longer available." }, access.headers);
    const stripeAccountId = string(payout, "stripeAccountId");
    if (!STRIPE_ACCOUNT_ID.test(stripeAccountId) || string(payout, "status") !== "ready" || !bool(payout, "payoutsEnabled") || bool(payout, "livemode") !== Boolean(liveKey(env))) return response(409, { error: "The seller must finish payout onboarding before checkout." }, access.headers);
    try {
      const account = await retrieveConnectedAccount(stripeAccountId), current = await storePayoutStatus(sellerId, account);
      if (!current.ready) return response(409, { error: "The seller must finish payout onboarding before checkout." }, access.headers);
    } catch {
      return response(502, { error: "The seller payout account could not be verified." }, access.headers);
    }

    const amounts = marketplaceAmounts(number(product, "priceCents"), number(product, "shippingCents"));
    const orderId = uuid(), at = nowIso(), expiresAt = Math.floor(clock() / 1000) + CHECKOUT_LIFETIME_SECONDS;
    const transferGroup = `DS_ORDER_${orderId.replace(/-/g, "")}`;
    const order = {
      ...orderKey(orderId), entityType: { S: "order" }, orderId: { S: orderId }, buyerId: { S: access.id }, sellerId: { S: sellerId },
      productId: { S: productId }, productTitle: { S: string(product, "title") }, itemPriceCents: { N: String(amounts.itemPriceCents) },
      shippingCents: { N: String(amounts.shippingCents) }, platformFeeCents: { N: String(amounts.platformFeeCents) },
      sellerPayoutCents: { N: String(amounts.sellerPayoutCents) }, subtotalCents: { N: String(amounts.subtotalCents) }, taxCents: { N: "0" },
      currency: { S: "usd" }, status: { S: "checkout_creating" }, payoutStatus: { S: "pending_payment" }, reservationReleased: { BOOL: false },
      stripeAccountId: { S: stripeAccountId }, transferGroup: { S: transferGroup }, livemode: { BOOL: Boolean(liveKey(env)) },
      checkoutExpiresAt: { N: String(expiresAt) }, createdAt: { S: at }, updatedAt: { S: at }
    };
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: {
          TableName: tableName, Key: productKey(sellerId, productId),
          UpdateExpression: "SET reservedInventory = if_not_exists(reservedInventory, :zero) + :one, updatedAt = :at",
          ConditionExpression: "#status = :published AND inventory > :zero AND (attribute_not_exists(reservedInventory) OR inventory > reservedInventory)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":zero": { N: "0" }, ":one": { N: "1" }, ":published": { S: "published" }, ":at": { S: at } }
        } },
        { Put: { TableName: tableName, Item: order, ConditionExpression: "attribute_not_exists(pk)" } }
      ] }));
    } catch (error) {
      return response(error?.name === "TransactionCanceledException" ? 409 : 500, { error: error?.name === "TransactionCanceledException" ? "This item is already reserved or sold." : "Checkout could not reserve the item." }, access.headers);
    }

    let session = null;
    try {
      const form = new URLSearchParams({
        mode: "payment",
        "payment_method_types[0]": "card",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": string(product, "title").slice(0, 200),
        "line_items[0][price_data][unit_amount]": String(amounts.itemPriceCents),
        "line_items[0][quantity]": "1",
        "payment_intent_data[transfer_group]": transferGroup,
        "payment_intent_data[metadata][orderId]": orderId,
        "metadata[product]": "danzstak_bazaar_item",
        "metadata[orderId]": orderId,
        "metadata[buyerId]": access.id,
        "metadata[sellerId]": sellerId,
        "metadata[productId]": productId,
        client_reference_id: access.id,
        expires_at: String(expiresAt),
        success_url: `https://danzstak.com/store.html?member=${encodeURIComponent(sellerId)}&product=${encodeURIComponent(productId)}&order=${encodeURIComponent(orderId)}&checkout=success`,
        cancel_url: `https://danzstak.com/store.html?member=${encodeURIComponent(sellerId)}&product=${encodeURIComponent(productId)}&checkout=cancelled`
      });
      if (amounts.shippingCents > 0) {
        form.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
        form.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(amounts.shippingCents));
        form.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
        form.set("shipping_options[0][shipping_rate_data][display_name]", "Seller shipping");
      }
      checkoutCountries(env).forEach((country, index) => form.set(`shipping_address_collection[allowed_countries][${index}]`, country));
      if (env.MARKETPLACE_AUTOMATIC_TAX === "true") form.set("automatic_tax[enabled]", "true");
      session = await stripe("/checkout/sessions", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `marketplace-checkout-${orderId}` }, body: form.toString() });
      if (!STRIPE_SESSION_ID.test(session.id || "") || !String(session.url || "").startsWith("https://checkout.stripe.com/")) throw new Error("Stripe returned an invalid Checkout Session");
      await db.send(new UpdateItemCommand({
        TableName: tableName, Key: orderKey(orderId),
        UpdateExpression: "SET checkoutSessionId = :session, checkoutUrl = :url, #status = :open, updatedAt = :at",
        ConditionExpression: "#status = :creating",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":session": { S: session.id }, ":url": { S: session.url }, ":open": { S: "checkout_open" }, ":creating": { S: "checkout_creating" }, ":at": { S: nowIso() } }
      }));
      return response(201, { orderId, checkoutUrl: session.url, itemPriceCents: amounts.itemPriceCents, shippingCents: amounts.shippingCents, platformFeeCents: amounts.platformFeeCents, currency: "usd" }, access.headers);
    } catch (error) {
      try {
        await abortCheckoutSession(order, session);
        return response(502, { error: "Checkout initialization failed; no payment was taken." }, access.headers);
      } catch {
        try {
          await db.send(new UpdateItemCommand({
            TableName: tableName,
            Key: orderKey(orderId),
            UpdateExpression: "SET #status = :review, checkoutSessionId = :session, updatedAt = :at",
            ConditionExpression: "#status = :creating",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":review": { S: "reconciliation_required" },
              ":session": { S: STRIPE_SESSION_ID.test(session?.id || "") ? session.id : "not_created" },
              ":at": { S: nowIso() },
              ":creating": { S: "checkout_creating" }
            }
          }));
        } catch { /* reservation intentionally stays locked for operator reconciliation */ }
        return response(503, { error: "Checkout is unavailable and this order needs reconciliation. No checkout link was returned." }, access.headers);
      }
    }
  }

  async function stripeSession(sessionId) {
    const query = new URLSearchParams();
    query.append("expand[]", "line_items");
    query.append("expand[]", "payment_intent.latest_charge");
    return stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}?${query}`);
  }

  async function recordIgnoredEvent(provider, eventId, type, orderId = "") {
    try {
      await db.send(new PutItemCommand({ TableName: tableName, Item: { ...eventKey(provider, eventId), eventType: { S: type }, orderId: { S: orderId }, outcome: { S: "ignored" }, processedAt: { S: nowIso() } }, ConditionExpression: "attribute_not_exists(pk)" }));
    } catch { /* duplicate ignored events remain idempotent */ }
  }

  async function finalizePaidOrder(eventId, eventType, session) {
    const orderId = String(session?.metadata?.orderId || "");
    if (!ORDER_ID.test(orderId)) throw new Error("Stripe Session order metadata is invalid");
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(orderId), ConsistentRead: true }));
    const order = found.Item;
    if (!order || string(order, "checkoutSessionId") !== session.id || string(order, "buyerId") !== session.client_reference_id || String(session?.metadata?.sellerId || "") !== string(order, "sellerId") || String(session?.metadata?.productId || "") !== string(order, "productId")) throw new Error("Stripe Session does not match the stored order");
    if (bool(order, "livemode") !== Boolean(session.livemode) || session.mode !== "payment" || session.status !== "complete" || session.currency !== "usd") throw new Error("Stripe Session mode does not match the order");
    if (session.payment_status !== "paid") {
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: orderKey(orderId), UpdateExpression: "SET #status = :status, updatedAt = :at", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":status": { S: "awaiting_payment" }, ":at": { S: nowIso() } } }));
      await recordIgnoredEvent("stripe", eventId, eventType, orderId);
      return { orderId, paid: false };
    }
    const taxCents = Number(session?.total_details?.amount_tax || 0);
    const shippingCents = Number(session?.total_details?.amount_shipping || 0);
    const itemPriceCents = number(order, "itemPriceCents");
    const expectedShippingCents = number(order, "shippingCents");
    if (!Number.isSafeInteger(taxCents) || taxCents < 0 || !Number.isSafeInteger(shippingCents) || shippingCents !== expectedShippingCents || session.amount_subtotal !== itemPriceCents || session.amount_total !== itemPriceCents + shippingCents + taxCents) throw new Error("Stripe Session amount does not match the stored order");
    const paymentIntentId = stripeObjectId(session.payment_intent), chargeId = stripeObjectId(session.payment_intent?.latest_charge);
    if (!/^pi_[A-Za-z0-9]{8,200}$/.test(paymentIntentId) || !STRIPE_CHARGE_ID.test(chargeId)) throw new Error("Stripe charge identifiers are missing");
    if (["paid_pending_shipment", "shipped", "delivered"].includes(string(order, "status"))) {
      await recordIgnoredEvent("stripe", eventId, eventType, orderId);
      return { orderId, paid: true, duplicate: true };
    }
    const productResult = await db.send(new GetItemCommand({ TableName: tableName, Key: productKey(string(order, "sellerId"), string(order, "productId")), ConsistentRead: true })), product = productResult.Item;
    if (!product || number(product, "inventory") < 1 || number(product, "reservedInventory") < 1) throw new Error("Reserved inventory is missing");
    const at = nowIso(), finalItem = number(product, "inventory") === 1;
    const productUpdate = finalItem ? {
      TableName: tableName, Key: productKey(string(order, "sellerId"), string(order, "productId")),
      UpdateExpression: "SET inventory = :zero, reservedInventory = reservedInventory - :one, #status = :sold, revision = revision + :one, updatedAt = :at REMOVE bazaarPk, bazaarSk",
      ConditionExpression: "inventory = :one AND reservedInventory >= :one",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":zero": { N: "0" }, ":one": { N: "1" }, ":sold": { S: "sold_out" }, ":at": { S: at } }
    } : {
      TableName: tableName, Key: productKey(string(order, "sellerId"), string(order, "productId")),
      UpdateExpression: "SET inventory = inventory - :one, reservedInventory = reservedInventory - :one, revision = revision + :one, updatedAt = :at",
      ConditionExpression: "inventory > :one AND reservedInventory >= :one",
      ExpressionAttributeValues: { ":one": { N: "1" }, ":at": { S: at } }
    };
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey("stripe", eventId), eventType: { S: eventType }, orderId: { S: orderId }, outcome: { S: "paid" }, processedAt: { S: at } }, ConditionExpression: "attribute_not_exists(pk)" } },
        { Put: { TableName: tableName, Item: { ...chargeKey(chargeId), orderId: { S: orderId }, createdAt: { S: at } }, ConditionExpression: "attribute_not_exists(pk)" } },
        { Update: productUpdate },
        { Update: {
          TableName: tableName, Key: orderKey(orderId),
          UpdateExpression: "SET #status = :paid, payoutStatus = :pending, paymentIntentId = :intent, chargeId = :charge, taxCents = :tax, paidAt = :at, updatedAt = :at",
          ConditionExpression: "checkoutSessionId = :session AND (#status = :open OR #status = :awaiting)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":paid": { S: "paid_pending_shipment" }, ":pending": { S: "pending_delivery" }, ":intent": { S: paymentIntentId }, ":charge": { S: chargeId }, ":tax": { N: String(taxCents) }, ":at": { S: at }, ":session": { S: session.id }, ":open": { S: "checkout_open" }, ":awaiting": { S: "awaiting_payment" } }
        } }
      ] }));
    } catch (error) {
      const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey("stripe", eventId), ConsistentRead: true }));
      if (!duplicate.Item) throw error;
      return { orderId, paid: true, duplicate: true };
    }
    return { orderId, paid: true };
  }

  async function failCheckout(eventId, eventType, session) {
    const orderId = String(session?.metadata?.orderId || "");
    if (!ORDER_ID.test(orderId)) { await recordIgnoredEvent("stripe", eventId, eventType); return { ignored: true }; }
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(orderId), ConsistentRead: true })), order = found.Item;
    if (!order || string(order, "checkoutSessionId") !== session.id) { await recordIgnoredEvent("stripe", eventId, eventType, orderId); return { ignored: true }; }
    try { await releaseReservation(order, eventType.endsWith("expired") ? "checkout_expired" : "payment_failed"); } catch (error) {
      if (!["checkout_expired", "payment_failed"].includes(string((await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(orderId), ConsistentRead: true }))).Item, "status"))) throw error;
    }
    await recordIgnoredEvent("stripe", eventId, eventType, orderId);
    return { orderId, failed: true };
  }

  async function reverseTransfer(transferId, order, reason) {
    if (!STRIPE_TRANSFER_ID.test(transferId)) return "";
    const form = new URLSearchParams({ amount: String(number(order, "sellerPayoutCents")), description: `DanzStak ${reason} for order ${string(order, "orderId")}`, "metadata[orderId]": string(order, "orderId") });
    const reversal = await stripe(`/transfers/${encodeURIComponent(transferId)}/reversals`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `marketplace-${reason}-${string(order, "orderId")}` }, body: form.toString() });
    if (!STRIPE_REVERSAL_ID.test(reversal.id || "") || Number(reversal.amount) !== number(order, "sellerPayoutCents")) throw new Error("Stripe returned an invalid transfer reversal");
    return reversal.id;
  }

  async function reverseReleasedTransfer(order, reason) {
    return reverseTransfer(string(order, "transferId"), order, reason);
  }

  async function orderForCharge(chargeId) {
    if (!STRIPE_CHARGE_ID.test(chargeId)) return null;
    const mapped = await db.send(new GetItemCommand({ TableName: tableName, Key: chargeKey(chargeId), ConsistentRead: true })), orderId = string(mapped.Item, "orderId");
    if (!ORDER_ID.test(orderId)) return null;
    return (await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(orderId), ConsistentRead: true }))).Item || null;
  }

  async function processRefund(eventId, supplied) {
    if (!STRIPE_CHARGE_ID.test(supplied?.id || "")) throw new Error("Stripe refund charge is invalid");
    const charge = await stripe(`/charges/${encodeURIComponent(supplied.id)}`), order = await orderForCharge(charge.id);
    if (!order || string(order, "chargeId") !== charge.id || Number(charge.amount) !== number(order, "subtotalCents") + number(order, "taxCents")) throw new Error("Stripe refund does not match a Bazaar order");
    if (Number(charge.amount_refunded) !== Number(charge.amount) || charge.refunded !== true) {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey("stripe", eventId), eventType: { S: "charge.refunded" }, orderId: { S: string(order, "orderId") }, outcome: { S: "partial_refund_review" }, processedAt: { S: nowIso() } }, ConditionExpression: "attribute_not_exists(pk)" } },
        { Update: { TableName: tableName, Key: orderKey(string(order, "orderId")), UpdateExpression: "SET payoutStatus = :review, updatedAt = :at", ExpressionAttributeValues: { ":review": { S: "manual_review" }, ":at": { S: nowIso() } } } }
      ] }));
      return { orderId: string(order, "orderId"), manualReview: true };
    }
    let reversalId = "";
    if (string(order, "payoutStatus") === "released") reversalId = await reverseReleasedTransfer(order, "refund-reversal");
    const at = nowIso();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey("stripe", eventId), eventType: { S: "charge.refunded" }, orderId: { S: string(order, "orderId") }, outcome: { S: "refunded" }, processedAt: { S: at } }, ConditionExpression: "attribute_not_exists(pk)" } },
        { Update: { TableName: tableName, Key: orderKey(string(order, "orderId")), UpdateExpression: "SET #status = :refunded, payoutStatus = :cancelled, refundReversalId = :reversal, refundedAt = :at, updatedAt = :at", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":refunded": { S: "refunded" }, ":cancelled": { S: "cancelled" }, ":reversal": { S: reversalId || "not_required" }, ":at": { S: at } } } }
      ] }));
    } catch (error) {
      const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey("stripe", eventId), ConsistentRead: true }));
      if (!duplicate.Item) throw error;
    }
    return { orderId: string(order, "orderId"), refunded: true };
  }

  async function processDispute(eventId, supplied) {
    if (!STRIPE_DISPUTE_ID.test(supplied?.id || "")) throw new Error("Stripe dispute is invalid");
    const dispute = await stripe(`/disputes/${encodeURIComponent(supplied.id)}`), chargeId = stripeObjectId(dispute.charge), order = await orderForCharge(chargeId);
    if (!order || string(order, "chargeId") !== chargeId) throw new Error("Stripe dispute does not match a Bazaar order");
    let reversalId = "";
    if (string(order, "payoutStatus") === "released") reversalId = await reverseReleasedTransfer(order, "dispute-reversal");
    const at = nowIso();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey("stripe", eventId), eventType: { S: "charge.dispute.created" }, orderId: { S: string(order, "orderId") }, outcome: { S: "disputed" }, processedAt: { S: at } }, ConditionExpression: "attribute_not_exists(pk)" } },
        { Update: { TableName: tableName, Key: orderKey(string(order, "orderId")), UpdateExpression: "SET #status = :disputed, payoutStatus = :blocked, disputeId = :dispute, disputeReversalId = :reversal, updatedAt = :at", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":disputed": { S: "disputed" }, ":blocked": { S: "blocked" }, ":dispute": { S: dispute.id }, ":reversal": { S: reversalId || "not_required" }, ":at": { S: at } } } }
      ] }));
    } catch (error) {
      const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey("stripe", eventId), ConsistentRead: true }));
      if (!duplicate.Item) throw error;
    }
    return { orderId: string(order, "orderId"), disputed: true };
  }

  async function stripeWebhook(event) {
    const payload = rawBody(event), signature = event?.headers?.["stripe-signature"] || event?.headers?.["Stripe-Signature"];
    if (!paymentsAllowed(env) || !payload || Buffer.byteLength(payload) > 65536 || !verifyStripeSignature(payload, signature, env.STRIPE_MARKETPLACE_WEBHOOK_SECRET, clock())) return response(400, { error: "Invalid Stripe signature." });
    const notification = parseBody(event);
    if (!notification || !/^evt_[A-Za-z0-9]{8,200}$/.test(notification.id || "") || !STRIPE_EVENTS.has(notification.type)) return response(400, { error: "Unsupported Stripe event." });
    const supplied = notification?.data?.object;
    try {
      if (notification.type === "charge.refunded") return response(200, { received: true, ...(await processRefund(notification.id, supplied)) });
      if (notification.type === "charge.dispute.created") return response(200, { received: true, ...(await processDispute(notification.id, supplied)) });
    } catch {
      return response(409, { error: "Stripe event did not match a valid Bazaar order." });
    }
    if (!STRIPE_SESSION_ID.test(supplied?.id || "")) return response(400, { error: "Stripe Session is invalid." });
    try {
      const session = await stripeSession(supplied.id);
      const result = notification.type === "checkout.session.async_payment_failed" || notification.type === "checkout.session.expired"
        ? await failCheckout(notification.id, notification.type, session)
        : await finalizePaidOrder(notification.id, notification.type, session);
      return response(200, { received: true, ...result });
    } catch {
      return response(409, { error: "Stripe event did not match a valid Bazaar order." });
    }
  }

  async function attachTracking(event, orderId) {
    const access = await requireUser(event);
    if (access.error) return access.error;
    if (!paymentsAllowed(env) || !env.EASYPOST_API_KEY) return response(503, { error: "Shipment tracking is not configured." }, access.headers);
    const body = parseBody(event), trackingCode = String(body?.trackingCode || "").trim(), carrier = String(body?.carrier || "").trim();
    if (!ORDER_ID.test(orderId) || !TRACKING_CODE.test(trackingCode) || (carrier && !CARRIER.test(carrier))) return response(400, { error: "Enter a valid carrier and tracking number." }, access.headers);
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(orderId), ConsistentRead: true })), order = found.Item;
    if (!order) return response(404, { error: "Order not found." }, access.headers);
    if (string(order, "sellerId") !== access.id) return response(403, { error: "Only the seller can add tracking." }, access.headers);
    if (string(order, "status") !== "paid_pending_shipment") return response(409, { error: "Tracking can be added only after verified payment." }, access.headers);
    try {
      const tracker = await easyPost("/trackers", { method: "POST", body: JSON.stringify({ tracker: { tracking_code: trackingCode, ...(carrier ? { carrier } : {}) } }) });
      if (!EASYPOST_TRACKER_ID.test(tracker.id || "") || String(tracker.tracking_code || "").replace(/\s/g, "").toUpperCase() !== trackingCode.replace(/\s/g, "").toUpperCase()) throw new Error("Shipping provider returned an invalid tracker");
      const at = nowIso();
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...trackerKey(tracker.id), orderId: { S: orderId }, trackingHash: { S: createHash("sha256").update(trackingCode.toUpperCase()).digest("hex") }, createdAt: { S: at } }, ConditionExpression: "attribute_not_exists(pk)" } },
        { Update: {
          TableName: tableName, Key: orderKey(orderId),
          UpdateExpression: "SET #status = :shipped, trackerId = :tracker, trackingCode = :code, carrier = :carrier, shippedAt = :at, updatedAt = :at",
          ConditionExpression: "sellerId = :seller AND #status = :paid",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":shipped": { S: "shipped" }, ":tracker": { S: tracker.id }, ":code": { S: trackingCode }, ":carrier": { S: String(tracker.carrier || carrier || "Carrier") }, ":at": { S: at }, ":seller": { S: access.id }, ":paid": { S: "paid_pending_shipment" } }
        } }
      ] }));
      return response(200, { orderId, status: "shipped", trackerId: tracker.id }, access.headers);
    } catch {
      return response(502, { error: "Tracking could not be verified with the shipping provider." }, access.headers);
    }
  }

  async function releaseSellerPayout(order, deliveredAt) {
    const latest = await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(string(order, "orderId")), ConsistentRead: true }));
    order = latest.Item;
    if (!paymentsAllowed(env) || string(order, "payoutStatus") !== "transfer_pending" || ["refunded", "disputed", "cancelled"].includes(string(order, "status")) || !STRIPE_ACCOUNT_ID.test(string(order, "stripeAccountId")) || !STRIPE_CHARGE_ID.test(string(order, "chargeId"))) throw new Error("Order payout configuration is invalid");
    const form = new URLSearchParams({
      amount: String(number(order, "sellerPayoutCents")), currency: "usd", destination: string(order, "stripeAccountId"),
      source_transaction: string(order, "chargeId"), transfer_group: string(order, "transferGroup"),
      "metadata[orderId]": string(order, "orderId"), description: `DanzStak seller payout for order ${string(order, "orderId")}`
    });
    const transfer = await stripe("/transfers", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `marketplace-transfer-${string(order, "orderId")}` }, body: form.toString() });
    if (!STRIPE_TRANSFER_ID.test(transfer.id || "") || Number(transfer.amount) !== number(order, "sellerPayoutCents") || stripeObjectId(transfer.destination) !== string(order, "stripeAccountId")) throw new Error("Stripe returned an invalid seller transfer");
    try {
      await db.send(new UpdateItemCommand({
        TableName: tableName, Key: orderKey(string(order, "orderId")),
        UpdateExpression: "SET #status = :deliveredStatus, payoutStatus = :released, transferId = :transfer, deliveredAt = :deliveredAt, payoutReleasedAt = :at, updatedAt = :at",
        ConditionExpression: "payoutStatus = :pending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":deliveredStatus": { S: "delivered" }, ":deliveredAt": { S: deliveredAt }, ":released": { S: "released" }, ":transfer": { S: transfer.id }, ":at": { S: nowIso() }, ":pending": { S: "transfer_pending" } }
      }));
    } catch (error) {
      const latestAfterTransfer = (await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(string(order, "orderId")), ConsistentRead: true }))).Item;
      if (latestAfterTransfer && string(latestAfterTransfer, "payoutStatus") !== "released") {
        await reverseTransfer(transfer.id, order, "transfer-race-reversal");
      }
      throw error;
    }
    return transfer.id;
  }

  async function claimDelivery(order, source, sourceEventId, deliveredAt) {
    if (["released"].includes(string(order, "payoutStatus"))) return { orderId: string(order, "orderId"), duplicate: true, released: true };
    if (string(order, "payoutStatus") !== "transfer_pending") {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey(source, sourceEventId), eventType: { S: "delivery_confirmed" }, orderId: { S: string(order, "orderId") }, outcome: { S: "transfer_pending" }, processedAt: { S: nowIso() } }, ConditionExpression: "attribute_not_exists(pk)" } },
        { Update: {
          TableName: tableName, Key: orderKey(string(order, "orderId")),
          UpdateExpression: "SET payoutStatus = :transfer, deliveryConfirmedAt = :delivered, deliverySource = :source, updatedAt = :at",
          ConditionExpression: "payoutStatus = :pending AND (#status = :paid OR #status = :shipped)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":transfer": { S: "transfer_pending" }, ":delivered": { S: deliveredAt }, ":source": { S: source }, ":at": { S: nowIso() }, ":pending": { S: "pending_delivery" }, ":paid": { S: "paid_pending_shipment" }, ":shipped": { S: "shipped" } }
        } }
      ] }));
      order.payoutStatus = { S: "transfer_pending" };
    }
    const transferId = await releaseSellerPayout(order, deliveredAt);
    return { orderId: string(order, "orderId"), released: true, transferId };
  }

  async function easyPostWebhook(event) {
    const payload = rawBody(event), headers = event?.headers || {}, requestPath = event?.rawPath || "";
    const valid = verifyEasyPostSignature({ payload, method: event?.requestContext?.http?.method || "", requestPath, timestamp: headers["x-timestamp"] || headers["X-Timestamp"], signedPath: headers["x-path"] || headers["X-Path"], signature: headers["x-hmac-signature-v2"] || headers["X-Hmac-Signature-V2"], secret: env.EASYPOST_WEBHOOK_SECRET, currentTime: clock() });
    if (!valid || !paymentsAllowed(env)) return response(401, { error: "Invalid shipping-provider signature." });
    const notification = parseBody(event), eventId = String(notification?.id || ""), tracker = notification?.result;
    if (!EASYPOST_EVENT_ID.test(eventId) || tracker?.object !== "Tracker" || !EASYPOST_TRACKER_ID.test(tracker?.id || "")) return response(400, { error: "Unsupported shipping event." });
    const mapped = await db.send(new GetItemCommand({ TableName: tableName, Key: trackerKey(tracker.id), ConsistentRead: true }));
    const orderId = string(mapped.Item, "orderId");
    if (!ORDER_ID.test(orderId)) return response(200, { received: true, ignored: true });
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(orderId), ConsistentRead: true })), order = found.Item;
    if (!order || string(order, "trackerId") !== tracker.id) return response(200, { received: true, ignored: true });
    if (String(tracker.status || "").toLowerCase() !== "delivered") {
      await recordIgnoredEvent("easypost", eventId, String(tracker.status || "unknown"), orderId);
      return response(200, { received: true, orderId, released: false });
    }
    try {
      const result = await claimDelivery(order, "easypost", eventId, String(tracker.updated_at || nowIso()));
      return response(200, { received: true, ...result });
    } catch {
      return response(503, { error: "Delivery was verified, but seller payout needs a retry." });
    }
  }

  async function confirmDelivery(event, orderId) {
    const access = await requireUser(event);
    if (access.error) return access.error;
    if (!ORDER_ID.test(orderId)) return response(400, { error: "Valid order required." }, access.headers);
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(orderId), ConsistentRead: true })), order = found.Item;
    if (!order) return response(404, { error: "Order not found." }, access.headers);
    if (string(order, "buyerId") !== access.id) return response(403, { error: "Only the buyer can confirm receipt." }, access.headers);
    try {
      const result = await claimDelivery(order, "buyer", `${orderId}:${access.id}`, nowIso());
      return response(200, result, access.headers);
    } catch {
      return response(503, { error: "Receipt was recorded, but seller payout needs a retry." }, access.headers);
    }
  }

  async function readOrder(event, orderId) {
    const access = await requireUser(event);
    if (access.error) return access.error;
    if (!ORDER_ID.test(orderId)) return response(400, { error: "Valid order required." }, access.headers);
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: orderKey(orderId), ConsistentRead: true })), order = publicOrder(found.Item, access.id);
    return order ? response(200, { order }, access.headers) : response(404, { error: "Order not found." }, access.headers);
  }

  return async function marketplaceCommerce(event) {
    const method = event?.requestContext?.http?.method || "", path = event?.rawPath || "";
    if (method === "POST" && path === "/marketplace/payouts/onboarding") return payoutOnboarding(event);
    if (method === "GET" && path === "/marketplace/payouts/status") return payoutStatus(event);
    if (method === "POST" && path === "/marketplace/checkout") return checkout(event);
    if (method === "POST" && path === "/marketplace/stripe/webhook") return stripeWebhook(event);
    if (method === "POST" && path === "/marketplace/shipping/webhook") return easyPostWebhook(event);
    const tracking = path.match(/^\/marketplace\/orders\/([a-f0-9-]{36})\/tracking$/i);
    if (method === "POST" && tracking) return attachTracking(event, tracking[1]);
    const confirm = path.match(/^\/marketplace\/orders\/([a-f0-9-]{36})\/confirm-delivery$/i);
    if (method === "POST" && confirm) return confirmDelivery(event, confirm[1]);
    const order = path.match(/^\/marketplace\/orders\/([a-f0-9-]{36})$/i);
    if (method === "GET" && order) return readOrder(event, order[1]);
    return null;
  };
}

export {
  orderKey,
  payoutKey,
  trackerKey,
  chargeKey,
  eventKey,
  SFS_MINT,
  SFS_PAIR,
  SFS_SETTLEMENT_WALLET,
  SFS_SETTLEMENT_TOKEN_ACCOUNT,
  WRAPPED_SOL_MINT
};
