const fs = require("node:fs");
const assert = require("node:assert/strict");

const home = fs.readFileSync("index.html", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const appDownloads = fs.readFileSync("assets/app-downloads.js", "utf8");

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
  /Terms of Service<\/span><\/a>\s*<a class="app-menu-link"[^>]*href="#install-danzstak"[^>]*data-app-platform="android"[\s\S]*?Install on Android[\s\S]*?<a class="app-menu-link"[^>]*data-app-platform="apple"[\s\S]*?Apple App[\s\S]*?<button type="button" class="menu-action logout-menu-link" data-logout>/,
  "the left menu stacks the Android PWA and Apple home-screen install actions above Logout"
);
assert.match(home, /href="#install-danzstak"[^>]*data-app-platform="android"/, "the homepage uses the real browser PWA install flow on Android");
assert.match(home, /Install for<\/small><strong>Android<\/strong>/, "the public Android action describes installation rather than a preview download");
assert.doesNotMatch(home, /data-app-platform="android"[^>]*\bdownload\b|Download preview/, "the public homepage must install the PWA instead of downloading a preview package");
assert.doesNotMatch(feed, /data-app-platform="android"[^>]*\bdownload\b|Android Preview/, "the signed-in menu must install the PWA instead of downloading a preview package");
assert.doesNotMatch(appDownloads, /if \(link\.dataset\.appPlatform === "android"\) return;/, "Android must use the same install helper as the rest of the PWA");
assert.match(appDownloads, /Install app or Add to Home screen/, "the Android fallback must explain the normal browser installation path");

console.log("App install checks passed: Android PWA prompt, Apple home-screen guidance, share badges, and stacked sidebar actions.");
