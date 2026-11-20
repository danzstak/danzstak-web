"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const root = __dirname;
  const verification = await import(pathToFileURL(path.join(root,"infrastructure/auth-api/personal-phone-verification.mjs")));
  const serviceModule = await import(pathToFileURL(path.join(root,"infrastructure/auth-api/personal-phone-service.mjs")));
  const secret = "a".repeat(64), now = Date.UTC(2026,10,11,12,0,0), number = verification.normalizeE164("+1","202 555 0123");
  assert.equal(number,"+12025550123");
  assert.equal(verification.maskPhone(number),"•••• 0123");
  const record = verification.challengeRecord({secret,userId:"member-1",number,challengeId:"00000000-0000-4000-8000-000000000001",code:"123456",now});
  assert.equal(verification.verifyChallenge(record,"123456",secret,now+1000).ok,true);
  assert.equal(verification.verifyChallenge(record,"654321",secret,now+1000).reason,"invalid");
  assert.equal(verification.verifyChallenge(record,"123456",secret,now+601000).reason,"expired");
  assert.equal(verification.publicPhoneStatus(record,now).state,"pending");
  assert.equal(Object.values(record).includes(number),false,"plaintext number must not be persisted");
  assert.equal(verification.deviceChallengeDigest("22222222-2222-4222-8222-222222222222","a".repeat(43)).length,64);

  let saved = null, sent = null;
  const adapter = {
    getByUser: async () => saved,
    reserveChallenge: async value => { saved={...value}; return {accepted:true}; },
    markSent: async () => {}, cancelChallenge: async () => { saved=null; },
    recordFailedAttempt: async value => { value.attempts=(value.attempts||0)+1; },
    markVerified: async (value,grant) => { saved={...value,status:"verified"}; if(grant)saved.grant={...grant}; return true; },
    remove: async () => { saved=null; }
  };
  const service = serviceModule.createPersonalPhoneService({adapter,secret,enabled:true,now:()=>now,createCode:()=>"123456",createId:()=>"00000000-0000-4000-8000-000000000001",sender:{send:async value=>{sent=value;}}});
  const pending = await service.send({userId:"member-1",countryCode:"+1",localNumber:"202 555 0123"});
  assert.equal(pending.maskedNumber,"•••• 0123"); assert.equal(sent.number,"+12025550123");
  const confirmed = await service.confirm({userId:"member-1",code:"123456"}); assert.equal(confirmed.verified,true);
  const deviceChallengeId="22222222-2222-4222-8222-222222222222", deviceChallenge="a".repeat(43);
  await service.send({userId:"member-1",countryCode:"+1",localNumber:"202 555 0123",purpose:"sync_device",deviceChallengeId,deviceChallenge});
  await assert.rejects(service.confirm({userId:"member-1",code:"123456",purpose:"sync_device",deviceChallengeId:"33333333-3333-4333-8333-333333333333",deviceChallenge}),error=>error.code==="device_mismatch");
  const deviceConfirmed=await service.confirm({userId:"member-1",code:"123456",purpose:"sync_device",deviceChallengeId,deviceChallenge});
  assert.match(deviceConfirmed.deviceGrantId,/^[a-f0-9-]{36}$/); assert.match(deviceConfirmed.deviceGrantToken,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(saved.grant.grantTokenHash.length,64); assert.notEqual(saved.grant.grantTokenHash,deviceConfirmed.deviceGrantToken);
  const disabled = serviceModule.createPersonalPhoneService({adapter,secret,enabled:false,sender:{send:async()=>{throw new Error("must not send");}}});
  await assert.rejects(disabled.send({userId:"member-2",countryCode:"+1",localNumber:"4155550123"}),error=>error.code==="provider_unavailable");

  const html=fs.readFileSync(path.join(root,"messages.html"),"utf8"), client=fs.readFileSync(path.join(root,"assets/phone-verification.js"),"utf8"), devices=fs.readFileSync(path.join(root,"assets/call-devices.js"),"utf8"), messages=fs.readFileSync(path.join(root,"assets/direct-messages.js"),"utf8"), api=fs.readFileSync(path.join(root,"infrastructure/auth-api/index.mjs"),"utf8"), callTemplate=fs.readFileSync(path.join(root,"infrastructure/call-signaling/template.yaml"),"utf8"), template=fs.readFileSync(path.join(root,"infrastructure/engagement/template.yaml"),"utf8");
  for (const marker of ["syncPhoneCountryCode","syncPhoneNumber","syncPhoneCode","Verify this device by SMS","stays private, unsearchable"] /* the DS-number note left the panel until DS numbers launch (owner SYNC call test 2026-11-17) */) assert.ok(html.includes(marker),`missing phone UI: ${marker}`);
  assert.ok(client.includes("SYNC verification texts aren't available yet"), "provider-neutral fail-closed message (Twilio or AWS)");
  assert.ok(client.includes('purpose:"sync_device"') && client.includes("deviceChallengeId") && client.includes("danzstak:device-otp-confirmed"),"device OTP must be bound in memory to the exact registration challenge");
  assert.ok(devices.includes("state.pendingName=state.accountName||defaultName()"),"device label must default to the account name");
  assert.ok(devices.includes("danzstakBeginCallingDeviceEnrollment") && client.includes("danzstakBeginCallingDeviceEnrollment"),"Text me a code must start the bound device enrollment challenge");
  assert.ok(!html.includes('id="registerThisDevice"'),"redundant Register this device button must not remain");
  assert.ok(devices.includes("deviceGrantId") && devices.includes("danzstak:device-otp-confirmed"),"device registration must wait for the real SMS grant");
  assert.doesNotMatch(html.match(/<dialog id="contactDetailsDialog"[\s\S]*?<\/dialog>/)?.[0]||"",/(?:syncPhone|maskedNumber|verifiedPhone|mobile number)/i,"another member's SYNC contact details must never expose full or masked registration numbers");
  assert.doesNotMatch(messages.match(/function populateContactDetails\(\)[\s\S]*?\n}/)?.[0]||"",/(?:syncPhone|maskedNumber|verifiedPhone|phoneHash)/,"contact rendering must not read private phone registration fields");
  assert.match(callTemplate,/async function publicProfile\(email,account\)[\s\S]*?return \{memberId:attr\(account,'sub'\),name:[\s\S]*?,picture:[\s\S]*?};}/,"SYNC public profiles must stay limited to member ID, name, and picture");
  assert.doesNotMatch(callTemplate.match(/async function listCallingDevices[\s\S]*?\n\s*async function updateCallingDevice/)?.[0]||"",/verifiedPhoneMask/,"registered-device responses must not expose the owner's masked number");
  for (const route of ["GET /phone-verification","POST /phone-verification/send","POST /phone-verification/confirm","DELETE /phone-verification"]) assert.ok(template.includes(route),`missing route ${route}`);
  assert.ok(api.includes("PHONE_VERIFICATION_ENABLED") && api.includes("PHONE_DEVICE_OTP_REQUIRED") && api.includes("SendNotifyTextMessageCommand"));
  assert.match(api,/const phoneDeviceOtpRequired = process\.env\.PHONE_DEVICE_OTP_REQUIRED === "true";/,"OTP policy must stay mandatory when the SMS provider is unavailable");
  assert.doesNotMatch(api,/phoneVerificationEnabled\s*&&\s*process\.env\.PHONE_DEVICE_OTP_REQUIRED/,"provider health must never enable unverified device registration");
  const translations=fs.readFileSync(path.join(root,"assets/i18n.js"),"utf8");
  for(const italian of ["Verifica privata del telefono","Prefisso internazionale","Numero di cellulare","AWS non ha ancora approvato gli SMS di verifica SYNC"])assert.ok(translations.includes(italian),`missing Italian phone verification copy: ${italian}`);
  console.log("SYNC private phone verification regression checks passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});

// Owner 2026-11-19: the Italian tester's reply from "Send a test notification" came back in English,
// and Resend left a Send button that did nothing.
{
  const fs = require("node:fs"), assert = require("node:assert/strict");
  const push = fs.readFileSync("assets/push-notifications.js", "utf8"), sync = fs.readFileSync("assets/i18n-sync.js", "utf8"), phone = fs.readFileSync("assets/phone-verification.js", "utf8");
  assert.doesNotMatch(push, /status\.textContent = "|status\.textContent = error\.message|: "No device has|`Sent to \$\{/, "test-notification replies go through t()");
  for (const key of ["Send a test notification", "Sending…", "No device has notifications on yet. Allow notifications and try again.", "Sent to 1 device.", "Sent to {count} devices.", "This device will ring for calls when SYNC is closed.", "This device gets messages; register it to ring for calls when SYNC is closed.", "Notifications must be allowed for background alerts."])
    for (const lang of ["it", "fr", "es", "de", "pt"]) assert.ok(sync.split(`"${lang}": {`)[1].includes(JSON.stringify(key) + ":"), `"${key}" missing in ${lang}`);
  assert.match(phone, /resend\.addEventListener\("click", \(\) => \{[^}]*send\.disabled = current\?\.providerAvailable !== true/, "Resend brings back a Send button that works");
  console.log("SYNC test-notification localization + Resend checks passed.");
}

// Directive L2 short screen: one line, a live countdown, "Wrong number? Change it", the country from the phone, autosubmit.
{
  const fs = require("node:fs"), assert = require("node:assert/strict");
  const client = fs.readFileSync("assets/phone-verification.js", "utf8"), devices = fs.readFileSync("assets/call-devices.js", "utf8"), sync = fs.readFileSync("assets/i18n-sync.js", "utf8");
  for (const page of ["messages.html", "sync/index.html"]) {
    const html = fs.readFileSync(page, "utf8");
    assert.match(html, /<p class="calling-device-account" hidden>/, `${page}: no account-name box on the short screen`);
    assert.match(html, /<p class="push-test-row" hidden>/, `${page}: the test-notification button waits until the device is registered`);
    assert.match(html, /id="syncPhoneChangeNumber"[^>]*>Wrong number\? Change it</, `${page}: Wrong number? Change it`);
    assert.match(html, /autocomplete="one-time-code"/, `${page}: the code field offers the SMS code`);
  }
  assert.match(devices, /pushRow\.hidden=!registered/, "the test button shows only once registered");
  assert.match(client, /t\("Resend in"\)[^\n]*padStart\(2, "0"\)/, "Resend shows a m:ss countdown");
  assert.match(client, /digits\.length === 6[^\n]*codeForm\.requestSubmit\(\)/, "the 6th digit submits the code");
  assert.match(client, /OTPCredential/, "WebOTP fills the code on Android when the text allows it");
  assert.match(client, /new Intl\.DisplayNames/, "country names in the visitor's language");
  for (const key of ["Calls and voice messages need this phone verified. Texting already works.", "Resend in", "Wrong number? Change it"])
    for (const lang of ["it", "fr", "es", "de", "pt"]) assert.ok(sync.split(`"${lang}": {`)[1].includes(JSON.stringify(key) + ":"), `"${key}" missing in ${lang}`);
  console.log("Directive L2 short registration screen checks passed.");
}
