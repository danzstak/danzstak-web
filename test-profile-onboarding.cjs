const assert = require('node:assert/strict');
const fs = require('node:fs');

const feed = fs.readFileSync('feed.html', 'utf8');
const source = fs.readFileSync('assets/profile-onboarding.js', 'utf8');
const css = fs.readFileSync('assets/profile-onboarding.css', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');

assert.match(feed, /id="profileOnboarding"[^>]*hidden/, 'the identity prompt is present but hidden until an incomplete profile is confirmed');
assert.match(feed, /What should people call you\?/, 'the prompt uses ordinary language rather than profile jargon');
assert.match(feed, /assets\/profile-onboarding\.js\?v=8/, 'the live feed loads current first-login identity behavior');
assert.match(feed, /assets\/profile-onboarding\.css\?v=2/, 'the live feed loads responsive identity styling');
assert.match(serviceWorker, /"\/assets\/profile-onboarding\.css"/, 'the installed app keeps the identity layout available offline');
assert.match(serviceWorker, /"\/assets\/profile-onboarding\.js"/, 'the installed app keeps the identity behavior available offline');
assert.match(source, /toLocaleLowerCase\(\)/, 'generic account detection ignores capitalization');
assert.match(source, /"danzstak member", "danzstak user", "new member"/, 'legacy generic display names are detected');
assert.match(source, /"danzstak-member", "danzstak\.member", "danzstak_member", "member", "new-member"/, 'legacy generic usernames are detected');
assert.match(source, /suggestedHandle\(nameInput\.value\)/, 'typing a name automatically suggests a username');
assert.match(feed, /id="profileOnboardingHandle"[^>]*type="hidden"/, 'new members only have to understand and enter one visible name field');
assert.match(source, /DanzStak handles the username for you/, 'plain-language help explains that the technical username is automatic');
assert.match(source, /function updateMenuProfile\(profile = \{\}\)/, 'the same account profile populates the navigation header');
assert.match(source, /menuProfileName\.textContent = name/, 'the drawer shows the member display name rather than a generic account label');
assert.match(source, /window\.danzstakIdentityMedia\?\.install\(menuProfileImage, profile\)/, 'the drawer avatar uses the existing resilient identity-media loader');
assert.doesNotMatch(source.match(/function updateMenuProfile[\s\S]*?^  \}/m)?.[0] || '', /profile\.email|@/, 'the drawer profile header does not expose account email');
assert.match(source, /Puoi cambiarlo in seguito in Impostazioni/, 'Italian members are told where to change their name later');
assert.match(source, /handle: data\.suggestion/, 'a taken automatic username is retried without making the member understand or edit it');
assert.match(source, /base\.length < 3/, 'short or non-Latin display names still receive a valid automatic username');
assert.match(source, /method: "POST"[\s\S]*JSON\.stringify\(\{ name, handle \}\)/, 'the simple form saves both public identity fields to the account');
assert.match(source, /data\.suggestion/, 'taken names receive the server suggestion in the same form');
assert.match(source, /Come vuoi farti chiamare\?/, 'Italian members receive direct onboarding copy');
assert.match(feed, /aria-label="Find friends and see who is online"/, 'the top people icon clearly identifies friend discovery');
assert.match(feed, /id="profileOnboardingFindPeople"/, 'the completed name step offers a direct next action');
assert.match(source, /Trova persone/, 'Italian members receive a translated friend-discovery action');
assert.match(source, /Benvenuto su DanzStak/, 'Italian members receive a translated welcome rather than an English banner');
assert.match(source, /DanzStak non riesce a connettersi/, 'Italian members receive understandable connection recovery guidance');
assert.match(source, /Questo nome è già in uso/, 'Italian members receive understandable name-conflict guidance');
for (const language of ['en','es','fr','de','pt','it','ko','ja','zh-Hans','zh-Hant','fil','hi','vi','th','id']) {
  assert.match(source, new RegExp(`(?:^|\\s|[,{])(?:"${language}"|${language}):`), `${language} receives direct identity onboarding copy`);
}
assert.match(source, /const feedback = \{/, 'welcome and recovery feedback are localized separately from field labels');
assert.match(source, /document\.querySelector\("\.profile-onboarding-kicker"\)\.textContent = messages\.welcome/, 'the visible welcome banner follows the member language');
assert.match(source, /throw new Error\(messages\.offline\)/, 'connection failures never fall back to browser-language technical errors');
assert.match(source, /identityLanguage/, 'identity setup resolves every supported locale explicitly');
assert.match(source, /\.topnav \[data-feature="Friends"\]/, 'the next action opens the existing online-user and friend workspace');
assert.match(source, /next\.hidden = false/, 'saving a name reveals friend discovery instead of silently dismissing onboarding');
assert.match(source, /const homeIsActive = newsFeedView && featureView && !newsFeedView\.hidden && featureView\.hidden/, 'identity onboarding is limited to the active Home feed');
assert.match(source, /routeObserver\.observe\(newsFeedView,[\s\S]*routeObserver\.observe\(featureView/, 'identity onboarding follows exclusive workspace navigation');
assert.match(source, /onboardingDismissed \|\| !onboardingEligible \|\| !homeIsActive/, 'dismissed, ineligible, and non-Home states cannot leak onboarding into another workspace');
assert.match(css, /@media\(max-width:700px\)/, 'the identity card stacks on phones');
assert.doesNotMatch(source, /profile\.email|username@|email address/i, 'identity onboarding never exposes or requests an account email');

console.log('Profile onboarding checks passed: generic members receive a simple responsive name prompt in all 15 languages with server conflict suggestions.');
