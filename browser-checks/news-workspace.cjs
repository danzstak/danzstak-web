"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_NEWS_ORIGIN || "http://127.0.0.1:8146";
const widths = [320, 390, 430, 1366];
const output = path.resolve("docs/screenshots/issue-55-news");
fs.mkdirSync(output, { recursive:true });
const memberId = "11111111-1111-4111-8111-111111111111";

const newsItems = interest => [
  ...Array.from({ length:8 }, (_, index) => ({
    title:`${interest[0].toUpperCase()}${interest.slice(1)} verified headline ${index + 1}`,
    source:index % 2 ? "Independent Music Wire" : "Regional Arts Desk",
    url:`https://news.example.invalid/${interest}/${index + 1}?source=danzstak`
  })),
  { title:"Unsafe protocol", source:"Blocked", url:"javascript:alert(1)" },
  { title:"Credential URL", source:"Blocked", url:"https://user:pass@example.invalid/private" }
];

function fixture(url) {
  if (url.pathname === "/auth/session") return { authenticated:true, user:{ sub:memberId, email:"fixture@danzstak.invalid" } };
  if (url.pathname === "/profiles") return { profile:{ memberId, name:"Test Member", handle:"test-member", isOwner:true, cloudProfile:true } };
  if (url.pathname === "/news") return { items:newsItems(url.searchParams.get("interest") || "music") };
  if (url.pathname === "/secure-posts") return { posts:[] };
  if (url.pathname === "/stories") return { stories:[], reels:[] };
  if (url.pathname === "/friends") return { friends:[] };
  if (["/calls/directory","/people"].includes(url.pathname)) return { users:[] };
  if (["/notifications","/engagement-notifications"].includes(url.pathname)) return { notifications:[] };
  if (url.pathname === "/groups") return { groups:[] };
  if (url.pathname === "/settings/presence") return { visible:true };
  if (url.pathname === "/settings/posts") return { hiddenPostIds:[] };
  return {};
}

(async()=>{
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:844 }, serviceWorkers:"block", reducedMotion:"reduce" });
      const page = await context.newPage();
      const errors=[]; const requested=[];
      page.on("pageerror", error=>errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route=>{
        const url=new URL(route.request().url());
        if(url.pathname==="/news") requested.push(url.searchParams.get("interest"));
        return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(fixture(url)) });
      });
      await page.goto(`${origin}/feed.html?view=news`, { waitUntil:"domcontentloaded" });
      try { await page.locator(".news-workspace-list .news-card").first().waitFor({ timeout:10_000 }); }
      catch (error) {
        const state=await page.evaluate(()=>({href:location.href,workspace:document.querySelector("#featureView")?.dataset.workspaceName,featureHidden:document.querySelector("#featureView")?.hidden,featureText:document.querySelector("#featureView")?.textContent?.slice(0,500),body:document.body.textContent?.slice(0,500)}));
        throw new Error(`${width}px News did not render: ${JSON.stringify(state)}; page errors: ${errors.join(" | ")}; ${error.message}`);
      }

      const initial=await page.evaluate(()=>({
        width:document.documentElement.scrollWidth,
        workspace:document.querySelector("#featureView")?.dataset.workspaceName,
        cards:document.querySelectorAll(".news-workspace-list .news-card").length,
        tabs:document.querySelectorAll(".news-category-tab").length,
        selected:document.querySelector('.news-category-tab[aria-selected="true"]')?.textContent,
        links:[...document.querySelectorAll(".news-workspace-list .news-card")].map(link=>({href:link.href,rel:link.rel,referrer:link.referrerPolicy})),
        minTab:Math.min(...[...document.querySelectorAll(".news-category-tab")].map(tab=>tab.getBoundingClientRect().height))
      }));
      assert.equal(errors.length,0,`${width}px News errors: ${errors.join(" | ")}`);
      assert.ok(initial.width<=width,`${width}px News overflow: ${JSON.stringify(initial)}`);
      assert.equal(initial.workspace,"News");
      assert.equal(initial.cards,8,"unsafe provider URLs must not become cards");
      assert.equal(initial.tabs,6);
      assert.equal(initial.selected,"Music");
      assert.ok(initial.links.every(link=>link.href.startsWith("https://")&&/noopener/.test(link.rel)&&/noreferrer/.test(link.rel)&&link.referrer==="no-referrer"),"external News links must be isolated and safe");
      if(width<=700) assert.ok(initial.minTab>=43.5,`${width}px News topic target below 44px: ${initial.minTab}`);

      await page.getByRole("tab",{name:"Technology"}).click();
      await page.locator(".news-workspace-list").getByText("Technology verified headline 1",{exact:true}).waitFor();
      await page.getByRole("tab",{name:"Technology"}).press("ArrowRight");
      await page.locator(".news-workspace-list").getByText("Sports verified headline 1",{exact:true}).waitFor();
      assert.equal(await page.getByRole("tab",{name:"Sports"}).getAttribute("aria-selected"),"true");
      assert.ok(requested.includes("technology")&&requested.includes("sports"),`${width}px category requests missing: ${requested.join(",")}`);
      await page.screenshot({ path:path.join(output,`news-${width}.png`), fullPage:width>=700 });

      await page.reload({ waitUntil:"domcontentloaded" });
      await page.locator(".news-workspace-list").getByText("Sports verified headline 1",{exact:true}).waitFor();
      assert.equal(await page.getByRole("tab",{name:"Sports"}).getAttribute("aria-selected"),"true","selected topic must persist across refresh");

      if(width===1366){
        await page.goto(`${origin}/feed.html?view=feed`,{waitUntil:"domcontentloaded"});
        await page.locator("#interestNews .news-card").first().waitFor();
        assert.equal(await page.locator("#interestNews .news-card").count(),6,"desktop sidebar must preserve its compact six-headline view");
      }
      await context.close();
    }
    console.log(`News workspace browser checks passed at ${widths.join(", ")}px: real route, safe headlines, keyboard topics, persistence, touch geometry, and desktop sidebar.`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
