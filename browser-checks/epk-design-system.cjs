"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_EPK_ORIGIN || "http://127.0.0.1:8144";
const widths = [320, 390, 430, 1366];
const output = path.resolve("docs/screenshots/issue-55-epk");
fs.mkdirSync(output, { recursive: true });
const kit = {
  artistName:"Eroticon", hometown:"San Francisco, California", genres:["Punk", "Electronic"],
  shortPitch:"Raw electronics, live drums and a fast, physical set.",
  shortBio:"Eroticon combines punk urgency with hardware-driven electronic music.",
  bio:"Built in San Francisco's independent scene, Eroticon performs a direct live set for clubs, festivals and unconventional spaces.",
  lineup:["Sigmund — vocals and electronics", "Guest drummer — live drums"],
  releases:["West Coast Noise — LP — 2026"], notableShows:["Independent showcase — San Francisco — 2026"], achievements:[],
  musicLinks:[], videoLinks:[], socialLinks:[], media:[], pressQuotes:[], stageRequirements:"20-minute changeover", techRequirements:"Stereo DI and vocal microphone", hospitalityRequirements:"Water",
  bookingName:"Eroticon booking", bookingEmail:"booking@example.invalid", bookingPhone:"", website:"https://example.invalid",
  publicDetails:{bookingEmail:false,bookingPhone:false,technical:true,hospitality:false}
};

(async()=>{
  const browser=await chromium.launch({channel:"msedge",headless:true});
  try{
    for(const width of widths){
      const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:"block",reducedMotion:"reduce"});
      const page=await context.newPage(); const errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      await page.route("https://api.danzstak.com/**",async route=>{
        const url=new URL(route.request().url());
        if(url.pathname==="/epk" && route.request().method()==="GET") return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({kit,published:false,privateShared:false})});
        return route.fulfill({status:200,contentType:"application/json",body:"{}"});
      });
      await page.goto(`${origin}/epk.html`,{waitUntil:"domcontentloaded"});
      await page.locator("#artistName").waitFor();
      await page.waitForFunction(()=>document.querySelector("#artistName")?.value==="Eroticon");
      const geometry=await page.evaluate(()=>{
        const visibleTargets=[...document.querySelectorAll("button,.epk-step-nav a,.epk-preview-link,.epk-preview-heading a,summary,header a,.ds-mobile-nav a")].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
        const nav=document.querySelector(".epk-step-nav").getBoundingClientRect();
        const intro=document.querySelector(".intro").getBoundingClientRect();
        const preview=document.querySelector("#epkPreview").getBoundingClientRect();
        return {
          scrollWidth:document.documentElement.scrollWidth,
          minTouch:Math.min(...visibleTargets.map(r=>r.height)),
          introHeight:intro.height,
          navRight:nav.right,
          viewport:innerWidth,
          previewWidth:preview.width,
          openSteps:document.querySelectorAll(".epk-step[open]").length,
          stepCount:document.querySelectorAll(".epk-step").length,
          emoji:document.body.textContent.includes("🗑️"),
          artist:document.querySelector("#epkPreview .epk-hero h1")?.textContent
        };
      });
      assert.equal(errors.length,0,`${width}px errors: ${errors.join(" | ")}`);
      assert.ok(geometry.scrollWidth<=width,`${width}px horizontal overflow: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.stepCount,6);
      assert.equal(geometry.openSteps,1,"only the current EPK section should consume vertical space initially");
      assert.equal(geometry.emoji,false);
      assert.equal(geometry.artist,"Eroticon");
      assert.ok(geometry.introHeight<155,`${width}px intro is too tall: ${geometry.introHeight}`);
      assert.ok(geometry.previewWidth>0 && geometry.navRight<=geometry.viewport+1,`${width}px editor geometry failed: ${JSON.stringify(geometry)}`);
      if(width<=700) assert.ok(geometry.minTouch>=43.5,`${width}px target below 44px after browser rounding: ${geometry.minTouch}`);
      await page.screenshot({path:path.join(output,`epk-${width}.png`),fullPage:true});
      await page.locator("#epkStory > summary").click();
      assert.equal(await page.locator("#epkStory").evaluate(el=>el.open),true);
      await page.locator(".epk-preview-link").click();
      await page.waitForTimeout(80);
      assert.ok(await page.locator("#epkPreview").isVisible());
      await context.close();
    }
    console.log(`EPK visual checks passed at ${widths.join(", ")}px: compact sections, live preview, touch geometry and zero overflow.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
