const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('feed.html', 'utf8');

assert.match(source, /const feedBatchSize = 12;/, 'the feed should render a bounded initial batch');
assert.match(source, /const visiblePosts = data\.posts\.filter\(/, 'hidden and malformed posts should be removed before batching');
assert.match(source, /function renderNextPostBatch\(count = feedBatchSize\)/, 'additional posts should use the same bounded renderer');
assert.match(source, /loadMorePosts\.textContent = "Show more posts";/, 'the next batch needs a familiar explicit control');
assert.match(source, /visiblePosts\.length - renderedPostCount/, 'the control should expose an accurate remaining count');
assert.match(source, /renderNextPostBatch\(Math\.max\(feedBatchSize, linkedPostIndex \+ 1\)\)/, 'shared post links must render their target even beyond the first batch');
assert.match(source, /firstAddedPost\?\.focus\(\{ preventScroll: true \}\)/, 'keyboard users should land on newly revealed posts');
assert.match(source, /No posts yet\. Create your first post!/, 'the main Mix empty state must not describe itself as the Saved screen');
assert.doesNotMatch(source, /No saved posts yet\. Create your first post!/, 'the main Mix must not reuse Saved-screen wording');
assert.doesNotMatch(source, /data\.posts\.forEach\(post => \{/, 'the initial feed must not eagerly build every historical post');

console.log('Feed batching checks passed: bounded initial rendering, accessible expansion, and deep-linked post preservation.');
