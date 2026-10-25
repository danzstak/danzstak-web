const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const eventCode = source.slice(source.indexOf('  if (name === "Events") {'), source.indexOf('  if (name === "Settings") {'));
const nodes = [], requests = [];
function node(tag) {
  const item = { tag, value: '', checked: false, children: [], handlers: {}, append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); }, setAttribute() {}, addEventListener(type, handler) { this.handlers[type] = handler; }, focus() { this.focused = true; } };
  nodes.push(item);
  return item;
}
const featureText = {};
vm.runInNewContext(`function renderEvent(){ const name = "Events"; ${eventCode} } renderEvent();`, {
  document: { createElement: node, createTextNode: text => ({ textContent: text }), querySelectorAll: () => [] },
  workspace: node('workspace'), featureText, featurePanel: {}, window: {}, renderWorkspace() {}, renderPublishedEvents() {},
  field: () => ({ wrap: node('label'), input: node('input') }),
  fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({}) }; }
});
(async () => {
  const [title, date, certification] = nodes.filter(item => item.tag === 'input');
  const button = nodes.find(item => item.textContent === 'Add Event');
  title.value = 'Local music meetup'; date.value = '2026-11-01';
  await button.handlers.click();
  assert.equal(requests.length, 0, 'uncertified events never reach the API');
  assert.equal(certification.focused, true);
  certification.checked = true;
  await button.handlers.click();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.originalContentCertified, true);
  assert.match(requests[0].body.content, /Local music meetup/);
  assert.equal(title.value, '');
  console.log('Event publishing checks passed: explicit confirmation and certified API request.');
})().catch(error => { console.error(error); process.exitCode = 1; });
