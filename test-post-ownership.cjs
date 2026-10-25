const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'infrastructure/auth-api/index.mjs'), 'utf8');
const code = source.slice(source.indexOf('async function getSecurePosts(event)'), source.indexOf('async function postForEngagement('));
const row = (id, owner, audience) => ({ postId: { S: id }, ...(owner ? { userId: { S: owner } } : {}), content: { S: 'Post content' }, createdAt: { S: '2026-10-25T00:00:00Z' }, audience: { S: audience } });
const context = vm.createContext({ event: { headers: {} }, corsHeaders: () => ({}), getAuthenticatedUser: async () => 'viewer', postsTable: 'Posts',
  scanAll: async () => [row('mine', 'viewer', 'private'), row('other', 'someone-else', 'public'), row('legacy', null, 'public'), row('private-other', 'someone-else', 'private')],
  accountForSub: async () => 'viewer@example.com', postEditHistory: () => [] });
vm.runInContext(code, context);
(async () => {
  const result = await vm.runInContext('getSecurePosts(event)', context);
  const posts = JSON.parse(result.body).posts;
  assert.equal(posts.find(post => post.postId === 'mine').isOwner, true);
  assert.equal(posts.find(post => post.postId === 'other').isOwner, false);
  assert.equal(posts.find(post => post.postId === 'legacy').isOwner, false);
  assert.equal(posts.some(post => post.postId === 'private-other'), false);
  console.log('Post ownership checks passed: explicit owner flags and private post filtering.');
})().catch(error => { console.error(error); process.exitCode = 1; });
