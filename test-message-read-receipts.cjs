"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const client = fs.readFileSync("assets/direct-messages.js", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");

assert.match(template, /contactReadAt=state\.Item\?\.contactReadAt\?\.S\|\|''/);
assert.match(template, /read:x\.senderEmail\.S===user\.email&&Boolean\(contactReadAt\)&&x\.createdAt\.S<=contactReadAt/);
assert.match(template, /Key:\{userEmail:\{S:contact\},contactEmail:\{S:user\.email\}\}/);
assert.match(template, /UpdateExpression:'SET contactReadAt = :r'/);
assert.match(client, /message\.read \? "✓✓" : "✓"/);
assert.match(client, /message\.read \? "Read" : "Delivered"/);
assert.match(css, /\.message-receipt\.is-read\{color:#1687d9\}/);

console.log("Message receipt checks passed: durable recipient reads, delivered/read ticks, and accessible status labels.");
