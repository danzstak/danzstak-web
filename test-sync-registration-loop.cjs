"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
// Owner 2026-11-17: on a registered computer a registration window kept opening and could not be closed.
const incoming = fs.readFileSync("assets/incoming-calls.js", "utf8");
const chat = fs.readFileSync("assets/chat.js", "utf8");
const devices = fs.readFileSync("assets/call-devices.js", "utf8");
assert.match(incoming, /async function showCall[\s\S]*?await window\.danzstakSyncDeviceReady/, "incoming calls wait for the device check before deciding the device is unregistered");
assert.match(incoming, /handledCalls\.set\(event\.callId[^;]*;\s*window\.danzstakRequireCallingDevice/, "an unregistered device is asked once per call, not on every poll");
assert.match(devices, /window\.danzstakRecheckCallingDevice=async\(\)=>\{await loadDevices\(\);return state\.registered;\}/);
assert.match(chat, /function openCallDeviceRegistration\(options=\{\}\)\{if\(window\.danzstakSyncDeviceRegistered\?\.\(\)===true\)\{Promise\.resolve\(window\.danzstakRecheckCallingDevice/, "a registered device re-checks with the server before being sent to registration");
console.log("SYNC registration-loop checks passed: no reopening registration window on registered devices.");
