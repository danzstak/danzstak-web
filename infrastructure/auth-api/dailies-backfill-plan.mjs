// Pure planning for backfill-dailies-from-posts.mjs (no AWS SDK, so the regression suite can test it anywhere).
import { randomUUID } from "node:crypto";
const DAY = 86400;

export function mediaPost(item) {
  return Boolean(item?.mediaKey?.S) && ["image", "video"].includes(item?.mediaType?.S) && !item?.sharedPostId?.S;
}
export function dailyFor(post, nowSeconds, storyId = randomUUID()) {
  const audience = post.groupId?.S ? "private" : (["public", "friends", "private"].includes(post.audience?.S) ? post.audience.S : "public");
  return {
    storyId: { S: storyId }, userEmail: { S: post.userEmail.S }, content: { S: String(post.content?.S || "").slice(0, 5000) || "Story" },
    audience: { S: audience }, mediaKey: { S: post.mediaKey.S }, mediaType: { S: post.mediaType.S }, postId: { S: post.postId.S },
    fromPost: { BOOL: true }, backfilled: { BOOL: true }, createdAt: { S: new Date(nowSeconds * 1000).toISOString() }, expiresAt: { N: String(nowSeconds + DAY) }
  };
}
export function plan(posts, stories, nowSeconds, onlyEmail = "") {
  const live = new Set(stories.filter(story => story.postId?.S && Number(story.expiresAt?.N || 0) > nowSeconds).map(story => story.postId.S));
  const media = posts.filter(mediaPost).filter(post => !onlyEmail || post.userEmail?.S?.toLowerCase() === onlyEmail);
  const dailies = media.filter(post => !live.has(post.postId.S));
  const reels = media.filter(post => post.mediaType.S === "video" && post.reel?.BOOL !== true);
  const takes = new Map();
  for (const post of media) if (post.mediaType.S === "video") takes.set(post.userEmail.S, (takes.get(post.userEmail.S) || 0) + 1);
  return { media, dailies, reels, takes };
}

