"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 390, 430, 1024];
const ownerId = "11111111-1111-4111-8111-111111111111";
const sharerId = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";
const shareId = "44444444-4444-4444-8444-444444444444";
const output = path.resolve("docs/screenshots/issue-40-content-ownership");
const baseUrl = String(process.env.DANZSTAK_BROWSER_BASE_URL || "http://127.0.0.1:8188").replace(/\/$/, "");
fs.mkdirSync(output, { recursive: true });

function fixture(url) {
  const pathname = url.pathname;
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "owner@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: { memberId: ownerId, name: "Creator Test", username: "creator", handle: "creator" } };
  if (pathname === "/secure-posts") return { posts: [
    {
      postId: sourceId, userId: ownerId, authorName: "Creator Test", content: "Original recording that must disappear globally.",
      createdAt: "2026-11-06T10:00:00.000Z", audience: "public", isOwner: true, mediaType: "image",
      mediaUrl: `${baseUrl}/assets/danzstak-share-fb-v2.jpg`, commentPolicy: "everyone"
    },
    {
      postId: shareId, userId: sharerId, authorName: "Tour Friend", content: "My own caption stays after the creator withdraws the original.",
      createdAt: "2026-11-06T10:05:00.000Z", audience: "public", isOwner: false, sharedPostId: sourceId,
      sharedPost: { postId: sourceId, userId: ownerId, authorName: "Creator Test", content: "Original recording that must disappear globally.", mediaType: "image", mediaUrl: `${baseUrl}/assets/danzstak-share-fb-v2.jpg` },
      commentPolicy: "everyone"
    }
  ] };
  if (["/stories", "/friends", "/calls/directory", "/people", "/notifications", "/engagement-notifications", "/groups", "/news", "/conversations", "/calls/devices", "/calls/inbox"].includes(pathname)) return pathname === "/stories" ? { stories: [], reels: [] } : { users: [], friends: [], notifications: [], groups: [], articles: [], conversations: [], devices: [], events: [] };
  if (pathname === "/settings/presence") return { visible: true };
  if (pathname === "/settings/posts") return { hiddenPostIds: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        requests.push(new URL(route.request().url()).pathname);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) });
      });
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      const source = page.locator(`.post[data-post-id="${sourceId}"]`);
      const share = page.locator(`.post[data-post-id="${shareId}"]`);
      await source.waitFor({ timeout: 10000 }).catch(error => { throw new Error(`${error.message}; requests=${requests.join(",")}; errors=${errors.join(" | ")}`); });
      await share.waitFor();
      assert.equal(await source.getAttribute("data-is-owner"), "true", `${width}px source owner flag is missing`);
      assert.ok([null, ""].includes(await source.getAttribute("data-shared-post-id")), `${width}px original was misclassified as a share`);
      await source.locator(".post-menu-toggle").click();
      await source.getByRole("menuitem", { name: "Delete post" }).click();
      const choice = page.locator(".choice-action-dialog");
      await page.waitForTimeout(100);
      const debug = await page.evaluate(id => {
        const post = document.querySelector(`.post[data-post-id="${id}"]`);
        return { isOwner: post?.dataset.isOwner, sharedPostId: post?.dataset.sharedPostId, dialogs: [...document.querySelectorAll("dialog")].map(item => ({ className: item.className, text: item.textContent, open: item.open })), feedback: document.querySelector(".app-feedback")?.textContent || "" };
      }, sourceId);
      assert.equal(await choice.count(), 1, `${width}px removal choice did not open: ${JSON.stringify(debug)}; browser errors: ${errors.join(" | ")}`);
      const choiceResult = await choice.evaluate(dialog => ({
        title: dialog.querySelector("h2")?.textContent,
        text: dialog.textContent,
        sizes: [...dialog.querySelectorAll(".choice-action-button")].map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
        overflow: dialog.scrollWidth > dialog.clientWidth + 1
      }));
      assert.equal(choiceResult.title, "Remove your content");
      assert.match(choiceResult.text, /Only this placement disappears/);
      assert.match(choiceResult.text, /Withdraw the original from all DanzStak locations and shares/);
      assert.ok(choiceResult.sizes.every(size => size.height >= 44 && size.width >= 44), `${width}px choices are not touch usable: ${JSON.stringify(choiceResult.sizes)}`);
      assert.equal(choiceResult.overflow, false, `${width}px choice dialog overflows`);
      await choice.getByRole("button", { name: /Delete everywhere/ }).click();
      const confirm = page.locator("dialog").filter({ hasText: "Delete everywhere?" });
      await confirm.waitFor();
      const warning = await confirm.textContent();
      assert.match(warning, /captions may remain/i);
      assert.match(warning, /Downloads, screenshots, external shares, or unrelated reuploads cannot be erased/i);
      await confirm.getByRole("button", { name: "Delete everywhere" }).click();
      await source.waitFor({ state: "detached" });
      const result = await share.evaluate(article => ({
        html: article.innerHTML,
        caption: article.querySelector(".post-content")?.textContent || "",
        tombstone: article.querySelector(".shared-post-card")?.textContent || "",
        removedClass: article.querySelector(".shared-post-card")?.classList.contains("is-original-removed"),
        leakedMedia: Boolean(article.querySelector(".shared-post-card img, .shared-post-card video, .shared-post-card iframe")),
        leakedOriginal: (article.querySelector(".shared-post-card")?.textContent || "").includes("Original recording"),
        documentWidth: document.documentElement.scrollWidth
      }));
      assert.match(result.caption, /My own caption stays/);
      assert.equal(result.tombstone.trim(), "Original content removed by its creator.", result.html);
      assert.equal(result.removedClass, true);
      assert.equal(result.leakedMedia, false);
      assert.equal(result.leakedOriginal, false);
      assert.ok(result.documentWidth <= width, `${width}px ownership UI overflows: ${result.documentWidth}`);
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      await page.screenshot({ path: path.join(output, `creator-withdrawal-${width}.png`), fullPage: true });
      await context.close();
    }
    console.log(`Creator content ownership browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
