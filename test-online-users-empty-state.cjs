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
  const response = payload => ({ ok: true, status: 200, json: async () => payload });
  const context = vm.createContext({
    document: {
      getElementById: id => {
        assert.equal(id, 'feedOnlineUsers');
        return container;
      },
      createElement: tagName => ({ tagName: tagName.toUpperCase(), className: '', textContent: '' })
    },
    fetchWithDeadline: async url => {
      if (url.endsWith('/calls/presence')) return response(presence);
      if (url.endsWith('/calls/directory')) return response({ users: [] });
      if (url.endsWith('/friends')) return response({ friends: [] });
      throw new Error(`Unexpected request: ${url}`);
    },
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
