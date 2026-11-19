"use strict";
// Audit A6/E2: members never see raw programming errors; server messages meant for people still come through.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const window = {};
vm.runInNewContext(fs.readFileSync("assets/friendly-error.js", "utf8"), { window, TypeError, ReferenceError, SyntaxError, String, Error });
const f = window.danzstakFriendlyError;
assert.equal(f(new TypeError("Cannot read properties of undefined (reading 'name')"), "Plain"), "Plain");
assert.equal(f(new Error("Cannot read properties of undefined (reading 'join')"), "Plain"), "Plain");
assert.equal(f(new Error("Failed to fetch"), "Plain"), "Plain");
assert.equal(f(new Error(""), "Plain"), "Plain");
assert.equal(f(new Error("Shop names must be 2 to 60 characters."), "Plain"), "Shop names must be 2 to 60 characters.");
assert.match(f(null), /Try again/);
for (const page of ["store.html", "trusted-contacts.html"]) {
  const html = fs.readFileSync(page, "utf8");
  assert.ok(html.indexOf("assets/friendly-error.js") > -1 && html.indexOf("assets/friendly-error.js") < html.indexOf(page === "store.html" ? "assets/store.js" : "assets/trusted-contacts.js"), `${page} loads the friendly-error helper first`);
}
for (const file of ["assets/store.js", "assets/trusted-contacts.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /textContent\s*=\s*error\.message/, `${file} never shows error.message directly`);
assert.ok(fs.readFileSync("service-worker.js", "utf8").includes('"/assets/friendly-error.js"'), "the helper is cached for offline use");
console.log("Friendly error checks passed: raw programming errors become plain messages; server messages for people still show.");
