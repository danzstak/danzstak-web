const assert = require("node:assert/strict");

(async () => {
  const { createTourManagerBilling } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  class UpdateItemCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand };
  const records = new Map(), keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const userId = "user_12345678", creditId = `${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`;
  records.set(creditId, { userId: { S: userId }, tourId: { S: "TOUR_MANAGER#BOOKING_EMAIL_CREDITS" }, credits: { N: "2" }, reservedCredits: { N: "0" }, sentEmails: { N: "0" } });
  records.set(`${userId}|TOUR_MANAGER#CONTACT_UNLOCK#venue-1`, { userId: { S: userId }, tourId: { S: "TOUR_MANAGER#CONTACT_UNLOCK#venue-1" }, venueKey: { S: "venue-1" }, status: { S: "active" } });
  records.set(`${userId}|booking-workspace-v1`, { userId: { S: userId }, tourId: { S: "booking-workspace-v1" }, plan: { S: JSON.stringify({ artist: { name: "Codex", epk: "https://danzstak.com/epk.html?id=codex" }, venues: [{ venueKey: "venue-1", name: "Club Test", emails: ["bookings@example.com"] }] }) } });
  const number = (item, name) => Number(item[name]?.N || 0);
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
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
      if (tx[0].Update?.Key.tourId.S === "TOUR_MANAGER#BOOKING_EMAIL_CREDITS") {
        const credit = records.get(creditId);
        if (number(credit, "credits") < 1 || records.has(keyOf(tx[1].Put.Item))) { const error = new Error("condition"); error.name = "TransactionCanceledException"; throw error; }
        credit.credits = { N: String(number(credit, "credits") - 1) };
        credit.reservedCredits = { N: String(number(credit, "reservedCredits") + 1) };
        records.set(keyOf(tx[1].Put.Item), structuredClone(tx[1].Put.Item)); records.set(keyOf(tx[2].Put.Item), structuredClone(tx[2].Put.Item)); return {};
      }
      const send = records.get(keyOf(tx[0].Update.Key)), credit = records.get(creditId), values = tx[0].Update.ExpressionAttributeValues;
      assert.equal(send.status.S, values[":accepted"] ? "provider_accepted" : "sending");
      send.status = values[":sent"] || values[":restored"];
      if (values[":messageId"]) send.providerMessageId = values[":messageId"];
      if (values[":sent"]) credit.sentEmails = { N: String(number(credit, "sentEmails") + 1) };
      else credit.credits = { N: String(number(credit, "credits") + 1) };
      credit.reservedCredits = { N: String(number(credit, "reservedCredits") - 1) };
      records.set(keyOf(tx[2].Put.Item), structuredClone(tx[2].Put.Item)); return {};
    }
    throw new Error("Unexpected command");
  }};
  const corsHeaders = origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {};
  const privateEpk = "https://danzstak.com/epk.html?outreach=1234567890abcdef1234567890abcdef#token=" + "a".repeat(64);
  const event = (id, message = `Please book this tested artist for the proposed date. Private EPK: ${privateEpk}`, artistApproved = true) => ({ requestContext: { http: { method: "POST" } }, rawPath: "/tour-manager/emails/send", headers: { origin: "https://danzstak.com" }, body: JSON.stringify({ venueKey: "venue-1", to: "bookings@example.com", subject: "Codex booking request", message, template: "band", artistApproved, idempotencyKey: id }) });
  let providerCalls = 0, fail = false;
  const service = createTourManagerBilling({ db, commands, authenticate: async () => userId, corsHeaders, tableName: "Tours", env: {}, validateOutreachEpkLink: async ({ userId: owner, venueKey, outreachId, message }) => owner === userId && venueKey === "venue-1" && message.includes(privateEpk) && /^[a-zA-Z0-9_-]{16,100}$/.test(outreachId), sendBookingEmail: async () => { providerCalls += 1; if (fail) throw new Error("provider rejected"); return { messageId: "ses-message-1" }; } });
  const unapproved = await service(event("unapproved123456", undefined, false));
  assert.equal(unapproved.statusCode, 400); assert.equal(providerCalls, 0, "An unapproved draft must never reach the provider or reserve a credit");
  const unbound = await service(event("unboundshare12345", "Please book this artist. EPK: https://danzstak.com/epk.html?id=codex"));
  assert.equal(unbound.statusCode, 409); assert.equal(providerCalls, 0, "A public or unbound EPK link must not reach the provider"); assert.equal(number(records.get(creditId), "credits"), 2);
  const sent = await service(event("1234567890abcdef"));
  assert.equal(sent.statusCode, 200); assert.equal(providerCalls, 1); assert.equal(number(records.get(creditId), "credits"), 1); assert.equal(number(records.get(creditId), "sentEmails"), 1);
  const approvedRecord = records.get(`${userId}|TOUR_MANAGER#EMAIL_SEND#1234567890abcdef`);
  assert.equal(approvedRecord.template.S, "band"); assert.match(approvedRecord.message.S, /Private EPK: https:\/\/danzstak\.com\/epk\.html\?outreach=/); assert.ok(approvedRecord.artistApprovedAt.S, "The approved snapshot must include its approval time");
  const duplicate = await service(event("1234567890abcdef"));
  assert.equal(duplicate.statusCode, 200); assert.equal(providerCalls, 1, "A repeated send request must not call the provider twice");
  const history = await service({ requestContext: { http: { method: "GET" } }, rawPath: "/tour-manager/outreach", headers: { origin: "https://danzstak.com" } });
  assert.equal(history.statusCode, 200); assert.equal(JSON.parse(history.body).messages[0].status, "sent", "Accepted email must appear in outreach history");
  fail = true;
  const failed = await service(event("fedcba0987654321"));
  assert.equal(failed.statusCode, 502); assert.equal(number(records.get(creditId), "credits"), 1, "A provider failure must restore the reserved credit"); assert.equal(number(records.get(creditId), "reservedCredits"), 0);
  records.delete(`${userId}|TOUR_MANAGER#CONTACT_UNLOCK#venue-1`);
  assert.equal((await service(event("contactlocked1234"))).statusCode, 402, "Sending must fail closed when the venue contact is locked");
  console.log("Tour Manager email-credit checks passed: contact entitlement, saved-contact validation, reservation, provider acceptance, duplicate prevention, final deduction, and failed-send restoration.");
})().catch(error => { console.error(error); process.exit(1); });
