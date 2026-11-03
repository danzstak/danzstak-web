const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('feed.html', 'utf8');
const code = source.slice(source.indexOf('async function loadFriends()'), source.indexOf('// CREATE THE VISUAL DISPLAY OF A POST'));

function element(tagName) {
  return {
    tagName: tagName.toUpperCase(), children: [], className: '', textContent: '',
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute(name, value) { this[name] = value; }
  };
}

async function render({ friendsAvailable = true, presenceAvailable = true } = {}) {
  const container = element('div');
  const context = vm.createContext({
    feedTranslate: value => value,
    document: {
      getElementById(id) { assert.equal(id, 'feedFriends'); return container; },
      createElement: element
    },
    loadPeopleSnapshot: async () => {
      if (!friendsAvailable) throw Error('Friends unavailable');
      return {
        presenceState: { online: true },
        friendsData: { friends: [{ email: 'friend@example.com', memberId: '44444444-4444-4444-4444-444444444444', name: 'Existing Friend' }] },
        directoryData: { users: presenceAvailable ? [{ email: 'friend@example.com', online: true }] : [] },
        presenceAvailable
      };
    }
  });
  vm.runInContext(code, context);
  await context.loadFriends();
  return container;
}

(async () => {
  const online = await render();
  assert.equal(online.children[0].children[1].children[1].textContent, 'Online');

  const unknown = await render({ presenceAvailable: false });
  const details = unknown.children[0].children[1];
  assert.equal(details.children[1].textContent, 'Status unavailable', 'failed presence must not falsely label a friend offline');
  assert.equal(unknown.children[0].children[2].title, 'Status unavailable');

  const failed = await render({ friendsAvailable: false });
  assert.equal(failed.children[0].textContent, 'Friends are temporarily unavailable. Retrying…', 'friends failure must replace the loading state');
  console.log('Feed friend presence checks passed: online, unknown, and failed states remain accurate.');
})().catch(error => { console.error(error); process.exitCode = 1; });
