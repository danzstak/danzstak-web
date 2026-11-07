"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { chromium } = require("playwright");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.2:8023").replace(/\/$/, "");
const outputDir = path.resolve(process.env.DANZSTAK_PDF_DIR || "tmp/pdfs");
const repeat = (prefix,count) => Array.from({length:count},(_,index)=>`${prefix} ${index + 1} - verified public detail`);
const kit = {
  artistName:"Night Circuit", hometown:"Berlin, Germany", actType:"band", look:"techno", genres:["Techno","Electronic"],
  shortPitch:"A hardware-driven live set built for independent rooms and late-night dance floors.",
  shortBio:"Night Circuit is a Berlin electronic act performing an all-hardware set that moves between machine funk, electro and direct club music. The show is compact, tour-ready and adaptable to independent venues.",
  bio:repeat("Full biography paragraph",12).join(" "), lineup:repeat("Member",6), releases:repeat("Release",20), notableShows:repeat("Show",14), achievements:repeat("Documented milestone",10),
  musicLinks:[{label:"Latest release",url:"https://example.com/music"},{label:"Live session",url:"https://example.com/session"},{label:"Catalog",url:"https://example.com/catalog"}],
  videoLinks:[{label:"Full live set",url:"https://example.com/live"},{label:"Studio performance",url:"https://example.com/studio"},{label:"Festival set",url:"https://example.com/festival"}],
  pressQuotes:Array.from({length:8},(_,index)=>({quote:`A precise and energetic live set ${index + 1}.`,source:`Independent Review ${index + 1}`,url:"https://example.com/review"})),
  stageRequirements:"Clear performance area, safe power, house PA and a 20-minute changeover.", techRequirements:"Two monitor mixes and qualified house technician.", hospitalityRequirements:"Water and a secure equipment area.",
  bookingName:"Booking Team", bookingEmail:"booking@example.com", bookingPhone:"+1 555 010 2026", website:"https://example.com",
  publicDetails:{bookingEmail:true,bookingPhone:true,technical:true,hospitality:true}, production:{plotItems:[{id:"a",kind:"dj-mixer",label:"Artist mixer",position:"front-center"}],inputs:[{id:"b",source:"Stereo playback",connection:"stereo-di",stand:"none",phantom:false,notes:"Artist interface"}]}, media:[]
};
const pageCount = bytes => (bytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;

(async () => {
  fs.mkdirSync(outputDir,{recursive:true});
  const browser = await chromium.launch({channel:"msedge",headless:true});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"}), page = await context.newPage();
    const errors=[]; page.on("pageerror",error=>errors.push(error.message));
    await page.route("https://api.danzstak.com/epk/public/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({kit})}));
    await page.goto(`${baseUrl}/epk.html?id=press-pdf`,{waitUntil:"networkidle"});
    await page.getByRole("button",{name:"One-page press PDF"}).waitFor();
    await page.evaluate(()=>{window.print=()=>{document.body.dataset.printCalled="yes";};});
    await page.getByRole("button",{name:"One-page press PDF"}).click();
    await page.waitForFunction(()=>document.body.dataset.printCalled === "yes");
    assert.equal(await page.evaluate(()=>document.body.dataset.epkPrint),"one-page");
    await page.emulateMedia({media:"print"});
    const onePagePath=path.join(outputDir,"epk-one-page.pdf");
    await page.pdf({path:onePagePath,format:"Letter",printBackground:true,preferCSSPageSize:true});
    assert.equal(pageCount(fs.readFileSync(onePagePath)),1,"the summary press PDF must remain one page with veteran-level content");
    await page.evaluate(()=>{document.body.dataset.epkPrint="full";});
    const fullPath=path.join(outputDir,"epk-full.pdf");
    await page.pdf({path:fullPath,format:"Letter",printBackground:true,preferCSSPageSize:true});
    assert.ok(pageCount(fs.readFileSync(fullPath)) > 1,"the full press PDF must preserve extended content across pages");
    assert.equal(errors.length,0,errors.join("\n"));
    await context.close();

    const privateContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"}), privatePage=await privateContext.newPage();
    await privatePage.route("https://api.danzstak.com/epk/outreach/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({kit,bookingShare:true,permissions:{allowPdf:false},disclosure:"Private booking EPK."})}));
    await privatePage.goto(`${baseUrl}/epk.html?outreach=private#token=test`,{waitUntil:"networkidle"});
    assert.equal(await privatePage.locator(".epk-pdf-action:visible").count(),0,"a private venue link without PDF permission must hide both exports");
    await privateContext.close();
    console.log(`EPK PDF browser checks passed: one-page=${onePagePath}, full=${fullPath}, permissions enforced.`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
