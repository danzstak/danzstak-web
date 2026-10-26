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

const notificationBlock = source.slice(source.indexOf('if (name === "Notifications")'), source.indexOf('if (name === "Friends")'));
assert.match(notificationBlock, /copy\.className = "notification-copy"/);
assert.match(notificationBlock, /time\.dateTime = notice\.createdAt/);
assert.match(notificationBlock, /row\.append\(avatar, copy, actions\)/);
console.log('Notification timestamp checks passed: valid times render and malformed dates are ignored.');
