const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('assets/direct-messages.js', 'utf8');
const start = source.indexOf('function messageAccessibleSummary');
const end = source.indexOf('function directMessageItem', start);
assert.notEqual(start, -1, 'message summary helper exists');
assert.notEqual(end, -1, 'message summary helper has a stable boundary');

const messageTranslate = value => value;
const context = vm.createContext({
  activeContactName: 'Sleeping Dragon',
  messageTranslate,
  messageFormat: (key, values = {}) => Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    messageTranslate(key)
  )
});
vm.runInContext(source.slice(start, end), context);

assert.equal(
  context.messageAccessibleSummary({ content: '', mediaType: 'video' }, false),
  'Sleeping Dragon sent a video. Long press or press Shift F10 for reactions.',
  'received media-only videos have a useful accessible name'
);
assert.equal(
  context.messageAccessibleSummary({ content: 'Backstage', mediaType: 'image' }, true),
  'You: Backstage. Long press or press Shift F10 for reactions and editing.',
  'captioned media retains its editable text summary'
);
assert.equal(
  context.messageAccessibleSummary({ content: '', mediaType: '' }, false),
  'Sleeping Dragon sent a message. Long press or press Shift F10 for reactions.',
  'legacy empty messages never expose awkward punctuation'
);

console.log('Message media-label checks passed: media-only and legacy messages have useful accessible summaries.');
