const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'infrastructure/auth-api/index.mjs'), 'utf8');
const code = source.slice(source.indexOf('async function loadFeedAuthorNames('), source.indexOf('async function getSecurePosts(event)'));
let active = 0, maximum = 0;
const requested = [];
const items = Array.from({ length: 20 }, (_, i) => ({ userEmail: { S: `member${i}@example.com` } }));
items.push(items[0], { userEmail: { S: ' MEMBER0@EXAMPLE.COM ' } }, {});
const context = vm.createContext({ items, settingsTable: 'DanzStak-UserSettings', console: { warn() {} },
  GetItemCommand: class { constructor(input) { this.input = input; } }, db: { send: async command => {
    requested.push(command.input); active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    if (command.input.Key.userEmail.S === 'member1@example.com') throw new Error('Temporarily unavailable');
    return { Item: { profileName: { S: '  Saved display name  ' } } };
  } } });
vm.runInContext(code, context);
(async () => {
  const names = await vm.runInContext('loadFeedAuthorNames(items)', context);
  assert.equal(requested.length, 20, 'an author is read only once even across multiple posts');
  assert.equal(maximum <= 8, true, 'profile reads use bounded concurrency');
  assert.equal(names.get('member0@example.com'), 'Saved display name');
  assert.equal(names.has('member1@example.com'), false, 'an unavailable name falls back without failing the feed');
  assert.equal(requested.every(request => request.ProjectionExpression === 'profileName'), true, 'private profile fields are not loaded');
  console.log('Feed author checks passed: saved display names, deduplication, bounded reads, and lookup failure recovery.');
})().catch(error => { console.error(error); process.exitCode = 1; });
