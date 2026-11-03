"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const client = fs.readFileSync("assets/direct-messages.js", "utf8");
const styles = fs.readFileSync("assets/chat.css", "utf8");
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");

assert.match(client, /async function refreshDirectMessageMedia\(message\)/, "chat attachments need a signed-media refresh path");
assert.match(client, /&message=" \+ encodeURIComponent\(message\.messageId\)/, "the refresh request must target the exact durable message");
assert.match(client, /media\.addEventListener\("error"[\s\S]*message\.mediaUrl = ""; showRecovery\(\)/, "expired attachments must become a recovery card");
assert.match(client, /Retry media/, "the attachment recovery card needs a retry action");
assert.match(styles, /\.message-attachment-recovery\{/, "attachment recovery needs a compact visible treatment");
assert.match(template, /requestedMessage=String\(event\.queryStringParameters\?\.message\|\|''\)/, "the API should accept a specific message-media refresh request");
assert.match(template, /hiddenMessages\.has\(requestedMessage\)/, "hidden messages must not regain media access through refresh");
assert.match(template, /item\.senderEmail\.S!==user\.email&&item\.recipientEmail\.S!==user\.email/, "message media refresh must verify conversation membership");
assert.match(template, /mediaUrl:item\.mediaKey\?\.S\?signedMediaUrl\('GET',item\.mediaKey\.S,3600\):''/, "the API should return a fresh short-lived media URL");

console.log("Message media recovery checks passed.");
