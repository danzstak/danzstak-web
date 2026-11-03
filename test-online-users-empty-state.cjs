const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('feed.html', 'utf8');
const code = source.slice(source.indexOf('async function loadOnlineUsers()'), source.indexOf('async function updateFeedFriend'));

async function renderEmptyState(presence) {
  const container = {
    children: [],
    replaceChildren() { this.children = []; },
    appendChild(child) { this.children.push(child); }
  };
  const context = vm.createContext({
    feedTranslate: value => value,
    document: {
      getElementById: id => {
        assert.equal(id, 'feedOnlineUsers');
        return container;
      },
      createElement: tagName => ({ tagName: tagName.toUpperCase(), className: '', textContent: '' })
    },
    loadPeopleSnapshot: async () => ({ presenceState: presence, directoryData: { users: [] }, friendsData: { friends: [] }, presenceAvailable: true }),
    location: { replace() { throw new Error('Unexpected sign-out redirect'); } },
    openMessageDrawer() {},
    updateFeedFriend() {}
  });
  vm.runInContext(code, context);
  await context.loadOnlineUsers();
  return container.children[0]?.textContent;
}

(async () => {
  assert.equal(await renderEmptyState({ online: true, visible: true }), 'You are online. No other connected users are active right now.');
  assert.equal(await renderEmptyState({ online: false, visible: false }), 'You are appearing offline. Turn on online visibility in Settings to be seen.');
  assert.equal(await renderEmptyState({}), 'No other connected users are active right now.');
  console.log('Online user empty-state checks passed: current presence, hidden visibility, and unavailable presence are distinct.');
})().catch(error => { console.error(error); process.exitCode = 1; });
