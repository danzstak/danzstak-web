"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const page = fs.readFileSync("messages.html", "utf8");
const client = fs.readFileSync("assets/direct-messages.js", "utf8");
const styles = fs.readFileSync("assets/chat.css", "utf8");
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");

assert.match(page, /id="messageMedia"[^>]+accept="image\/jpeg,image\/png,image\/webp,image\/gif,video\/mp4,video\/webm,video\/quicktime"/);
assert.match(page, /media-src[^;]+danzstak-call-signaling-mediabucket/);
assert.match(client, /Standalone audio files are not supported/);
assert.match(client, /purpose: "message"/);
assert.match(client, /uploadSelectedMessageMedia/);
assert.match(client, /media\.className = "message-attachment"/);
assert.match(client, /\(!content && !selectedMessageMedia\)/);
assert.match(styles, /\.message-media-preview/);
assert.match(styles, /\.message-attachment/);

assert.match(template, /mediaPattern=new RegExp\(`\^messages\/\$\{ownerPrefix\(user\)\}/);
assert.match(template, /\['story','post','profile','message'\]/);
assert.match(template, /Invalid message attachment/);
assert.match(template, /Boolean\(mediaKey\)!==Boolean\(mediaType\)/);
assert.match(template, /mediaType:x\.mediaType\?\.S\|\|''/);
assert.match(template, /mediaUrl:x\.mediaKey\?\.S\?signedMediaUrl\('GET',x\.mediaKey\.S,3600\):''/);
assert.ok(template.indexOf("Invalid message attachment") < template.indexOf("mediaAttributes=mediaKey"), "Ownership must be checked before media is stored");

console.log("Message media checks passed: photo/video selection, upload, ownership validation, signed delivery, and no standalone audio.");
