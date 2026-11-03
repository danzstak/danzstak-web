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
  records.set(`${userId}|booking-workspace-v1`, { userId: { S: userId }, tourId: { S: "booking-workspace-v1" }, plan: { S: JSON.stringify({ artist: { name: "Codex" }, venues: [{ venueKey: "venue-1", name: "Club Test", emails: ["bookings@example.com"] }] }) } });
  const number = (item, name) => Number(item[name]?.N || 0);
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof QueryCommand) return { Items: [] };
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
  const event = (id, message = "Please book this tested artist for the proposed date.") => ({ requestContext: { http: { method: "POST" } }, rawPath: "/tour-manager/emails/send", headers: { origin: "https://danzstak.com" }, body: JSON.stringify({ venueKey: "venue-1", to: "bookings@example.com", subject: "Codex booking request", message, idempotencyKey: id }) });
  let providerCalls = 0, fail = false;
  const service = createTourManagerBilling({ db, commands, authenticate: async () => userId, corsHeaders, tableName: "Tours", env: {}, sendBookingEmail: async () => { providerCalls += 1; if (fail) throw new Error("provider rejected"); return { messageId: "ses-message-1" }; } });
  const sent = await service(event("1234567890abcdef"));
  assert.equal(sent.statusCode, 200); assert.equal(providerCalls, 1); assert.equal(number(records.get(creditId), "credits"), 1); assert.equal(number(records.get(creditId), "sentEmails"), 1);
  const duplicate = await service(event("1234567890abcdef"));
  assert.equal(duplicate.statusCode, 200); assert.equal(providerCalls, 1, "A repeated send request must not call the provider twice");
  fail = true;
  const failed = await service(event("fedcba0987654321"));
  assert.equal(failed.statusCode, 502); assert.equal(number(records.get(creditId), "credits"), 1, "A provider failure must restore the reserved credit"); assert.equal(number(records.get(creditId), "reservedCredits"), 0);
  console.log("Tour Manager email-credit checks passed: saved-contact validation, reservation, provider acceptance, duplicate prevention, final deduction, and failed-send restoration.");
})().catch(error => { console.error(error); process.exit(1); });
