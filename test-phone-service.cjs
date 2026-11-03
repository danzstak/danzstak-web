const assert = require('node:assert/strict');
const { createHmac, createHash } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {
  const { createPhoneService, verifyStripeSignature } = await import('./infrastructure/auth-api/phone.mjs');
  const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
  const time = 1800000000000;
  const env = { PHONE_ENABLED: 'true', CLOUDFLARE_TURN_KEY_ID: 'test-key-id', CLOUDFLARE_TURN_API_TOKEN: 'test-only-token', STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_PHONE_WEBHOOK_SECRET: 'test-only-signing-secret' };
  const rows = new Map(), calls = [];
  const commands = Object.fromEntries(['GetItemCommand', 'PutItemCommand', 'UpdateItemCommand', 'QueryCommand', 'TransactWriteItemsCommand', 'DeleteItemCommand'].map(name => [name, class { constructor(input) { this.kind = name; this.input = input; } }]));
  const rowKey = key => key.pk.S + '|' + key.sk.S;
  const failure = name => Object.assign(new Error(name), { name });
  const db = { async send(command) {
    const p = command.input, k = p.Key && rowKey(p.Key);
    if (command.kind === 'GetItemCommand') return { Item: rows.get(k) };
    if (command.kind === 'DeleteItemCommand') { rows.delete(k); return {}; }
    if (command.kind === 'PutItemCommand') {
      const key = rowKey(p.Item), old = rows.get(key);
      if (p.ConditionExpression === 'attribute_not_exists(pk)' && old) throw failure('ConditionalCheckFailedException');
      if (p.ConditionExpression === 'sessionId = :old' && old?.sessionId?.S !== p.ExpressionAttributeValues[':old'].S) throw failure('ConditionalCheckFailedException');
      rows.set(key, p.Item); return {};
    }
    if (command.kind === 'UpdateItemCommand') {
      const old = rows.get(k), count = Number(old?.requests?.N || 0);
      if (count >= Number(p.ExpressionAttributeValues[':maximum'].N)) throw failure('ConditionalCheckFailedException');
      rows.set(k, { ...p.Key, requests: { N: String(count + 1) } }); return {};
    }
    if (command.kind === 'TransactWriteItemsCommand') {
      if (p.TransactItems.some(item => rows.has(rowKey(item.Put.Item)))) throw failure('TransactionCanceledException');
      for (const item of p.TransactItems) rows.set(rowKey(item.Put.Item), item.Put.Item);
      return {};
    }
    if (command.kind === 'QueryCommand') return { Items: [...rows.values()].filter(row => row.pk?.S === p.ExpressionAttributeValues[':pk'].S && row.sk.S.startsWith('CALL#')) };
    throw new Error('Unexpected database operation');
  } };
  let connected = true, checkoutStatus = 'open';
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('cloudflare.com')) return { ok: true, json: async () => ({ iceServers: [{ urls: ['turn:turn.cloudflare.com:3478'], username: 'temporary-user', credential: 'temporary-password' }] }) };
    return { ok: true, json: async () => ({ id: 'cs_test_example', url: 'https://checkout.stripe.com/c/pay/example', status: checkoutStatus }) };
  };
  const accountForSub = async id => id === owner ? 'owner@example.com' : id === other ? 'other@example.com' : null;
  const make = (overrides = {}) => createPhoneService({ db, commands, authenticate: async () => owner, accountForSub, canContact: async () => connected, headers: {}, env, fetcher, clock: () => time, ...overrides });
  const event = (method, path, body) => ({ requestContext: { http: { method } }, rawPath: path, headers: { origin: 'https://danzstak.com' }, body: JSON.stringify(body || {}) });
  const data = response => JSON.parse(response.body);
  const service = make();
  assert.equal((await make({ authenticate: async () => null })(event('GET', '/phone'))).statusCode, 401);
  assert.equal((await service({ ...event('POST', '/phone/checkout'), headers: { origin: 'https://evil.example' } })).statusCode, 403);
  assert.equal((await make({ env: { ...env, PHONE_ENABLED: 'false' } })(event('GET', '/phone'))).statusCode, 503);
  assert.equal((await make({ env: { ...env, STRIPE_SECRET_KEY: 'sk_live_example' } })(event('POST', '/phone/checkout'))).statusCode, 503);
  assert.equal(data(await service(event('GET', '/phone'))).number, null);
  assert.equal((await service(event('GET', '/phone/ice'))).statusCode, 403);
  const checkout = await service(event('POST', '/phone/checkout'));
  assert.equal(checkout.statusCode, 200);
  assert.equal(data(checkout).url, 'https://checkout.stripe.com/c/pay/example');
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '300');
  assert.equal(form.get('metadata[userId]'), owner);
  await service(event('POST', '/phone/checkout'));
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 1, 'repeated Checkout attempts must reuse the existing session');
  assert.equal(data(await service(event('GET', '/phone'))).number, null, 'Checkout creation never activates a number');

  const paid = { id: 'cs_test_example', mode: 'payment', payment_status: 'paid', status: 'complete', amount_total: 300, currency: 'usd', metadata: { userId: owner, product: 'danzstak-phone-v1' } };
  const paymentEvent = (session = paid, changes = {}) => {
    const raw = JSON.stringify({ type: 'checkout.session.completed', livemode: false, data: { object: session }, ...changes });
    const timestamp = String(time / 1000);
    const signature = createHmac('sha256', env.STRIPE_PHONE_WEBHOOK_SECRET).update(timestamp + '.' + raw).digest('hex');
    return { ...event('POST', '/phone/webhook'), headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` }, body: raw };
  };
  assert.equal(verifyStripeSignature('x', 't=1,v1=' + '0'.repeat(64), env.STRIPE_PHONE_WEBHOOK_SECRET, time), false);
  assert.equal((await service({ ...paymentEvent(), body: '{}' })).statusCode, 400, 'tampered raw webhook bodies must fail');
  assert.equal((await service(paymentEvent({ ...paid, amount_total: 1 }))).statusCode, 400);
  assert.equal((await service(paymentEvent({ ...paid, payment_status: 'unpaid' }))).statusCode, 400);
  assert.equal((await service(paymentEvent(paid, { livemode: true }))).statusCode, 400);
  assert.equal((await service(paymentEvent())).statusCode, 200);
  const number = data(await service(event('GET', '/phone'))).number;
  assert.match(number, /^DS-\d{12}$/);
  assert.equal((await service(paymentEvent())).statusCode, 200);
  assert.equal(data(await service(event('GET', '/phone'))).number, number, 'webhook retries must preserve the assigned number');
  assert.equal([...rows.keys()].filter(key => key.startsWith('NUMBER#')).length, 1);
  assert.equal((await service(event('POST', '/phone/checkout'))).statusCode, 409, 'activated users cannot pay again');
  const ice = data(await service(event('GET', '/phone/ice')));
  assert.equal(ice.expiresIn, 3600);
  assert.ok(!JSON.stringify(ice).includes(env.CLOUDFLARE_TURN_API_TOKEN), 'long-lived API credentials never reach the browser');
  for (let n = 0; n < 19; n++) await service(event('GET', '/phone/ice'));
  assert.equal((await service(event('GET', '/phone/ice'))).statusCode, 429, 'credential generation is rate limited');

  const targetNumber = 'DS-123456789012';
  rows.set('NUMBER#' + targetNumber + '|ACCOUNT', { memberId: { S: other } });
  assert.equal(data(await service(event('POST', '/phone/resolve', { number: targetNumber }))).memberId, other);
  connected = false;
  assert.equal((await service(event('POST', '/phone/resolve', { number: targetNumber }))).statusCode, 404);
  connected = true;
  assert.equal((await service(event('POST', '/phone/block', { number: targetNumber, blocked: true }))).statusCode, 200);
  assert.equal((await service(event('POST', '/phone/resolve', { number: targetNumber }))).statusCode, 404);
  const template = fs.readFileSync('infrastructure/call-signaling/template.yaml', 'utf8');
  const contactSource = template.match(/async function canContact\([^\n]+/)[0];
  const contactContext = vm.createContext({ process: { env: { PHONE_TABLE: 'DANZSTAK-Phone' } }, createHash, GetItemCommand: commands.GetItemCommand, db, groupIds: async () => new Set(), sharesValidGroup: async () => true });
  vm.runInContext(contactSource, contactContext);
  assert.equal(await contactContext.canContact('owner@example.com', 'other@example.com'), false, 'blocking must deny backend calls and messages, including shared-Tribe contacts');
  assert.equal(await contactContext.canContact('other@example.com', 'owner@example.com'), false, 'blocking must apply in both contact directions');
  assert.equal((await service(event('POST', '/phone/block', { number: targetNumber, blocked: false }))).statusCode, 200);
  assert.equal((await service(event('POST', '/phone/resolve', { number: targetNumber }))).statusCode, 200);
  const diagnostic = { callId: '33333333-3333-4333-8333-333333333333', number: targetNumber, seconds: 120, relayed: true };
  await service(event('POST', '/phone/events', diagnostic));
  await service(event('POST', '/phone/events', diagnostic));
  assert.equal(data(await service(event('GET', '/phone/history'))).calls.length, 1, 'duplicate call diagnostics must not duplicate history');
  assert.equal((await service(event('POST', '/phone/events', { ...diagnostic, seconds: -1 }))).statusCode, 400);
  console.log('Phone service checks passed: secure activation, payment retries, TURN authorization, rate limits, contact privacy, blocking, and history.');
})().catch(error => { console.error(error); process.exitCode = 1; });
