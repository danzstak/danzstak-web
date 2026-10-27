const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'infrastructure/auth-api/index.mjs'), 'utf8');
const code = source.slice(source.indexOf('async function loadFeedAuthorProfiles('), source.indexOf('async function getSecurePosts(event)'));
let active = 0, maximum = 0;
const requested = [], cognitoRequested = [];
const items = Array.from({ length: 20 }, (_, i) => ({ userEmail: { S: `member${i}@example.com` } }));
items.push(items[0], { userEmail: { S: ' MEMBER0@EXAMPLE.COM ' } }, {});
const context = vm.createContext({ items, settingsTable: 'DanzStak-UserSettings', userPoolId: 'pool', console: { warn() {} },
  signedMediaUrl: key => 'signed:' + key,
  GetItemCommand: class { constructor(input) { this.input = input; } },
  ListUsersCommand: class { constructor(input) { this.input = input; } }, db: { send: async command => {
    requested.push(command.input); active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    if (command.input.Key.userEmail.S === 'member1@example.com') throw new Error('Temporarily unavailable');
    if (command.input.Key.userEmail.S === 'member0@example.com') return { Item: { profileName: { S: '  Saved display name  ' }, profileAvatarKey: { S: 'users/member0/avatar.jpg' } } };
    return {};
  } }, cognito: { send: async command => {
    cognitoRequested.push(command.input);
    const email = command.input.Filter.match(/"(.*)"/)[1];
    if (email === 'member1@example.com') return { Users: [{ Attributes: [{ Name: 'name', Value: 'Cognito public name' }] }] };
    if (email === 'member2@example.com') return { Users: [{ Attributes: [{ Name: 'preferred_username', Value: 'Preferred public name' }] }] };
    return { Users: [] };
  } } });
vm.runInContext(code, context);
(async () => {
  const names = await vm.runInContext('loadFeedAuthorNames(items)', context);
  const profiles = await vm.runInContext('loadFeedAuthorProfiles(items)', context);
  assert.equal(requested.length, 40, 'each profile pass reads an author only once even across multiple posts');
  assert.equal(maximum <= 8, true, 'profile reads use bounded concurrency');
  assert.equal(names.get('member0@example.com'), 'Saved display name');
  assert.equal(names.get('member1@example.com'), 'Cognito public name', 'Cognito name fills a missing settings name');
  assert.equal(names.get('member2@example.com'), 'Preferred public name', 'preferred username is the secondary public fallback');
  assert.equal(profiles.get('member0@example.com').picture, 'signed:users/member0/avatar.jpg', 'saved profile photos receive expiring media URLs');
  assert.equal(cognitoRequested.length, 38, 'each bounded lookup skips Cognito when a saved profile name exists');
  assert.equal(cognitoRequested.every(request => request.UserPoolId === 'pool' && request.Limit === 1), true);
  assert.equal(requested.every(request => request.ProjectionExpression === 'profileName, profileAvatarKey'), true, 'only public profile identity fields are loaded');
  console.log('Feed author checks passed: public names and photos, deduplication, bounded reads, and lookup failure recovery.');
})().catch(error => { console.error(error); process.exitCode = 1; });
