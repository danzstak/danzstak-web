const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('  if (name === "Friends") {'), source.indexOf('  if (["Photos", "Videos"].includes(name)) {'));
const nodes = [];
function node(tag) {
  const item = { tag, children: [], append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); }, replaceChildren() { this.children = []; }, setAttribute() {}, addEventListener() {} };
  nodes.push(item); return item;
}
vm.runInNewContext(`function render(){const name = "Friends"; ${code}} render();`, {
  document: { createElement: node }, workspace: node('workspace'), featureText: {}, createFriendRequestForm: () => node('form'), AbortController, setTimeout, clearTimeout,
  fetch: async url => {
    if (url.endsWith('/calls/directory')) throw new Error('Presence unavailable');
    return { ok: true, json: async () => ({ friends: [{ email: 'friend@example.com', memberId: '44444444-4444-4444-4444-444444444444', name: 'Existing Friend' }] }) };
  }
});
setImmediate(async () => {
  try {
    assert.equal(nodes.filter(item => item.tag === 'a').length, 1, 'presence failure must not hide accepted friends');
    assert.equal(nodes.find(item => item.tag === 'a').href, 'profile.html?member=44444444-4444-4444-4444-444444444444');
    assert.doesNotMatch(nodes.find(item => item.tag === 'a').href, /@|%40/);
    assert.ok(nodes.some(item => item.tag === 'small' && item.textContent === 'Status unavailable'), 'presence failure must not falsely label a friend offline');
    const timeoutNodes = [];
    let deadline;
    let retries = 0;
    class TestAbortController {
      constructor() { const listeners = []; this.signal = { addEventListener(type, fn) { if (type === 'abort') listeners.push(fn); } }; this.abort = () => listeners.forEach(fn => fn()); }
    }
    function timeoutNode(tag) {
      const item = { tag, children: [], listeners: {}, append(...items) { this.children.push(...items); }, appendChild(child) { this.children.push(child); }, replaceChildren(...items) { this.children = items; }, setAttribute(name, value) { this[name] = value; }, addEventListener(name, fn) { this.listeners[name] = fn; } };
      timeoutNodes.push(item); return item;
    }
    vm.runInNewContext(`function render(){const name = "Friends"; ${code}} render();`, {
      document: { createElement: timeoutNode }, workspace: timeoutNode('workspace'), featureText: {}, createFriendRequestForm: () => timeoutNode('form'),
      AbortController: TestAbortController, setTimeout(fn) { deadline = fn; return 1; }, clearTimeout() {}, renderWorkspace(name) { if (name === 'Friends') retries++; },
      fetch: (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; reject(error); }))
    });
    deadline();
    await new Promise(resolve => setImmediate(resolve));
    const alert = timeoutNodes.find(item => item.role === 'alert');
    const retry = timeoutNodes.find(item => item.tag === 'button' && item.textContent === 'Retry');
    assert.equal(alert?.textContent, 'Friends took too long to load.');
    assert.ok(retry, 'timed-out friend loading must provide a Retry button');
    retry.listeners.click();
    assert.equal(retries, 1, 'Retry must reopen the Friends workspace');
    console.log('Friends loading check passed: accepted friends survive a failed presence lookup without a false offline status.');
  } catch (error) { console.error(error); process.exitCode = 1; }
});
