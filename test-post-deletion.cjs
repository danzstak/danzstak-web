const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
const feedSource = readFileSync('assets/feed-enhancements.js', 'utf8');
const feedbackSource = readFileSync('assets/app-feedback.js', 'utf8');
const translationsSource = readFileSync('assets/i18n.js', 'utf8');
const cleanupCode = source.slice(source.indexOf('async function runCleanup('), source.indexOf('async function batchGetFriendships'));
const deleteCode = source.slice(source.indexOf('async function deleteSecurePost('), source.indexOf('async function resolveMediaTags'));

class GetItemCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }

const postId = '11111111-1111-4111-a111-111111111111';
const ownerId = 'owner-user-id';
const ownerEmail = 'owner@example.com';
const ownerPrefix = createHash('sha256').update(ownerEmail).digest('hex').slice(0, 24);
const mediaKey = `users/${ownerPrefix}/22222222-2222-4222-a222-222222222222.jpg`;

function harness({ authenticatedUser = ownerId, storedOwner = ownerId, profileOwner = "", failMediaAttempts = 0, shares = [], sharedPostId = "" } = {}) {
  const deletes = [];
  const updates = [];
  const mediaDeletes = [];
  let mediaAttempts = 0;
  const context = vm.createContext({
    corsHeaders: () => ({}),
    allowedOrigins: new Set(['https://danzstak.com']),
    getAuthenticatedUser: async () => authenticatedUser,
    parseJsonBody: event => event.body ? JSON.parse(event.body) : null,
    postsTable: 'posts', storiesTable: 'stories', reactionsTable: 'reactions', commentsTable: 'comments', engagementNotificationsTable: 'notices',
    sha256: value => createHash('sha256').update(value).digest('hex'),
    process: { env: { MEDIA_BUCKET: 'media' } },
    GetItemCommand, DeleteItemCommand, DeleteObjectCommand, UpdateItemCommand,
    db: { send: async command => {
      if (command instanceof GetItemCommand) return { Item: { postId: { S: postId }, userId: { S: storedOwner }, userEmail: { S: ownerEmail }, ...(!sharedPostId ? { mediaKey: { S: mediaKey } } : {}), ...(profileOwner ? { profileOwnerId: { S: profileOwner } } : {}), ...(sharedPostId ? { sharedPostId: { S: sharedPostId } } : {}) } };
      if (command instanceof UpdateItemCommand) { updates.push(command.input); return {}; }
      if (command instanceof DeleteItemCommand) { deletes.push(command.input); return {}; }
      throw Error('Unexpected database command');
    } },
    s3: { send: async command => {
      mediaAttempts += 1;
      if (mediaAttempts <= failMediaAttempts) throw Error('temporary storage failure');
      mediaDeletes.push(command.input); return {};
    } },
    scanAll: async request => request.TableName === 'posts' ? shares : [{ storyId: { S: '33333333-3333-4333-a333-333333333333' } }],
    queryAll: async request => request.TableName === 'reactions'
      ? [{ postId: { S: postId }, userId: { S: 'reactor' } }]
      : request.TableName === 'comments'
        ? [{ postId: { S: postId }, commentId: { S: 'comment' } }]
        : [{ userEmail: { S: ownerEmail }, eventId: { S: 'notice' }, postId: { S: postId } }, { userEmail: { S: ownerEmail }, eventId: { S: 'other' }, postId: { S: 'other-post' } }],
    setTimeout: callback => { callback(); return 1; },
    console
  });
  vm.runInContext(cleanupCode + deleteCode, context);
  return { context, deletes, updates, mediaDeletes, mediaAttempts: () => mediaAttempts };
}

(async () => {
  assert.match(feedSource, /const data = await response\.json\(\)\.catch\(\(\) => \(\{\}\)\);\s*if \(!response\.ok\) throw new Error\(data\.error \|\| "The post could not be deleted from the server\."\)/, 'the feed must preserve a retryable server deletion error');
  assert.match(feedSource, /window\.danzstakTranslate\?\.\(source\) \|\| source/, 'feed feedback must follow the selected language');
  assert.match(feedbackSource, /window\.danzstakTranslate\?\.\(source\) \|\| source/, 'shared feedback must follow the selected language');
  assert.match(translationsSource, /const deletionFeedbackKeys=/, 'post deletion feedback must have localized keys');
  for (const language of ['es','fr','de','pt','it','ko','ja','zh-Hans','zh-Hant','fil','hi','vi','th','id']) assert.match(translationsSource, new RegExp(`(?:^|\\n)\\s*(?:"${language}"|${language}):\\[`), `post deletion feedback must cover ${language}`);
  const denied = harness({ storedOwner: 'someone-else' });
  const deniedResponse = await denied.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId } });
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(denied.deletes.length, 0, 'a non-owner must not delete any records');

  const profileOwner = harness({ authenticatedUser: 'profile-owner', storedOwner: ownerId, profileOwner: 'profile-owner' });
  const profileResponse = await profileOwner.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId } });
  assert.equal(profileResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(profileResponse.body), { deleted: false, removedFromProfile: true });
  assert.equal(profileOwner.updates.length, 1, 'the profile association must be removed');
  assert.equal(profileOwner.updates[0].UpdateExpression, 'REMOVE profileOwnerId, profileOwnerEmail');
  assert.equal(profileOwner.deletes.length, 0, 'a profile owner must not delete the author post');
  assert.equal(profileOwner.mediaDeletes.length, 0, 'a profile owner must not delete author media');

  const owner = harness({ failMediaAttempts: 2 });
  const response = await owner.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { deleted: true, deletedEverywhere: true, removedShares: 0, cleanupPending: 0 });
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

  const shareId = '44444444-4444-4444-a444-444444444444';
  const share = { postId: { S: shareId }, userId: { S: 'sharer' }, userEmail: { S: 'sharer@example.com' }, sharedPostId: { S: postId }, content: { S: 'Shared a post.' } };
  const removeHere = harness({ shares: [share] });
  const removeResponse = await removeHere.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId }, body: JSON.stringify({ mode: 'remove_here' }) });
  assert.deepEqual(JSON.parse(removeResponse.body), { deleted: false, removedFromHere: true, sharesPreserved: 1 });
  assert.equal(removeHere.updates[0].UpdateExpression, 'SET placementRemoved = :yes, placementRemovedAt = :at');
  assert.equal(removeHere.deletes.length, 0, 'remove from here must preserve the source and its shares');

  const cascade = harness({ shares: [share] });
  const cascadeResponse = await cascade.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId }, body: JSON.stringify({ mode: 'delete_everywhere' }) });
  assert.equal(JSON.parse(cascadeResponse.body).removedShares, 1);
  assert.ok(cascade.deletes.some(item => item.TableName === 'posts' && item.Key.postId.S === shareId), 'delete everywhere must remove every share placement');

  const ownShare = harness({ sharedPostId: '55555555-5555-4555-a555-555555555555' });
  const ownShareResponse = await ownShare.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId }, body: JSON.stringify({ mode: 'remove_here' }) });
  assert.equal(JSON.parse(ownShareResponse.body).deletedEverywhere, false, 'a sharer cannot delete the creator original');

  const storageUnavailable = harness({ failMediaAttempts: 3 });
  const unavailableResponse = await storageUnavailable.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId } });
  assert.equal(unavailableResponse.statusCode, 503);
  assert.deepEqual(JSON.parse(unavailableResponse.body), { error: 'Post media could not be removed yet. Try again.', deleted: false });
  assert.equal(storageUnavailable.mediaAttempts(), 3, 'storage deletion receives the full retry budget');
  assert.equal(storageUnavailable.deletes.length, 0, 'the post and its database graph must remain retryable when media deletion is unavailable');
  console.log('Post deletion checks passed: author-only destruction, safe profile removal, database cleanup, media retry, and unrelated-record preservation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
