const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.match(source, /function linkifyUserText\(element\)/, "feed text must have a dedicated safe linkifier");
assert.match(source, /new URL\(visible\.startsWith\("www\."\) \? "https:\/\/" \+ visible : visible\)/, "www links must receive an HTTPS URL");
assert.match(source, /href\.protocol !== "https:" && href\.protocol !== "http:"/, "only web protocols may become clickable");
assert.match(source, /link\.rel = "noopener noreferrer nofollow ugc"/, "user links must not control the opener or inherit site trust");
assert.match(source, /link\.target = "_blank"/, "external user links must preserve the DanzStak session page");
assert.match(source, /node\.parentElement\?\.closest\("a, button, input, textarea, script, style"\)/, "linkification must not nest links or modify controls and code");
assert.match(source, /new MutationObserver/, "new and asynchronously loaded posts and comments must also become clickable");
assert.doesNotMatch(source.slice(source.indexOf("function linkifyUserText"), source.indexOf("function linkifyFeedContent")), /innerHTML/, "user text must never be converted with unsafe HTML parsing");
assert.match(css, /\.user-content-link\{/, "clickable user links need a visible treatment");
assert.match(feed, /feed-enhancements\.js\?v=\d+/, "the link behavior must use a versioned script URL to bypass old browser caches");
assert.match(feed, /feed-enhancements\.css\?v=\d+/, "the link style must use a versioned stylesheet URL to bypass old browser caches");

console.log("Clickable-link checks passed: post/comment URLs are safe, visible, asynchronous, and cache-busted.");
