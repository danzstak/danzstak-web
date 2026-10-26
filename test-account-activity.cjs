const assert = require('node:assert/strict');
const { buildActivity } = require('./assets/activity-history-core.js');

const posts = [
  { postId: 'mine', isOwner: true, content: 'My post', audience: 'friends', createdAt: '2026-10-26T10:00:00Z' },
  { postId: 'friend', isOwner: false, content: 'Friend post', createdAt: '2026-10-26T11:00:00Z' },
  { postId: 'bad', isOwner: true, content: 'Bad date', createdAt: 'invalid' }
];
const activity = buildActivity(posts, {
  mine: { comments: [{ commentId: 'other-comment', isOwner: false, content: 'Not mine', createdAt: '2026-10-26T10:30:00Z' }] },
  friend: { comments: [{ commentId: 'my-comment', isOwner: true, content: 'My comment', createdAt: '2026-10-26T12:00:00Z' }] }
});

assert.deepEqual(activity.map(item => item.id), ['my-comment', 'mine']);
assert.equal(activity[0].type, 'comment');
assert.equal(activity[0].postId, 'friend');
assert.equal(activity[1].audience, 'friends');
assert.ok(activity.every(item => !Object.hasOwn(item, 'email')));
assert.equal(buildActivity(posts, {}, 1).length, 1);
console.log('Account activity checks passed: owner posts/comments only, chronological order, limits, and no email fields.');
