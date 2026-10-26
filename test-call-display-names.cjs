const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');

const template = readFileSync('infrastructure/call-signaling/template.yaml', 'utf8');
const incoming = readFileSync('assets/incoming-calls.js', 'utf8');
const chat = readFileSync('assets/chat.js', 'utf8');
const messages = readFileSync('assets/direct-messages.js', 'utf8');

assert.match(template, /senderName=signalType==='offer'\?\(\(await publicProfile\(user\.email\)\)\.name\|\|'DanzStak member'\):''/);
assert.match(template, /senderName:x\.senderName\?\.S\|\|''/);
assert.match(incoming, /event\.senderName \|\| "DanzStak member"/);
assert.doesNotMatch(incoming, /label\.textContent = `\$\{event\.senderEmail\}/);
assert.match(chat, /contactName=event\.senderName\|\|"DanzStak member"/);
assert.match(chat, /els\.incomingLabel\.textContent="Incoming "\+event\.mode\+" from "\+contactName/);
assert.match(messages, /window\.danzstakActiveContactName = conversation\.name \|\| "DanzStak member"/);
assert.match(messages, /call\.addEventListener\("click", \(\) => \{ openConversation\(conversation\); document\.getElementById\(targetId\)\?\.click\(\); \}\)/);
assert.doesNotMatch(messages, /call\.addEventListener\("click", \(\) => \{ contactInput\.value = conversation\.contactEmail/);
assert.doesNotMatch(messages, /conversationName\.textContent = conversation\.name \|\| conversation\.contactEmail/);
assert.doesNotMatch(messages, /name\.textContent = conversation\.name \|\| conversation\.contactEmail/);
assert.doesNotMatch(messages, /name: requested\.split\("@"\)\[0\]/);
assert.match(messages, /conversationName\.textContent = conversation\.name \|\| "DanzStak member"/);
console.log('Call display-name checks passed: signaling carries names and call surfaces keep emails internal.');
