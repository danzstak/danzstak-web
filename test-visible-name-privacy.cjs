const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');

const feed = readFileSync('feed.html', 'utf8');
const enhancements = readFileSync('assets/feed-enhancements.js', 'utf8');
const messages = readFileSync('assets/direct-messages.js', 'utf8');
const profile = readFileSync('assets/profile.js', 'utf8');
const editor = readFileSync('assets/profile-editor.js', 'utf8');
const authApi = readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
const signaling = readFileSync('infrastructure/call-signaling/template.yaml', 'utf8');

for (const [name, source] of Object.entries({ feed, enhancements, messages, profile, editor })) {
  assert.doesNotMatch(source, /(?:name|author|displayName|textContent)[^;\n]{0,180}(?:split\(["']@["']\)|\|\|\s*(?:friend\.)?email)/, `${name} must not derive visible names from account email`);
}
assert.match(feed, /const storyAuthor = story\.displayName \|\| "DanzStak member"/);
assert.match(enhancements, /author\.textContent = comment\.authorName \|\| "DanzStak member"/);
assert.match(messages, /name: friend\.name \|\| "DanzStak member"/);
assert.match(profile, /\|\| "DanzStak Member"/);
assert.match(editor, /friend\.name \|\| "DanzStak member"/);
assert.doesNotMatch(authApi, /(?:authorName|actorName|name)[^;\n]{0,180}split\("@"\)\[0\]/, 'Auth API must not derive public display names from account email');
assert.doesNotMatch(signaling, /(?:name|handle)[^;\n]{0,180}split\('@'\)\[0\]/, 'Signaling API must not derive public display names from account email');
assert.match(authApi, /actorName:\{S:names\.get\(actorEmail\)\|\|"DanzStak member"\}/);
assert.match(signaling, /name:item\?\.profileName\?\.S\|\|attr\(account,'name'\)\|\|attr\(account,'preferred_username'\)\|\|'DanzStak member'/);
assert.match(signaling, /displayName:profile\.name\|\|'DanzStak member'/, 'Stories and Reels expose public profile labels');
assert.doesNotMatch(signaling, /displayName:(?:x\.)?userEmail/, 'Story and Reel display labels must not use account email');
console.log('Visible-name privacy checks passed: frontend and API social surfaces do not derive display names from email addresses.');
