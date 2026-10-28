const fs = require("node:fs");
const assert = require("node:assert/strict");

const home = fs.readFileSync("index.html", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const appDownloads = fs.readFileSync("assets/app-downloads.js", "utf8");
const apkPath = "downloads/danzstak-android-test.apk";

assert.match(
  home,
  /\.app-downloads\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  "the public homepage keeps Android and Apple install links side by side"
);
assert.match(
  home,
  /<meta property="og:image" content="https:\/\/danzstak\.com\/assets\/danzstak-share-apps-v\d+\.png">/,
  "external shares use the branded app-download preview"
);
assert.match(
  home,
  /<meta property="og:image:width" content="1744">[\s\S]*?<meta property="og:image:height" content="909">/,
  "the share preview publishes explicit image dimensions"
);
assert.match(
  feed,
  /Terms of Service<\/span><\/a>\s*<a class="app-menu-link"[^>]*href="downloads\/danzstak-android-test\.apk"[^>]*data-app-platform="android"[^>]*download[\s\S]*?Android Test App[\s\S]*?<a class="app-menu-link"[^>]*data-app-platform="apple"[\s\S]*?Apple App[\s\S]*?<button type="button" class="menu-action logout-menu-link" data-logout>/,
  "the left menu stacks Android then Apple directly under Terms of Service and above Logout"
);
assert.match(home, /href="downloads\/danzstak-android-test\.apk"[^>]*download/, "the homepage links directly to the Android test APK");
assert.match(appDownloads, /if \(link\.dataset\.appPlatform === "android"\) return;/, "Android APK links are not intercepted by the PWA install helper");
assert.ok(fs.existsSync(apkPath), "the Android test APK is present in the website package");
assert.deepEqual([...fs.readFileSync(apkPath).subarray(0, 2)], [0x50, 0x4b], "the Android test download is a ZIP-based APK");

console.log("App download checks passed: live APK links, share badges, and stacked sidebar links.");
