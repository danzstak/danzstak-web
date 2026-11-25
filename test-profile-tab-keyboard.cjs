const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('assets/profile-editor.js', 'utf8');
const kit = readFileSync('tools/ui-kit/components.css', 'utf8');
const html = readFileSync('profile.html', 'utf8');
assert.match(html, /assets\/ds\.css\?v=\d+/, 'profile loads the kit (its tabs are the kit pill row, UIKIT 4b)');
assert.match(kit, /\.ds\.ds-pills\{[^}]*overflow-x:auto;[^}]*scrollbar-width:none/, 'profile tabs swipe cleanly without exposing a heavy browser scrollbar');
assert.match(kit, /\.ds\.ds-pills::-webkit-scrollbar\{display:none\}/, 'WebKit profile tabs hide the visual scrollbar');
assert.match(kit, /\.ds \.ds-pill\{flex:none;/, 'profile tabs keep readable labels while horizontally scrolling');
const start = source.indexOf('tabs.addEventListener("keydown"');
const end = source.indexOf('const panel = document.createElement("form")', start);
assert.notEqual(start, -1, 'profile keyboard handler exists');
assert.notEqual(end, -1, 'profile keyboard handler boundary exists');

const handlers = {};
const calls = [];
const makeButton = name => ({
  name,
  focus() { document.activeElement = this; calls.push(`focus:${name}`); },
  click() { calls.push(`click:${name}`); }
});
const posts = makeButton('Posts');
const about = makeButton('About');
const friends = makeButton('Friends');
const document = { activeElement: about };
const tabs = {
  addEventListener(type, handler) { handlers[type] = handler; },
  querySelectorAll(selector) {
    assert.equal(selector, '[role="tab"]:not([hidden])', 'hidden profile tabs are excluded from keyboard navigation');
    return [posts, about, friends];
  }
};

vm.runInNewContext(source.slice(start, end), { tabs, document });
let prevented = false;
handlers.keydown({ key: 'ArrowRight', preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.deepEqual(calls, ['focus:Friends', 'click:Friends']);

calls.length = 0;
document.activeElement = posts;
handlers.keydown({ key: 'ArrowLeft', preventDefault() {} });
assert.deepEqual(calls, ['focus:Friends', 'click:Friends'], 'keyboard navigation wraps across visible tabs only');

console.log('Profile tab keyboard checks passed: hidden tabs never receive focus.');
