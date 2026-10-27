const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = readFileSync('feed.html', 'utf8');
const helperStart = source.indexOf('async function fetchWithDeadline');
const helperEnd = source.indexOf('async function discardUploadedMedia');
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'feed deadline helper must exist');

let timerCallback;
let timeoutCleared = false;
class AbortController {
  constructor() {
    const listeners = [];
    this.signal = { addEventListener: (name, callback) => { if (name === 'abort') listeners.push(callback); } };
    this.abort = () => listeners.forEach(callback => callback());
  }
}
const context = vm.createContext({
  AbortController,
  Number,
  Math,
  setTimeout: callback => { timerCallback = callback; return 9; },
  clearTimeout: id => { assert.equal(id, 9); timeoutCleared = true; },
  fetch: (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
    const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
  }))
});
vm.runInContext(source.slice(helperStart, helperEnd), context);

(async () => {
  const request = vm.runInContext('fetchWithDeadline("https://api.danzstak.com/stories")', context).catch(error => error);
  timerCallback();
  const error = await request;
  assert.match(error.message, /too long to respond/i);
  assert.equal(timeoutCleared, true);
  assert.equal(vm.runInContext('mediaUploadDeadline({ size: 1 })', context), 120000);
  assert.ok(vm.runInContext('mediaUploadDeadline({ size: 16 * 1024 * 1024 })', context) > 120000, 'large uploads receive additional time');
  for (const operation of [
    'const response = await fetchWithDeadline("https://api.danzstak.com/stories"',
    'const deleted = await fetchWithDeadline("https://api.danzstak.com/stories/"',
    'const ticketResponse = await fetchWithDeadline("https://api.danzstak.com/stories"',
    'const uploadResponse = await fetchWithDeadline(ticket.uploadUrl',
    'const publishResponse = await fetchWithDeadline("https://api.danzstak.com/stories"',
    'const storyTicketResponse = await fetchWithDeadline("https://api.danzstak.com/stories"',
    'const storyUploadResponse = await fetchWithDeadline(storyTicket.uploadUrl',
    'const storyResponse = await fetchWithDeadline("https://api.danzstak.com/stories"'
  ]) assert.ok(source.includes(operation), `missing guarded operation: ${operation}`);
  assert.doesNotMatch(source, /await fetch\("https:\/\/api\.danzstak\.com\/stories/);
  console.log('Feed network checks passed: story and media operations recover from stalls and large uploads receive adaptive time.');
})().catch(error => { console.error(error); process.exitCode = 1; });
