"use strict";
// "Write it with AI" on Edit profile (task 19, queue 5b2) in a real browser (Edge), API mocked: the row under the
// title ($6.30 only until bought), the purchase sheet to Stripe test checkout, the quick questions, the draft, and
// "Use this" filling the editor without saving. 320–430 px plus 1366; screenshots at 360 and 390.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8149 node browser-checks/profile-ai.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8149").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/profile-ai");
const widths = (process.env.WIDTHS || "320,360,390,430,1366").split(",").map(Number);
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const DISCLAIMER = "AI drafts can be wrong or out of date. DanzStak doesn't verify them. You must review every word, and you're responsible for what you publish or send. No guarantee of bookings or press. We never train AI on your content.";
const DRAFT = { bio: "Guitar and vocals in Night Shift. Oakland punk, fast and loud, still booking basement shows.", location: "Oakland", work: "Guitar and vocals in Night Shift", website: "https://nightshift.bandcamp.com", handles: ["nightshift", "night.shift.oak", "nightshiftband"] };

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}
async function open(browser, width, { available = true, owned = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 820 }, serviceWorkers: "block", hasTouch: width < 760, isMobile: width < 760, deviceScaleFactor: 2 });
  const page = await ctx.newPage(), state = { errors: [], bodies: {}, saves: 0 };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("https://checkout.stripe.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Stripe Checkout (test)</p>" }));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    if (request.postData()) { try { state.bodies[p] = JSON.parse(request.postData()); } catch {} }
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.test" } }));
    if (p === "/profiles" && method === "POST") { state.saves += 1; return route.fulfill(json({ profile: {} })); }
    if (p === "/profiles") return route.fulfill(json({ profile: { memberId: "11111111-1111-4111-8111-111111111111", isOwner: true, cloudProfile: true, name: "Night Shift", handle: "nightshift_temp", bio: "", location: "", work: "", website: "" } }));
    if (p === "/profile/ai") return route.fulfill(json({ available, comingSoon: available ? "" : "AI coming soon", owned, priceCents: 500, feeCents: 130, totalCents: 630, disclaimer: DISCLAIMER, draftsLeftToday: 5 }));
    if (p === "/profile/ai/draft") return route.fulfill(json({ draft: DRAFT, draftsLeftToday: 4 }));
    if (p === "/tour-manager/ai-epk/checkout") return route.fulfill(json({ checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_profile", totalCents: 630, testMode: true }));
    return route.fulfill(json({}));
  });
  return { ctx, page, state };
}
async function openEditor(page) {
  await page.goto(`${baseUrl}/profile.html`, { waitUntil: "domcontentloaded" });
  const edit = page.locator('button[data-icon="edit"]').first();
  await edit.waitFor({ timeout: 15000 });
  await edit.click();
  const row = page.locator("#profileAiRow");
  await row.waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.querySelector("#profileAiRow .profile-ai-label")?.textContent.trim());
  return row;
}
const geometry = (page, root) => page.evaluate(root => ({
  overflow: document.documentElement.scrollWidth > innerWidth,
  small: [...document.querySelectorAll(`${root} button`)].filter(node => { const r = node.getBoundingClientRect(); return r.height > 0 && r.height < 43.5; }).map(node => node.textContent.trim() || node.getAttribute("aria-label"))
}), root);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const snap = [360, 390].includes(width);
      // A. Not bought yet: price on the row, purchase sheet, Stripe test checkout (kind=profile).
      {
        const label = `${width}px buy`;
        const { ctx, page, state } = await open(browser, width, {});
        const row = await openEditor(page);
        assert.equal(await row.getAttribute("aria-label"), "Write it with AI, $6.30", `${label}: price until bought`);
        const box = await row.boundingBox(), heading = await page.locator(".edit-profile-panel h2").boundingBox();
        assert.ok(box.y > heading.y && box.height >= 44, `${label}: one row right under the title`);
        if (snap) await shot(page, `1-row-${width}`);
        await row.click();
        const sheet = page.locator("dialog.profile-ai-sheet");
        await sheet.waitFor({ state: "visible" });
        assert.equal(await sheet.locator("#profileAiTitle").textContent(), "Write it with AI");
        assert.match(await sheet.textContent(), /\$6\.30\s*\(\$5\.00 \+ \$1\.30 fee\)/);
        assert.ok((await sheet.textContent()).includes(DISCLAIMER));
        assert.match(await sheet.textContent(), /No refund once a draft is made/);
        let g = await geometry(page, "dialog.profile-ai-sheet"); assert.equal(g.overflow, false); assert.deepEqual(g.small, [], `${label}: targets`);
        if (snap) await shot(page, `2-start-${width}`);
        await sheet.getByRole("button", { name: "Continue" }).click();
        assert.equal((await sheet.locator(".epk-ai-bill").textContent()).replace(/\s+/g, ""), "AIprofile$5.00DanzStakfee$1.30Total$6.30");
        await sheet.getByRole("button", { name: "Pay $6.30" }).click();
        await page.waitForURL(/checkout\.stripe\.com/);
        assert.deepEqual(state.bodies["/tour-manager/ai-epk/checkout"], { kind: "profile" });
        assert.ok(!state.bodies["/profile/ai/draft"], `${label}: nothing drafted before paying`);
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
      // B. Bought: no price; questions -> draft -> Use this fills the editor, nothing saved.
      {
        const label = `${width}px draft`;
        const { ctx, page, state } = await open(browser, width, { owned: true });
        const row = await openEditor(page);
        assert.equal(await row.getAttribute("aria-label"), "Write it with AI", `${label}: no price once bought`);
        await row.click();
        const sheet = page.locator("dialog.profile-ai-sheet");
        await sheet.waitFor({ state: "visible" });
        assert.equal(await sheet.locator("#profileAiTitle").textContent(), "A few quick questions");
        await sheet.locator("select[name=role]").selectOption("band");
        await sheet.locator("input[name=genres]").fill("punk");
        await sheet.locator("input[name=city]").fill("Oakland");
        await sheet.locator("input[name=oneLine]").fill("We play fast.");
        await sheet.locator("textarea[name=links]").fill("https://nightshift.bandcamp.com");
        assert.match(await sheet.textContent(), /5 drafts left today/);
        if (snap) await shot(page, `3-questions-${width}`);
        await sheet.getByRole("button", { name: "Draft it with AI" }).click();
        await sheet.locator(".profile-ai-draft").waitFor();
        assert.deepEqual(state.bodies["/profile/ai/draft"], { answers: { role: "band", genres: "punk", city: "Oakland", oneLine: "We play fast.", links: ["https://nightshift.bandcamp.com"] } });
        assert.equal(await sheet.locator("#profileAiTitle").textContent(), "Your AI draft");
        await sheet.getByRole("button", { name: "@night.shift.oak" }).click();
        const g = await geometry(page, "dialog.profile-ai-sheet"); assert.equal(g.overflow, false); assert.deepEqual(g.small, [], `${label}: targets`);
        if (snap) await shot(page, `4-draft-${width}`);
        await sheet.getByRole("button", { name: "Use this" }).click();
        await sheet.waitFor({ state: "hidden" });
        const form = page.locator(".edit-profile-panel");
        assert.equal(await form.locator("[name=bio]").inputValue(), DRAFT.bio);
        assert.equal(await form.locator("[name=location]").inputValue(), "Oakland");
        assert.equal(await form.locator("[name=work]").inputValue(), DRAFT.work);
        assert.equal(await form.locator("[name=website]").inputValue(), DRAFT.website);
        assert.equal(await form.locator("[name=handle]").inputValue(), "night.shift.oak");
        assert.equal((await page.locator("#profileAiStatus").textContent()).trim(), "AI draft filled in. Check every word, then Save.");
        assert.equal(state.saves, 0, `${label}: nothing is saved until the member taps Save`);
        await form.locator("[name=bio]").scrollIntoViewIfNeeded();
        if (snap) await shot(page, `5-filled-${width}`);
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
      // C. Without the key: AI coming soon, nothing opens. D. Back closes the sheet.
      if ([360, 1366].includes(width)) {
        const closed = await open(browser, width, { available: false });
        const row = await openEditor(closed.page);
        assert.equal((await row.textContent()).trim(), "AI coming soon");
        assert.equal(await row.isDisabled(), true);
        await closed.ctx.close();
        const { ctx, page, state } = await open(browser, width, { owned: true });
        await (await openEditor(page)).click();
        await page.locator("dialog.profile-ai-sheet").waitFor({ state: "visible" });
        await page.goBack();
        await page.locator("dialog.profile-ai-sheet").waitFor({ state: "hidden" });
        assert.ok(new URL(page.url()).pathname.endsWith("/profile.html"), `Back stays on the profile (${page.url()})`);
        assert.ok(await page.locator(".edit-profile-panel").isVisible(), "the editor stays open");
        assert.deepEqual(state.errors, []);
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  console.log(`Write it with AI browser checks passed (${widths.join(", ")}px): one row under the title with $6.30 until bought, purchase sheet with refund rule and disclaimer, Stripe test checkout (kind=profile), quick questions, draft with @username ideas, Use this fills the editor without saving, coming soon, Back.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
