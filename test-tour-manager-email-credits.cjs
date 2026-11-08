const assert = require("node:assert/strict");

(async () => {
  const { createTourManagerBilling, normalizedRecipientHash, recipientCooldownKey, MAX_NEW_PITCHES_PER_24_HOURS, BOOKING_CONTACT_COOLDOWN_SECONDS } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  assert.equal(MAX_NEW_PITCHES_PER_24_HOURS, 20);
  assert.equal(BOOKING_CONTACT_COOLDOWN_SECONDS, 30 * 24 * 60 * 60);
  assert.equal(normalizedRecipientHash(" Bookings@Example.com "), normalizedRecipientHash("bookings@example.com"), "Recipient hashing must normalize case and whitespace");
  assert.doesNotMatch(recipientCooldownKey("user_12345678", "bookings@example.com").tourId.S, /bookings|example/i, "Cooldown keys must not expose the recipient address");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  class UpdateItemCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand };
  const records = new Map(), keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const userId = "user_12345678", creditId = `${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`;
  records.set(creditId, { userId: { S: userId }, tourId: { S: "TOUR_MANAGER#BOOKING_EMAIL_CREDITS" }, credits: { N: "3" }, reservedCredits: { N: "0" }, sentEmails: { N: "0" } });
  records.set(`${userId}|TOUR_MANAGER#CONTACT_UNLOCK#venue-1`, { userId: { S: userId }, tourId: { S: "TOUR_MANAGER#CONTACT_UNLOCK#venue-1" }, venueKey: { S: "venue-1" }, status: { S: "active" } });
  records.set(`${userId}|booking-workspace-v1`, { userId: { S: userId }, tourId: { S: "booking-workspace-v1" }, plan: { S: JSON.stringify({ artist: { name: "Codex", epk: "https://danzstak.com/epk.html?id=codex" }, venues: [{ venueKey: "venue-1", name: "Club Test", emails: ["bookings@example.com"], booking: { followUp: "2026-11-07" } }] }) } });
  const number = (item, name) => Number(item[name]?.N || 0);
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof PutItemCommand) {
      const key = keyOf(command.input.Item);
      if (records.has(key)) { const error = new Error("condition"); error.name = "ConditionalCheckFailedException"; throw error; }
      records.set(key, structuredClone(command.input.Item)); return {};
    }
    if (command instanceof QueryCommand) {
      const prefix = command.input.ExpressionAttributeValues[":prefix"]?.S || "";
      return { Items: [...records.values()].filter(item => item.userId?.S === userId && item.tourId?.S?.startsWith(prefix)) };
    }
    if (command instanceof UpdateItemCommand) {
      const item = records.get(keyOf(command.input.Key));
      if (command.input.ExpressionAttributeValues[":reserved"]) {
        assert.equal(item.status.S, command.input.ExpressionAttributeValues[":reserved"].S);
        item.status = command.input.ExpressionAttributeValues[":sending"];
      } else {
        assert.equal(item.status.S, command.input.ExpressionAttributeValues[":sending"].S);
        item.status = command.input.ExpressionAttributeValues[":accepted"];
        item.providerMessageId = command.input.ExpressionAttributeValues[":messageId"];
      }
      return {};
    }
    if (command instanceof TransactWriteItemsCommand) {
      const tx = command.input.TransactItems;
      const reservationCredit = tx.find(item => item.Update?.Key.tourId.S === "TOUR_MANAGER#BOOKING_EMAIL_CREDITS" && item.Update?.UpdateExpression?.includes("reservedCredits :one"));
      if (reservationCredit) {
        for (const check of tx.filter(item => item.ConditionCheck)) if (records.has(keyOf(check.ConditionCheck.Key)) && check.ConditionCheck.ConditionExpression === "attribute_not_exists(userId)") { const error = new Error("condition"); error.name = "TransactionCanceledException"; throw error; }
        const credit = records.get(creditId), hourUpdate = tx.find(item => item.Update?.Key.tourId.S.startsWith("TOUR_MANAGER#OUTREACH_HOUR#")), cooldownPut = tx.find(item => item.Put?.Item.tourId.S.startsWith("TOUR_MANAGER#RECIPIENT_COOLDOWN#")), followUpUpdate = tx.find(item => item.Update?.UpdateExpression?.includes("followUpSendId")), sendPut = tx.find(item => item.Put?.Item.tourId.S.startsWith("TOUR_MANAGER#EMAIL_SEND#")), ledgerPut = tx.find(item => item.Put?.Item.tourId.S.startsWith("TOUR_MANAGER#LEDGER#"));
        const cooldown = cooldownPut && records.get(keyOf(cooldownPut.Put.Item)), now = Number(cooldownPut?.Put.ExpressionAttributeValues?.[":now"]?.N || 0), hour = hourUpdate && records.get(keyOf(hourUpdate.Update.Key)), allowance = Number(hourUpdate?.Update.ExpressionAttributeValues?.[":allowance"]?.N || 0);
        const source = followUpUpdate && records.get(keyOf(followUpUpdate.Update.Key));
        if (number(credit, "credits") < 1 || records.has(keyOf(sendPut.Put.Item)) || number(hour || {}, "sendCount") >= allowance || Number(cooldown?.nextAllowedAt?.N || 0) > now || followUpUpdate && (!source || source.followUpSendId || source.repliedAt || !["sent", "delivered"].includes(source.status?.S))) { const error = new Error("condition"); error.name = "TransactionCanceledException"; throw error; }
        credit.credits = { N: String(number(credit, "credits") - 1) };
        credit.reservedCredits = { N: String(number(credit, "reservedCredits") + 1) };
        const nextHour = hour || { ...hourUpdate.Update.Key };
        nextHour.sendCount = { N: String(number(nextHour, "sendCount") + 1) }; records.set(keyOf(hourUpdate.Update.Key), nextHour);
        if (cooldownPut) records.set(keyOf(cooldownPut.Put.Item), structuredClone(cooldownPut.Put.Item));
        if (followUpUpdate) { source.followUpSendId = structuredClone(followUpUpdate.Update.ExpressionAttributeValues[":sendId"]); source.followUpReservedAt = structuredClone(followUpUpdate.Update.ExpressionAttributeValues[":at"]); }
        records.set(keyOf(sendPut.Put.Item), structuredClone(sendPut.Put.Item)); records.set(keyOf(ledgerPut.Put.Item), structuredClone(ledgerPut.Put.Item)); return {};
      }
      const send = records.get(keyOf(tx[0].Update.Key)), credit = records.get(creditId), values = tx[0].Update.ExpressionAttributeValues;
      assert.equal(send.status.S, values[":accepted"] ? "provider_accepted" : "sending");
      send.status = values[":sent"] || values[":restored"];
      if (values[":messageId"]) send.providerMessageId = values[":messageId"];
      if (values[":sent"]) credit.sentEmails = { N: String(number(credit, "sentEmails") + 1) };
      else {
        credit.credits = { N: String(number(credit, "credits") + 1) };
        const hourUpdate = tx.find(item => item.Update?.Key.tourId.S.startsWith("TOUR_MANAGER#OUTREACH_HOUR#")), cooldownDelete = tx.find(item => item.Delete?.Key.tourId.S.startsWith("TOUR_MANAGER#RECIPIENT_COOLDOWN#")), followUpReset = tx.find(item => item.Update?.UpdateExpression?.startsWith("REMOVE followUpSendId"));
        const hour = records.get(keyOf(hourUpdate.Update.Key)); hour.sendCount = { N: String(number(hour, "sendCount") - 1) };
        if (cooldownDelete) records.delete(keyOf(cooldownDelete.Delete.Key));
        if (followUpReset) { const source = records.get(keyOf(followUpReset.Update.Key)); delete source.followUpSendId; delete source.followUpReservedAt; }
      }
      credit.reservedCredits = { N: String(number(credit, "reservedCredits") - 1) };
      const ledgerPut = tx.find(item => item.Put?.Item.tourId.S.startsWith("TOUR_MANAGER#LEDGER#")); records.set(keyOf(ledgerPut.Put.Item), structuredClone(ledgerPut.Put.Item)); return {};
    }
    throw new Error("Unexpected command");
  }};
  const corsHeaders = origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {};
  const privateEpk = "https://danzstak.com/epk.html?outreach=1234567890abcdef1234567890abcdef#token=" + "a".repeat(64);
  const event = (id, message = `Please book this tested artist for the proposed date. Private EPK: ${privateEpk}`, artistApproved = true, followUpTo = "") => ({ requestContext: { http: { method: "POST" } }, rawPath: "/tour-manager/emails/send", headers: { origin: "https://danzstak.com" }, body: JSON.stringify({ venueKey: "venue-1", to: "bookings@example.com", subject: "Codex booking request", message, template: "band", artistApproved, idempotencyKey: id, ...(followUpTo ? { followUpTo } : {}) }) });
  let providerCalls = 0, fail = false, currentTime = Date.parse("2026-11-07T12:00:00.000Z");
  const service = createTourManagerBilling({ db, commands, authenticate: async () => userId, corsHeaders, tableName: "Tours", env: {}, clock: () => currentTime, validateOutreachEpkLink: async ({ userId: owner, venueKey, outreachId, message }) => owner === userId && venueKey === "venue-1" && message.includes(privateEpk) && /^[a-zA-Z0-9_-]{16,100}$/.test(outreachId), sendBookingEmail: async () => { providerCalls += 1; if (fail) throw new Error("provider rejected"); return { messageId: "ses-message-1" }; } });
  const preflight = async (id, followUpTo = "") => {
    const result = await service({ requestContext: { http: { method: "POST" } }, rawPath: "/tour-manager/outreach/preflight", headers: { origin: "https://danzstak.com" }, body: JSON.stringify({ venueKey: "venue-1", to: "bookings@example.com", outreachId: id, ...(followUpTo ? { followUpTo } : {}) }) });
    return { result, footer: result.statusCode === 200 ? JSON.parse(result.body).footer : "" };
  };
  const reviewedMessage = footer => `Please book this tested artist for the proposed date. Private EPK: ${privateEpk}\n\n---\n${footer}`;
  const unapproved = await service(event("unapproved123456", undefined, false));
  assert.equal(unapproved.statusCode, 400); assert.equal(providerCalls, 0, "An unapproved draft must never reach the provider or reserve a credit");
  const unbound = await service(event("unboundshare12345", "Please book this artist. EPK: https://danzstak.com/epk.html?id=codex"));
  assert.equal(unbound.statusCode, 409); assert.equal(providerCalls, 0, "A public or unbound EPK link must not reach the provider"); assert.equal(number(records.get(creditId), "credits"), 3);
  const firstPreflight = await preflight("1234567890abcdef"); assert.equal(firstPreflight.result.statusCode, 200); assert.match(firstPreflight.footer, /2063 Main St\. #237/); assert.match(firstPreflight.footer, /booking-opt-out\.html#token=[a-f0-9]{64}/);
  const sent = await service(event("1234567890abcdef", reviewedMessage(firstPreflight.footer)));
  assert.equal(sent.statusCode, 200); assert.equal(providerCalls, 1); assert.equal(number(records.get(creditId), "credits"), 2); assert.equal(number(records.get(creditId), "sentEmails"), 1);
  const approvedRecord = records.get(`${userId}|TOUR_MANAGER#EMAIL_SEND#1234567890abcdef`);
  assert.equal(approvedRecord.template.S, "band"); assert.match(approvedRecord.message.S, /Private EPK: https:\/\/danzstak\.com\/epk\.html\?outreach=/); assert.ok(approvedRecord.artistApprovedAt.S, "The approved snapshot must include its approval time");
  const duplicate = await service(event("1234567890abcdef", reviewedMessage(firstPreflight.footer)));
  assert.equal(duplicate.statusCode, 200); assert.equal(providerCalls, 1, "A repeated send request must not call the provider twice");
  const contactCooldown = await preflight("newpitchsamecontact");
  assert.equal(contactCooldown.result.statusCode, 409); assert.equal(providerCalls, 1, "A second initial pitch to the same contact inside 30 days must be blocked before review"); assert.match(JSON.parse(contactCooldown.result.body).error, /30 days/i);
  const followUpPreflight = await preflight("followup123456789", "1234567890abcdef"); assert.equal(followUpPreflight.result.statusCode, 200, "One due follow-up may bypass the initial-pitch cooldown after server validation");
  const followedUp = await service(event("followup123456789", reviewedMessage(followUpPreflight.footer), true, "1234567890abcdef"));
  assert.equal(followedUp.statusCode, 200); assert.equal(providerCalls, 2); assert.equal(number(records.get(creditId), "credits"), 1); assert.equal(number(records.get(creditId), "sentEmails"), 2, "A successful follow-up consumes exactly one email credit");
  assert.equal(records.get(`${userId}|TOUR_MANAGER#EMAIL_SEND#followup123456789`).followUpTo.S, "1234567890abcdef");
  const secondFollowUp = await preflight("followupsecond123", "1234567890abcdef"); assert.equal(secondFollowUp.result.statusCode, 409); assert.match(JSON.parse(secondFollowUp.result.body).error, /one allowed follow-up/i);
  const history = await service({ requestContext: { http: { method: "GET" } }, rawPath: "/tour-manager/outreach", headers: { origin: "https://danzstak.com" } });
  assert.equal(history.statusCode, 200); assert.equal(JSON.parse(history.body).messages[0].status, "sent", "Accepted email must appear in outreach history");
  currentTime += 31 * 24 * 60 * 60 * 1000; fail = true;
  const failedPreflight = await preflight("fedcba0987654321"); assert.equal(failedPreflight.result.statusCode, 200);
  const failed = await service(event("fedcba0987654321", reviewedMessage(failedPreflight.footer)));
  assert.equal(failed.statusCode, 502); assert.equal(number(records.get(creditId), "credits"), 1, "A provider failure must restore the reserved credit"); assert.equal(number(records.get(creditId), "reservedCredits"), 0);
  const currentHour = Math.floor(currentTime / 3600000), capKey = `${userId}|TOUR_MANAGER#OUTREACH_HOUR#${String(currentHour).padStart(12, "0")}`, previousCapKey = `${userId}|TOUR_MANAGER#OUTREACH_HOUR#${String(currentHour - 12).padStart(12, "0")}`;
  records.set(capKey, { userId: { S: userId }, tourId: { S: capKey.split("|")[1] }, sendCount: { N: "1" } });
  records.set(previousCapKey, { userId: { S: userId }, tourId: { S: previousCapKey.split("|")[1] }, sendCount: { N: "19" } }); fail = false;
  const capped = await preflight("dailycapblocked12");
  assert.equal(capped.result.statusCode, 429); assert.equal(providerCalls, 3, "The 24-hour cap must block before review or provider submission");
  records.delete(previousCapKey); records.get(capKey).sendCount = { N: "0" };
  const optOutToken = firstPreflight.footer.match(/#token=([a-f0-9]{64})/)[1], optOut = await service({ requestContext: { http: { method: "POST" } }, rawPath: "/tour-manager/opt-out", headers: { origin: "https://danzstak.com" }, body: JSON.stringify({ token: optOutToken }) });
  assert.equal(optOut.statusCode, 200); assert.equal(JSON.parse(optOut.body).optedOut, true);
  const suppressed = await preflight("suppressedpitch1"); assert.equal(suppressed.result.statusCode, 409); assert.match(JSON.parse(suppressed.result.body).error, /opted out/i);
  records.delete(`${userId}|TOUR_MANAGER#CONTACT_UNLOCK#venue-1`);
  assert.equal((await service(event("contactlocked1234"))).statusCode, 402, "Sending must fail closed when the venue contact is locked");
  console.log("Tour Manager email-credit checks passed: contact entitlement, saved-contact validation, reservation, provider acceptance, idempotency, one approved follow-up, 30-day duplicate protection, 24-hour cap, final deduction, and failed-send restoration.");
})().catch(error => { console.error(error); process.exit(1); });
