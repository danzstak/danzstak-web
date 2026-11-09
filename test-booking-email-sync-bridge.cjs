"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const billing = fs.readFileSync("infrastructure/auth-api/tour-manager-billing.mjs", "utf8");
  const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  const inboundSource = fs.readFileSync("infrastructure/booking-inbound/index.mjs", "utf8");
  const inboundSetup = fs.readFileSync("aws-configure-booking-replies.ps1", "utf8");
  const inbound = await import("./infrastructure/booking-inbound/mime.mjs");

  assert.match(billing, /replyToken: \{ S: footerToken \}/, "the send record must retain its opaque reply route");
  assert.match(billing, /sendBookingEmail\(\{[^}]+replyToken: footerToken/s, "the mail adapter must receive the reply route");
  assert.match(billing, /sendBookingReply\(\{[^}]+replyToken: message\.replyToken/s, "SYNC replies must keep the same email thread route");
  assert.match(api, /via DanzStak.*<booking@danzstak\.com>/, "mail must use the artist display name through the verified DanzStak sender");
  assert.match(api, /@reply\.danzstak\.com/, "personal artist email must not be exposed as Reply-To");
  assert.doesNotMatch(api.slice(api.indexOf("sendBookingEmail:"), api.indexOf("const now =")), /accountForSub\(/, "booking email delivery must not expose the account mailbox");
  assert.match(inboundSource, /sender !== normalizeEmail\(source\.recipient/, "inbound mail must bind the sender to the original venue recipient");
  assert.match(inboundSource, /attribute_not_exists\(userId\)/, "provider retries must be idempotent");
  assert.match(inboundSource, /TOUR_MANAGER#BOOKING_REPLY#/, "accepted email must enter the existing private SYNC booking thread");
  assert.match(inboundSetup, /Recipients = @\("reply\.danzstak\.com"\)/, "the SES rule must be limited to the separate EPK reply subdomain");
  assert.match(inboundSetup, /ScanEnabled = \$true/, "SES spam and malware scanning must remain enabled for EPK replies");

  const plain = "Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nWe can host you March 5.=0AWhat fee do you need?";
  assert.equal(inbound.decodePart(plain), "We can host you March 5.\nWhat fee do you need?");
  const multipart = [
    'Content-Type: multipart/alternative; boundary="reply-boundary"',
    "",
    "This is a multi-part message in MIME format.",
    "--reply-boundary",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "Ci vediamo a Novara.=0ACompenso: =E2=82=AC500.",
    "--reply-boundary",
    "Content-Type: text/html; charset=UTF-8",
    "",
    "<p>Ci vediamo a Novara.</p>",
    "--reply-boundary--",
    ""
  ].join("\r\n");
  assert.equal(inbound.decodePart(multipart), "Ci vediamo a Novara.\nCompenso: €500.", "multipart preambles must not replace the venue reply and UTF-8 amounts must remain intact");
  const mixedWithTextAttachment = [
    'Content-Type: multipart/mixed; boundary="mixed-boundary"',
    "",
    "--mixed-boundary",
    'Content-Type: text/plain; name="notes.txt"',
    "Content-Disposition: attachment; filename=notes.txt",
    "",
    "private attachment text",
    "--mixed-boundary",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "The venue reply body.",
    "--mixed-boundary--",
    ""
  ].join("\r\n");
  assert.equal(inbound.decodePart(mixedWithTextAttachment), "The venue reply body.", "text attachments must not be mistaken for the venue reply");
  assert.equal(inbound.cleanReply("Sounds good.\n\nOn Nov 8, Artist wrote:\nold copy"), "Sounds good.");
  assert.equal(inbound.receiptIsSafe({ spamVerdict: { status: "PASS" }, virusVerdict: { status: "PASS" }, spfVerdict: { status: "PASS" }, dkimVerdict: { status: "PASS" } }), true);
  assert.equal(inbound.receiptIsSafe({ spamVerdict: { status: "PASS" }, virusVerdict: { status: "PASS" }, spfVerdict: { status: "GRAY" }, dkimVerdict: { status: "PASS" } }), true, "one verified sender-authentication path is sufficient");
  assert.equal(inbound.receiptIsSafe({ spamVerdict: { status: "GRAY" }, virusVerdict: { status: "PASS" }, spfVerdict: { status: "PASS" } }), false, "inconclusive spam scans must fail closed");
  assert.equal(inbound.receiptIsSafe({ spamVerdict: { status: "PASS" }, virusVerdict: { status: "GRAY" }, spfVerdict: { status: "PASS" } }), false, "inconclusive virus scans must fail closed");
  assert.equal(inbound.receiptIsSafe({ spamVerdict: { status: "PASS" }, virusVerdict: { status: "PROCESSING_FAILED" }, dkimVerdict: { status: "PASS" } }), false, "failed malware processing must fail closed");
  assert.equal(inbound.receiptIsSafe({ spamVerdict: { status: "PASS" }, virusVerdict: { status: "PASS" }, spfVerdict: { status: "GRAY" }, dkimVerdict: { status: "GRAY" } }), false, "mail without a passing authentication verdict must fail closed");
  assert.equal(inbound.receiptIsSafe({ spamVerdict: { status: "PASS" }, virusVerdict: { status: "PASS" }, dmarcVerdict: { status: "PASS" } }), true, "a passing DMARC verdict authenticates the sender");
  assert.equal(inbound.receiptIsSafe({ spamVerdict: { status: "FAIL" }, virusVerdict: { status: "PASS" }, spfVerdict: { status: "PASS" } }), false);
  assert.equal(inbound.receiptIsSafe({}), false, "missing scan verdicts must fail closed");

  console.log("Booking email-to-SYNC bridge checks passed: artist sender identity, private route, sender binding, fail-closed SES verdicts, multipart/UTF-8 MIME extraction and duplicate protection.");
})().catch(error => { console.error(error); process.exitCode = 1; });
