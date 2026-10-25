const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/profile-editor.js'), 'utf8');
const code = source.slice(source.indexOf('let profileTabVersion = 0;'), source.indexOf('tabs.addEventListener("keydown"'));
function setup() {
  const requests = [], handlers = {};
  const panel = { textContent: '', childElementCount: 0, replaceChildren() { this.textContent = ''; this.childElementCount = 0; }, appendChild() { this.childElementCount++; } };
  const context = vm.createContext({ URLSearchParams, tabMessage: panel, details: {}, profileApi: 'https://api.danzstak.com', viewingOtherProfile: false,
    window: { danzstakCurrentProfile: { email: 'me@example.com' } },
    tabs: { addEventListener: (type, handler) => { handlers[type] = handler; }, querySelectorAll: () => [] },
    fetch: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })),
    profilePostCard: () => ({}), document: { createElement: () => ({ append() {}, appendChild() {} }) } });
  vm.runInContext(code, context);
  const select = name => handlers.click({ target: { closest: () => ({ dataset: { profileTab: name } }) } });
  const resolve = async (index, data) => { requests[index].resolve({ ok: true, json: async () => data }); await new Promise(done => setImmediate(done)); };
  return { requests, panel, select, resolve };
}
(async () => {
  const h = setup();
  const oldPosts = h.select('Posts');
  const friends = h.select('Friends');
  await h.resolve(1, { friends: [] });
  await h.resolve(2, { users: [] });
  await friends;
  assert.equal(h.panel.textContent, 'No friends yet.');
  await h.resolve(0, { posts: [] });
  await oldPosts;
  assert.equal(h.panel.textContent, 'No friends yet.', 'old posts cannot overwrite friends');

  const media = h.select('Media');
  await h.resolve(3, { posts: [] });
  await h.select('About');
  h.panel.textContent = 'About remains selected';
  h.requests[4].reject(new Error('Delayed media failure'));
  await media;
  assert.equal(h.panel.textContent, 'About remains selected', 'old media error cannot overwrite another tab');

  const oldFriends = h.select('Friends');
  const currentPosts = h.select('Posts');
  await h.resolve(7, { posts: [] });
  await currentPosts;
  await h.resolve(5, { friends: [] });
  await h.resolve(6, { users: [] });
  await oldFriends;
  assert.equal(h.panel.textContent, 'No posts to show yet.', 'old friends cannot overwrite posts');
  const mediaWithPhotos = h.select('Media');
  await h.resolve(8, { posts: [{ authorEmail: 'me@example.com', mediaType: 'image', mediaUrl: 'https://example.com/photo.jpg' }] });
  assert.equal(h.panel.childElementCount, 1, 'photos render before the optional profile video returns');
  h.requests[9].reject(new Error('Video service offline'));
  await mediaWithPhotos;
  assert.equal(h.panel.childElementCount, 2, 'photo is retained alongside a retry notice');
  console.log('Profile tab checks passed: delayed posts, friends, and media errors stay in their tab.');
})().catch(error => { console.error(error); process.exitCode = 1; });
