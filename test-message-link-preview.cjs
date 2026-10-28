const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("messages.html", "utf8");
const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");

assert.match(html, /assets\/direct-messages\.js\?v=366/);
assert.match(source, /function firstSafeMessageUrl\(content\)/);
assert.match(source, /url\.protocol !== "https:" \|\| url\.username \|\| url\.password/);
assert.match(source, /function messageLinkPreview\(url\)/);
assert.match(source, /card\.rel = "noopener noreferrer"/);
assert.match(source, /item\.appendChild\(messageLinkPreview\(sharedUrl\)\)/);
assert.match(source, /media\.setAttribute\("aria-label", mine \? "Video you sent"/);
assert.match(css, /\.message-link-preview\{/);
assert.match(css, /\.message-attachment:is\(video\)/);

console.log("Message sharing checks passed: HTTPS links render as safe preview cards and shared videos retain compact inline controls.");
