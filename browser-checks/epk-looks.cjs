"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { chromium } = require("playwright");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.2:8022").replace(/\/$/, "");
const captureDir = path.resolve(process.env.DANZSTAK_CAPTURE_DIR || "docs/screenshots/epk-looks");
const looks = ["techno", "punk", "metal", "house"], widths = [390, 1366];

function kit(look) {
  const full = look !== "punk";
  return {
    artistName: look === "punk" ? "New Act" : "The Night Circuit",
    hometown: "Berlin, Germany", genres:[look === "house" ? "House / EDM" : look], look,
    shortPitch:"A focused live set built for independent rooms.",
    shortBio: full ? "The Night Circuit combines live electronics, drums and sharp visual production without losing the human performance." : "A new independent act building its first live set.",
    releases: full ? ["Signal Path — 12-inch — 2026", "After Voltage — EP — 2025"] : [],
    musicLinks: full ? [{label:"Listen on Bandcamp",url:"https://example.bandcamp.com/album/signal-path"}] : [],
    videoLinks: full ? [{label:"Live session",url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}] : [],
    notableShows: full ? ["Independent Hall, Berlin — 2026"] : [],
    pressQuotes: full ? [{quote:"A precise, physical live show.",source:"Independent Music Review",url:"https://example.com/review"}] : [],
    bookingName:"Tour Contact", bookingEmail:"booking@example.com", website:"https://example.com", media:[]
  };
}

(async () => {
  fs.mkdirSync(captureDir,{recursive:true});
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const look of looks) for (const width of widths) {
      const context = await browser.newContext({ viewport:{width,height:900}, serviceWorkers:"block" });
      const page = await context.newPage(), errors = [], externalFonts = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => { if (request.frame() === page.mainFrame() && /fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url()); });
      await page.route("https://api.danzstak.com/epk/public/**", route => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({kit:kit(look)}) }));
      await page.goto(`${baseUrl}/epk.html?id=visual-${look}`, { waitUntil:"networkidle" });
      await page.locator(`#epkPreview[data-look="${look}"]`).waitFor({state:"visible"});
      const state = await page.evaluate(() => {
        const preview=document.getElementById("epkPreview"), hero=preview.querySelector(".epk-hero"), style=getComputedStyle(preview), heroStyle=getComputedStyle(hero);
        const loadButton=preview.querySelector(".epk-player-load");
        return { scrollWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth, look:preview.dataset.look, ground:style.backgroundColor, ink:style.color, display:heroStyle.fontFamily, emptyNotes:preview.querySelectorAll(".empty-note").length, sections:preview.querySelectorAll(".epk-body>section").length, reviewsHidden:document.getElementById("epkReviews").hidden, iframeCount:preview.querySelectorAll("iframe").length, loadButtonCount:preview.querySelectorAll(".epk-player-load").length, loadButtonHeight:loadButton?.getBoundingClientRect().height || 0 };
      });
      assert.equal(errors.length,0,`${look} ${width}px browser errors: ${errors.join(" | ")}`);
      assert.equal(externalFonts.length,0,`${look} requested a third-party font`);
      assert.equal(state.look,look);
      assert.ok(state.scrollWidth<=width&&state.bodyWidth<=width,`${look} overflows at ${width}px: ${JSON.stringify(state)}`);
      assert.notEqual(state.ground,"rgba(0, 0, 0, 0)");
      assert.equal(state.emptyNotes,0,`${look} public page exposes an empty placeholder`);
      assert.ok(state.sections>=2,`${look} lost useful sparse content`);
      assert.equal(state.reviewsHidden,true,`${look} exposes optional review errors on the public EPK`);
      assert.equal(state.iframeCount,0,`${look} eagerly loads a third-party player before consent`);
      assert.equal(state.loadButtonCount,look === "punk" ? 0 : 1,`${look} has the wrong number of explicit player controls`);
      if (look !== "punk") assert.ok(state.loadButtonHeight>=44,`${look} player control is too small to tap`);
      await page.screenshot({ path:path.join(captureDir,`${look}-${width}.png`), fullPage:true });
      if (look === "techno" && width === 390) {
        await page.locator(".epk-player-load").click();
        await page.locator(".epk-media-card iframe").waitFor({state:"attached"});
        assert.equal(await page.locator("#epkPreview iframe").count(),1,"explicit activation must load exactly one player");
        await page.evaluate(() => Object.defineProperty(document,"hidden",{configurable:true,value:true}));
        await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
        assert.equal(await page.locator("#epkPreview iframe").count(),0,"hidden EPK pages must unload active players");
      }
      await context.close();
    }
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{width,height:900}, serviceWorkers:"block" });
      const page = await context.newPage(), errors=[];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/epk", route => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({kit:kit("house"),published:false,privateShared:false}) }));
      await page.goto(`${baseUrl}/epk.html`, {waitUntil:"networkidle"});
      await page.locator("#epkLook").waitFor({state:"visible"});
      const originalName = await page.locator("#artistName").inputValue();
      await page.locator("#epkLook").selectOption("punk");
      assert.equal(await page.locator("#artistName").inputValue(),originalName,"switching looks must not lose EPK content");
      assert.equal(await page.locator("#epkPreview").getAttribute("data-look"),"punk");
      assert.equal(errors.length,0,`builder ${width}px browser errors: ${errors.join(" | ")}`);
      const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth));
      assert.ok(overflow<=width,`builder overflows at ${width}px`);
      await page.screenshot({path:path.join(captureDir,`builder-${width}.png`),fullPage:true});
      await context.close();
    }
    console.log(`EPK look browser checks passed: ${looks.length * widths.length} public look/viewport combinations plus ${widths.length} builder views.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
