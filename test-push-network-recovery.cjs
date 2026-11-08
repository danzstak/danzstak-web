const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/push-notifications.js', 'utf8');
const callCss = fs.readFileSync('assets/incoming-calls.css', 'utf8');
assert.match(callCss, /\.push-alert-prompt\[hidden\]\{display:none\}/, 'the chat suppression state must override the prompt grid display');
assert.match(callCss, /\.push-alert-prompt\{[^}]*right:max\(16px,env\(safe-area-inset-right\)\)/, 'the desktop notification prompt should stay clear of the left navigation');
const desktopPrompt = callCss.match(/\.push-alert-prompt\{([^}]]*)\}/)?.[1] || '';
assert.doesNotMatch(desktopPrompt, /left:/, 'the desktop notification prompt must not cover lower navigation links');
assert.match(callCss, /@media\(max-width:560px\)\{\.push-alert-prompt\{[^}]*bottom:calc\(62px \+ env\(safe-area-inset-bottom\)\)[^}]*grid-template-columns:minmax\(0,1fr\) auto auto/, 'the phone prompt must stay above navigation in one compact action row');
assert.match(callCss, /\.push-alert-prompt button\{min-height:44px/, 'notification actions must keep full touch targets');
assert.match(callCss, /@media\(max-width:560px\)[\s\S]*?\.push-alert-prompt span\{display:none\}/, 'phone prompts must remove secondary copy rather than cover the feed');
assert.match(source, /document\.body\.classList\.contains\("messages-page"\)/, 'the global permission prompt must not cover the dedicated Messages composer');
assert.match(source, /document\.getElementById\('messageDrawer'\)\?\.hidden === false[\s\S]*?document\.getElementById\('notificationDrawer'\)\?\.hidden === false/, 'the permission prompt must not cover an already open communication drawer');
assert.match(source, /function syncPromptDrawerVisibility\(\)[\s\S]*?danzstak:message-drawer[\s\S]*?danzstak:notification-drawer/, 'the permission prompt should yield to Messages and Notifications and return after either closes');
const start = source.indexOf('async function withDeadline(');
const end = source.indexOf('async function state()', start);
assert.ok(start >= 0 && end > start, 'push deadline helpers are missing');

const timers = [];
let cleared = 0;
class AbortController {
  constructor() {
    const listeners = [];
    this.signal = { addEventListener(type, fn) { if (type === 'abort') listeners.push(fn); } };
    this.abort = () => listeners.forEach(fn => fn());
  }
}
const context = vm.createContext({
  API: 'https://api.danzstak.com',
  AbortController,
  setTimeout(fn) { timers.push(fn); return timers.length; },
  clearTimeout() { cleared++; },
  fetch(url, options) {
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
      const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
    }));
  }
});
vm.runInContext(source.slice(start, end), context);

(async () => {
  const request = vm.runInContext('api("/push/key")', context);
  timers[0]();
  await assert.rejects(request, /setup took too long/);
  assert.equal(cleared, 1, 'push API deadline must be cleared after failure');
  for (const required of [
    'withDeadline(navigator.serviceWorker.ready, 10000',
    'withDeadline(registration.pushManager.getSubscription(), 10000',
    'withDeadline(registration.pushManager.subscribe({',
    'signal: controller.signal'
  ]) assert.ok(source.includes(required), `Push operation bypasses deadline recovery: ${required}`);
  console.log('Push network checks passed: API, service-worker, status, and subscription operations are bounded.');
})().catch(error => { console.error(error); process.exitCode = 1; });
