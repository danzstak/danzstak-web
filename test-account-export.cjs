const assert = require('node:assert/strict');
const fs = require('node:fs');
const fflate = require('./assets/vendor/fflate-0.8.3.js');
const { buildAccountArchive, collectAccountEngagement, mediaManifest, ownedActivity } = require('./assets/account-export-core.js');

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
  mediaManifest: { complete: true, files: [{ archivePath: 'media/uploads/photo.jpg', size: 42, modifiedAt: '2026-10-26T11:00:00.000Z', downloadUrl: 'https://signed.example' }] },
  incompleteSources: ['supportTickets']
}, engagement, { 'friend@example.com': [{ messageId: 'message-1' }] }, '2026-10-26T12:00:00.000Z');

assert.deepEqual(archive.posts.map(post => post.postId), ['mine']);
assert.deepEqual(archive.stories.map(story => story.storyId), ['mine-story']);
assert.equal(archive.messagesByContact['friend@example.com'][0].messageId, 'message-1');
assert.equal(archive.bookingWorkspace.artist.name, 'Owner Band');
assert.equal(archive.bookingWorkspace.venues[0].stage, 'contacted');
assert.deepEqual(archive.incompleteSources, ['supportTickets']);
assert.equal(archive.formatVersion, 2);
assert.equal(archive.notIncluded.includes('Uploaded media binary files'), false);
assert.deepEqual(archive.media, { complete: true, totalBytes: 42, files: [{ archivePath: 'media/uploads/photo.jpg', size: 42, modifiedAt: '2026-10-26T11:00:00.000Z' }] });
assert.equal(JSON.stringify(archive).includes('signed.example'), false, 'expiring signed URLs must not be stored in the portable JSON');
assert.deepEqual(mediaManifest({ complete: false, files: [{ archivePath: '../escape.jpg', size: 9 }] }), { complete: false, totalBytes: 0, files: [] });
assert.equal(archive.generatedAt, '2026-10-26T12:00:00.000Z');
const client = fs.readFileSync('assets/account-export.js', 'utf8');
const page = fs.readFileSync('feed.html', 'utf8');
assert.doesNotMatch(client, /\.slice\(0,\s*200\)/, 'account export must not silently cap posts at 200');
assert.match(client, /\/account-export\/media/, 'account export must request the authenticated owner-media manifest');
assert.match(client, /maximumArchiveBytes = 300 \* 1024 \* 1024/, 'browser ZIP packaging must have an explicit memory boundary');
assert.match(client, /credentials: "omit"/, 'signed media fetches must not forward the DanzStak session cross-origin');
assert.match(client, /mediaFailures/, 'media failures must be recorded rather than silently omitted');
assert.match(client, /archive\.notIncluded\.push\("Uploaded media binary files listed by mediaArchive"\)/, 'fallback JSON must state when media binaries are not packaged');
assert.match(page, /vendor\/fflate-0\.8\.3\.js[^]*account-export\.js/, 'ZIP support must load before the exporter');
const zipBytes = fflate.zipSync({
  'account-data.json': [fflate.strToU8(JSON.stringify(archive)), { level: 6 }],
  'media/uploads/photo.jpg': [Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), { level: 0 }]
});
const unpacked = fflate.unzipSync(zipBytes);
assert.equal(JSON.parse(fflate.strFromU8(unpacked['account-data.json'])).formatVersion, 2, 'ZIP must contain a readable portable account-data.json');
assert.deepEqual(Array.from(unpacked['media/uploads/photo.jpg']), [0xff, 0xd8, 0xff, 0xd9], 'ZIP must preserve media bytes and their portable path');

(async () => {
  const exportPosts = Array.from({ length: 250 }, (_, index) => ({ postId: `post-${index}` }));
  let active = 0, peak = 0;
  const progress = [];
  const collected = await collectAccountEngagement(exportPosts, async postId => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve));
    active -= 1;
    if (postId === 'post-173') throw new Error('fixture outage');
    return { myReaction: postId === 'post-249' ? 'Fire' : '' };
  }, { concurrency: 3, onProgress: (complete, total) => progress.push([complete, total]) });

  assert.equal(Object.hasOwn(collected.engagementByPost, 'post-249'), true, 'exports must include engagement beyond the former 200-post ceiling');
  assert.equal(collected.engagementByPost['post-249'].myReaction, 'Fire');
  assert.deepEqual(collected.incompleteSources, ['engagement:post-173']);
  assert.ok(peak <= 3, 'account export must keep API fan-out bounded');
  assert.deepEqual(progress.at(-1), [250, 250]);
  assert.doesNotMatch(client, /posts\.slice\(0,\s*200\)/, 'account export must not silently truncate activity at 200 posts');
  assert.match(client, /posts:server-limit-reached/, 'the existing server ceiling must be disclosed inside the export');
  console.log('Account export checks passed: all returned posts, bounded activity collection, owned content, messages, booking data, safe media ZIP packaging, and honest incomplete-source reporting.');
})().catch(error => { console.error(error); process.exitCode = 1; });
