"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const origin = process.argv[2] || "http://127.0.0.1:8037", output = path.resolve("docs/screenshots/booking-sync");
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 850 }, deviceScaleFactor: 1, serviceWorkers: "block" });
      const page = await context.newPage(); let submitted, usedDates = [], usedStatuses = []; const appliedByReply = new Map();
      await page.route("https://api.danzstak.com/**", async route => {
        const pathname = new URL(route.request().url()).pathname, method = route.request().method();
        if (pathname === "/booking-pipeline" && method === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ venues: [{ venueKey: "venue_reply_test_123", name: "Test Venue", address: "100 Music Way, Portland, OR", categories: ["live music"], websites: ["https://example.com"], emails: ["booking@example.com"], booking: { status: "Reply received", showDate: "2027-03-05", followUp: "2026-11-01" } }], artist: { name: "Road Test", genre: "Punk", hometown: "Seattle", epk: "https://danzstak.com/epk.html?id=road-test", pitch: "A direct live set for independent rooms." }, tour: { currency: "USD" }, revision: "revision-1" }) });
        if (pathname === "/tour-manager/credits") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bookingEmailCredits: 2, purchasedCredits: 2, sentEmails: 1, reservedCredits: 0, activity: [] }) });
        if (pathname === "/tour-manager/contact-unlocks") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ venueKeys: ["venue_reply_test_123"] }) });
        if (pathname === "/epk/outreach-share" && method === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shares: [{ outreachId: "outreach_reply_test_123", venueKey: "venue_reply_test_123", venueName: "Test Venue", openCount: 1, lastOpenedAt: "2026-11-07T11:00:00Z", revoked: false }] }) });
        if (pathname === "/tour-manager/outreach" && route.request().method() === "GET") { const replies = [{ id: "TOUR_MANAGER#BOOKING_REPLY#outreach_reply_test_123#client_interested_test_123", outreachId: "outreach_reply_test_123", direction: "inbound", action: "interested", content: "We are interested. Please send the full rider.", createdAt: "2026-11-07T11:55:00Z" }, { id: "TOUR_MANAGER#BOOKING_REPLY#outreach_reply_test_123#client_reply_test_123", outreachId: "outreach_reply_test_123", direction: "inbound", action: "offer_date", content: "We can offer March 5. What is your guarantee?", proposedDate: "2027-03-05", createdAt: "2026-11-07T12:00:00Z" }, { id: "TOUR_MANAGER#BOOKING_REPLY#outreach_reply_test_123#client_confirm_test_123", outreachId: "outreach_reply_test_123", direction: "inbound", action: "confirm_date", content: "Confirmed for March 5. Load-in is 5 PM.", proposedDate: "2027-03-05", createdAt: "2026-11-07T12:05:00Z" }, { id: "TOUR_MANAGER#BOOKING_REPLY#outreach_reply_test_123#client_pass_test_123", outreachId: "outreach_reply_test_123", direction: "inbound", action: "pass", content: "We cannot make this date work.", createdAt: "2026-11-07T12:10:00Z" }].map(reply => ({ ...reply, appliedStatus: appliedByReply.get(reply.id) || "" })); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ messages: [{ id: "outreach_reply_test_123", venueKey: "venue_reply_test_123", venueName: "Test Venue", subject: "March 5 booking pitch", status: "replied", sentAt: "2026-11-07T10:00:00Z", repliedAt: "2026-11-07T11:55:00Z" }], replies }) }); }
        if (pathname === "/tour-manager/outreach/reply") { submitted = JSON.parse(route.request().postData() || "{}"); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "sent" }) }); }
        if (pathname === "/tour-manager/outreach/use-date") { const request = JSON.parse(route.request().postData() || "{}"); usedDates.push(request); const status = request.confirm ? "Confirmed" : "Date proposed"; appliedByReply.set(request.replyId, status); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ saved: true, venueName: "Test Venue", proposedDate: "2027-03-05", status }) }); }
        if (pathname === "/tour-manager/outreach/use-status") { const request = JSON.parse(route.request().postData() || "{}"); usedStatuses.push(request); const status = request.replyId.includes("interested") ? "Interested" : "Declined"; appliedByReply.set(request.replyId, status); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ saved: true, venueName: "Test Venue", status }) }); }
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      });
      await page.goto(`${origin}/booking-selections.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#bookingAccountStatus").filter({ hasText: "loaded" }).waitFor();
      const openReply = page.getByRole("link", { name: "Open this reply in SYNC" });
      await openReply.waitFor();
      assert.equal(await openReply.getAttribute("href"), "messages.html?section=bookings&outreach=outreach_reply_test_123", "The booking workspace must target the exact private SYNC thread");
      const handoffGeometry = await openReply.evaluate(link => { const rect = link.getBoundingClientRect(); return { height: rect.height, right: rect.right, viewport: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }; });
      assert.ok(handoffGeometry.height >= 44, `${width}px booking-to-SYNC control is too small`);
      assert.ok(handoffGeometry.right <= handoffGeometry.viewport + 1, `${width}px booking-to-SYNC control is clipped`);
      assert.ok(handoffGeometry.scrollWidth <= handoffGeometry.viewport + 1, `${width}px booking handoff overflows`);
      await openReply.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `booking-handoff-${width}.png`), fullPage: false });
      await page.goto(`${origin}/messages.html?section=bookings&outreach=outreach_reply_test_123`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof window.danzstakLoadBookingThreads === "function");
      const bookingsTab = page.locator('[data-chat-filter="bookings"]');
      await bookingsTab.waitFor({ state: "attached" });
      assert.equal(await bookingsTab.getAttribute("aria-selected"), "true", "A booking deep link must select the Bookings inbox");
      const geometry = await page.evaluate(() => { const tabs = [...document.querySelectorAll("[data-chat-filter]")].map(node => node.getBoundingClientRect()), sidebar = document.querySelector(".chat-sidebar")?.getBoundingClientRect(); return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, tabHeights: tabs.map(rect => rect.height), tabRight: Math.max(...tabs.map(rect => rect.right)), sidebarRight: sidebar?.right || 0 }; });
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${width}px booking inbox overflows`); assert.ok(geometry.tabHeights.every(height => height === 0 || height >= 44), `${width}px has a small SYNC tab`); assert.ok(width <= 760 || geometry.tabRight <= geometry.sidebarRight + 1, `${width}px tabs are clipped by the SYNC sidebar`);
      const conversation = page.getByLabel("Conversation");
      await conversation.getByText("We can offer March 5. What is your guarantee?").waitFor();
      assert.equal(new URL(page.url()).searchParams.has("outreach"), false, "The private outreach identifier must leave the address bar after the thread opens");
      await conversation.getByText("Proposed date: 2027-03-05").waitFor();
      assert.equal(await page.locator("#messageForm").isHidden(), true, "The personal composer must not pretend to send an external email");
      assert.equal(await page.locator("#headerPhone").isHidden(), true, "An external venue email thread must not show a fake SYNC call control");
      assert.equal(await page.locator("#callStatus").isHidden(), true, "An external venue email thread must not claim a secure call is ready");
      await page.getByRole("button", { name: "Review interest" }).click();
      await page.getByRole("button", { name: "Mark Interested" }).click();
      await page.getByText(/marked Interested/).waitFor();
      assert.match(usedStatuses[0].replyId, /client_interested_test_123$/);
      await page.getByRole("button", { name: "Add proposed date to Tour" }).click();
      await page.getByText(/added as Date proposed/).waitFor();
      assert.equal(usedDates[0].outreachId, "outreach_reply_test_123"); assert.match(usedDates[0].replyId, /client_reply_test_123$/); assert.equal(usedDates[0].confirm, false);
      await page.getByRole("button", { name: "Review confirmed date" }).click();
      await page.getByRole("button", { name: "Add confirmed show" }).click();
      await page.getByText(/added as a confirmed show/).waitFor();
      assert.equal(usedDates[1].confirm, true); assert.match(usedDates[1].replyId, /client_confirm_test_123$/);
      await page.getByRole("button", { name: "Review pass" }).click();
      await page.getByRole("button", { name: "Mark Declined" }).click();
      await page.getByText(/marked Declined/).waitFor();
      assert.match(usedStatuses[1].replyId, /client_pass_test_123$/);
      const bookingComposer = page.getByLabel("Reply to this venue by email");
      await bookingComposer.fill("Thanks. March 5 works for us.");
      const sendReply = page.getByRole("button", { name: "Send booking reply by email" });
      assert.equal(await sendReply.evaluate(button => { const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return button === hit || button.contains(hit); }), true, `${width}px booking send control is covered`);
      await sendReply.evaluate(button => button.click());
      await page.getByText("Reply submitted to the venue by email. No booking credit was charged.").waitFor();
      assert.equal(submitted.outreachId, "outreach_reply_test_123"); assert.equal(submitted.content, "Thanks. March 5 works for us."); assert.match(submitted.clientMessageId, /^[a-zA-Z0-9_-]{16,100}$/);
      await conversation.getByText("Tour Manager: Interested").waitFor();
      await conversation.getByText("Tour Manager: Date proposed").waitFor();
      await conversation.getByText("Tour Manager: Confirmed").waitFor();
      await conversation.getByText("Tour Manager: Declined").waitFor();
      assert.equal(await page.getByRole("button", { name: /Review (interest|confirmed date|pass)/ }).count(), 0, "Applied venue decisions must not reappear after refresh");
      await page.screenshot({ path: path.join(output, `booking-sync-${width}.png`), fullPage: false });
      await context.close();
    }
    console.log("Booking reply SYNC browser checks passed at 320, 360, 375, 390, 414, 430, 768, 1024, and 1366px.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
