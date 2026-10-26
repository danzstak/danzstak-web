const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
const cleanupCode = source.slice(source.indexOf('async function runCleanup('), source.indexOf('async function batchGetFriendships'));
const deleteCode = source.slice(source.indexOf('async function deleteSecurePost('), source.indexOf('async function resolveMediaTags'));

class GetItemCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }

const postId = '11111111-1111-4111-a111-111111111111';
const ownerId = 'owner-user-id';
const ownerEmail = 'owner@example.com';
const ownerPrefix = createHash('sha256').update(ownerEmail).digest('hex').slice(0, 24);
const mediaKey = `users/${ownerPrefix}/22222222-2222-4222-a222-222222222222.jpg`;

function harness({ authenticatedUser = ownerId, storedOwner = ownerId, failMediaAttempts = 0 } = {}) {
  const deletes = [];
  const mediaDeletes = [];
  let mediaAttempts = 0;
  const context = vm.createContext({
    corsHeaders: () => ({}),
    allowedOrigins: new Set(['https://danzstak.com']),
    getAuthenticatedUser: async () => authenticatedUser,
    postsTable: 'posts', storiesTable: 'stories', reactionsTable: 'reactions', commentsTable: 'comments', engagementNotificationsTable: 'notices',
    sha256: value => createHash('sha256').update(value).digest('hex'),
    process: { env: { MEDIA_BUCKET: 'media' } },
    GetItemCommand, DeleteItemCommand, DeleteObjectCommand,
    db: { send: async command => {
      if (command instanceof GetItemCommand) return { Item: { postId: { S: postId }, userId: { S: storedOwner }, userEmail: { S: ownerEmail }, mediaKey: { S: mediaKey } } };
      if (command instanceof DeleteItemCommand) { deletes.push(command.input); return {}; }
      throw Error('Unexpected database command');
    } },
    s3: { send: async command => {
      mediaAttempts += 1;
      if (mediaAttempts <= failMediaAttempts) throw Error('temporary storage failure');
      mediaDeletes.push(command.input); return {};
    } },
    scanAll: async () => [{ storyId: { S: '33333333-3333-4333-a333-333333333333' } }],
    queryAll: async request => request.TableName === 'reactions'
      ? [{ postId: { S: postId }, userId: { S: 'reactor' } }]
      : request.TableName === 'comments'
        ? [{ postId: { S: postId }, commentId: { S: 'comment' } }]
        : [{ userEmail: { S: ownerEmail }, eventId: { S: 'notice' }, postId: { S: postId } }, { userEmail: { S: ownerEmail }, eventId: { S: 'other' }, postId: { S: 'other-post' } }],
    setTimeout: callback => { callback(); return 1; },
    console
  });
  vm.runInContext(cleanupCode + deleteCode, context);
  return { context, deletes, mediaDeletes, mediaAttempts: () => mediaAttempts };
}

(async () => {
  const denied = harness({ storedOwner: 'someone-else' });
  const deniedResponse = await denied.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId } });
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(denied.deletes.length, 0, 'a non-owner must not delete any records');

  const owner = harness({ failMediaAttempts: 2 });
  const response = await owner.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { deleted: true, cleanupPending: 0 });
  assert.equal(owner.mediaAttempts(), 3, 'temporary media deletion failures must be retried');
  assert.equal(owner.mediaDeletes.length, 1);
  assert.equal(owner.mediaDeletes[0].Bucket, 'media');
  assert.equal(owner.mediaDeletes[0].Key, mediaKey);
  assert.ok(owner.deletes.some(item => item.TableName === 'posts' && item.Key.postId.S === postId), 'post record must be permanently deleted');
  assert.ok(owner.deletes.some(item => item.TableName === 'reactions'), 'post reactions must be deleted');
  assert.ok(owner.deletes.some(item => item.TableName === 'comments'), 'post comments must be deleted');
  assert.ok(owner.deletes.some(item => item.TableName === 'notices' && item.Key.eventId.S === 'notice'), 'post notifications must be deleted');
  assert.ok(owner.deletes.some(item => item.TableName === 'stories'), 'linked Story records must be deleted');
  assert.ok(!owner.deletes.some(item => item.TableName === 'notices' && item.Key.eventId.S === 'other'), 'unrelated notifications must remain');
  console.log('Post deletion checks passed: owner authorization, database removal, dependent cleanup, media retry, and unrelated-record preservation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
