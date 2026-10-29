const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('assets/feed-enhancements.js', 'utf8');
const start = source.indexOf('function formatNotificationTimestamp(');
const end = source.indexOf('async function refreshNotificationCount()', start);
assert.notEqual(start, -1, 'notification timestamp formatter exists');
assert.notEqual(end, -1, 'notification timestamp formatter boundary exists');
const context = vm.createContext({ Date, Number });
vm.runInContext(source.slice(start, end), context);

assert.equal(vm.runInContext('formatNotificationTimestamp("")', context), '');
assert.equal(vm.runInContext('formatNotificationTimestamp("not-a-date")', context), '');
assert.ok(vm.runInContext('formatNotificationTimestamp("2026-10-26T10:30:00.000Z")', context).length > 3);
assert.equal(vm.runInContext('formatReactionNotification("SFScoop", "Like")', context), 'SFScoop liked your post.');
assert.equal(vm.runInContext('formatReactionNotification("SFScoop", "Dislike")', context), 'SFScoop disliked your post.');
assert.equal(vm.runInContext('formatReactionNotification("SFScoop", "")', context), 'SFScoop reacted to your post.');

const notificationBlock = source.slice(source.indexOf('if (name === "Notifications")'), source.indexOf('if (name === "Friends")'));
assert.match(notificationBlock, /copy\.className = "notification-copy"/);
assert.match(notificationBlock, /time\.dateTime = notice\.createdAt/);
assert.match(notificationBlock, /row\.append\(avatar, copy, actions\)/);
assert.match(notificationBlock, /const displayName = person\?\.name \|\| "DanzStak member"/);
assert.match(notificationBlock, /formatReactionNotification\(displayName, notice\.preview\)/);
assert.match(notificationBlock, /fetch\("https:\/\/api\.danzstak\.com\/friends"/, 'notification identities should include accepted-friend profile data');
assert.match(notificationBlock, /picture: person\.picture \|\| known\.picture/, 'online directory data must not erase a saved friend photo');
assert.match(notificationBlock, /"View post from " \+ displayName/);
assert.match(notificationBlock, /"Open chat with " \+ displayName/);
assert.match(notificationBlock, /label \+ " friend request from " \+ displayName/);
assert.doesNotMatch(notificationBlock, /String\(notice\.email \|\| "DanzStak member"\)\.split\("@"\)\[0\]/);
console.log('Notification checks passed: timestamps render, actions name their member, and account emails stay private.');
