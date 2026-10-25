const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('const search = document.querySelector(".search");'), source.indexOf('document.querySelector(\'[data-feature="Music"]\')'));
let observer;
const search = { value: '', setAttribute() {}, addEventListener(_, handler) { this.input = handler; } };
const feedback = { setAttribute() {} };
const post = (text, author) => ({ hidden: false, textContent: `${author} ${text} Like Comment Share`, querySelector: selector => ({ textContent: selector === '.post-content' ? text : author }) });
const posts = [post('Live music tonight', 'Alice'), post('New photography', 'Bob')];
const context = vm.createContext({ document: {
  querySelector: () => search, querySelectorAll: () => posts, createElement: () => feedback,
  getElementById: () => ({ insertAdjacentElement() {} }) },
  MutationObserver: class { constructor(callback) { observer = callback; } observe() {} }
});
vm.runInContext(code, context);
vm.runInContext(source.slice(source.lastIndexOf('new MutationObserver(records => {')), context);
search.value = 'MUSIC'; search.input();
assert.equal(posts[0].hidden, false);
assert.equal(posts[1].hidden, true);
assert.match(feedback.textContent, /1 matching/);
posts.push(post('Another music event', 'Carol'), post('Another photo', 'Dan'));
observer([{ addedNodes: [] }]);
assert.equal(posts[2].hidden, false);
assert.equal(posts[3].hidden, true, 'refreshed posts must respect active search');
assert.match(feedback.textContent, /2 matching/);
search.value = 'no such result'; search.input();
assert.match(feedback.textContent, /No matching feed posts/);
search.value = 'like'; search.input();
assert.equal(posts.every(item => item.hidden), true, 'action button text does not count as content');
search.value = ''; search.input();
assert.equal(posts.every(item => !item.hidden), true);
assert.equal(feedback.hidden, true);
console.log('Feed search checks passed: refreshed posts, result feedback, content matching, and clearing.');
