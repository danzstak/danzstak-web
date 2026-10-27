const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('async function loadEngagement(post)'), source.indexOf('function addCommentDelete(comment)'));
const requests = [], comments = [];
const post = { dataset: {}, querySelector: () => ({ replaceChildren() { comments.length = 0; } }) };
const input = { value: 'My new comment', disabled: false, focus() {} };
const context = vm.createContext({ post, input, engagementApi: 'https://api.danzstak.com',
  engagementPostId: () => 'post-1', setReactionAppearance() {}, updateCommentPreview() {}, alert: message => { throw new Error(message); },
  renderPersistentComment: (_, comment) => { if (!comments.some(item => item.commentId === comment.commentId)) comments.push(comment); },
  engagementFetch: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) });
vm.runInContext(code, context);
const resolve = async (index, data) => { requests[index].resolve({ ok: true, json: async () => data }); await new Promise(done => setImmediate(done)); };
(async () => {
  const oldLoad = vm.runInContext('loadEngagement(post)', context);
  const save = vm.runInContext('saveComment(post, input)', context);
  const comment = { commentId: 'new-1', content: 'My new comment' };
  await resolve(1, { comment });
  await resolve(2, { comments: [comment] });
  await save;
  assert.equal(comments.length, 1);
  await resolve(0, { comments: [] });
  await oldLoad;
  assert.equal(comments.length, 1, 'old GET cannot erase a newly saved comment');
  assert.equal(input.disabled, false);
  assert.equal(post.dataset.engagementLoaded, 'true');
  console.log('Engagement loading check passed: delayed initial response cannot erase a saved comment.');
})().catch(error => { console.error(error); process.exitCode = 1; });
