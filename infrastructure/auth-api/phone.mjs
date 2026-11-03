import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const product = 'danzstak-phone-v1';
const hash = value => createHash('sha256').update(value).digest('hex');
const numberPattern = /^DS-\d{12}$/;
const memberPattern = /^[a-f0-9-]{36}$/;
const origins = new Set(['https://danzstak.com', 'https://www.danzstak.com']);
const stun = [{ urls: ['stun:stun.cloudflare.com:3478'] }];

export function verifyStripeSignature(raw, signature, secret, timestamp = Date.now()) {
  if (!secret || typeof signature !== 'string') return false;
  const parts = signature.split(',').map(part => part.split('='));
  const time = parts.find(([key]) => key === 't')?.[1];
  if (!/^\d+$/.test(time || '') || Math.abs(timestamp / 1000 - Number(time)) > 300) return false;
  const expected = createHmac('sha256', secret).update(time + '.' + raw).digest();
  return parts.some(([key, value]) => key === 'v1' && /^[a-f0-9]{64}$/.test(value || '') && timingSafeEqual(Buffer.from(value, 'hex'), expected));
}

// Dependencies are injected so payment/authentication boundaries can be tested
// without contacting Stripe, Cloudflare, Cognito, or production accounts.
export function createPhoneService({ db, commands, authenticate, accountForSub, canContact, headers, env = process.env, fetcher = fetch, clock = Date.now }) {
  const { GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand, TransactWriteItemsCommand, DeleteItemCommand } = commands;
  const TableName = env.PHONE_TABLE || 'DANZSTAK-Phone';
  const now = () => Math.floor(clock() / 1000);
  const reply = (statusCode, body) => ({ statusCode, headers: { ...headers, 'cache-control': 'no-store', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const key = (pk, sk = 'ACCOUNT') => ({ pk: { S: pk }, sk: { S: sk } });
  const read = async (pk, sk) => (await db.send(new GetItemCommand({ TableName, Key: key(pk, sk), ConsistentRead: true }))).Item;
  const ownerKey = id => 'USER#' + id;
  const ready = () => env.PHONE_ENABLED === 'true' && Boolean(env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN);
  const paymentsReady = () => ready() && Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PHONE_WEBHOOK_SECRET) && (env.STRIPE_SECRET_KEY.startsWith('sk_test_') || (env.PHONE_LIVE_PAYMENTS === 'true' && env.STRIPE_SECRET_KEY.startsWith('sk_live_')));

  async function upstream(url, options) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    if (!response.ok) throw new Error('Phone provider unavailable');
    return data;
  }
  async function rateLimit(id, action, maximum = 10) {
    const bucket = Math.floor(now() / 300);
    try {
      await db.send(new UpdateItemCommand({ TableName, Key: key('RATE#' + id, action + '#' + bucket), UpdateExpression: 'SET expiresAt = :ttl ADD requests :one', ConditionExpression: 'attribute_not_exists(requests) OR requests < :maximum', ExpressionAttributeValues: { ':ttl': { N: String(now() + 600) }, ':one': { N: '1' }, ':maximum': { N: String(maximum) } } }));
      return true;
    } catch (error) { if (error.name === 'ConditionalCheckFailedException') return false; throw error; }
  }

  async function activate(session) {
    const id = session.metadata?.userId;
    if (!memberPattern.test(id || '') || session.metadata?.product !== product || session.mode !== 'payment' || session.payment_status !== 'paid' || session.status !== 'complete' || session.amount_total !== 300 || session.currency !== 'usd' || !/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(session.id || '')) return false;
    if (!await accountForSub(id)) return false;
    const existing = await read(ownerKey(id));
    if (existing?.number?.S) return true; // Stripe retries never change a number.
    const checkout = await read(ownerKey(id), 'CHECKOUT');
    if (checkout?.sessionId?.S !== session.id) return false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const number = 'DS-' + String(randomInt(0, 1e12)).padStart(12, '0');
      const createdAt = new Date(clock()).toISOString();
      try {
        await db.send(new TransactWriteItemsCommand({ TransactItems: [
          { Put: { TableName, Item: { ...key(ownerKey(id)), number: { S: number }, paymentId: { S: session.id }, createdAt: { S: createdAt } }, ConditionExpression: 'attribute_not_exists(pk)' } },
          { Put: { TableName, Item: { ...key('NUMBER#' + number), memberId: { S: id } }, ConditionExpression: 'attribute_not_exists(pk)' } },
          { Put: { TableName, Item: { ...key('PAYMENT#' + session.id), memberId: { S: id }, amountCents: { N: '300' }, createdAt: { S: createdAt } }, ConditionExpression: 'attribute_not_exists(pk)' } }
        ] }));
        console.info(JSON.stringify({ metric: 'PhoneActivation', amountCents: 300 }));
        return true;
      } catch (error) {
        if (error.name !== 'TransactionCanceledException') throw error;
        if ((await read(ownerKey(id)))?.number?.S) return true;
        if (!(await read('NUMBER#' + number))) throw error;
      }
    }
    throw new Error('Number allocation unavailable');
  }

  async function webhook(event) {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
    if (Buffer.byteLength(raw) > 65536 || !verifyStripeSignature(raw, event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'], env.STRIPE_PHONE_WEBHOOK_SECRET, clock())) return reply(400, { error: 'Invalid payment signature' });
    let notification;
    try { notification = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid payment event' }); }
    if (notification.type !== 'checkout.session.completed') return reply(200, { received: true });
    if (!paymentsReady()) return reply(503, { error: 'Phone activation is not configured' });
    if (notification.livemode !== env.STRIPE_SECRET_KEY.startsWith('sk_live_')) return reply(400, { error: 'Payment environment mismatch' });
    if (!await activate(notification.data?.object || {})) return reply(400, { error: 'Payment does not match a phone activation' });
    return reply(200, { received: true });
  }

  async function checkout(id) {
    if (!paymentsReady()) return reply(503, { error: 'Phone activation is not available yet' });
    if ((await read(ownerKey(id)))?.number?.S) return reply(409, { error: 'Your DANZSTAK number is already activated' });
    if (!await rateLimit(id, 'checkout', 5)) return reply(429, { error: 'Please wait before trying again' });
    const current = await read(ownerKey(id), 'CHECKOUT');
    if (current?.sessionId?.S) {
      const session = await upstream('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(current.sessionId.S), { headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } });
      if (session.status === 'complete') { await activate(session); return reply(200, { activated: true }); }
      if (session.status === 'open' && session.url) return reply(200, { url: session.url });
    }
    // A conditional reservation and stable idempotency key make concurrent
    // browser tabs reuse one Checkout session. Expired sessions can be replaced.
    const generation = current?.generation?.S || 'initial';
    const nextGeneration = current?.sessionId?.S ? randomUUID() : generation;
    if (current?.sessionId?.S) {
      try {
        await db.send(new PutItemCommand({ TableName, Item: { ...key(ownerKey(id), 'CHECKOUT'), generation: { S: nextGeneration } }, ConditionExpression: 'sessionId = :old', ExpressionAttributeValues: { ':old': current.sessionId } }));
      } catch (error) { if (error.name === 'ConditionalCheckFailedException') return reply(409, { error: 'Checkout changed. Please try again.' }); throw error; }
    }
    const form = new URLSearchParams({ mode: 'payment', 'payment_method_types[0]': 'card', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': '300', 'line_items[0][price_data][product_data][name]': 'DANZSTAK number — one-time activation', 'line_items[0][quantity]': '1', 'metadata[userId]': id, 'metadata[product]': product, success_url: 'https://danzstak.com/messages.html?phone=success', cancel_url: 'https://danzstak.com/messages.html?phone=cancelled' });
    const session = await upstream('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': product + '-' + id + '-' + nextGeneration }, body: form.toString() });
    if (!session.id || !session.url?.startsWith('https://checkout.stripe.com/')) throw new Error('Invalid checkout response');
    await db.send(new PutItemCommand({ TableName, Item: { ...key(ownerKey(id), 'CHECKOUT'), sessionId: { S: session.id }, generation: { S: nextGeneration } } }));
    return reply(200, { url: session.url });
  }

  async function resolveNumber(id, email, number, allowBlocked = false) {
    if (!numberPattern.test(number)) return null;
    const target = await read('NUMBER#' + number);
    const memberId = target?.memberId?.S;
    if (!memberId || memberId === id) return null;
    const otherEmail = await accountForSub(memberId);
    if (!otherEmail) return null;
    const [outgoing, incoming] = await Promise.all([read('BLOCK#' + hash(email), hash(otherEmail)), read('BLOCK#' + hash(otherEmail), hash(email))]);
    if (!allowBlocked && (outgoing || incoming)) return null;
    if (!await canContact(email, otherEmail)) return null;
    return { memberId, otherEmail, blocked: Boolean(outgoing) };
  }

  return async function handle(event) {
    const method = event.requestContext?.http?.method, path = event.rawPath;
    if (method === 'POST' && path === '/phone/webhook') return webhook(event);
    if (method !== 'GET' && !origins.has(event.headers?.origin || event.headers?.Origin)) return reply(403, { error: 'Forbidden origin' });
    const id = await authenticate(event);
    if (!id) return reply(401, { error: 'Authentication required' });
    if (env.PHONE_ENABLED !== 'true') return reply(503, { error: 'DANZSTAK Phone is not available yet' });
    const account = await read(ownerKey(id));
    if (method === 'GET' && path === '/phone') return reply(200, { number: account?.number?.S || null, activationCents: 300, currency: 'usd', checkoutAvailable: paymentsReady(), testMode: !env.STRIPE_SECRET_KEY?.startsWith('sk_live_') });
    if (method === 'POST' && path === '/phone/checkout') return checkout(id);
    if (!account?.number?.S) return reply(403, { error: 'Activate your DANZSTAK number first' });
    const email = await accountForSub(id);
    if (!email) return reply(401, { error: 'Account unavailable' });
    if (method === 'GET' && path === '/phone/ice') {
      if (!ready()) return reply(503, { error: 'Call connectivity is not configured' });
      if (!await rateLimit(id, 'ice', 20)) return reply(429, { error: 'Please wait before starting another call' });
      const result = await upstream('https://rtc.live.cloudflare.com/v1/turn/keys/' + encodeURIComponent(env.CLOUDFLARE_TURN_KEY_ID) + '/credentials/generate-ice-servers', { method: 'POST', headers: { authorization: 'Bearer ' + env.CLOUDFLARE_TURN_API_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ ttl: 3600 }) });
      if (!result.iceServers) throw new Error('Invalid call connectivity response');
      return reply(200, { iceServers: result.iceServers, expiresIn: 3600 });
    }
    if (method === 'GET' && path === '/phone/history') {
      const result = await db.send(new QueryCommand({ TableName, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': { S: ownerKey(id) }, ':prefix': { S: 'CALL#' } }, Limit: 30, ScanIndexForward: false }));
      return reply(200, { calls: (result.Items || []).map(row => ({ number: row.number?.S, startedAt: row.startedAt?.S, seconds: Number(row.seconds?.N || 0), relayed: row.relayed?.BOOL === true })) });
    }
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid JSON' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Invalid request' });
    if (method === 'POST' && (path === '/phone/resolve' || path === '/phone/block')) {
      if (!await rateLimit(id, 'lookup', 30)) return reply(429, { error: 'Please wait before searching again' });
      const number = String(body.number || '').toUpperCase().replace(/\s/g, '');
      const target = await resolveNumber(id, email, number, path === '/phone/block');
      if (!target) return reply(404, { error: 'Number unavailable. You must be friends or share a Tribe.' });
      if (path === '/phone/resolve') return reply(200, { memberId: target.memberId, number });
      if (typeof body.blocked !== 'boolean') return reply(400, { error: 'Valid blocking setting required' });
      const Key = key('BLOCK#' + hash(email), hash(target.otherEmail));
      if (body.blocked) await db.send(new PutItemCommand({ TableName, Item: { ...Key, memberId: { S: target.memberId } } }));
      else await db.send(new DeleteItemCommand({ TableName, Key }));
      return reply(200, { blocked: body.blocked });
    }
    if (method === 'POST' && path === '/phone/events') {
      // Client-reported diagnostics are approximate, never billing or advertiser evidence.
      if (!memberPattern.test(body.callId || '') || !numberPattern.test(body.number || '') || !Number.isFinite(body.seconds) || body.seconds < 0 || body.seconds > 86400 || typeof body.relayed !== 'boolean') return reply(400, { error: 'Invalid call diagnostic' });
      if (!await rateLimit(id, 'events', 30)) return reply(429, { error: 'Please wait' });
      try {
        await db.send(new PutItemCommand({ TableName, Item: { ...key(ownerKey(id), 'CALL#' + new Date(clock()).toISOString().slice(0, 10) + '#' + body.callId), number: { S: body.number }, startedAt: { S: new Date(clock() - body.seconds * 1000).toISOString() }, seconds: { N: String(Math.round(body.seconds)) }, relayed: { BOOL: body.relayed }, expiresAt: { N: String(now() + 90 * 86400) } }, ConditionExpression: 'attribute_not_exists(pk)' }));
      } catch (error) { if (error.name !== 'ConditionalCheckFailedException') throw error; }
      return reply(200, { accepted: true });
    }
    return reply(404, { error: 'Not found' });
  };
}

export { stun };
