"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const template=fs.readFileSync("infrastructure/call-signaling/template.yaml","utf8");
const html=fs.readFileSync("messages.html","utf8");
const client=fs.readFileSync("assets/call-devices.js","utf8");
const css=fs.readFileSync("assets/chat.css","utf8");
const worker=fs.readFileSync("service-worker.js","utf8");

for(const id of ["phoneCountry","phoneLocalNumber","sendPhoneCode","phoneCode","verifyPhoneCode","dsNumberValue","chooseDsNumber"])
  assert.ok(html.includes(`id="${id}"`),`${id} must be present in the phone setup window`);
assert.match(html,/Use my mobile number[\s\S]*Use a DanzStak number[\s\S]*Skip number for now/,"phone setup must preserve all three choices");
assert.match(client,/DANZSTAK_COUNTRY_CALLING_CODES/,"country calling codes must populate dynamically");
assert.match(client,/\/sync\/phone\/start[\s\S]*\/sync\/phone\/verify/,"personal-number verification must use protected backend routes");
assert.match(client,/\/phone-number\/entitlement[\s\S]*\/phone-number\/checkout[\s\S]*\/sync\/ds-number/,"DS assignment must verify payment before allocating a number");
assert.match(client,/data-setup-required/,"incomplete setup must be visible from the SYNC header");
assert.match(css,/min-height:44px/,"setup actions must preserve 44px touch targets");
assert.match(css,/@media\(max-width:520px\)[\s\S]*100dvh/,"the window must fit a phone viewport");

assert.match(template,/SyncIdentitiesTable:[\s\S]*DeletionPolicy: Retain[\s\S]*PointInTimeRecoveryEnabled: true[\s\S]*SSEEnabled: true/,"SYNC identity records must be recoverable and encrypted");
assert.match(template,/PhoneVerificationsTable:[\s\S]*TimeToLiveSpecification:[\s\S]*AttributeName: expiresAt[\s\S]*Enabled: true/,"verification challenges must expire");
assert.match(template,/PhoneVerificationKey:[\s\S]*EnableKeyRotation: true/,"pending phone destinations must use a rotating KMS key");
assert.match(template,/EncryptCommand[\s\S]*encryptedPhone:[\s\S]*CiphertextBlob/,"pending phone destinations must be encrypted");
assert.match(template,/codeHash:[\s\S]*otpHash\(salt,code\)/,"verification codes must be stored only as salted hashes");
assert.match(template,/timingSafeEqual\(expected,actual\)/,"verification comparison must resist timing disclosure");
assert.match(template,/resendAt[\s\S]*sendCount>=5[\s\S]*attempts>=5/,"SMS flow must enforce resend and attempt limits");
assert.match(template,/SMS_NOT_CONFIGURED/,"the API must truthfully refuse sends when SMS is not configured");
assert.doesNotMatch(template,/phoneVerifiedAt[\s\S]{0,500}phone:\s*\{S:/,"verified identity must not persist a plaintext personal phone");
assert.match(template,/randomInt\(100,1000\)[\s\S]*DS-\$\{digits\.slice\(0,3\)\}-\$\{digits\.slice\(3\)\}/,"DS numbers must use the requested unique DS-123-1234 format");
assert.match(template,/DS#\$\{digits\}[\s\S]*ConditionExpression:'attribute_not_exists\(identityKey\)'/,"DS aliases must be reserved conditionally to prevent duplicates");
assert.match(template,/PHONE#ACTIVATION_ENTITLEMENT[\s\S]*A verified \$3 DanzStak number activation is required/,"DS allocation must require the existing phone activation entitlement");
assert.match(template,/It works only inside SYNC[\s\S]*senderEmail:\{S:SYNC_SYSTEM_EMAIL\}/,"an assigned DS number must arrive in the member's SYNC chat");
for(const route of ["GET /sync/identity","POST /sync/phone/start","POST /sync/phone/verify","POST /sync/ds-number"])
  assert.ok(template.includes(route),`${route} must be routed`);
assert.match(worker,/danzstak-shell-v802/,"the installed PWA must receive the phone setup release");
assert.match(worker,/country-calling-codes\.js/,"the PWA shell must include country calling codes");

console.log("SYNC phone/device setup checks passed: country codes, truthful SMS gate, private verification, unique paid DS alias, system-chat confirmation, responsive window, and PWA cache update.");
