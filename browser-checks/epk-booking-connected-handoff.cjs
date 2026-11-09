"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const output = path.resolve("docs/screenshots/epk-booking-connected-handoff");
fs.mkdirSync(output, { recursive:true });

const kit = {
  artistName:"Road Test",
  hometown:"Tacoma, WA",
  actType:"band",
  genres:["Punk", "Garage rock"],
  shortPitch:"A direct live set for independent rooms.",
  shortBio:"Road Test arrives prepared with a concise EPK and a venue-ready live set.",
  musicLinks:[{ label:"Bandcamp", url:"https://example.com/music" }],
  videoLinks:[], socialLinks:[], lineup:[], releases:[], notableShows:[], achievements:[], pressQuotes:[], media:[], production:{ plotItems:[], inputs:[] }, publicDetails:{}
};

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:width < 700 ? 844 : 900 }, serviceWorkers:"block", reducedMotion:"reduce" });
      const page = await context.newPage();
      const errors = [];
      let savedWorkspace = null;
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method();
        let body = {};
        if (url.pathname === "/auth/session") body = { authenticated:true, user:{ sub:"11111111-1111-4111-8111-111111111111" } };
        else if (url.pathname === "/epk") body = { kit, publicId:"road-test", published:true, privateShared:false };
        else if (url.pathname === "/profiles") body = { profile:{ name:kit.artistName, location:kit.hometown } };
        else if (url.pathname === "/booking-pipeline" && method === "GET") body = { venues:savedWorkspace?.venues || [], artist:savedWorkspace?.artist || {}, tour:savedWorkspace?.tour || {}, revision:"revision-1", estimate:null };
        else if (url.pathname === "/booking-pipeline" && method === "POST") {
          savedWorkspace = request.postDataJSON();
          body = { revision:"revision-2", estimate:null };
        } else if (url.pathname === "/venues/search") {
          body = { venues:[{
            venueKey:"fixture-road-room", name:"Road Room", address:"100 Tour Ave, Tacoma, WA",
            position:[-122.44,47.25], categories:["Live music venue"], websites:["https://example.com/road-room"],
            emails:[], phones:[], sources:[{ name:"Official venue website", url:"https://example.com/road-room" }],
            activityEvidence:"Current live calendar found", bookingSuitability:"needs-research"
          }], page:0, radiusMiles:25, hasMore:false, canExpand:false, location:{ label:"Tacoma, Washington" } };
        } else if (url.pathname === "/epk/outreach-share") body = { shares:[] };
        else if (url.pathname === "/tour-manager/credits") body = { bookingEmailCredits:0, purchasedCredits:0, sentEmails:0, reservedCredits:0, activity:[] };
        else if (url.pathname === "/tour-manager/outreach") body = { messages:[], replies:[] };
        else if (url.pathname === "/tour-manager/contact-unlocks") body = { venueKeys:[] };
        return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(body) });
      });

      await page.goto(`${origin}/epk.html`, { waitUntil:"domcontentloaded" });
      await page.locator("#epkStatus").filter({ hasText:"Published EPK loaded" }).waitFor();
      await page.locator("#epkBookingHandoff").scrollIntoViewIfNeeded();
      const epkGeometry = await page.locator("#epkBookingHandoff").evaluate(node => ({
        visible:getComputedStyle(node).display !== "none",
        documentWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth,
        targets:[...node.querySelectorAll("a")].map(link => link.getBoundingClientRect().height)
      }));
      assert.equal(epkGeometry.visible, true, `${width}px published handoff should be visible`);
      assert.ok(epkGeometry.documentWidth <= epkGeometry.clientWidth + 1, `${width}px EPK handoff overflow: ${JSON.stringify(epkGeometry)}`);
      assert.ok(epkGeometry.targets.every(height => height >= 44), `${width}px EPK handoff targets must be 44px: ${JSON.stringify(epkGeometry.targets)}`);
      await page.locator("#epkBookingHandoff").screenshot({ path:path.join(output, `epk-handoff-${width}.png`) });

      await page.locator('#epkBookingHandoff a[href="booking-selections.html?from=epk"]').click();
      await page.waitForURL(url => url.pathname.endsWith("/booking-selections.html") && !url.searchParams.has("from"));
      await page.locator("#bookingAccountStatus").filter({ hasText:"Published EPK and act details saved" }).waitFor();
      const state = await page.evaluate(() => ({
        name:document.getElementById("pitchArtist").value,
        genre:document.getElementById("pitchGenre").value,
        hometown:document.getElementById("pitchHometown").value,
        epk:document.getElementById("pitchEpk").value,
        pitch:document.getElementById("pitchSummary").value,
        documentWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth
      }));
      assert.equal(state.name, kit.artistName);
      assert.equal(state.genre, kit.genres.join(", "));
      assert.equal(state.hometown, kit.hometown);
      assert.equal(state.epk, `${origin}/epk.html?id=road-test`);
      assert.equal(state.pitch, kit.shortPitch);
      assert.ok(state.documentWidth <= state.clientWidth + 1, `${width}px booking handoff overflow: ${JSON.stringify(state)}`);
      assert.equal(savedWorkspace?.artist?.name, kit.artistName, `${width}px saved workspace act mismatch`);
      assert.equal(savedWorkspace?.artist?.epk, `${origin}/epk.html?id=road-test`, `${width}px saved workspace EPK mismatch`);
      assert.equal(savedWorkspace?.artist?.pitch, kit.shortPitch, `${width}px saved workspace pitch mismatch`);
      const venueNext = page.locator("#chooseVenuesNext");
      assert.equal(await venueNext.textContent(), "Choose venues", `${width}px should name the next action clearly when the pipeline is empty`);
      assert.equal(await venueNext.getAttribute("href"), "booking.html", `${width}px should continue directly to worldwide venue discovery`);
      assert.ok(await venueNext.evaluate(node => node.getBoundingClientRect().height) >= 44, `${width}px venue-discovery action must retain a 44px touch target`);
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      await page.locator(".artist-workspace").screenshot({ path:path.join(output, `booking-handoff-${width}.png`) });
      if (width === 390) {
        await page.locator("#pitchArtist").fill("Another Act");
        await page.locator("#pitchEpk").fill("https://example.com/another-epk");
        await page.evaluate(() => { window.danzstakConfirm = async () => false; });
        await page.locator("#usePublishedEpk").click();
        await page.locator("#bookingAccountStatus").filter({ hasText:"Booking workspace unchanged" }).waitFor();
        assert.equal(await page.locator("#pitchArtist").inputValue(), "Another Act", "declining an act switch must retain the current act");
        assert.equal(await page.locator("#pitchEpk").inputValue(), "https://example.com/another-epk", "declining an act switch must retain the current EPK");
        await venueNext.click();
        await page.waitForURL(url => url.pathname.endsWith("/booking.html"));
        await page.locator("#venueQuickQuery").fill("punk clubs in Tacoma");
        await page.locator("#venueQuickForm button").click();
        const roadRoom = page.locator("#venueQuickResults article", { hasText:"Road Room" });
        await roadRoom.waitFor({ state:"visible" });
        await roadRoom.locator(".venue-quick-select").click();
        assert.match(await page.locator("#selectedVenueCount").textContent(), /1 club selected/);
        await page.locator("#openVenueSelections").click();
        await page.waitForURL(url => url.pathname.endsWith("/booking-selections.html"));
        await page.locator("#selectedVenueCards article", { hasText:"Road Room" }).waitFor({ state:"visible" });
        assert.equal(await page.locator("#pitchArtist").inputValue(), kit.artistName, "venue selection must retain the published EPK act");
        assert.equal(await page.locator("#pitchEpk").inputValue(), `${origin}/epk.html?id=road-test`, "venue selection must retain the published EPK link");
        await page.locator("#selectedVenueCards article", { hasText:"Road Room" }).screenshot({ path:path.join(output, "connected-venue-390.png") });
      }
      assert.equal(errors.length, 0, `${width}px browser errors after the complete handoff: ${errors.join(" | ")}`);
      await context.close();
    }
    console.log(`Connected EPK-to-booking browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
