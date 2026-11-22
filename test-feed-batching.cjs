const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('feed.html', 'utf8');

assert.match(source, /const feedBatchSize = 12;/, 'the feed should render a bounded initial batch');
assert.match(source, /const visiblePosts = data\.posts\.filter\(/, 'hidden and malformed posts should be removed before batching');
assert.match(source, /function renderNextPostBatch\(count = moreObserver \? feedBatchSize : visiblePosts\.length\)/, 'additional posts use the same bounded renderer (everything at once only without IntersectionObserver)');
// F15c (owner 2026-11-19): no down-arrow button; the next posts appear about one screen before the end, and the feed ends
// with "You're caught up" (finite, chronological, no further requests).
assert.doesNotMatch(source, /load-more-posts|loadMorePosts/, 'no load-more button or its styles remain');
assert.match(source, /new IntersectionObserver\(entries => \{ if \(entries\.some\(entry => entry\.isIntersecting\)\) renderNextPostBatch\(\); \}, \{ rootMargin: "0px 0px 100% 0px" \}\)/, 'the next batch renders a screen before the end');
assert.match(source, /moreObserver\.observe\(moreMarker\);/, 'the marker is observed anew after each batch');
assert.match(source, /\} else feed\.appendChild\(caughtUp\);/, 'the true end shows the caught-up line');
assert.match(source, /caughtUp\.textContent = feedTranslate\("You're caught up"\);/, 'the end line is translated');
assert.match(source, /renderNextPostBatch\(Math\.max\(feedBatchSize, linkedPostIndex \+ 1\)\)/, 'shared post links must render their target even beyond the first batch');
assert.match(source, /No posts yet\. Create your first post!/, 'the main Mix empty state must not describe itself as the Saved screen');
assert.doesNotMatch(source, /No saved posts yet\. Create your first post!/, 'the main Mix must not reuse Saved-screen wording');
assert.doesNotMatch(source, /data\.posts\.forEach\(post => \{/, 'the initial feed must not eagerly build every historical post');

console.log('Feed batching checks passed: bounded initial rendering, Mix flows on scroll to a caught-up end, and deep-linked post preservation.');
