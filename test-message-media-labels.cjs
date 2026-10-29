const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('assets/direct-messages.js', 'utf8');
const start = source.indexOf('function messageAccessibleSummary');
const end = source.indexOf('function directMessageItem', start);
assert.notEqual(start, -1, 'message summary helper exists');
assert.notEqual(end, -1, 'message summary helper has a stable boundary');

const context = vm.createContext({ activeContactName: 'SFScoop' });
vm.runInContext(source.slice(start, end), context);

assert.equal(
  context.messageAccessibleSummary({ content: '', mediaType: 'video' }, false),
  'SFScoop sent a video. Long press or press Shift F10 for reactions.',
  'received media-only videos have a useful accessible name'
);
assert.equal(
  context.messageAccessibleSummary({ content: 'Backstage', mediaType: 'image' }, true),
  'You: Backstage. Long press or press Shift F10 for reactions and editing.',
  'captioned media retains its editable text summary'
);
assert.equal(
  context.messageAccessibleSummary({ content: '', mediaType: '' }, false),
  'SFScoop sent a message. Long press or press Shift F10 for reactions.',
  'legacy empty messages never expose awkward punctuation'
);

console.log('Message media-label checks passed: media-only and legacy messages have useful accessible summaries.');
