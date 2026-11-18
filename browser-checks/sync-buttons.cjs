"use strict";
// Task 16-C (owner 2026-11-17): SYNC buttons don't look like HTML. One button system: icon buttons (44px target, 24px
// glyph, no border, round press state), primary pills, tonal secondary, text buttons. Standard actions are icons, not
// words, with accessible names. Audits every visible button on the chat list, a thread, contact details and the
// device sheet at 360 and 390px (plus 320/430) and fails on grey bevels, borders, uppercase blocks, two-line labels,
// touch targets under 44px or words where a standard icon exists. API mocked.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-buttons.cjs   (AUDIT_ONLY=1 SHOTS=before to just report)
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const prefix = process.env.SHOTS || "after";
const output = path.resolve("docs/screenshots/sync-buttons");
const widths = (process.env.WIDTHS || "320,360,390,430").split(",").map(Number);
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", FRIEND = "friend@danzstak.test", FRIEND_ID = "44444444-4444-4444-8444-444444444444";
const messages = Array.from({ length: 12 }, (_, i) => ({
  messageId: `m-${i}`, senderEmail: i % 2 ? ME : FRIEND, recipientEmail: i % 2 ? FRIEND : ME,
  content: i % 4 === 0 ? "Load-in is 4pm, soundcheck 5:30. House has a 24-channel desk." : `Cool, see you there ${i}`,
  createdAt: new Date(Date.UTC(2026, 10, 16, 12, i * 3)).toISOString(), status: "read"
}));

// Every visible, enabled-or-disabled control inside `scope` that a member can press.
const audit = (page, scope, iconOnly) => page.evaluate(({ scope, iconOnly }) => {
  const root = document.querySelector(scope);
  if (!root) return [{ problem: `missing ${scope}` }];
  const problems = [];
  const seen = new Set();
  for (const node of root.querySelectorAll("button, a.button, label[data-icon], [role='button']")) {
    if (seen.has(node) || node.matches(".conversation-user, .chat-contact, .conversation-archived-row")) continue; seen.add(node); // list rows are rows, not buttons
    const r = node.getBoundingClientRect(), cs = getComputedStyle(node);
    if (!r.width || !r.height || cs.visibility === "hidden" || node.closest("[hidden]")) continue;
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const name = (node.getAttribute("aria-label") || node.textContent || node.id || node.className).trim().replace(/\s+/g, " ").slice(0, 40);
    const tag = `${node.id ? "#" + node.id : "." + String(node.className).split(" ")[0]} "${name}"`;
    const minSide = Math.min(r.width, r.height);
    // The press area: the element itself or a ::before/::after hit extension recorded as --ds-hit.
    if (minSide < 43.5 && !node.matches(".sync-chip, [role='tab']")) problems.push(`${tag}: touch target ${Math.round(r.width)}x${Math.round(r.height)}`);
    const borders = ["Top", "Right", "Bottom", "Left"].map(side => parseFloat(cs[`border${side}Width`]) * (cs[`border${side}Style`] === "none" ? 0 : 1));
    if (borders.some(width => width > 1.01)) problems.push(`${tag}: border ${borders.join("/")}px`);
    if (["outset", "inset", "groove", "ridge"].some(style => cs.borderTopStyle === style)) problems.push(`${tag}: bevel border (${cs.borderTopStyle})`);
    if (/inset/.test(cs.boxShadow)) problems.push(`${tag}: inset bevel shadow`);
    if (/^rgb\((239|240|221), (239|240|221), (239|240|221)\)$/.test(cs.backgroundColor)) problems.push(`${tag}: browser-grey background ${cs.backgroundColor}`);
    if (cs.textTransform === "uppercase" && node.textContent.trim().length > 3) problems.push(`${tag}: uppercase block`);
    const text = [...node.childNodes].filter(child => child.nodeType === 3 || (child.nodeType === 1 && !child.matches("svg, .sr-only, [aria-hidden='true'], .ds-action-icon"))).map(child => child.textContent).join("").trim();
    if (text) {
      // Count the lines of each visible text node (an icon stacked above a label is not a wrapped label).
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let lines = new Set();
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.textContent.trim() || t.parentElement.closest(".sr-only, [aria-hidden='true']")) continue;
        const range = document.createRange(); range.selectNodeContents(t);
        const rows = new Set([...range.getClientRects()].filter(rect => rect.width > 1 && rect.height > 4).map(rect => Math.round(rect.top / 4)));
        if (rows.size > lines.size) lines = rows;
      }
      if (lines.size > 1) problems.push(`${tag}: label wraps to ${lines.size} lines`);
    }
    if (iconOnly && node.matches(iconOnly)) {
      // Icon buttons at rest: no border, no fill (the round press state appears only while pressed).
      if (borders.some(width => width > 0)) problems.push(`${tag}: icon button has a border`);
      if (!node.matches(".message-send") && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(cs.backgroundColor)) problems.push(`${tag}: icon button has a resting fill ${cs.backgroundColor}`);
      if (!node.querySelector("svg")) problems.push(`${tag}: standard action without an icon`);
      if (text && cs.fontSize !== "0px" && !/sr-only/.test(node.className)) {
        const visibleText = [...node.querySelectorAll("*"), node].some(el => [...el.childNodes].some(child => child.nodeType === 3 && child.textContent.trim()) && getComputedStyle(el).fontSize !== "0px" && el.getBoundingClientRect().width > 2 && !el.matches(".sr-only"));
        if (visibleText) problems.push(`${tag}: shows a word where a standard icon exists`);
      }
      if (!node.getAttribute("aria-label") && !node.querySelector(".sr-only")) problems.push(`${tag}: icon without an accessible name`);
    }
  }
  return problems.map(problem => typeof problem === "string" ? problem : problem.problem);
}, { scope, iconOnly });

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of widths) {
      const label = `${width}px`, take = [360, 390].includes(width);
      const context = await browser.newContext({ viewport: { width, height: 760 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      if (process.env.NO_BUTTONS) await page.route("**/assets/buttons.css*", route => route.abort());
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: ME, sub: "33333333-3333-4333-8333-333333333333" } }));
        if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift", email: ME } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: FRIEND, memberId: FRIEND_ID, name: "Tour Friend", preview: "See you there", updatedAt: messages.at(-1).createdAt, unread: 1 }] }));
        if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ messages, canContact: true, nextCursor: "" }));
        if (p === "/friends") return route.fulfill(json({ friends: [{ email: FRIEND, memberId: FRIEND_ID, name: "Tour Friend", status: "friends" }] }));
        if (p === "/calls/devices") return route.fulfill(json({ accountTag: "c".repeat(32), currentDeviceRegistered: false, devices: [] }));
        return route.fulfill(json({}));
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      const report = (where, list) => list.forEach(problem => failures.push(`${label} ${where}: ${problem}`));

      // 1. Chat list: top bar, section tabs, floating new chat.
      report("chat list", await audit(page, "main", ".chat-heading-actions > button"));
      // Section tabs are pills: the active one is tonal, not a white card with a shadow.
      const tab = await page.evaluate(() => { const t = document.querySelector(".sync-sections button[aria-selected='true']"); const cs = getComputedStyle(t); return { bg: cs.backgroundColor, shadow: cs.boxShadow, radius: parseFloat(cs.borderTopLeftRadius), h: t.getBoundingClientRect().height }; });
      if (/^rgb(255, 255, 255)$/.test(tab.bg) || tab.shadow !== "none") failures.push(`${label}: active section tab is a white card (${tab.bg}, ${tab.shadow})`);
      if (tab.radius < tab.h / 2 - 1) failures.push(`${label}: section tab is not a pill (radius ${tab.radius})`);
      const fab = await page.evaluate(() => { const b = document.querySelector(".sync-new-chat"); const r = b.getBoundingClientRect(), cs = getComputedStyle(b); return { round: parseFloat(cs.borderTopLeftRadius) >= r.width / 2 - 1, color: cs.color }; });
      if (!fab.round) failures.push(`${label}: new-chat button is not round`);
      if (fab.color !== "rgb(255, 255, 255)") failures.push(`${label}: new-chat glyph is not white on the accent (${fab.color})`);
      if (take) await shot(page, `${prefix}-1-list-${width}`);

      // 2. Thread: header actions and composer are icons.
      await page.locator(".conversation-user").first().evaluate(node => node.click());
      await page.waitForFunction(() => document.querySelectorAll("#messageList .message").length >= 12, null, { timeout: 15000 });
      await page.waitForTimeout(400);
      report("thread", await audit(page, ".conversation", "#conversationHeader .conversation-header-actions > button, .message-send, .message-attach, .message-camera, #closeContactDetails"));
      if (take) await shot(page, `${prefix}-2-thread-${width}`);
      // Send button states: disabled while empty, live as soon as the member types.
      const send = await page.evaluate(() => { const b = document.querySelector("#messageForm .message-send"); return { disabled: b.disabled, bg: getComputedStyle(b).backgroundColor }; });
      await page.locator("#messageInput").fill("On my way");
      await page.waitForTimeout(450);
      const typed = await page.evaluate(() => { const b = document.querySelector("#messageForm .message-send"); return { disabled: b.disabled, bg: getComputedStyle(b).backgroundColor }; });
      if (typed.disabled) failures.push(`${label}: send stays disabled after typing`);
      if (typed.bg !== "rgb(194, 65, 12)") failures.push(`${label}: send is not the accent primary while typing (${typed.bg})`);
      if (send.bg === "rgb(194, 65, 12)") failures.push(`${label}: send looks live with nothing typed (${send.bg})`);
      if (take) await shot(page, `${prefix}-3-typing-${width}`);
      await page.locator("#messageInput").fill("");

      // 3. Contact details sheet.
      await page.evaluate(() => document.getElementById("conversationName")?.click());
      await page.waitForTimeout(400);
      if (await page.locator("#contactDetailsDialog[open]").count()) {
        report("contact details", await audit(page, "#contactDetailsDialog", "#closeContactDetails"));
        if (take) await shot(page, `${prefix}-4-contact-${width}`);
        await page.evaluate(() => document.getElementById("closeContactDetails")?.click());
        await page.waitForTimeout(250);
      }

      // 4. Device registration sheet.
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
      await page.evaluate(() => document.getElementById("callingDevices")?.click());
      await page.waitForTimeout(500);
      const sheet = await page.evaluate(() => document.getElementById("callingDevicesDialog")?.open ? "#callingDevicesDialog" : "");
      if (sheet && sheet !== "#") {
        report("device sheet", await audit(page, sheet, "#closeCallingDevices"));
        if (take) await shot(page, `${prefix}-5-devices-${width}`);
      }
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) {
    console[process.env.AUDIT_ONLY ? "log" : "error"](`SYNC buttons: ${unique.length} problem(s)\n- ${unique.join("\n- ")}`);
    if (!process.env.AUDIT_ONLY) process.exitCode = 1;
    return;
  }
  console.log(`SYNC button checks passed at ${widths.join(", ")}px: no borders or bevels, no uppercase blocks, single-line labels, 44px targets, icons for standard actions.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
