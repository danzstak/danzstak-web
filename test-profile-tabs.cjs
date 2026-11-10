const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/profile-editor.js'), 'utf8');
const code = source.slice(source.indexOf('let profileTabVersion = 0;'), source.indexOf('tabs.addEventListener("keydown"'));
function setup() {
  const requests = [], handlers = {};
  const panel = {
    textContent: '', childElementCount: 0, hidden: false, dataset: {},
    replaceChildren() { this.textContent = ''; this.childElementCount = 0; },
    appendChild() { this.childElementCount++; }, prepend() { this.childElementCount++; }
  };
  const context = vm.createContext({ URLSearchParams, tabMessage: panel, details: {}, profileApi: 'https://api.danzstak.com', viewingOtherProfile: false,
    window: {
      location: { hash: '' }, history: { replaceState() {} },
      danzstakCurrentProfile: { email: 'me@example.com', memberId: 'member-1', isOwner: true },
      danzstakProfileCollections: require('./assets/profile-collections.js')
    },
    tabs: { addEventListener: (type, handler) => { handlers[type] = handler; }, querySelectorAll: () => [] },
    profileFetch: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })),
    profileMoreNavigation: () => ({}), profileShop: null,
    profilePostCard: () => ({}), document: { createElement: () => ({ className: '', textContent: '', append() {}, appendChild() {} }) } });
  vm.runInContext(code, context);
  const select = name => handlers.click({ target: { closest: () => ({ dataset: { profileTab: name } }) } });
  const resolve = async (index, data) => { requests[index].resolve({ ok: true, json: async () => data }); await new Promise(done => setImmediate(done)); };
  return { requests, panel, select, resolve };
}
(async () => {
  const h = setup();
  const oldPosts = h.select('Posts');
  const photos = h.select('Photos');
  await h.resolve(1, { posts: [] });
  await photos;
  assert.equal(h.panel.textContent, 'No photos to show yet.');
  await h.resolve(0, { posts: [] });
  await oldPosts;
  assert.equal(h.panel.textContent, 'No photos to show yet.', 'old posts cannot overwrite Photos');

  const videos = h.select('Videos');
  await h.resolve(2, { posts: [] });
  await h.select('About');
  h.panel.textContent = 'About remains selected';
  h.requests[3].reject(new Error('Delayed video failure'));
  await videos;
  assert.equal(h.panel.textContent, 'About remains selected', 'old video error cannot overwrite another tab');

  const oldPhotos = h.select('Photos');
  const currentPosts = h.select('Posts');
  await h.resolve(5, { posts: [] });
  await currentPosts;
  await h.resolve(4, { posts: [] });
  await oldPhotos;
  assert.equal(h.panel.textContent, 'No posts to show yet.', 'old Photos results cannot overwrite Posts');
  const photosWithMedia = h.select('Photos');
  await h.resolve(6, { posts: [{ userId: 'member-1', mediaType: 'image', mediaUrl: 'https://example.com/photo.jpg' }] });
  await photosWithMedia;
  assert.equal(h.panel.childElementCount, 1, 'the Photos tab renders matching profile media');
  console.log('Profile tab checks passed: delayed Posts, Photos, and Videos results stay in their selected tab.');
})().catch(error => { console.error(error); process.exitCode = 1; });
