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
assert.match(template, /observedTakeCount=Math\.max\(0,Number\(dailySettings\.Item\?\.dailyTakeCount\?\.N\|\|0\)\)/,
  "GET /stories must read the durable creator Take count");
assert.match(template, /storedVideoCount=items\.filter\(item=>item\.userEmail\?\.S===user\.email&&item\.dedicated\?\.BOOL===true&&item\.mediaType\?\.S==='video'/,
  "GET /stories must count legacy dedicated Dailies videos owned by the current member");
assert.match(template, /dailyTakeCount=Math\.max\(observedTakeCount,storedVideoCount\)/,
  "legacy reconciliation must never lower a member's durable Take count");
assert.match(template, /ADD dailyTakeCount :difference[\s\S]*?dailyTakeCount = :observed/,
  "legacy reconciliation must add only the missing count behind an optimistic concurrency guard");
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
assert.match(art, /#storiesRail:not\(:has\(\.story\[data-story-id\]\)\) \.story-create-art \{[\s\S]*?position:absolute;[\s\S]*?inset:0;[\s\S]*?height:100%;/,
  "the Dailies artwork must fill the complete square without a dead label strip");
assert.match(art, /#storiesRail \.story-create-caption \{[\s\S]*?position:absolute;[\s\S]*?inset:6px 6px auto auto;/,
  "the Dailies label must overlay the image instead of consuming a separate row");
assert.match(art, /#storiesRail \.daily-clapper \{[\s\S]*?inset:auto auto 18px 18px;[\s\S]*?width:58px;/,
  "the compact Dailies clapper must sit over the profile picture's lower-left corner");

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

  const backfillLines = template.split("\n").filter(line => line.includes("const observedTakeCount=") || line.includes("if(dailyTakeCount>observedTakeCount)"));
  assert.equal(backfillLines.length, 2, "legacy Take reconciliation must remain executable as one guarded unit");
  async function reconcile(observedTakeCount, items, conditionalFailure = false) {
    class UpdateItemCommand { constructor(input) { this.input = input; } }
    const updates = [];
    const backfillContext = vm.createContext({
      process: { env: { SETTINGS_TABLE: "settings" } },
      user: { email: "creator@danzstak.invalid" },
      dailySettings: { Item: { dailyTakeCount: { N: String(observedTakeCount) } } },
      items,
      UpdateItemCommand,
      Date,
      db: { send: async command => {
        updates.push(command.input);
        if (conditionalFailure) throw Object.assign(new Error("raced"), { name: "ConditionalCheckFailedException" });
        return {};
      } }
    });
    const dailyTakeCount = await vm.runInContext(`(async()=>{${backfillLines.join("\n")} return dailyTakeCount;})()`, backfillContext);
    return { dailyTakeCount, updates };
  }
  const legacyItems = [
    ...Array.from({ length: 3 }, (_, index) => ({ storyId: { S: `video-${index}` }, userEmail: { S: "creator@danzstak.invalid" }, dedicated: { BOOL: true }, mediaType: { S: "video" } })),
    { storyId: { S: "photo" }, userEmail: { S: "creator@danzstak.invalid" }, dedicated: { BOOL: true }, mediaType: { S: "image" } },
    { storyId: { S: "other-video" }, userEmail: { S: "other@danzstak.invalid" }, dedicated: { BOOL: true }, mediaType: { S: "video" } }
  ];
  const backfilled = await reconcile(0, legacyItems);
  assert.equal(backfilled.dailyTakeCount, 3, "three existing creator videos must display TAKE 3");
  assert.equal(backfilled.updates[0].ExpressionAttributeValues[":difference"].N, "3", "the durable counter must add exactly the missing legacy videos");
  const durableWins = await reconcile(5, legacyItems);
  assert.equal(durableWins.dailyTakeCount, 5, "expiry or deletion must never lower the lifetime Take number");
  assert.equal(durableWins.updates.length, 0, "a larger durable counter must not be rewritten");
  const raced = await reconcile(0, legacyItems, true);
  assert.equal(raced.dailyTakeCount, 3, "a concurrent upload must not break the current clapper response");
  console.log("Dailies clapper checks passed: date, Scene 1, durable video-only Take count, and legacy video backfill.");
})().catch(error => { console.error(error); process.exitCode = 1; });
