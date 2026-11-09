const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const eventCode = source.slice(source.indexOf('  if (name === "Events") {'), source.indexOf('  if (name === "Settings") {'));
const nodes = [], requests = [];
function node(tag) {
  const item = { classList: { add() {} }, tag, value: '', checked: false, children: [], handlers: {}, append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); }, setAttribute() {}, addEventListener(type, handler) { this.handlers[type] = handler; }, focus() { this.focused = true; } };
  nodes.push(item);
  return item;
}
const featureText = {};
let active = true;
const renders = [];
vm.runInNewContext(`function renderEvent(){ const name = "Events"; ${eventCode} } renderEvent();`, {
  document: { createElement: node, createTextNode: text => ({ textContent: text }), querySelectorAll: () => [] },
  workspace: node('workspace'), featureText, featurePanel: {}, window: {}, isCurrentWorkspace: () => active, renderWorkspace: name => renders.push(name), renderPublishedEvents() {},
  field: () => ({ wrap: node('label'), input: node('input') }),
  crypto: { randomUUID },
  postActionFetch: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => url === '/marketplace/events' ? ({ event: { id: randomUUID() } }) : ({}) };
  }
});
(async () => {
  const inputs = nodes.filter(item => item.tag === 'input');
  const [title, date, , venue, , , certification] = inputs;
  const button = nodes.find(item => item.textContent === 'Add Event');
  title.value = 'Local music meetup'; date.value = '2026-11-01T20:00'; venue.value = 'The Room';
  await button.handlers.click();
  assert.equal(requests.length, 0, 'uncertified events never reach the API');
  assert.equal(certification.focused, true);
  certification.checked = true;
  await button.handlers.click();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, '/marketplace/events');
  assert.equal(requests[1].body.originalContentCertified, true);
  assert.match(requests[1].body.content, /Local music meetup/);
  assert.equal(title.value, '');
  title.value = 'Pending event'; date.value = '2026-11-02T20:00'; venue.value = 'The Room'; certification.checked = true;
  const previousRenders = renders.length;
  const pending = button.handlers.click(); active = false; featureText.textContent = 'Settings remains visible'; await pending;
  assert.equal(featureText.textContent,'Settings remains visible','late event saves cannot replace another screen description');
  assert.equal(renders.length,previousRenders,'late saves cannot render Events into another workspace');
  active = true;title.value = 'Submitted event';date.value = '2026-11-03T20:00';venue.value = 'The Room';certification.checked = true;
  const draft = button.handlers.click();title.value = 'Next event draft';await draft;
  assert.equal(title.value,'Next event draft','publishing preserves new typing while the request is pending');
  console.log('Event publishing checks passed: explicit confirmation and certified API request.');
})().catch(error => { console.error(error); process.exitCode = 1; });
