const assert = require("node:assert/strict");
const fs = require("node:fs");

const preferences = fs.readFileSync("assets/display-preferences.js", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");

assert.match(preferences, /location\.pathname\.endsWith\("\/messages\.html"\)/, "early display setup is scoped to Messages");
assert.match(preferences, /new URLSearchParams\(location\.search\)\.get\("embedded"\) === "1"/, "early display setup requires embedded mode");
assert.match(preferences, /root\.classList\.add\("embedded-messages-document"\)/, "the root is marked before body rendering");
assert.match(css, /html\.embedded-messages-document \.chat-header\{display:none\}/, "the standalone header is hidden before deferred scripts run");
assert.match(css, /html\.embedded-messages-document \.chat-shell\{display:block/, "the compact shell applies before deferred scripts run");
assert.match(css, /html\.embedded-messages-document \.site-ownership\{display:none\}/, "the standalone footer never flashes in the drawer");
assert.ok(html.indexOf("assets/display-preferences.js") < html.indexOf("assets/chat.css"), "the root marker runs before chat layout CSS is applied");

console.log("Embedded message startup checks passed: compact drawer styling applies before first paint.");
