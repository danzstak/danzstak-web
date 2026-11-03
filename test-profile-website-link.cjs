const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const { normalizeUserUrl } = require("./assets/user-content-links.js");

const source = fs.readFileSync("assets/profile-editor.js", "utf8");
const functionSource = source.match(/function renderProfileWebsite\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(functionSource, "profile website renderer must exist");

const target = { children: [], textContent: "", replaceChildren() { this.children = []; }, appendChild(node) { this.children.push(node); } };
const document = { getElementById: () => target, createElement: tag => ({ tag, setAttribute(name, value) { this[name] = value; } }) };
const context = vm.createContext({ document, window: { danzstakNormalizeUserUrl: normalizeUserUrl }, Error });
vm.runInContext(functionSource, context);

context.renderProfileWebsite("https://sleepingdragon.example/path");
assert.equal(target.children.length, 1);
assert.equal(target.children[0].href, "https://sleepingdragon.example/path");
assert.equal(target.children[0].target, "_blank");
assert.equal(target.children[0].rel, "noopener noreferrer nofollow ugc");
assert.equal(target.children[0].referrerPolicy, "no-referrer");
assert.match(target.children[0]["aria-label"], /new tab/);

context.renderProfileWebsite("sfscoop.com");
assert.equal(target.children.length, 1);
assert.equal(target.children[0].href, "https://sfscoop.com/", "bare profile domains should become HTTPS links");

context.renderProfileWebsite("javascript:alert(1)");
assert.equal(target.children.length, 0, "unsafe website schemes must not become links");
assert.equal(target.textContent, "javascript:alert(1)");

context.renderProfileWebsite("");
assert.equal(target.textContent, "Not added");

console.log("Profile website checks passed: safe links open securely and unsafe schemes remain text.");
