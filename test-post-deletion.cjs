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
const parentCommentId = '1700000000000#aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const replyCommentId = '1700000000001#bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function harness({ authenticatedUser = ownerId, storedOwner = ownerId, profileOwner = "", failMediaAttempts = 0, failNoticeAttempts = 0, shares = [], sharedPostId = "", taggedUsers = [{ M: { memberId: { S: 'tagged-member' }, userEmail: { S: 'tagged@example.com' } } }] } = {}) {
  const deletes = [];
  const updates = [];
  const mediaDeletes = [];
  const collectionLimits = [];
  let mediaAttempts = 0;
  let noticeAttempts = 0;
  const context = vm.createContext({
    corsHeaders: () => ({}),
    allowedOrigins: new Set(['https://danzstak.com']),
    getAuthenticatedUser: async () => authenticatedUser,
    parseJsonBody: event => event.body ? JSON.parse(event.body) : null,
    postsTable: 'posts', storiesTable: 'stories', reactionsTable: 'reactions', commentsTable: 'comments', engagementNotificationsTable: 'notices',
    sha256: value => createHash('sha256').update(value).digest('hex'),
    process: { env: { MEDIA_BUCKET: 'media', POST_VIEWS_TABLE: 'postViews' } },
    GetItemCommand, DeleteItemCommand, DeleteObjectCommand, UpdateItemCommand,
    db: { send: async command => {
      if (command instanceof GetItemCommand) return { Item: { postId: { S: postId }, userId: { S: storedOwner }, userEmail: { S: ownerEmail }, taggedUsers: { L: taggedUsers }, ...(!sharedPostId ? { mediaKey: { S: mediaKey } } : {}), ...(profileOwner ? { profileOwnerId: { S: profileOwner } } : {}), ...(sharedPostId ? { sharedPostId: { S: sharedPostId } } : {}) } };
      if (command instanceof UpdateItemCommand) { updates.push(command.input); return {}; }
      if (command instanceof DeleteItemCommand) {
        if (command.input.TableName === 'notices' && ++noticeAttempts <= failNoticeAttempts) throw Error('temporary notification cleanup failure');
        deletes.push(command.input); return {};
      }
      throw Error('Unexpected database command');
    } },
    s3: { send: async command => {
      mediaAttempts += 1;
      if (mediaAttempts <= failMediaAttempts) throw Error('temporary storage failure');
      mediaDeletes.push(command.input); return {};
    } },
    scanAll: async (request, maximumItems) => {
      collectionLimits.push({ operation: 'scan', table: request.TableName, maximumItems });
      return request.TableName === 'posts' ? shares : [{ storyId: { S: '33333333-3333-4333-a333-333333333333' } }];
    },
    queryAll: async (request, maximumItems) => {
      collectionLimits.push({ operation: 'query', table: request.TableName, maximumItems });
      const requestedPostId = request.ExpressionAttributeValues?.[':p']?.S || postId;
      return request.TableName === 'reactions'
      ? [
          { postId: { S: requestedPostId }, userId: { S: 'reactor' } },
          { postId: { S: requestedPostId }, userId: { S: `comment#${parentCommentId}#comment-reactor` }, commentId: { S: parentCommentId } }
        ]
      : request.TableName === 'comments'
        ? [
            { postId: { S: requestedPostId }, commentId: { S: parentCommentId }, userEmail: { S: 'commenter@example.com' } },
            { postId: { S: requestedPostId }, commentId: { S: replyCommentId }, userEmail: { S: 'replier@example.com' }, parentCommentId: { S: parentCommentId } }
          ]
        : request.TableName === 'postViews'
          ? [{ postId: { S: requestedPostId }, viewerKey: { S: '2026-11-08#hashed-viewer' } }]
          : [];
    },
    setTimeout: callback => { callback(); return 1; },
    console
  });
  vm.runInContext(cleanupCode + deleteCode, context);
  return { context, deletes, updates, mediaDeletes, collectionLimits, mediaAttempts: () => mediaAttempts, noticeAttempts: () => noticeAttempts };
}

(async () => {
  assert.match(feedSource, /const data = await response\.json\(\)\.catch\(\(\) => \(\{\}\)\);\s*if \(!response\.ok\) throw new Error\(data\.error \|\| "The post could not be deleted from the server\."\)/, 'the feed must preserve a retryable server deletion error');
  assert.match(source, /if \(method === "DELETE" && path\?\.startsWith\("\/secure-posts\/"\)\) \{\s*return errorResponse\(500, "The post could not be deleted from the server\. Try again\."\);/, 'post deletion failures must not be mislabeled as authentication failures');
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
  assert.ok(owner.deletes.some(item => item.TableName === 'postViews' && item.Key.viewerKey.S === '2026-11-08#hashed-viewer'), 'post view telemetry must be deleted');
  assert.ok(owner.deletes.some(item => item.TableName === 'notices' && item.Key.userEmail.S === ownerEmail && item.Key.eventId.S === `reaction#${postId}#reactor`), 'post-owner reaction notifications must be deleted');
  assert.ok(owner.deletes.some(item => item.TableName === 'notices' && item.Key.userEmail.S === ownerEmail && item.Key.eventId.S === `comment#${replyCommentId}`), 'post-owner comment notifications must be deleted');
  assert.ok(owner.deletes.some(item => item.TableName === 'notices' && item.Key.userEmail.S === 'commenter@example.com' && item.Key.eventId.S === `reply#${replyCommentId}`), 'reply notifications in another member partition must be deleted');
  assert.ok(owner.deletes.some(item => item.TableName === 'notices' && item.Key.userEmail.S === 'tagged@example.com' && item.Key.eventId.S === `tag#${postId}#tagged-member`), 'tag notifications in another member partition must be deleted');
  assert.ok(owner.deletes.some(item => item.TableName === 'stories'), 'linked Story records must be deleted');
  assert.ok(!owner.deletes.some(item => item.TableName === 'notices' && item.Key.eventId.S === `reaction#${postId}#comment#${parentCommentId}#comment-reactor`), 'comment reactions must not invent post notifications');
  assert.ok(owner.collectionLimits.length >= 5 && owner.collectionLimits.every(item => item.maximumItems === Number.MAX_SAFE_INTEGER), 'delete everywhere must not silently stop after the shared 5,000-record helper limit');

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

  const manyShares = Array.from({ length: 101 }, (_, index) => {
    const suffix = String(index + 1).padStart(12, '0');
    return { postId: { S: `44444444-4444-4444-a444-${suffix}` }, userId: { S: `sharer-${index}` }, userEmail: { S: `sharer-${index}@example.com` }, sharedPostId: { S: postId }, content: { S: `Share ${index + 1}` } };
  });
  const largeCascade = harness({ shares: manyShares });
  const largeResponse = await largeCascade.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId }, body: JSON.stringify({ mode: 'delete_everywhere' }) });
  assert.equal(JSON.parse(largeResponse.body).removedShares, 101, 'delete everywhere must report every dependent share');
  const deletedPostIds = new Set(largeCascade.deletes.filter(item => item.TableName === 'posts').map(item => item.Key.postId.S));
  assert.ok(manyShares.every(item => deletedPostIds.has(item.postId.S)), 'delete everywhere must remove 100+ share placements, not only the first page');

  const noticeFailure = harness({ failNoticeAttempts: 999 });
  const noticeFailureResponse = await noticeFailure.context.deleteSecurePost({ headers: { origin: 'https://danzstak.com' }, pathParameters: { postId }, body: JSON.stringify({ mode: 'delete_everywhere' }) });
  assert.equal(noticeFailureResponse.statusCode, 503, 'incomplete notification cleanup must keep deletion retryable');
  assert.equal(noticeFailure.noticeAttempts(), 15, 'each cross-account notification cleanup receives the full three-attempt retry budget');
  assert.ok(!noticeFailure.deletes.some(item => ['posts','comments','reactions','postViews','stories'].includes(item.TableName)), 'content records must remain until cross-account notification cleanup succeeds');

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
