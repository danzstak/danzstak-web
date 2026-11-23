"use strict";
// Directive L2 (owner 2026-11-19: "This needs to be easier to do"): a verification text that fails on DanzStak's side
// (provider down, timeout, 5xx) never uses up the member's send limits. A refusal about the number itself still counts.
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const load = file => import(pathToFileURL(path.join(__dirname, "infrastructure/auth-api", file)));
  const { createPersonalPhoneService } = await load("personal-phone-service.mjs");
  const tw = await load("personal-phone-twilio.mjs");
  const { createPersonalPhoneDynamoAdapter } = await load("personal-phone-dynamodb.mjs");

  // ---- Service: which failures give the counters back ----
  const run = async failure => {
    const released = [], store = new Map();
    const adapter = {
      getByUser: async userId => store.get(userId) || null,
      reserveChallenge: async value => { store.set(value.userId, { ...value }); return { accepted: true, rateKeys: ["RATE#ACCOUNT#u#HOUR#1", "RATE#PHONE10#p#1"] }; },
      releaseRateCounters: async keys => { released.push(...keys); },
      markSent: async () => {}, cancelChallenge: async value => { store.delete(value.userId); },
      linkCapacity: async () => true
    };
    const verifier = { start: async () => { throw failure; } };
    const service = createPersonalPhoneService({ adapter, verifier, secret: "a".repeat(64), enabled: true });
    const error = await service.send({ userId: "u", countryCode: "+39", localNumber: "333 123 4567" }).then(() => null, value => value);
    return { error, released, left: store.size };
  };
  const down = await run(new tw.TwilioVerifyError(0, 0));
  assert.equal(down.error.statusCode, 503, "a provider outage is a 503");
  assert.deepEqual(down.released, ["RATE#ACCOUNT#u#HOUR#1", "RATE#PHONE10#p#1"], "an outage gives every counter back");
  assert.equal(down.left, 0, "and leaves no pending code behind");
  const crash = await run(new Error("socket hang up"));
  assert.equal(crash.error.code, "send_failed");
  assert.equal(crash.released.length, 2, "a network error gives the counters back too");
  const badNumber = await run(new tw.TwilioVerifyError(60200, 400));
  assert.equal(badNumber.error.code, "invalid_number");
  assert.deepEqual(badNumber.released, [], "an invalid number still counts (anti-abuse)");
  const tooMany = await run(new tw.TwilioVerifyError(60203, 429));
  assert.deepEqual(tooMany.released, [], "Twilio's own too-many-codes still counts");

  // ---- DynamoDB adapter: the keys it reserves are the keys it can release, never below zero ----
  const sent = [];
  class Command { constructor(input) { this.input = input; } }
  const db = { send: async command => { sent.push(command.input); return {}; } };
  const adapter = createPersonalPhoneDynamoAdapter({ db, tableName: "T", commands: { GetItemCommand: Command, TransactWriteItemsCommand: Command, UpdateItemCommand: Command }, now: () => Date.UTC(2026, 10, 20, 12) });
  const reserved = await adapter.reserveChallenge({ userId: "u", phoneHash: "p", challengeId: "c", deviceChallengeHash: "d", requestKey: "r", status: "pending", maskedNumber: "•••• 4567", expiresAt: 1, resendAfter: 1 });
  assert.equal(reserved.accepted, true);
  assert.ok(reserved.rateKeys.length >= 6 && reserved.rateKeys.every(key => key.startsWith("RATE#")), "every rate counter of the send is returned");
  sent.length = 0;
  await adapter.releaseRateCounters([...reserved.rateKeys, "ACCOUNT#u"]);
  assert.equal(sent.length, reserved.rateKeys.length, "only RATE# counters are touched");
  for (const update of sent) {
    assert.equal(update.UpdateExpression, "ADD #count :minus");
    assert.equal(update.ConditionExpression, "#count > :zero", "never below zero");
    assert.equal(update.ExpressionAttributeValues[":minus"].N, "-1");
  }
  console.log("SYNC send limits: our failures give the counters back; refusals about the number still count.");
})().catch(error => { console.error(error); process.exit(1); });
