"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.argv[2] || "http://127.0.0.1:8041";
const output = path.resolve("docs/screenshots/post-deletion-choice");
const ownerId = "11111111-1111-4111-8111-111111111111";
const postId = "33333333-3333-4333-8333-333333333333";
fs.mkdirSync(output, { recursive: true });

function responseFor(pathname) {
  if (pathname === "/auth/session") return { authenticated:true, user:{ sub:ownerId, email:"artist@danzstak.invalid" } };
  if (pathname === "/secure-posts") return { posts:[{ postId, userId:ownerId, isOwner:true, authorName:"Test Artist", content:"Creator-owned tour update", audience:"public", createdAt:"2026-11-07T10:00:00.000Z", commentPolicy:"everyone" }] };
  if (pathname === "/engagement") return { myReaction:"", reactionCounts:{}, comments:[] };
  if (pathname === "/profiles") return { profile:{ memberId:ownerId, name:"Test Artist", isOwner:true } };
  if (["/stories","/friends","/groups","/news","/notifications","/engagement-notifications","/people","/calls/directory"].includes(pathname)) return pathname === "/stories" ? { stories:[], reels:[] } : pathname === "/groups" ? { groups:[] } : pathname === "/friends" ? { friends:[] } : pathname === "/news" ? { articles:[] } : pathname === "/people" || pathname === "/calls/directory" ? { users:[] } : { notifications:[] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of [320,360,390,414,430,1366]) {
      const context = await browser.newContext({ viewport:{ width, height:900 }, serviceWorkers:"block", reducedMotion:"reduce" });
      const page = await context.newPage();
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), pathname = new URL(request.url()).pathname;
        if (pathname === `/secure-posts/${postId}` && request.method() === "DELETE") return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ removedFromHere:true }) });
        return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(responseFor(pathname)) });
      });
      await page.goto(`${origin}/feed.html?view=feed`, { waitUntil:"domcontentloaded" });
      const post = page.locator(`.post[data-post-id="${postId}"]`); await post.waitFor();
      await post.getByRole("button", { name:"Post options" }).click();
      const deleteOption = page.getByRole("menuitem", { name:"Delete post" });
      await deleteOption.waitFor();
      assert.equal((await deleteOption.innerText()).includes("Delete post"), true, `${width}px owner menu must visibly label the delete action`);
      await deleteOption.click();
      const dialog = page.locator(".danzstak-confirm-dialog"); await dialog.waitFor();
      if (await dialog.locator('button[value="remove_here"]').count() !== 1) throw new Error(`Unexpected deletion dialog: ${await dialog.innerHTML()}`);
      assert.equal(await dialog.locator('button[value="remove_here"]').count(), 1);
      assert.equal(await dialog.locator('button[value="delete_everywhere"]').count(), 1);
      assert.match(await dialog.locator("p").textContent(), /Screenshots or downloads made outside DanzStak cannot be recalled/);
      const geometry = await dialog.evaluate(node => ({ right:node.getBoundingClientRect().right, width:node.getBoundingClientRect().width, viewport:innerWidth, scrollWidth:document.documentElement.scrollWidth }));
      assert.ok(geometry.right <= geometry.viewport + 1 && geometry.width <= geometry.viewport, `${width}px dialog must fit the viewport`);
      assert.ok(geometry.scrollWidth <= geometry.viewport + 1, `${width}px page must not overflow`);
      await page.screenshot({ path:path.join(output, `delete-choice-${width}.png`), fullPage:false });
      await dialog.locator('button[value="remove_here"]').click();
      await context.close();
    }
    console.log("Post deletion choice browser checks passed at 320, 360, 390, 414, 430, and 1366px.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
