const fs = require("node:fs");
const assert = require("node:assert/strict");

const home = fs.readFileSync("index.html", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

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
  /Terms of Service<\/span><\/a>\s*<a class="app-menu-link"[^>]*data-app-platform="android"[\s\S]*?Android App[\s\S]*?<a class="app-menu-link"[^>]*data-app-platform="apple"[\s\S]*?Apple App[\s\S]*?<a href="#" data-logout>/,
  "the left menu stacks Android then Apple directly under Terms of Service and above Logout"
);

console.log("App download checks passed: side-by-side share badges and stacked sidebar links.");
