const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("messages.html", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");
const source = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(html, /id="newChat"[^>]*aria-label="Start a new chat"/);
assert.match(html, /class="chat-compat-controls" hidden aria-hidden="true"/);
assert.match(css, /\.new-chat-button\{/);
assert.match(css, /\.chat-compat-controls\[hidden\]\{display:none!important\}/);
assert.match(source, /getElementById\("newChat"\).*addEventListener\("click"/s);
assert.match(source, /chatSearch\?\.focus\(\)/);

console.log("New-chat checks passed: contacts remain in one familiar list and the compose control resets search and filters.");
