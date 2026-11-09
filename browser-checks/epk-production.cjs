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
const kit = actType => ({
  artistName:actType === "dj" ? "Signal Room" : "Night Circuit",
  hometown:"Berlin, Germany",
  actType,
  look:"techno",
  genres:[actType === "dj" ? "House / EDM" : "Rock"],
  shortPitch:"A focused live set ready for independent rooms.",
  shortBio:"Independent performers building high-energy rooms through original releases and a tightly rehearsed live show.",
  bio:"This controlled test biography verifies that a working public EPK can carry the longer artist story without hiding the booking essentials.",
  lineup:actType === "dj" ? ["Ari Vale — DJ and live electronics"] : ["Ari Vale — vocals", "Mika North — guitar", "Jo Lane — drums"],
  releases:["Open Circuit — EP — 2026", "Night Signal — single — 2025"],
  musicLinks:[
    {label:"Open Circuit on Bandcamp",url:"https://night-circuit.bandcamp.com/album/open-circuit"},
    {label:"Night Signal on Spotify",url:"https://open.spotify.com/track/5QTESTTRACK123"}
  ],
  videoLinks:[{label:"Live room session",url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}],
  socialLinks:[{label:"Official website",url:"https://artist.example/"}],
  notableShows:["Independent Room, Berlin — October 2026", "Warehouse Stage, Hamburg — June 2026"],
  achievements:["Independent radio session — 2026"],
  pressQuotes:[{quote:"A direct, carefully built live set.",source:"Test Press",url:"https://press.example/review"}],
  heroImage:"https://media.example/press-photo.svg",
  production,
  stageRequirements:"Clear performance area, safe power and a completed line check before doors.",
  techRequirements:"Venue supplies a working PA, console and qualified house technician.",
  bookingName:"Ari Vale",
  bookingEmail:"booking@artist.example",
  website:"https://artist.example/",
  publicDetails:{bookingEmail:true,bookingPhone:false,technical:true,hospitality:false},
  media:[]
});
const pressPhoto = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#ff5a1f"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><circle cx="600" cy="320" r="150" fill="#edecea" opacity=".9"/><path d="M260 800c30-240 180-360 340-360s310 120 340 360" fill="#09090b"/><g fill="#ffcc33"><rect x="90" y="100" width="18" height="400"/><rect x="1090" y="190" width="18" height="310"/></g></svg>`;

(async () => {
  fs.mkdirSync(captureDir,{recursive:true});
  const browser = await chromium.launch({channel:"msedge",headless:true});
  try {
    for (const actType of ["band","dj"]) for (const width of publicWidths) {
      const context = await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"}), page = await context.newPage(), errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      await page.route("https://media.example/press-photo.svg",route=>route.fulfill({status:200,contentType:"image/svg+xml",body:pressPhoto}));
      await page.route("https://www.youtube-nocookie.com/**",route=>route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><title>Controlled external player</title>"}));
      await page.route("https://api.danzstak.com/epk/public/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({kit:kit(actType)})}));
      await page.goto(`${baseUrl}/epk.html?id=production-${actType}`,{waitUntil:"networkidle"});
      const title=actType === "dj" ? "Booth plot and input list" : "Stage plot and input list";
      await page.getByRole("heading",{name:title}).waitFor();
      for (const sectionTitle of ["About","Full biography","Releases","Listen","Watch","Notable shows","Press","Booking"]) await page.getByRole("heading",{name:sectionTitle,exact:true}).waitFor();
      assert.equal(await page.locator(".epk-hero.has-image").count(),1,"the public EPK must render its authorized press image");
      assert.equal(await page.locator(".epk-media-card").count(),3,"music and video links must render as complete provider cards");
      assert.equal(await page.locator(".epk-provider-mark").count(),3,"every provider card needs a compact visual mark");
      assert.equal(await page.locator(".epk-plot-gear").count(),4);
      assert.equal(await page.locator(".epk-input-row").count(),4);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth),true,`${actType} public EPK overflowed at ${width}px`);
      assert.deepEqual(errors,[]);
      await page.screenshot({path:path.join(captureDir,`public-${actType}-${width}.png`),fullPage:true});
      await page.getByRole("button",{name:"Load Live room session from YouTube"}).click();
      const frame=page.locator(".epk-media-card iframe"); await frame.waitFor({state:"attached"});
      const frameLayout=await frame.evaluate(node=>{const frameRect=node.getBoundingClientRect(),cardRect=node.closest(".epk-media-card").getBoundingClientRect();return {inside:frameRect.left>=cardRect.left&&frameRect.right<=cardRect.right+0.5,width:frameRect.width,cardWidth:cardRect.width};});
      assert.equal(frameLayout.inside,true,"the explicit player must stay inside its media card");
      assert.ok(frameLayout.width>=frameLayout.cardWidth-30,"the explicit player must span the usable card width");
      await context.close();
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
