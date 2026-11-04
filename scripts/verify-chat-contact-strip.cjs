"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8123";
const output = path.resolve("docs/screenshots/chat-contact-strip");
const executablePath = process.env.DANZSTAK_BROWSER_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const widths = [320, 360, 390, 414, 430, 1024];
const capture = process.env.DANZSTAK_CAPTURE_SCREENSHOTS === "1";
const uuid = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}
async function captureViewport(page, destination) {
  const session = await page.context().newCDPSession(page);
  try {
    const result = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    fs.writeFileSync(destination, Buffer.from(result.data, "base64"));
  } finally {
    await session.detach();
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 768 }, hasTouch: width < 700, isMobile: width < 700 });
      const page = await context.newPage();
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        const endpoint = url.pathname;
        if (endpoint === "/auth/session") return json(route, { email: "owner@example.test", name: "Owner" });
        if (endpoint === "/calls/presence") return json(route, { ok: true });
        if (endpoint === "/conversations") return json(route, { conversations: [
          { contactEmail: "alice@example.test", memberId: uuid(1), name: "Alice", picture: `${baseUrl}/assets/danzstak-d-icon.png`, preview: "See you at soundcheck", updatedAt: "2026-11-04T18:00:00.000Z", unread: 2, canContact: true },
          { contactEmail: "blocked@example.test", memberId: uuid(99), name: "Blocked", preview: "Unavailable", updatedAt: "2026-11-04T19:00:00.000Z", canContact: false }
        ] });
        if (endpoint === "/friends") return json(route, { friends: Array.from({ length: 9 }, (_, index) => ({ email: `friend${index}@example.test`, memberId: uuid(index + 2), name: `Friend ${index + 1}`, picture: "" })) });
        if (endpoint === "/calls/directory") return json(route, { users: [
          { email: "alice@example.test", memberId: uuid(1), name: "Alice", picture: `${baseUrl}/assets/danzstak-d-icon.png`, online: true },
          ...Array.from({ length: 9 }, (_, index) => ({ email: `friend${index}@example.test`, memberId: uuid(index + 2), name: `Friend ${index + 1}`, online: index === 0 }))
        ] });
        if (endpoint === "/messages" && route.request().method() === "GET") return json(route, { messages: [], canContact: true });
        if (endpoint.startsWith("/notifications") || endpoint.startsWith("/push")) return json(route, {});
        return json(route, {});
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      const strip = page.locator("#chatContacts");
      await strip.locator(".chat-contact").first().waitFor({ state: "visible" });
      assert.equal(await strip.locator(".chat-contact").count(), 10, "only permitted contacts and real conversations belong in the strip");
      assert.equal(await strip.getAttribute("hidden"), null, "real contacts must reveal the strip");
      assert.equal(await strip.locator(".chat-contact", { hasText: "Blocked" }).count(), 0, "non-contactable people must not be exposed as shortcuts");
      const geometry = await strip.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { width: box.width, scrollWidth: node.scrollWidth, overflow: getComputedStyle(node).overflowX };
      });
      assert.equal(geometry.overflow, "auto");
      assert.ok(geometry.scrollWidth > geometry.width, `${width}px many-contact fixture must scroll horizontally`);
      const first = strip.locator(".chat-contact").first();
      assert.match(await first.getAttribute("aria-label"), /^Chats: Alice$/);
      assert.equal(await first.locator(".chat-contact-online").count(), 1, "confirmed online presence must be visible");
      if (capture && width < 700) await captureViewport(page, path.join(output, `inbox-${width}.png`));
      await first.click();
      await page.locator("body.is-conversation-open").waitFor();
      assert.equal((await page.locator("#conversationName").textContent()).trim(), "Alice", "avatar shortcut must open the existing conversation");
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`Chat contact-strip browser verification passed at ${widths.join(", ")}px${capture ? `; screenshots: ${output}` : ""}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
