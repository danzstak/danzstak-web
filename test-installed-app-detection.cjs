const fs = require("node:fs");
const assert = require("node:assert/strict");

const pwa = fs.readFileSync("assets/pwa.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
const androidManifest = fs.readFileSync("native/android/app/src/main/AndroidManifest.xml", "utf8");
const androidStrings = fs.readFileSync("native/android/app/src/main/res/values/strings.xml", "utf8");

assert.equal(manifest.prefer_related_applications, false, "DanzStak must keep direct PWA installation available");
assert.ok(manifest.related_applications.some(app => app.platform === "play" && app.id === "com.danzstak.app"), "the website must identify the native Android app");
assert.ok(manifest.related_applications.some(app => app.platform === "webapp" && app.url === "/manifest.webmanifest"), "the PWA must identify itself for installed-app detection");
assert.match(androidManifest, /android:name="asset_statements"[\s\S]*android:resource="@string\/asset_statements"/, "the Android app must identify its related website");
assert.match(androidStrings, /delegate_permission\/common\.handle_all_urls/, "the Android app must authorize its danzstak.com relationship");
assert.match(androidStrings, /https:\/\/danzstak\.com/, "the app relationship must be restricted to DanzStak");
assert.match(pwa, /navigator\.getInstalledRelatedApps/, "supported browsers must check for an installed related app");
assert.match(pwa, /app\?\.id === "com\.danzstak\.app"/, "native-app detection must require DanzStak's package id");
assert.match(pwa, /detectInstalledDanzStak\(true\)/, "a browser install event must recheck and clear stale installed state");
assert.match(pwa, /knownInstalled \|\| await detectInstalledDanzStak\(\)/, "manual install requests must also suppress prompts for an installed app");
assert.match(pwa, /if \(!installed\) showInstallButtonTemporarily\(\)/, "automatic prompts must wait for installed-app detection");

console.log("Installed-app checks passed: PWA, Android relationship, and prompt suppression are connected.");
