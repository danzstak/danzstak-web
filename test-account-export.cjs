const assert = require('node:assert/strict');
const { buildAccountArchive, ownedActivity } = require('./assets/account-export-core.js');

const posts = [
  { postId: 'mine', isOwner: true, content: 'Mine' },
  { postId: 'other', isOwner: false, content: 'Other' }
];
const engagement = {
  mine: { myReaction: 'like', comments: [{ commentId: 'not-mine', isOwner: false, content: 'Other comment' }] },
  other: { comments: [{ commentId: 'mine-comment', isOwner: true, content: 'My comment', myReaction: 'heart' }] }
};
const activity = ownedActivity(posts, engagement);
assert.deepEqual(activity.comments.map(item => item.commentId), ['mine-comment']);
assert.deepEqual(activity.reactions, [{ postId: 'mine', reaction: 'like' }, { postId: 'other', commentId: 'mine-comment', reaction: 'heart' }]);

const archive = buildAccountArchive({
  account: { email: 'owner@example.com' },
  profile: { profile: { name: 'Owner' } },
  settings: { onlineVisible: true },
  posts: { posts },
  friends: { friends: [{ name: 'Friend' }] },
  groups: { groupIds: ['group-1'] },
  stories: { stories: [{ storyId: 'mine-story', isOwner: true }, { storyId: 'other-story', isOwner: false }], reels: [{ id: 'mine-reel', isOwner: true }] },
  conversations: { conversations: [{ contactEmail: 'friend@example.com' }] },
  notifications: { notifications: [{ type: 'message' }] },
  engagementNotifications: { notifications: [{ type: 'reaction' }] },
  tours: { tours: [{ tourId: 'tour-1' }] },
  bookingWorkspace: {
    artist: { name: 'Owner Band', epkUrl: 'https://example.com/epk' },
    venues: [{ id: 'venue-1', name: 'The Club', stage: 'contacted' }]
  },
  incompleteSources: ['supportTickets']
}, engagement, { 'friend@example.com': [{ messageId: 'message-1' }] }, '2026-10-26T12:00:00.000Z');

assert.deepEqual(archive.posts.map(post => post.postId), ['mine']);
assert.deepEqual(archive.stories.map(story => story.storyId), ['mine-story']);
assert.equal(archive.messagesByContact['friend@example.com'][0].messageId, 'message-1');
assert.equal(archive.bookingWorkspace.artist.name, 'Owner Band');
assert.equal(archive.bookingWorkspace.venues[0].stage, 'contacted');
assert.deepEqual(archive.incompleteSources, ['supportTickets']);
assert.ok(archive.notIncluded.includes('Uploaded media binary files'));
assert.equal(archive.generatedAt, '2026-10-26T12:00:00.000Z');
console.log('Account export checks passed: owned content, activity, connections, messages, tours, booking workspace, and incomplete-source reporting.');
