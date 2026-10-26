const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// Execute the real conversation loader with controlled network completion order.
const fullSource = readFileSync(join(__dirname, 'assets/direct-messages.js'), 'utf8');
const source = fullSource.split('async function loadConversations()')[0];
function setup() {
  const elements = new Map();
  const element = () => ({ value: '', textContent: '', hidden: false, disabled: false, style: {}, scrollHeight: 0, scrollTop: 0, clientHeight: 0,
    querySelector: () => null, querySelectorAll: () => [], replaceChildren() {}, appendChild() {}, prepend() {} });
  for (const id of ['contactEmail', 'messageForm', 'messageInput', 'messageList', 'callStatus', 'conversationHeader', 'conversationName', 'conversationAvatar']) elements.set(id, element());
  const send = element();
  elements.get('messageForm').querySelector = () => send;
  const classes = new Set();
  const requests = [];
  const context = vm.createContext({ URLSearchParams, AbortController, setTimeout, clearTimeout,
    location: { search: '', origin: 'https://danzstak.com' }, window: {},
    localStorage: { getItem: () => '{}', setItem() {} },
    document: { hidden: false, getElementById: id => elements.get(id) || null, querySelector: () => null,
      body: { classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) } } },
    fetch: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })) });
  vm.runInContext('window.parent = window', context);
  vm.runInContext(source, context);
  elements.get('messageForm').addEventListener = (_, handler) => { context.submit = handler; };
  vm.runInContext('async function loadConversations() {}', context);
  vm.runInContext(fullSource.slice(fullSource.indexOf('messageForm?.addEventListener("submit"'), fullSource.indexOf('deleteChat?.addEventListener')), context);
  const run = code => vm.runInContext(code, context);
  const finish = async (index, data = {}, ok = true) => {
    requests[index].resolve({ ok, json: async () => ({ messages: [], ...data }) });
    await new Promise(resolve => setImmediate(resolve));
  };
  return { run, finish, requests, elements, send };
}

(async () => {
  const h = setup();
  h.run('openConversation({contactEmail:"first@example.com"})');
  h.run('openConversation({contactEmail:"second@example.com"})');
  assert.equal(h.requests.length, 2, 'new chat loads without waiting for old request');
  await h.finish(0, { canContact: true, nextCursor: 'old-cursor' });
  assert.equal(h.send.disabled, true, 'stale response cannot enable the new composer');
  assert.equal(h.run('nextMessageCursor'), '', 'stale history cursor is discarded');
  assert.equal(h.run('loadingMessages'), true, 'old completion cannot unlock the new request');
  await h.finish(1, { canContact: false });
  assert.equal(h.send.disabled, true, 'saved chat remains read only');
  assert.match(h.elements.get('callStatus').textContent, /Saved chat/);

  h.run('openConversation({contactEmail:"third@example.com"})');
  h.run('closeConversation()');
  await h.finish(2, { canContact: true });
  assert.equal(h.send.disabled, true, 'closing a chat invalidates in-flight responses');
  assert.equal(h.run('directContact'), '');

  h.run('openConversation({contactEmail:"fourth@example.com"})');
  h.requests[3].reject(new Error('Network unavailable'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.run('loadingMessages'), false, 'failure releases the loader');
  assert.match(h.elements.get('callStatus').textContent, /Network unavailable/);

  h.run('openConversation({contactEmail:"sender@example.com"})');
  await h.finish(4, { canContact: true });
  h.elements.get('messageInput').value = 'Sending to first contact';
  const pendingSend = h.run('submit({preventDefault(){},stopImmediatePropagation(){}})');
  await h.run('submit({preventDefault(){},stopImmediatePropagation(){}})');
  assert.equal(h.requests.length,6,"Repeated Enter cannot duplicate a pending message");
  h.run('openConversation({contactEmail:"other@example.com"})');
  h.elements.get('messageInput').value = 'Draft for another contact';
  await h.finish(5);
  await pendingSend;
  assert.equal(h.elements.get('messageInput').value, 'Draft for another contact', 'old send cannot erase another chat draft');
  assert.equal(h.send.disabled, true, 'old send cannot enable another chat composer');
  await h.finish(6, { canContact: false });
  console.log('Messaging race checks passed: switching, closing, delayed sends, and network failures.');
})().catch(error => { console.error(error); process.exitCode = 1; });
