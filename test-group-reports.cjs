const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'infrastructure/auth-api/index.mjs'), 'utf8');
const code = source.slice(source.indexOf('async function reportPost(event)'), source.indexOf('async function deleteComment(event)'));
const writes = [];
let authenticated = true, existingGroup = true;
const context = vm.createContext({ corsHeaders: () => ({}), allowedOrigins: new Set(['https://danzstak.com']),
  getAuthenticatedUser: async () => authenticated ? 'reporter-1' : null, parseJsonBody: event => JSON.parse(event.body),
  groupExists: async () => existingGroup, postForEngagement: async () => ({ post: { userId: { S: 'another-user' } } }),
  accountForSub: async () => 'reporter@example.com', randomUUID: () => 'report-1', reportsTable: 'DANZSTAK-Reports',
  PutItemCommand: class { constructor(input) { this.input = input; } }, db: { send: async command => writes.push(command.input) } });
vm.runInContext(code, context);
const report = async (body, origin = 'https://danzstak.com') => { context.event = { headers: { origin }, body: JSON.stringify(body) }; return vm.runInContext('reportPost(event)', context); };
(async () => {
  const body = { targetType: 'group', groupId: 'default-0', reason: 'other', details: 'Group concern for review' };
  assert.equal((await report(body, 'https://untrusted.example')).statusCode, 403);
  authenticated = false; assert.equal((await report(body)).statusCode, 401); authenticated = true;
  assert.equal((await report({ ...body, details: '' })).statusCode, 400);
  assert.equal((await report({ ...body, details: 'a'.repeat(501) })).statusCode, 400);
  existingGroup = false; assert.equal((await report(body)).statusCode, 404); existingGroup = true;
  assert.equal(writes.length, 0, 'invalid and unauthenticated reports never reach storage');
  assert.equal((await report(body)).statusCode, 201);
  assert.equal(writes[0].Item.targetType.S, 'group'); assert.equal(writes[0].Item.groupId.S, 'default-0');
  assert.equal(writes[0].Item.status.S, 'open'); assert.equal(writes[0].Item.postId, undefined);
  assert.equal((await report({ postId: 'post-1', reason: 'spam', details: '' })).statusCode, 201);
  assert.equal(writes[1].Item.postId.S, 'post-1', 'existing post reports still work');
  console.log('Group report checks passed: authorization, validation, durable storage, and existing post reports.');
})().catch(error => { console.error(error); process.exitCode = 1; });
