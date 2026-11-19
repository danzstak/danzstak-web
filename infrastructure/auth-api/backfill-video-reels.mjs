#!/usr/bin/env node
// T0-A1 one-off backfill (owner session runs it once, after the Auth API with automatic Roll videos is deployed).
// Every video a member posted belongs in The Roll (owner 2026-11-18). Posts made before the fix only got `reel` when a
// box was ticked, so the owner's own video (posted as Eroticon) is in neither The Roll nor Dailies. This marks every
// existing video post as a Roll video. Facebook imports keep their history out of The Roll. Dailies are not
// backfilled: they only last 24 hours, so old posts are not put back into anyone's Dailies.
//
//   node infrastructure/auth-api/backfill-video-reels.mjs            # dry run: lists what would change, writes nothing
//   node infrastructure/auth-api/backfill-video-reels.mjs --apply    # sets reel = true on those posts
//
// Needs AWS credentials for us-west-1 with dynamodb:Scan and dynamodb:UpdateItem on DANZSTAK-Posts. Prints post ids and
// counts only, never member emails or content.
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const TABLE = process.env.DANZSTAK_POSTS_TABLE || "DANZSTAK-Posts";
const apply = process.argv.includes("--apply");
const db = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-1" });

export function needsReel(item) {
  return item?.mediaType?.S === "video" && item?.mediaKey?.S && item?.reel?.BOOL !== true && item?.importSource?.S !== "facebook" && !item?.sharedPostId?.S;
}

async function main() {
  let scanned = 0, changed = 0, ExclusiveStartKey;
  const pending = [];
  do {
    const page = await db.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey, ProjectionExpression: "postId, mediaType, mediaKey, reel, importSource, sharedPostId" }));
    for (const item of page.Items || []) { scanned++; if (needsReel(item)) pending.push(item.postId.S); }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  console.log(`${scanned} posts scanned, ${pending.length} video posts not yet in The Roll${apply ? "" : " (dry run: nothing written)"}`);
  for (const postId of pending) {
    if (!apply) { console.log(`would mark ${postId}`); continue; }
    await db.send(new UpdateItemCommand({
      TableName: TABLE, Key: { postId: { S: postId } },
      UpdateExpression: "SET reel = :yes", ConditionExpression: "attribute_exists(postId) AND mediaType = :video",
      ExpressionAttributeValues: { ":yes": { BOOL: true }, ":video": { S: "video" } }
    })).then(() => { changed++; console.log(`marked ${postId}`); }).catch(error => console.error(`skipped ${postId}: ${error.name}`));
  }
  if (apply) console.log(`${changed} of ${pending.length} video posts now in The Roll.`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("backfill-video-reels.mjs")) main().catch(error => { console.error(error.name || error); process.exitCode = 1; });
