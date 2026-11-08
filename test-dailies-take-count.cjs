"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const art = fs.readFileSync("assets/danzstak-original-feed.css", "utf8");

assert.match(template, /TransactWriteItemsCommand\(\{TransactItems:\[\{Put:\{TableName:process\.env\.STORIES_TABLE/,
  "publishing a Daily must save the media record and advance its Take counter atomically");
assert.match(template, /ADD dailyTakeCount :one/,
  "the creator's durable Dailies Take counter must advance after a successful publish");
assert.match(template, /mediaType==='video'\?\[\{Update:/,
  "photos must not advance the Dailies video Take counter");
assert.match(template, /dailyTakeCount=Math\.max\(0,Number\(dailySettings\.Item\?\.dailyTakeCount\?\.N\|\|0\)\)/,
  "GET /stories must return the durable creator Take count");
assert.match(feed, /data\.dailyTakeCount/,
  "the clapper must use the server's durable Take count");
assert.doesNotMatch(feed, /filter\(story => story\.isOwner && story\.mediaType === "video"\)\.length/,
  "the clapper must not fall back to counting only unexpired visible videos");
assert.match(feed, /SCENE 1<\/strong><small>TAKE 0/,
  "the Dailies creator tile must contain a Scene 1 / Take clapper");
assert.match(feed, /formatDailyDate\(now\)/,
  "the creator clapper must show today's date");
assert.doesNotMatch(art, /daily-clapper \{display:none!important\}/,
  "the creator clapper must remain visible on an empty Dailies rail");
assert.match(art, /#storiesRail \.story-create-identity \{[\s\S]*?inset:0;[\s\S]*?width:100%;[\s\S]*?height:100%;/,
  "the creator profile image must fill the Dailies artwork instead of floating as a small portrait");
assert.match(art, /#storiesRail \.daily-clapper \{[\s\S]*?inset:auto auto 5px 6px;/,
  "the compact Dailies clapper must stay over the lower-left corner of the artwork");

const createStoryLine = template.split("\n").find(line => line.includes("async function createStory("));
class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
const transactions = [];
const context = vm.createContext({
  process: { env: { STORIES_TABLE: "stories", SETTINGS_TABLE: "settings", MEDIA_BUCKET: "media" } },
  ownerPrefix: () => "a".repeat(24),
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
  now: () => 200000,
  signedMediaUrl: () => "https://media.test/daily",
  json: (statusCode, payload) => ({ statusCode, ...payload }),
  db: { send: async command => { transactions.push(command.input); return {}; } },
  TransactWriteItemsCommand,
  URL
});
vm.runInContext(createStoryLine.trim(), context);

(async () => {
  const publish = mediaType => context.createStory({ body: JSON.stringify({
    mediaKey: `stories/${"a".repeat(24)}/11111111-1111-4111-8111-111111111111.${mediaType === "video" ? "mp4" : "jpg"}`,
    mediaType,
    dedicatedMedia: true,
    originalContentCertified: true
  }) }, { email: "creator@danzstak.invalid" });
  await publish("video");
  assert.equal(transactions.at(-1).TransactItems.length, 2, "a successful Dailies video must atomically advance Take N");
  assert.equal(transactions.at(-1).TransactItems[1].Update.TableName, "settings");
  await publish("image");
  assert.equal(transactions.at(-1).TransactItems.length, 1, "a Dailies photo must not advance the video Take counter");
  console.log("Dailies clapper checks passed: date, Scene 1, and durable video-only Take count.");
})().catch(error => { console.error(error); process.exitCode = 1; });
