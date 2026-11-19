"use strict";
// L2 (owner 2026-11-19): device registration must never dead-end. A tester confirmed the right SMS code twice and still
// wasn't registered: the device challenge had been created 20 minutes earlier and expired after 300 s.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const devices = fs.readFileSync("assets/call-devices.js", "utf8");
const phone = fs.readFileSync("assets/phone-verification.js", "utf8");
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const i18n = fs.readFileSync("assets/i18n-sync.js", "utf8");
const html = fs.readFileSync("messages.html", "utf8");

// The server keeps a device challenge as long as the SMS code lives.
assert.match(template, /expiresAt:\{N:String\(now\(\)\+900\)\}\}\}\)\);return json\(201/, "device challenge must live 900 s on the server");
assert.doesNotMatch(template, /expiresAt:\{N:String\(now\(\)\+300\)\}\}\}\)\);return json\(201/, "the 300 s device challenge is back");

// The browser reuses a challenge only while it is fresh, and records when it got it.
assert.match(devices, /CHALLENGE_REUSE_MS=4\*60\*1000/, "challenge reuse window must be 4 minutes");
assert.match(devices, /if\(state\.pendingChallenge&&Date\.now\(\)-state\.pendingIssuedAt<CHALLENGE_REUSE_MS\)return state\.pendingChallenge;/, "a stale pending challenge must not be reused");
assert.match(devices, /state\.pendingIssuedAt=Date\.now\(\)/, "the time a challenge was issued must be recorded");

// Every send asks for a valid challenge, so a code is never bound to an expired one.
assert.match(phone, /const challenge = await window\.danzstakBeginCallingDeviceEnrollment\(\);\n\s+if \(!deviceChallenge \|\| challenge\.challengeId !== deviceChallenge\.challengeId\) await startDeviceOtp\(challenge, \{ keepNumber:true \}\);/, "send must refresh the device challenge");

// A failed registration after a confirmed code offers a new code instead of a dead end.
assert.match(devices, /danzstak:device-registration-failed/, "a failed registration must be announced");
assert.match(phone, /addEventListener\("danzstak:device-registration-failed"[\s\S]*?deviceChallenge = null;[\s\S]*?Send a new code to finish on this device\./, "the SMS screen must reset and offer a new code");

// Verified number + unregistered device = "finish here", never the Remove-only state.
assert.match(phone, /done = current\.state === "verified" && !deviceChallenge && \(deviceRegistered \|\| !deviceOtp\)/, "verified number alone must not count as done when this device needs its own code");
assert.match(phone, /finishHere[\s\S]*?Send a code to finish on this device\./, "the finish-on-this-device message is missing");
assert.match(phone, /addEventListener\("danzstak:call-device-ready", \(\) => \{ if \(current\) render\(\); \}\)/, "the SMS screen must re-check once the device state is known");

// Automatic prompts are rate-limited; taps always open.
assert.match(devices, /function mayPrompt\(incoming\)/, "prompt limiter missing");
assert.match(devices, /if\(\(incoming\|\|auto\)&&!dialog\.open&&!mayPrompt\(incoming\)\)return;/, "only automatic and incoming prompts are limited");
assert.match(devices, /url\.searchParams\.delete\("device"\);history\.replaceState/, "?device=register must be cleared so reloads don't reopen the dialog");

// The button says what it does, in every SYNC language.
assert.match(html, /id="syncPhoneSend"[^>]*aria-label="Send code"><span class="ds-cue-label">Send code<\/span>/, "send button must read Send code");
for (const [lang, word] of [["it", "Invia codice"], ["fr", "Envoyer le code"], ["es", "Enviar código"], ["de", "Code senden"], ["pt", "Enviar código"]]) {
  const block = i18n.slice(i18n.indexOf(`"${lang}": {`));
  assert.ok(block.includes(`"Send code": "${word}"`), `${lang} translation for Send code missing`);
}
console.log("Device registration L2 checks passed.");
