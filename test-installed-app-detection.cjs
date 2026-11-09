const fs = require("node:fs");
const assert = require("node:assert/strict");

const pwa = fs.readFileSync("assets/pwa.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));

assert.equal(manifest.prefer_related_applications, false, "DanzStak must keep direct PWA installation available");
assert.ok(manifest.related_applications.some(app => app.platform === "webapp" && app.url === "/manifest.webmanifest"), "the PWA must identify itself for installed-app detection");
assert.match(pwa, /navigator\.getInstalledRelatedApps/, "supported browsers must check for an installed related app");
assert.match(pwa, /app\?\.platform === "webapp"/, "installed-app detection must remain scoped to the DanzStak PWA");
assert.match(pwa, /detectInstalledDanzStak\(true\)/, "a browser install event must recheck and clear stale installed state");
assert.match(pwa, /knownInstalled \|\| await detectInstalledDanzStak\(\)/, "manual install requests must also suppress prompts for an installed app");
assert.match(pwa, /if \(!installed\) showInstallButtonTemporarily\(\)/, "automatic prompts must wait for installed-app detection");
assert.match(pwa, /automaticInstallPromptShown/, "automatic install prompts must not restart their 15-second timer repeatedly in one page view");
assert.match(pwa, /if \(!signedInPage \|\| knownInstalled \|\| waitingWorker \|\| automaticInstallPromptShown\) return;/, "only one automatic install prompt may appear per signed-in page view");
assert.match(pwa, /automaticInstallPromptShown = false;\s*showInstallButtonTemporarily\(\);/, "an explicit install request may show a fresh time-limited prompt");
assert.match(pwa, /document\.querySelector\("body > header"\)/, "install prompts must locate the primary header");
assert.match(pwa, /querySelector\("\.topnav, \.header-actions, :scope > div:last-child"\)/, "signed-in pages must reuse an existing header action group");
assert.match(pwa, /matchMedia\("\(min-width: 701px\)"\)/, "wide layouts must place app prompts inside the header");
assert.match(pwa, /appPromptHost\.append\(installButton, updateButton\)/, "wide app prompts must not create a blank row below the header");
assert.match(pwa, /insertAdjacentElement\("afterend", installButton\)/, "phone install actions must remain in normal page flow");
assert.match(pwa, /addEventListener\?\.\("change", placeAppPrompts\)/, "prompt placement must follow responsive viewport changes");
const softUi = fs.readFileSync("assets/soft-ui.css", "utf8");
assert.match(softUi, /\.install-app-button,\.app-update-button\{position:relative/, "install and update prompts must not cover composer or message controls");
assert.match(softUi, /\.install-app-button,\.app-update-button\{position:relative;z-index:1;/, "scrolling prompts must remain below sticky navigation");
assert.doesNotMatch(softUi, /\.install-app-button,\.app-update-button\{position:fixed/, "app prompts must not use a blocking fixed overlay");
assert.match(softUi, /header \.app-header-prompt\{position:relative;display:inline-flex/, "wide prompts must be compact header controls");
assert.match(softUi, /header \.app-header-prompt\[hidden\]\{display:none!important\}/, "compact header styling must preserve each prompt's hidden state against later button rules");

console.log("Installed-app checks passed: PWA detection and prompt suppression are connected without native-app dependencies.");
