const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const storage = new Map();
const listeners = {};
let online = true, sends = 0, failSend = false;
const element = () => ({ style: {}, setAttribute() {}, append() {}, addEventListener() {} });
const context = {
  URL, Response, AbortSignal, Event, crypto: require('node:crypto').webcrypto,
  location: { href: 'https://danzstak.com/feed.html' },
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  navigator: { get onLine() { return online; }, locks: { request: async (_, options, action) => action({}) } },
  document: { createElement: element, addEventListener() {}, body: { append() {} } },
  fetch: async (url, options = {}) => {
    if (url.endsWith('/auth/session')) return Response.json({ authenticated: true, user: { email: 'one@example.com' } });
    if (options.method === 'POST') { sends++; if (failSend) throw new Error('lost connection'); return Response.json({}); }
    return Response.json({ posts: [{ content: 'Saved feed' }] });
  },
  addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => delete listeners[name], dispatchEvent() {}
};
context.window = context;
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  vm.runInNewContext(fs.readFileSync('assets/offline.js', 'utf8'), context);
  await settle();
  assert.equal(context.danzstakOfflineEnabled(), false, 'offline access must default off');
  await context.fetch('https://api.danzstak.com/secure-posts');
  assert.equal(storage.has('danzstak-offline-v1'), false, 'private reads must not be cached without opt-in');
  assert.throws(() => context.danzstakQueueOffline('/secure-posts', { content: 'No consent' }), /Turn on offline access/);
  await context.danzstakSetOfflineEnabled(true);
  assert.equal(context.danzstakOfflineEnabled(), true);
  await context.fetch('https://api.danzstak.com/secure-posts');
  online = false;
  assert.equal((await (await context.fetch('https://api.danzstak.com/secure-posts')).json()).posts[0].content, 'Saved feed');
  context.danzstakQueueOffline('/secure-posts', { content: 'Offline post', audience: 'friends' });
  assert.equal(sends, 0);
  assert.equal(JSON.parse(storage.get('danzstak-offline-v1')).queue.length, 1);
  online = true;
  await listeners.online();
  assert.equal(sends, 1);
  assert.equal(JSON.parse(storage.get('danzstak-offline-v1')).queue.length, 0);
  online = false;
  context.danzstakQueueOffline('/messages', { content: 'Offline chat', recipientEmail: 'two@example.com' });
  const queuedMessageId = JSON.parse(storage.get('danzstak-offline-v1')).queue[0].body.clientMessageId;
  assert.match(queuedMessageId, /^\d{13}#[a-f0-9-]{36}$/, 'offline messages need a stable retry ID');
  failSend = true; online = true;
  await listeners.online(); await listeners.online();
  assert.equal(sends, 3, 'an uncertain message delivery may retry safely with its stable ID');
  assert.equal(JSON.parse(storage.get('danzstak-offline-v1')).queue[0].status, 'sending');
  assert.equal(JSON.parse(storage.get('danzstak-offline-v1')).queue[0].body.clientMessageId, queuedMessageId, 'offline retries must preserve the original message ID');
  context.danzstakClearOffline();
  assert.equal(storage.has('danzstak-offline-v1'), false);
  assert.equal(storage.get('danzstak_offline_access'), '1', 'logout cleanup keeps the device preference but removes private content');
  await context.danzstakSetOfflineEnabled(false);
  assert.equal(storage.size, 0);
  console.log('Offline checks passed: default-off consent, saved reads, durable queue, idempotent message retry, disable and logout cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
