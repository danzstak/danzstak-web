"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const trackedFiles = String(require("node:child_process").execFileSync("git", ["ls-files"], { cwd: root }));
const authApi = fs.readFileSync(path.join(root, "infrastructure/auth-api/index.mjs"), "utf8");
const deployScript = fs.readFileSync(path.join(root, "aws-deploy-auth-api.ps1"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

assert.doesNotMatch(trackedFiles, /(^|[\\/])(android|ios|native)([\\/]|$)/im, "native project directories must stay out of the PWA repository");
assert.doesNotMatch(trackedFiles, /\.apk$/im, "APK binaries must stay out of the PWA repository");
assert.doesNotMatch(authApi, /\/auth\/mobile-(?:login|session)|mobile_exchange|danzstak:\/\//, "native login exchanges must not remain in the PWA backend");
assert.doesNotMatch(deployScript, /create-route[^\r\n]+\/auth\/mobile-(?:login|session)/i, "deployment must not recreate native authentication routes");
assert.equal(manifest.display, "standalone", "the website must remain installable as a standalone PWA");
assert.equal(manifest.background_color, "#edf2f7", "the installed PWA launch surface must match the light-only app canvas");
assert.equal(manifest.prefer_related_applications, false, "the PWA must not prefer a native application");
assert.deepEqual(manifest.related_applications.map(app => app.platform), ["webapp"], "the manifest must advertise only the web app");
assert.match(readme, /The installable PWA is the only DanzStak app\./, "the PWA-only product decision must remain explicit");

console.log("PWA-only checks passed: no native projects, APKs, auth exchange, routes, or app-store preference remain.");
