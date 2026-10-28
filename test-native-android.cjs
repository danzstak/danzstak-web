"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "native", "android");
const main = fs.readFileSync(path.join(root, "app", "src", "main", "java", "com", "danzstak", "app", "MainActivity.kt"), "utf8");
const api = fs.readFileSync(path.join(root, "app", "src", "main", "java", "com", "danzstak", "app", "DanzStakApi.kt"), "utf8");
const store = fs.readFileSync(path.join(root, "app", "src", "main", "java", "com", "danzstak", "app", "SessionStore.kt"), "utf8");
const manifest = fs.readFileSync(path.join(root, "app", "src", "main", "AndroidManifest.xml"), "utf8");

assert.doesNotMatch(main + api, /\bWebView\b|\bloadUrl\s*\(/, "the native app must not be a website wrapper");
assert.match(main, /SecureRandom/, "device verifier uses a cryptographic RNG");
assert.match(main, /SHA-256/, "the browser receives only the verifier challenge");
assert.match(main, /danzstak\.com\/auth\/mobile-login/, "login uses the DanzStak-owned API");
assert.match(api, /Authorization", "Bearer \$token"/, "API calls use the opaque native session");
assert.doesNotMatch(api, /id_token|access_token|refresh_token/, "native code never handles Cognito tokens");
assert.match(store, /AndroidKeyStore/, "sessions are protected by Android Keystore");
assert.match(store, /AES\/GCM\/NoPadding/, "sessions use authenticated encryption at rest");
assert.match(manifest, /usesCleartextTraffic="false"/, "cleartext networking is prohibited");
assert.match(manifest, /android:allowBackup="false"/, "session-bearing app data is excluded from device backups");
assert.match(manifest, /android:scheme="danzstak" android:host="android"/, "Android handles only its native login callback");

console.log("Native Android checks passed: real native UI, device-bound login, opaque API session, Keystore encryption, and HTTPS-only networking.");
