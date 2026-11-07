"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 390, 414, 430];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const ownerId = "11111111-1111-4111-8111-111111111111";
const friendId = "22222222-2222-4222-8222-222222222222";
const postId = "33333333-3333-4333-8333-333333333333";
const commentId = "44444444-4444-4444-8444-444444444444";

function fixture(url) {
  const path = url.pathname;
  if (path === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "test-artist@danzstak.invalid" } };
  if (path === "/profiles") return { profile: { memberId: ownerId, name: "DanzStak Test Artist", username: "testartist", bio: "Independent artist testing DanzStak.", picture: "" } };
  if (path === "/secure-posts") return { posts: [{
    postId,
    userId: ownerId,
    authorName: "DanzStak Test Artist",
    content: "A real populated post with enough text to verify wrapping, spacing, actions, media, and comments on narrow phones.",
    createdAt: "2026-11-04T20:00:00.000Z",
    audience: "public",
    isOwner: true,
    mediaType: "image",
    mediaUrl: "http://127.0.0.1:8016/assets/danzstak-share-fb-v2.jpg",
    viewCount: 27,
    commentPolicy: "everyone"
  }] };
  if (path === "/engagement") return {
    myReaction: "Love",
    reactionCounts: { Like: 3, Love: 2, Dislike: 1 },
    comments: [{
      commentId,
      authorMemberId: friendId,
      authorName: "Tour Friend",
      content: "This comment verifies the compact reply, reactions, and delete action row.",
      createdAt: "2026-11-04T20:05:00.000Z",
      canDelete: true,
      myReaction: "Like",
      reactionCounts: { Like: 2 },
      reactionTotal: 2,
      reactors: [{ memberId: ownerId, name: "DanzStak Test Artist", reaction: "Like", isFriend: true }]
    }]
  };
  if (path === "/stories") return { stories: [], reels: [] };
  if (path === "/friends") return { friends: [] };
  if (path === "/calls/directory" || path === "/people") return { users: [] };
  if (path === "/notifications" || path === "/engagement-notifications") return { notifications: [] };
  if (path === "/groups") return { groups: [] };
  if (path === "/news") return { articles: [] };
  if (path === "/conversations") return { conversations: [] };
  if (path === "/calls/devices") return { devices: [] };
  if (path === "/calls/inbox") return { events: [] };
  if (path === "/settings/presence") return { visible: true };
  if (path === "/settings/posts") return { hiddenPostIds: [] };
  if (path === "/profile-video") return { video: null };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url)) });
      });
      await page.goto("http://127.0.0.1:8016/feed.html?view=feed", { waitUntil: "domcontentloaded" });
      await page.locator(`.post[data-post-id="${postId}"]`).waitFor();
      await page.locator(`.post[data-post-id="${postId}"] .commentBtn`).click();
      await page.locator(`.comment[data-comment-id="${commentId}"]`).waitFor();
      await page.waitForTimeout(100);

      const geometry = await page.evaluate(({ postId, commentId }) => {
        const post = document.querySelector(`.post[data-post-id="${postId}"]`);
        const media = post.querySelector(".post-media");
        const actions = [...post.querySelectorAll(":scope > .post-actions > button")];
        const comment = post.querySelector(`.comment[data-comment-id="${commentId}"]`);
        const reply = comment.querySelector(".comment-reply-button");
        const remove = comment.querySelector(".deleteCommentBtn");
        const commentReactions = [...comment.querySelectorAll(".comment-reactions > button")];
        const postRect = post.getBoundingClientRect();
        const mediaRect = media.getBoundingClientRect();
        const actionRects = actions.map(button => button.getBoundingClientRect());
        const countOrder = actions.map(button => {
          const icon = button.querySelector(".reaction-icon")?.getBoundingClientRect();
          const count = button.querySelector(".reaction-count")?.getBoundingClientRect();
          return !icon || !count || count.left >= icon.right - 0.5;
        });
        const replyRect = reply.getBoundingClientRect();
        const removeRect = remove.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          post: { left: postRect.left, right: postRect.right },
          media: { left: mediaRect.left, right: mediaRect.right, width: mediaRect.width, naturalWidth: media.naturalWidth },
          actionCount: actions.length,
          actionTops: actionRects.map(rect => Math.round(rect.top)),
          countOrder,
          commentCountOrder: commentReactions.map(button => {
            const icon = button.querySelector(".reaction-icon")?.getBoundingClientRect();
            const count = button.querySelector(".reaction-count")?.getBoundingClientRect();
            return !icon || !count || (count.left >= icon.right - 0.5 && Math.abs((count.top + count.bottom) - (icon.top + icon.bottom)) <= 2);
          }),
          replyTop: Math.round(replyRect.top),
          removeTop: Math.round(removeRect.top),
          replyCenter: Math.round((replyRect.top + replyRect.bottom) * 2) / 4,
          removeCenter: Math.round((removeRect.top + removeRect.bottom) * 2) / 4,
          replyLeft: replyRect.left,
          removeRight: removeRect.right,
          commentRight: comment.getBoundingClientRect().right
        };
      }, { postId, commentId });

      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      assert.ok(geometry.documentWidth <= width && geometry.bodyWidth <= width, `${width}px populated feed overflows: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.media.naturalWidth > 0 && geometry.media.width > 0, `${width}px image did not render`);
      assert.ok(Math.abs(geometry.media.left - geometry.post.left) <= 1 && Math.abs(geometry.media.right - geometry.post.right) <= 1, `${width}px media is not aligned to the post edges: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.actionCount, 5, `${width}px must show five post actions on one row`);
      assert.equal(new Set(geometry.actionTops).size, 1, `${width}px post actions wrapped: ${JSON.stringify(geometry.actionTops)}`);
      assert.ok(geometry.countOrder.every(Boolean), `${width}px reaction counts are not immediately right of their icons`);
      assert.ok(geometry.commentCountOrder.every(Boolean), `${width}px comment reaction counts are not aligned to the right of their icons`);
      assert.ok(Math.abs(geometry.replyCenter - geometry.removeCenter) <= 1, `${width}px Reply and Delete are not vertically centered on the same row: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.removeRight <= geometry.commentRight + 1, `${width}px Delete escapes its comment`);
      assert.ok(geometry.removeRight - geometry.replyLeft > 100, `${width}px comment actions are not distributed across the row`);
      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.locator(`.post[data-post-id="${postId}"]`).screenshot({ path: path.join(captureDir, `populated-post-${width}.png`) });
      }
      await context.close();
    }
    console.log(`Populated feed mobile browser checks passed: ${widths.length} viewport widths.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
