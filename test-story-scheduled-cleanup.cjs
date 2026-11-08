const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const lines = fs.readFileSync('infrastructure/call-signaling/template.yaml', 'utf8').split('\n');
const resourceStart = lines.findIndex(line => line.trim() === 'StoryCleanupFunction:');
const sourceStart = lines.findIndex((line, index) => index > resourceStart && line.includes("const {DynamoDBClient,ScanCommand,DeleteItemCommand}"));
const sourceEnd = lines.findIndex((line, index) => index > sourceStart && line.trim() === 'StoryCleanupRule:');
assert.ok(resourceStart >= 0 && sourceStart > resourceStart && sourceEnd > sourceStart, 'scheduled Story cleanup source must remain extractable');
const source = lines.slice(sourceStart, sourceEnd)
  .map(line => line.replace(/^          /, ''))
  .join('\n');

const current = 2_000_000;
const iso = seconds => new Date(seconds * 1000).toISOString();
const item = (storyId, mediaKey, expiresAt = current - 1, kind = '') => ({
  storyId: { S: storyId },
  mediaKey: { S: mediaKey },
  createdAt: { S: iso(current - 90_000) },
  expiresAt: { N: String(expiresAt) },
  ...(kind ? { kind: { S: kind } } : {})
});

const pages = [
  {
    Items: [
      item('good', 'stories/good.jpg'),
      item('storage-failed', 'stories/storage-failed.jpg'),
      item('record-failed', 'stories/record-failed.jpg'),
      item('legacy-shared', 'users/member/shared.jpg'),
      item('current', 'stories/current.jpg', current + 100),
      item('reel', 'stories/reel.jpg', current - 100, 'reel')
    ],
    LastEvaluatedKey: { storyId: { S: 'page-2' } }
  },
  { Items: [item('legacy-expired', 'stories/legacy.jpg', 0)] }
];
delete pages[1].Items[0].expiresAt;

const mediaAttempts = new Map();
const recordAttempts = new Map();
const events = [];
class ScanCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }
class DynamoDBClient {
  async send(command) {
    if (command instanceof ScanCommand) return pages[command.input.ExclusiveStartKey ? 1 : 0];
    const storyId = command.input.Key.storyId.S;
    recordAttempts.set(storyId, (recordAttempts.get(storyId) || 0) + 1);
    events.push(`record:${storyId}`);
    if (storyId === 'record-failed') throw new Error('temporary database failure');
    return {};
  }
}
class S3Client {
  async send(command) {
    const key = command.input.Key;
    mediaAttempts.set(key, (mediaAttempts.get(key) || 0) + 1);
    events.push(`media:${key}`);
    if (key === 'stories/storage-failed.jpg') throw new Error('temporary storage failure');
    return {};
  }
}

const context = vm.createContext({
  require(name) {
    if (name === '@aws-sdk/client-dynamodb') return { DynamoDBClient, ScanCommand, DeleteItemCommand };
    if (name === '@aws-sdk/client-s3') return { S3Client, DeleteObjectCommand };
    throw new Error(`Unexpected module ${name}`);
  },
  process: { env: { STORIES_TABLE: 'stories', MEDIA_BUCKET: 'media' } },
  Date: class extends Date { static now() { return current * 1000; } },
  exports: {},
  console: { error() {} }
});
vm.runInContext(source.trim(), context);

(async () => {
  const result = await context.exports.handler();
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { expired: 5, cleaned: 3, pending: 2 });
  assert.equal(mediaAttempts.get('stories/good.jpg'), 1, 'normal media is removed once');
  assert.equal(mediaAttempts.get('stories/storage-failed.jpg'), 3, 'storage cleanup receives three bounded attempts');
  assert.equal(mediaAttempts.get('stories/record-failed.jpg'), 1, 'media removal completes before record cleanup is attempted');
  assert.equal(mediaAttempts.has('users/member/shared.jpg'), false, 'media outside the dedicated stories prefix is never removed');
  assert.equal(mediaAttempts.has('stories/current.jpg'), false, 'current Dailies are preserved');
  assert.equal(mediaAttempts.has('stories/reel.jpg'), false, 'Roll links are preserved until owner deletion');
  assert.equal(recordAttempts.has('storage-failed'), false, 'a retry record remains when its media could not be removed');
  assert.equal(recordAttempts.get('record-failed'), 3, 'record cleanup receives three bounded attempts');
  assert.equal(recordAttempts.get('legacy-shared'), 1, 'expired legacy references are removed without touching shared media');
  assert.equal(recordAttempts.get('legacy-expired'), 1, 'legacy expiry is enforced across scan pages');
  for (const storyId of ['good', 'record-failed', 'legacy-expired']) {
    assert.ok(events.indexOf(`media:stories/${storyId === 'legacy-expired' ? 'legacy' : storyId}.jpg`) < events.indexOf(`record:${storyId}`), `${storyId} media must be removed before its database retry record`);
  }
  console.log('Scheduled Story cleanup checks passed: storage-first ordering, retries, pagination, prefix isolation, and retry records are durable.');
})().catch(error => { console.error(error); process.exitCode = 1; });
