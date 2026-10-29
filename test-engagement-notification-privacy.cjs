const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
assert.match(source, /async function mapLimit\(items, limit, worker\)/, 'notification lookups require the bounded-concurrency helper');
const start = source.indexOf('async function getEngagementNotifications(');
const end = source.indexOf('async function clearEngagementNotifications(', start);
assert.notEqual(start, -1);
assert.notEqual(end, -1);

class ListUsersCommand { constructor(input) { this.input = input; } }
const actorEmail = 'artist@example.com';
const context = vm.createContext({
  corsHeaders: () => ({ 'content-type': 'application/json' }),
  getAuthenticatedUser: async () => 'viewer-id',
  accountForSub: async () => 'viewer@example.com',
  engagementNotificationsTable: 'notifications',
  queryAll: async () => [{
    type: { S: 'comment' }, actorEmail: { S: actorEmail }, postId: { S: 'post-id' },
    preview: { S: 'Great set' }, createdAt: { S: '2026-10-29T10:00:00.000Z' }, read: { BOOL: false }
  }],
  loadFeedAuthorProfiles: async () => new Map([[actorEmail, { name: 'Touring Artist', picture: 'https://media.test/avatar' }]]),
  mapLimit: async (values, _limit, task) => Promise.all(values.map(task)),
  cognito: { send: async command => {
    assert.equal(command.input.Filter, `email = "${actorEmail}"`);
    return { Users: [{ Attributes: [{ Name: 'sub', Value: 'member-opaque-id' }] }] };
  } },
  ListUsersCommand,
  userPoolId: 'pool',
  console: { warn() {} },
  JSON, Set, Map
});

vm.runInContext(source.slice(start, end), context);
(async () => {
  const response = await context.getEngagementNotifications({ headers: { origin: 'https://danzstak.com' } });
  assert.equal(response.statusCode, 200);
  const notification = JSON.parse(response.body).notifications[0];
  assert.equal(notification.memberId, 'member-opaque-id');
  assert.equal(notification.name, 'Touring Artist');
  assert.equal(notification.picture, 'https://media.test/avatar');
  assert.equal(notification.email, undefined);
  assert.equal(JSON.stringify(notification).includes(actorEmail), false);
  console.log('Engagement notification privacy checks passed: public profile identity is returned without account emails.');
})().catch(error => { console.error(error); process.exitCode = 1; });
