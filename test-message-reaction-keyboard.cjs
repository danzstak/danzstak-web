const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('assets/direct-messages.js', 'utf8');
const start = source.indexOf('function isReactionKeyboardShortcut(');
const end = source.indexOf('function openMessageReactions', start);
assert.notEqual(start, -1, 'message reaction keyboard helper exists');
assert.notEqual(end, -1, 'message reaction keyboard helper boundary exists');
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);

assert.equal(vm.runInContext('isReactionKeyboardShortcut({key:"F10",shiftKey:true})', context), true);
assert.equal(vm.runInContext('isReactionKeyboardShortcut({key:"ContextMenu",shiftKey:false})', context), true);
assert.equal(vm.runInContext('isReactionKeyboardShortcut({key:"F10",shiftKey:false})', context), false);
assert.equal(vm.runInContext('isReactionKeyboardShortcut({key:"Enter",shiftKey:true})', context), false);

const itemStart = source.indexOf('function directMessageItem(');
const itemEnd = source.indexOf('function renderEarlierMessagesButton', itemStart);
const itemSource = source.slice(itemStart, itemEnd);
assert.match(itemSource, /item\.tabIndex = 0/, 'rendered messages can receive keyboard focus');
assert.match(itemSource, /isReactionKeyboardShortcut\(event\)/, 'message keydown uses the reaction shortcut guard');
assert.match(itemSource, /openMessageReactions\(item, message, [^\n]+, true\)/, 'keyboard shortcut moves focus into the reaction picker');

const paletteSource = source.slice(source.indexOf('function openMessageReactions('), itemStart);
assert.match(paletteSource, /event\.key === "Escape"/, 'Escape closes the reaction picker');
assert.match(paletteSource, /item\.focus\(\)/, 'Escape returns focus to the message');
console.log('Message reaction keyboard checks passed: focus, shortcuts, picker focus, and Escape return.');
