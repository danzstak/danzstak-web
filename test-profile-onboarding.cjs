const assert = require('node:assert/strict');
const fs = require('node:fs');

const feed = fs.readFileSync('feed.html', 'utf8');
const source = fs.readFileSync('assets/profile-onboarding.js', 'utf8');
const css = fs.readFileSync('assets/profile-onboarding.css', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');

assert.match(feed, /id="profileOnboarding"[^>]*hidden/, 'the identity prompt is present but hidden until an incomplete profile is confirmed');
assert.match(feed, /What should people call you\?/, 'the prompt uses ordinary language rather than profile jargon');
assert.match(feed, /assets\/profile-onboarding\.js\?v=1/, 'the live feed loads first-login identity behavior');
assert.match(feed, /assets\/profile-onboarding\.css\?v=1/, 'the live feed loads responsive identity styling');
assert.match(serviceWorker, /"\/assets\/profile-onboarding\.css"/, 'the installed app keeps the identity layout available offline');
assert.match(serviceWorker, /"\/assets\/profile-onboarding\.js"/, 'the installed app keeps the identity behavior available offline');
assert.match(source, /profile\.name === "DanzStak member"/, 'generic new accounts are detected');
assert.match(source, /profile\.handle === "danzstak-member"/, 'generic usernames are detected');
assert.match(source, /suggestedHandle\(nameInput\.value\)/, 'typing a name automatically suggests a username');
assert.match(source, /method: "POST"[\s\S]*JSON\.stringify\(\{ name, handle \}\)/, 'the simple form saves both public identity fields to the account');
assert.match(source, /data\.suggestion/, 'taken names receive the server suggestion in the same form');
assert.match(source, /Come vuoi farti chiamare\?/, 'Italian members receive direct onboarding copy');
assert.match(css, /@media\(max-width:700px\)/, 'the identity card stacks on phones');
assert.doesNotMatch(source, /profile\.email|username@|email address/i, 'identity onboarding never exposes or requests an account email');

console.log('Profile onboarding checks passed: generic members receive a simple responsive name/username prompt with Italian copy and server conflict suggestions.');
