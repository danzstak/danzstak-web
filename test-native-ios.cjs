"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "native", "ios");
const read = file => fs.readFileSync(path.join(root, "DanzStak", file), "utf8");
const model = read("AppModel.swift"), api = read("APIClient.swift"), store = read("SessionStore.swift"), view = read("ContentView.swift");
const project = fs.readFileSync(path.join(root, "project.yml"), "utf8");

assert.doesNotMatch(model + api + view, /WKWebView|SFSafariViewController/, "the iOS app must not be a website wrapper");
assert.match(model, /ASWebAuthenticationSession/, "login uses the protected system authentication session");
assert.match(model, /SHA256\.hash/, "the browser receives only the device verifier challenge");
assert.match(model, /callbackURLScheme: "danzstak"/, "the app receives its native callback");
assert.ok(api.includes('"Bearer \\(token)", forHTTPHeaderField: "Authorization"'), "API calls use the opaque native session");
assert.doesNotMatch(api, /id_token|access_token|refresh_token/, "native code never handles Cognito tokens");
assert.match(store, /kSecClassGenericPassword/, "sessions are stored in Keychain");
assert.match(store, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/, "sessions cannot migrate through device backups");
assert.match(project, /NSAllowsArbitraryLoads: false/, "arbitrary insecure networking is prohibited");
assert.match(view, /filteredPosts\.enumerated\(\)/, "the feed renders through native SwiftUI controls");
assert.match(view, /PostCard\(post: post\)/, "feed posts use native cards");

console.log("Native iOS checks passed: real SwiftUI, device-bound login, opaque API session, Keychain storage, and strict transport security.");
