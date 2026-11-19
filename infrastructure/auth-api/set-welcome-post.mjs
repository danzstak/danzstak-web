#!/usr/bin/env node
// Directive F15b (owner 2026-11-19): "Lock this post to the top of the Mix until a few weeks after opening, also take out
// the part about groups and make it say Tribes, and take away the spacing to make it tighter." The owner runs this once
// in CloudShell. It finds the DanzStak welcome post, replaces its text with the tight version below (keeping the old
// text in the post's edit history, as an edit in the app would) and pins it to the top of Mix until 20 January 2027.
// It is the only thing that writes pinnedUntil: no API route accepts it, so members can't pin.
//
//   node infrastructure/auth-api/set-welcome-post.mjs                     # dry run: lists the welcome post(s), writes nothing
//   node infrastructure/auth-api/set-welcome-post.mjs --apply --post ID   # updates that one post
//
// Needs AWS credentials for us-west-1 with dynamodb:Scan and dynamodb:UpdateItem on DANZSTAK-Posts. Prints post ids,
// dates and the first words of the text only, never member emails.
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

export const WELCOME_TEXT = "Welcome to DanzStak! Connect with people, share your original photos, music videos and ideas, and build your scene. Start by finishing your profile, finding friends and joining a Tribe. What are you creating today?";
export const PINNED_UNTIL = "2027-01-20T00:00:00.000Z"; // about four weeks after doors open (23 Dec 2026)
export const isWelcomePost = item => /^\s*welcome to danzstak\b/i.test(item?.content?.S || "") && !item?.groupId?.S && !item?.sharedPostId?.S;

const TABLE = process.env.DANZSTAK_POSTS_TABLE || "DANZSTAK-Posts";

async function main() {
  const args = process.argv.slice(2), apply = args.includes("--apply"), postId = args[args.indexOf("--post") + 1] || "";
  const db = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-1" });
  const found = [];
  let ExclusiveStartKey;
  do {
    const page = await db.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey, ProjectionExpression: "postId, content, createdAt, groupId, sharedPostId, pinnedUntil, editHistory" }));
    for (const item of page.Items || []) if (isWelcomePost(item)) found.push(item);
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  for (const item of found) console.log(`welcome post ${item.postId.S} · ${item.createdAt?.S || "?"} · pinned until ${item.pinnedUntil?.S || "-"} · "${item.content.S.slice(0, 48)}…"`);
  if (!apply) { console.log(`${found.length} welcome post(s) found (dry run: nothing written). Run again with --apply --post <id>.`); return; }
  const target = found.find(item => item.postId.S === postId);
  if (!target) throw new Error("--post must name one of the welcome posts listed above.");
  const now = new Date().toISOString(), replacing = target.content.S !== WELCOME_TEXT;
  let history = [];
  try { history = JSON.parse(target.editHistory?.S || "[]"); } catch { history = []; }
  if (!Array.isArray(history)) history = [];
  // Same shape as an edit in the app (updateSecurePost): the old text goes into the JSON edit history, last 20 kept.
  if (replacing) history.push({ content: target.content.S, editedAt: now });
  await db.send(new UpdateItemCommand({
    TableName: TABLE, Key: { postId: { S: postId } }, ConditionExpression: "attribute_exists(postId)",
    UpdateExpression: replacing ? "SET #content = :text, editHistory = :history, pinnedUntil = :until, updatedAt = :now" : "SET pinnedUntil = :until, updatedAt = :now",
    ...(replacing ? { ExpressionAttributeNames: { "#content": "content" } } : {}),
    ExpressionAttributeValues: { ":until": { S: PINNED_UNTIL }, ":now": { S: now }, ...(replacing ? { ":text": { S: WELCOME_TEXT }, ":history": { S: JSON.stringify(history.slice(-20)) } } : {}) }
  }));
  console.log(`${postId}: ${replacing ? "text replaced and " : ""}pinned to the top of Mix until ${PINNED_UNTIL}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error.message || error.name); process.exitCode = 1; });
