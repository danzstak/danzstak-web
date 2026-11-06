"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const origin = process.env.DANZSTAK_RECORD_STORES_ORIGIN || "http://127.0.0.1:8024";
const widths = [320, 390, 430, 1366];
const output = path.resolve("docs/screenshots/issue-55-record-stores");
fs.mkdirSync(output, { recursive: true });
const stores = [
  { venueKey:"portland-1", name:"Mississippi Records", address:"5202 N Albina Ave, Portland, OR", websites:["https://mississippirecords.net"], emails:["records@example.invalid"], phones:["+1 503 555 0101"], position:[-122.674,45.56] },
  { venueKey:"portland-2", name:"Music Millennium", address:"3158 E Burnside St, Portland, OR", websites:["https://musicmillennium.com"], emails:[], phones:["+1 503 555 0102"], position:[-122.633,45.523] },
  { venueKey:"portland-3", name:"Tomorrow Records", address:"700 SE Hawthorne Blvd, Portland, OR", websites:[], emails:[], phones:[], position:[-122.658,45.512] }
];
(async()=>{
  const browser = await chromium.launch({channel:"msedge",headless:true});
  try {
    for(const width of widths){
      const context = await browser.newContext({viewport:{width,height:844},serviceWorkers:"block",reducedMotion:"reduce"});
      const page = await context.newPage(); const errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      await page.route("https://api.danzstak.com/**",async route=>{
        const url=new URL(route.request().url());
        const body=url.pathname==="/record-store-workspace"?{release:{artist:"Eroticon",title:"West Coast Noise",format:"LP"},stores:[],revision:"fixture"}:{stores,location:{label:"Portland, Oregon"},page:0,radiusMiles:30,hasMore:false,canExpand:true,providers:[]};
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
      });
      await page.goto(`${origin}/record-stores.html`,{waitUntil:"domcontentloaded"});
      await page.locator("#recordStoreLocation").fill("Portland, Oregon");
      await page.locator("#recordStoreForm button").click();
      await page.locator(".store-card").first().waitFor();
      await page.waitForTimeout(100);
      const geometry=await page.evaluate(()=>({
        scrollWidth:document.documentElement.scrollWidth,
        cardCount:document.querySelectorAll(".store-card").length,
        emoji:document.body.textContent.includes("💿"),
        heroHeight:document.querySelector(".hero").getBoundingClientRect().height,
        searchHeight:document.querySelector(".search-card").getBoundingClientRect().height,
        minTargets:Math.min(...[...document.querySelectorAll("button,.store-links a,.tool-header a")].map(el=>el.getBoundingClientRect().height).filter(height=>height>0)),
        columns:getComputedStyle(document.querySelector(".store-grid")).gridTemplateColumns.split(" ").length,
        cards:[...document.querySelectorAll(".store-card")].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};})
      }));
      assert.equal(errors.length,0,`${width}px errors: ${errors.join(" | ")}`);
      assert.ok(geometry.scrollWidth<=width,`${width}px horizontal overflow: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.cardCount,3); assert.equal(geometry.emoji,false);
      assert.ok(geometry.heroHeight<125 && geometry.searchHeight<210,`${width}px primary controls are too tall: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.minTargets>=44,`${width}px target below 44px: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.columns,width<=640?1:2,`${width}px unexpected card columns`);
      await page.screenshot({path:path.join(output,`record-stores-${width}.png`),fullPage:true});
      await context.close();
    }
    console.log(`Record Store visual checks passed at ${widths.join(", ")}px.`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
