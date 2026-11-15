const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const eventCode = source.slice(source.indexOf('  if (name === "Events") {'), source.indexOf('  if (name === "Settings") {'));
const nodes = [], requests = [];
function node(tag) {
  const item = { classList: { add() {} }, tag, value: '', checked: false, children: [], handlers: {}, append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); }, replaceChildren(...children) { this.children = children; }, setAttribute() {}, addEventListener(type, handler) { this.handlers[type] = handler; }, focus() { this.focused = true; } };
  nodes.push(item);
  return item;
}
const featureText = {};
let active = true;
const renders = [];
vm.runInNewContext(`function renderEvent(){ const name = "Events"; ${eventCode} } renderEvent();`, {
  document: { createElement: node, createTextNode: text => ({ textContent: text }), querySelectorAll: () => [] },
  workspace: node('workspace'), featureText, featurePanel: {}, window: {}, isCurrentWorkspace: () => active, renderWorkspace: name => renders.push(name), renderPublishedEvents() {}, renderUpcomingEvents() {},
  URL: Object.assign(class extends URL {}, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }), fetch: async () => ({ ok: true }),
  field: () => ({ wrap: node('label'), input: node('input') }),
  crypto: { randomUUID },
  postActionFetch: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => url === '/marketplace/events' ? ({ event: { id: randomUUID() } }) : url === '/stories' ? ({ uploadUrl: 'https://upload.example/x', mediaKey: 'users/aaaaaaaaaaaaaaaaaaaaaaaa/11111111-1111-4111-8111-111111111111.png' }) : ({}) };
  }
});
(async () => {
  const inputs = nodes.filter(item => item.tag === 'input');
  const [mediaInput, title, date, , venue, , , outsideTickets, certification] = inputs;
  const button = nodes.find(item => item.textContent === 'Add Event');
  title.value = 'Local music meetup'; date.value = '2026-11-01T20:00'; venue.value = 'The Room'; certification.checked = true;
  await button.handlers.click();
  assert.equal(requests.length, 0, 'events without a flyer or video never reach the API');
  assert.match(featureText.textContent, /flyer or a video of 15 seconds/);
  certification.checked = false;
  mediaInput.files = [{ type: 'image/png' }];
  await mediaInput.handlers.change();
  await button.handlers.click();
  assert.equal(requests.length, 0, 'uncertified events never reach the API');
  assert.equal(certification.focused, true);
  certification.checked = true;
  await button.handlers.click();
  assert.equal(requests.length, 3);
  assert.equal(requests[0].url, '/stories');
  assert.equal(requests[1].url, '/marketplace/events');
  assert.equal(requests[1].body.mediaType, 'image');
  assert.match(requests[1].body.mediaKey, /^users\//);
  assert.equal(requests[2].body.originalContentCertified, true);
  assert.equal(requests[2].body.mediaKey, requests[1].body.mediaKey, 'the Mix post carries the flyer');
  assert.match(requests[2].body.content, /Local music meetup/);
  assert.equal(title.value, '');
  mediaInput.files = [{ type: 'image/png' }]; await mediaInput.handlers.change();
  title.value = 'Pending event'; date.value = '2026-11-02T20:00'; venue.value = 'The Room'; certification.checked = true;
  const previousRenders = renders.length;
  const pending = button.handlers.click(); active = false; featureText.textContent = 'Settings remains visible'; await pending;
  assert.equal(featureText.textContent,'Settings remains visible','late event saves cannot replace another screen description');
  assert.equal(renders.length,previousRenders,'late saves cannot render Events into another workspace');
  active = true;mediaInput.files = [{ type: 'image/png' }]; await mediaInput.handlers.change();title.value = 'Submitted event';date.value = '2026-11-03T20:00';venue.value = 'The Room';certification.checked = true;
  const draft = button.handlers.click();title.value = 'Next event draft';await draft;
  assert.equal(title.value,'Next event draft','publishing preserves new typing while the request is pending');
  active = true; mediaInput.files = [{ type: 'image/png' }]; await mediaInput.handlers.change();
  title.value = 'Eventbrite gig'; date.value = '2026-11-04T20:00'; venue.value = 'The Room'; certification.checked = true; outsideTickets.value = 'javascript:alert(1)';
  const before = requests.length; await button.handlers.click();
  assert.equal(requests.length, before, 'unsafe outside ticket links never reach the API');
  outsideTickets.value = 'https://www.eventbrite.com/e/123'; await button.handlers.click();
  const created = requests.filter(item => item.url === '/marketplace/events').pop();
  assert.equal(created.body.ticketUrl, 'https://www.eventbrite.com/e/123');
  assert.match(requests[requests.length - 1].body.content, /eventbrite\.com/, 'the Mix post carries the outside ticket link');
  console.log('Event publishing checks passed: flyer or video required, explicit confirmation, flyer on the event and the Mix post.');
})().catch(error => { console.error(error); process.exitCode = 1; });
