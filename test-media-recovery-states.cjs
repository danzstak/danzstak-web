const assert = require('node:assert/strict');
const fs = require('node:fs');

const feed = fs.readFileSync('feed.html', 'utf8');
const enhancements = fs.readFileSync('assets/feed-enhancements.js', 'utf8');
const i18n = fs.readFileSync('assets/i18n.js', 'utf8');
const aliases = fs.readFileSync('assets/brand-language-aliases.js', 'utf8');

assert.match(feed, /if \(!response\.ok\) throw new Error\(feedTranslate\("Dailies could not be loaded/);
assert.match(feed, /className = "story story-empty story-load-error"/);
assert.match(feed, /retry\.addEventListener\("click", \(\) => \{ unavailable\.remove\(\); loadStories\(\); \}\)/);
assert.doesNotMatch(feed, /catch \{ \/\* Feed still works if stories are temporarily unavailable/);

assert.match(enhancements, /if \(!response\.ok\) throw new Error\(feedTranslate\("The Roll could not be loaded/);
assert.match(enhancements, /retry\.addEventListener\("click", \(\) => \{ reelStatus\.replaceChildren\(\); loadCloudReels\(\); \}\)/);
assert.doesNotMatch(enhancements, /catch \{ \/\* Local reels remain available while cloud sync retries next load/);

for (const key of [
  'The Roll could not be loaded. Check your connection and try again.',
  'DanzStak cannot load The Roll right now. Check your connection and try again.',
  'Try again'
]) assert.ok(i18n.includes(JSON.stringify(key)), `Missing localized recovery key: ${key}`);
assert.ok(aliases.includes('Dailies could not be loaded. Check your connection and try again.'), 'Dailies recovery copy must be mapped for every supported language');

for (const language of ['es','fr','de','pt','it','ko','ja','zh-Hans','zh-Hant','fil','hi','vi','th','id']) {
  assert.match(i18n, new RegExp(`(?:^|\\n)\\s*(?:"${language}"|${language}):\\[`), `Missing recovery translations for ${language}`);
}

console.log('Media recovery checks passed: Dailies and The Roll expose localized retry actions instead of silently failing.');
