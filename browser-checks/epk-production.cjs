"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { chromium } = require("playwright");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.2:8023").replace(/\/$/, "");
const captureDir = path.resolve(process.env.DANZSTAK_CAPTURE_DIR || "docs/screenshots/epk-production");
const builderWidths = [320,360,390,414,430,1366], publicWidths = [390,1366];
const production = {
  plotItems:[
    {id:"drums",kind:"drum-kit",label:"Drums",position:"rear-center"},
    {id:"vocal",kind:"vocal-mic",label:"Lead vocal",position:"front-center"},
    {id:"guitar",kind:"amplifier",label:"Guitar amp",position:"rear-right"},
    {id:"monitor",kind:"monitor",label:"Vocal wedge",position:"front-center"}
  ],
  inputs:[
    {id:"one",source:"Lead vocal",connection:"mic",stand:"boom",phantom:false,notes:"SM58 or equivalent"},
    {id:"two",source:"Guitar",connection:"mic",stand:"short",phantom:false,notes:"House dynamic"},
    {id:"three",source:"Playback left/right",connection:"stereo-di",stand:"none",phantom:true,notes:"Artist interface"}
  ]
};
const kit = actType => ({ artistName:actType === "dj" ? "Signal Room" : "Night Circuit", hometown:"Berlin, Germany", actType, look:"techno", genres:[actType === "dj" ? "House / EDM" : "Rock"], shortPitch:"A focused live set ready for independent rooms.", production, techRequirements:"Venue supplies a working PA, console and qualified house technician.", publicDetails:{technical:true}, media:[] });

(async () => {
  fs.mkdirSync(captureDir,{recursive:true});
  const browser = await chromium.launch({channel:"msedge",headless:true});
  try {
    for (const actType of ["band","dj"]) for (const width of publicWidths) {
      const context = await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"}), page = await context.newPage(), errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      await page.route("https://api.danzstak.com/epk/public/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({kit:kit(actType)})}));
      await page.goto(`${baseUrl}/epk.html?id=production-${actType}`,{waitUntil:"networkidle"});
      const title=actType === "dj" ? "Booth plot and input list" : "Stage plot and input list";
      await page.getByRole("heading",{name:title}).waitFor();
      assert.equal(await page.locator(".epk-plot-gear").count(),4);
      assert.equal(await page.locator(".epk-input-row").count(),4);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth),true,`${actType} public EPK overflowed at ${width}px`);
      assert.deepEqual(errors,[]);
      await page.screenshot({path:path.join(captureDir,`public-${actType}-${width}.png`),fullPage:true}); await context.close();
    }
    for (const width of builderWidths) {
      const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"}),page=await context.newPage(),errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      await page.route("https://api.danzstak.com/epk",async route=>{ if(route.request().method()==="GET") return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({kit:kit("dj"),published:false,publicId:"signal-room"})}); return route.fulfill({status:200,contentType:"application/json",body:"{}"}); });
      await page.goto(`${baseUrl}/epk.html`,{waitUntil:"networkidle"});
      await page.locator("#productionTitle",{hasText:"Booth plot and input list"}).waitFor();
      await page.locator("#plotLabel").fill("Second monitor"); await page.locator("#plotKind").selectOption("monitor"); await page.locator("#plotPosition").selectOption("front-left"); await page.locator("#addPlotItem").click();
      await page.locator("#inputSource").fill("Talkback mic"); await page.locator("#inputConnection").selectOption("mic"); await page.locator("#inputStand").selectOption("straight"); await page.locator("#addInputItem").click();
      assert.equal(await page.locator("#plotItems .epk-production-item").count(),5); assert.equal(await page.locator("#inputItems .epk-production-item").count(),4);
      assert.equal(await page.locator("#epkPreview .epk-plot-gear").count(),5); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth),true,`builder overflowed at ${width}px`); assert.deepEqual(errors,[]);
      if ([390,1366].includes(width)) await page.screenshot({path:path.join(captureDir,`builder-${width}.png`),fullPage:true}); await context.close();
    }
    console.log("EPK production browser checks passed: band and DJ public plots plus builder interactions at six phone/desktop widths.");
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
