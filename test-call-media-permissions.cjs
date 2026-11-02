const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/chat.js", "utf8");
const start = source.indexOf("function callMediaError");
const end = source.indexOf("async function media", start);
assert.ok(start >= 0 && end > start, "call media permission guidance must exist");
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);
const message = (name, kind) => vm.runInContext(`callMediaError({name:${JSON.stringify(name)}},${JSON.stringify(kind)})`, context);

assert.match(message("NotAllowedError", "video"), /Allow both.*settings/i);
assert.match(message("NotAllowedError", "phone"), /Microphone access is blocked/);
assert.match(message("NotFoundError", "video"), /No camera or microphone/);
assert.match(message("NotReadableError", "phone"), /used by another app/);
assert.match(message("UnknownError", "video"), /Check device permissions/);
assert.match(source, /catch\(error\)\{throw new Error\(callMediaError\(error,kind\)\);\}/, "media startup must use the friendly permission guidance");

console.log("Call media checks passed: denied, missing, busy, and unknown camera or microphone failures give clear recovery steps.");
