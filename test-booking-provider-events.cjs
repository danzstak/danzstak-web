const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const { createTourManagerBilling, providerMessageKey, providerEventKey, normalizedRecipientHash } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  class UpdateItemCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand };
  const records = new Map(), keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const artistId = "artist_12345678", sendId = "provider-event-send-1", recipientHash = normalizedRecipientHash("venue@example.com"), providerId = "010201-test-provider-message";
  const mapping = { ...providerMessageKey(providerId), artistId: { S: artistId }, sendId: { S: sendId }, recipientHash: { S: recipientHash } };
  records.set(keyOf(mapping), mapping);
  const sendKey = `${artistId}|TOUR_MANAGER#EMAIL_SEND#${sendId}`;
  records.set(sendKey, { userId: { S: artistId }, tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${sendId}` }, status: { S: "sent" } });
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof TransactWriteItemsCommand) {
      const eventPut = command.input.TransactItems[0].Put, eventKey = keyOf(eventPut.Item);
      if (records.has(eventKey)) { const error = new Error("duplicate"); error.name = "TransactionCanceledException"; throw error; }
      records.set(eventKey, structuredClone(eventPut.Item));
      for (const operation of command.input.TransactItems.slice(1)) {
        if (operation.Update) {
          const item = records.get(keyOf(operation.Update.Key));
          item.status = operation.Update.ExpressionAttributeValues[":status"];
          item.providerEventAt = operation.Update.ExpressionAttributeValues[":at"];
        }
        if (operation.Put) records.set(keyOf(operation.Put.Item), structuredClone(operation.Put.Item));
      }
      return {};
    }
    throw new Error(`Unexpected command ${command.constructor.name}`);
  } };
  const service = createTourManagerBilling({ db, commands, authenticate: async () => "", corsHeaders: () => ({}), tableName: "Tours", env: {}, clock: () => Date.parse("2026-11-07T13:00:00Z") });
  const sns = (messageId, payload) => ({ Records: [{ EventSource: "aws:sns", Sns: { MessageId: messageId, Message: JSON.stringify(payload) } }] });
  const mail = { messageId: providerId, timestamp: "2026-11-07T13:00:00Z" };

  const delivered = await service(sns("sns-delivery-1", { eventType: "Delivery", mail, delivery: { timestamp: mail.timestamp } }));
  assert.deepEqual(delivered, { processed: 1, ignored: 0, duplicates: 0 });
  assert.equal(records.get(sendKey).status.S, "delivered");
  const duplicate = await service(sns("sns-delivery-1", { eventType: "Delivery", mail, delivery: { timestamp: mail.timestamp } }));
  assert.deepEqual(duplicate, { processed: 0, ignored: 0, duplicates: 1 });

  const transient = await service(sns("sns-transient-1", { eventType: "Bounce", mail, bounce: { bounceType: "Transient" } }));
  assert.deepEqual(transient, { processed: 0, ignored: 1, duplicates: 0 });
  const bounced = await service(sns("sns-bounce-1", { eventType: "Bounce", mail, bounce: { bounceType: "Permanent" } }));
  assert.deepEqual(bounced, { processed: 1, ignored: 0, duplicates: 0 });
  assert.equal(records.get(sendKey).status.S, "bounced");
  const suppression = records.get(`TOUR_MANAGER#GLOBAL_SUPPRESSION|${recipientHash}`);
  assert.equal(suppression.reason.S, "permanent_bounce");

  records.delete(`TOUR_MANAGER#GLOBAL_SUPPRESSION|${recipientHash}`);
  const complained = await service(sns("sns-complaint-1", { notificationType: "Complaint", mail, complaint: {} }));
  assert.deepEqual(complained, { processed: 1, ignored: 0, duplicates: 0 });
  assert.equal(records.get(sendKey).status.S, "complained");
  assert.equal(records.get(`TOUR_MANAGER#GLOBAL_SUPPRESSION|${recipientHash}`).reason.S, "provider_complaint");
  const taggedProviderId = "010201-tagged-provider-message", taggedSendId = "provider-tagged-send-2", taggedSendKey = `${artistId}|TOUR_MANAGER#EMAIL_SEND#${taggedSendId}`;
  records.set(taggedSendKey, { userId: { S: artistId }, tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${taggedSendId}` }, status: { S: "sent" } });
  const tagged = await service(sns("sns-tagged-delivery", { eventType: "Delivery", mail: { messageId: taggedProviderId, timestamp: mail.timestamp, tags: { DanzStakArtistId: [artistId], DanzStakSendId: [taggedSendId], DanzStakRecipientHash: [recipientHash] } }, delivery: {} }));
  assert.deepEqual(tagged, { processed: 1, ignored: 0, duplicates: 0 }, "SES tags must close the event-before-correlation-record race");
  assert.equal(records.get(taggedSendKey).status.S, "delivered");
  assert.doesNotMatch(providerMessageKey(providerId).tourId.S, /provider-message/);
  assert.equal(providerEventKey("sns-event").tourId.S.length, 64);

  const index = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8"), client = fs.readFileSync("assets/booking-selections.js", "utf8"), page = fs.readFileSync("booking-selections.html", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8");
  assert.match(index, /ConfigurationSetName: "DanzStakTourManager"/);
  assert.match(index, /Name: "DanzStakRecipientHash"/);
  assert.match(index, /EventSource === "aws:sns"/);
  assert.match(deploy, /DANZSTAK-TourManager-SES-Events/);
  assert.match(deploy, /MatchingEventTypes = @\("DELIVERY", "BOUNCE", "COMPLAINT"\)/);
  assert.match(deploy, /AllowTourManagerSesEvents/);
  assert.match(client, /Email delivered by the provider/);
  assert.match(client, /permanently bounced; this contact is now suppressed/);
  assert.match(client, /reported this email; this contact is now suppressed/);
  assert.match(page, /booking-selections\.js\?v=17/);
assert.match(worker, /danzstak-shell-v749/);
  console.log("Booking provider-event checks passed: delivery state, duplicate protection, permanent-bounce and complaint suppression, transient-bounce handling, private keys, and SES event infrastructure.");
})().catch(error => { console.error(error); process.exit(1); });
