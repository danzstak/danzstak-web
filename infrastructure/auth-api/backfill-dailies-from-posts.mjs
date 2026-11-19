#!/usr/bin/env node
// Owner 2026-11-19 (test request): "put every video and every image in Dailies and videos in The Roll so I can test the
// scroll" and "Dailies count says TAKE 0 when I have uploaded a few videos; it should be that number".
//
// For every photo/video post (not shared posts):
//   - adds a Daily made from the post (fromPost, same media, no second upload) that lasts 24 hours from now, unless that
//     post already has a live Daily;
//   - marks every video post as a Roll video (reel = true);
// and for every member sets the clapper's TAKE count (dailyTakeCount) to at least the number of videos they have posted.
// Re-running is safe: live Dailies are not duplicated and the count only ever goes up.
//
//   node infrastructure/auth-api/backfill-dailies-from-posts.mjs                 # dry run: counts only, writes nothing
//   node infrastructure/auth-api/backfill-dailies-from-posts.mjs --apply         # writes
//   ... --member-email someone@example.com                                        # only that member's posts
//
// Needs AWS credentials for us-west-1 with Scan/PutItem/UpdateItem on DANZSTAK-Posts, DANZSTAK-Stories and
// DanzStak-UserSettings. Prints counts and post ids only, never emails or post text.
import { plan, dailyFor } from "./dailies-backfill-plan.mjs";
import { DynamoDBClient, ScanCommand, PutItemCommand, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

const POSTS = process.env.DANZSTAK_POSTS_TABLE || "DANZSTAK-Posts";
const STORIES = process.env.DANZSTAK_STORIES_TABLE || "DANZSTAK-Stories";
const SETTINGS = process.env.DANZSTAK_SETTINGS_TABLE || "DanzStak-UserSettings";
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const onlyEmail = (argv[argv.indexOf("--member-email") + 1] || "").toLowerCase();

async function scanAll(db, TableName, ProjectionExpression, ExpressionAttributeNames) {
  const items = []; let ExclusiveStartKey;
  do {
    const page = await db.send(new ScanCommand({ TableName, ProjectionExpression, ExpressionAttributeNames, ExclusiveStartKey }));
    items.push(...(page.Items || [])); ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function main() {
  const db = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-1" });
  const now = Math.floor(Date.now() / 1000);
  const posts = await scanAll(db, POSTS, "postId, userEmail, content, audience, groupId, mediaKey, mediaType, reel, sharedPostId");
  const stories = await scanAll(db, STORIES, "storyId, postId, expiresAt");
  const { media, dailies, reels, takes } = plan(posts, stories, now, onlyEmail);
  console.log(`${posts.length} posts, ${media.length} with a photo or video: ${dailies.length} new Dailies (24 h), ${reels.length} videos to add to The Roll, TAKE counts for ${takes.size} member(s)${apply ? "" : " — dry run, nothing written"}`);
  if (!apply) return;
  let made = 0, rolled = 0, counted = 0;
  for (const post of dailies) {
    await db.send(new PutItemCommand({ TableName: STORIES, Item: dailyFor(post, now), ConditionExpression: "attribute_not_exists(storyId)" }))
      .then(() => { made++; }).catch(error => console.error(`Daily skipped for ${post.postId.S}: ${error.name}`));
  }
  for (const post of reels) {
    await db.send(new UpdateItemCommand({ TableName: POSTS, Key: { postId: post.postId }, UpdateExpression: "SET reel = :yes", ConditionExpression: "attribute_exists(postId) AND mediaType = :video", ExpressionAttributeValues: { ":yes": { BOOL: true }, ":video": { S: "video" } } }))
      .then(() => { rolled++; }).catch(error => console.error(`Roll skipped for ${post.postId.S}: ${error.name}`));
  }
  for (const [userEmail, videos] of takes) {
    const current = Number((await db.send(new GetItemCommand({ TableName: SETTINGS, Key: { userEmail: { S: userEmail } }, ConsistentRead: true }))).Item?.dailyTakeCount?.N || 0);
    if (current >= videos) continue;
    await db.send(new UpdateItemCommand({ TableName: SETTINGS, Key: { userEmail: { S: userEmail } }, UpdateExpression: "SET dailyTakeCount = :takes, dailyTakeUpdatedAt = :now", ConditionExpression: "attribute_not_exists(dailyTakeCount) OR dailyTakeCount < :takes", ExpressionAttributeValues: { ":takes": { N: String(videos) }, ":now": { S: new Date().toISOString() } } }))
      .then(() => { counted++; }).catch(error => console.error(`TAKE count skipped: ${error.name}`));
  }
  console.log(`Done: ${made} Dailies added, ${rolled} videos added to The Roll, ${counted} TAKE count(s) raised.`);
}

if (process.argv[1]?.endsWith("backfill-dailies-from-posts.mjs")) main().catch(error => { console.error(error.name || error); process.exitCode = 1; });
