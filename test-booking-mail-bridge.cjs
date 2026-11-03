const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  process.env.TOURS_TABLE = "test-tours";
  process.env.INBOUND_BUCKET = "test-inbound";
  process.env.BOOKING_REPLY_DOMAIN = "reply.danzstak.com";
  process.env.PUSH_FUNCTION_NAME = "test-push-worker";
  const inbound = await import("./infrastructure/booking-mail-bridge/index.mjs");
  const chat = await import("./infrastructure/auth-api/booking-mail-chat.mjs");
  const token = "a".repeat(32), recipient = `reply+${token}@reply.danzstak.com`;
  assert.equal(inbound.inboundAlias([recipient]).token, token);
  assert.equal(inbound.inboundAlias(["reply+bad@example.com"]), null);
  assert.equal(inbound.acceptableVerdicts({ spamVerdict: { status: "PASS" }, virusVerdict: { status: "PASS" }, spfVerdict: { status: "FAIL" }, dkimVerdict: { status: "PASS" } }), true);
  assert.equal(inbound.acceptableVerdicts({ spamVerdict: { status: "FAIL" }, virusVerdict: { status: "PASS" }, dkimVerdict: { status: "PASS" } }), false);
  assert.deepEqual(inbound.confirmedAppointment("We are happy to confirm March 5, 2027 at 5 pm."), { status: "confirmed", date: "2027-03-05", time: "17:00" });
  assert.equal(inbound.confirmedAppointment("Maybe we can hold March 5, 2027.").status, "needs-clarification");
  assert.equal(chat.extractConfirmedAppointment("Locked in 2027-04-02 at 18:30").status, "confirmed");
  assert.equal(chat.bookingConversationId("artist-a", "club", "venue-a", "BOOKING@VENUE.TEST"), chat.bookingConversationId("artist-a", "club", "venue-a", "booking@venue.test"));

  const aliasHash = inbound.inboundAlias([recipient]).hash, writes = [], updates = [], invocations = [];
  const db = { send: async command => {
    const input = command.input;
    if (command.constructor.name === "GetItemCommand" && input.Key.userId.S === "BOOKING_MAIL_ALIAS") return { Item: { status: { S: "active" }, expectedSender: { S: "buyer@venue.test" }, ownerUserId: { S: "artist-user" }, conversationId: { S: "c".repeat(32) }, aliasHash: { S: aliasHash } } };
    if (command.constructor.name === "GetItemCommand") return {};
    if (command.constructor.name === "TransactWriteItemsCommand") { writes.push(input); return {}; }
    if (command.constructor.name === "UpdateItemCommand") { updates.push(input); return {}; }
    throw new Error(`Unexpected ${command.constructor.name}`);
  } };
  const storage = { send: async command => { assert.equal(command.input.Key, "booking-replies/ses-message-1"); return { Body: { transformToString: async () => "raw" } }; } };
  const notifier = { send: async command => { invocations.push(JSON.parse(Buffer.from(command.input.Payload).toString("utf8"))); return { StatusCode: 200, Payload: Buffer.from('{"delivered":1}') }; } };
  const event = { eventSource: "aws:ses", ses: { mail: { messageId: "ses-message-1", source: "buyer@venue.test", timestamp: "2027-03-01T10:00:00.000Z" }, receipt: { recipients: [recipient], spamVerdict: { status: "PASS" }, virusVerdict: { status: "PASS" }, spfVerdict: { status: "PASS" }, dkimVerdict: { status: "PASS" }, dmarcVerdict: { status: "PASS" } } } };
  const accepted = await inbound.processSesRecord(event, { db, s3: storage, lambda: notifier, parse: async () => ({ text: "Happy to confirm March 5, 2027 at 5 pm.", subject: "Re: show", messageId: "<external-1@venue.test>" }) });
  assert.deepEqual(accepted, { accepted: true, conversationId: "c".repeat(32), appointment: "confirmed" });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].TransactItems.length, 4);
  assert.equal(writes[0].TransactItems[2].Put.Item.body.S, "A booking contact replied in DanzStak Chat.");
  assert.equal(writes[0].TransactItems[2].Put.Item.body.S.includes("March"), false, "push must not expose message content");
  assert.deepEqual(invocations, [{ source: "danzstak.booking-mail", userId: "artist-user", conversationId: "c".repeat(32) }]);
  assert.equal(updates[0].Key.tourId.S, "BOOKING_PUSH#ses-message-1");

  const mismatch = structuredClone(event); mismatch.ses.mail.source = "attacker@example.test";
  assert.deepEqual(await inbound.processSesRecord(mismatch, { db, s3: storage, lambda: notifier, parse: async () => ({ text: "fake" }) }), { accepted: false, reason: "sender-mismatch" });
  const messagesPage = fs.readFileSync("messages.html", "utf8"), bookingClient = fs.readFileSync("assets/booking-chat.js", "utf8"), chatCss = fs.readFileSync("assets/chat.css", "utf8");
  assert.match(messagesPage, /assets\/booking-chat\.js/);
  assert.match(bookingClient, /booking-club/); assert.match(bookingClient, /booking-radio/); assert.match(bookingClient, /booking-record-store/);
  assert.match(bookingClient, /\/tour-manager\/booking-conversations/); assert.match(bookingClient, /\/tour-manager\/booking-messages/);
  assert.match(chatCss, /\.booking-chat-row/); assert.match(chatCss, /grid-template-columns:44px minmax\(0,1fr\) auto/);
  console.log("booking mail bridge tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
