"use strict";
// AI EPK builder screens (task 08, PR 2) in a real browser (Edge), API mocked: the choice in the builder, the five
// screens (Start, Tell us who you are, Is this you?, Pay, Build), the draft opening in the editor with
// "AI draft — check it" marks and sources, the review gate, device Back, "coming soon" without a key, and the price
// shown only until it's bought. 320–430 px plus 768 and 1366; screenshots at 360 and 390.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8146 node browser-checks/epk-ai.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8146").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/epk-ai");
const widths = (process.env.WIDTHS || "320,360,390,430,768,1366").split(",").map(Number);
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const DISCLAIMER = "AI drafts can be wrong or out of date. DanzStak doesn't verify them. You must review every word, and you're responsible for what you publish or send. No guarantee of bookings or press. We never train AI on your content.";
const draft = {
  kit: { shortPitch: "Oakland punk, fast and loud.", shortBio: "Night Shift play Oakland punk.", bio: "Night Shift are an Oakland punk band. Their record Signal Lost came out on Hazard Records in 2024.", releases: ["Signal Lost — 2024, Hazard Records"], notableShows: ["924 Gilman, Berkeley"], pressQuotes: [{ quote: "Raw, fast and smart.", source: "Punk Weekly, 2025-03", url: "https://nightshift.bandcamp.com" }], musicLinks: [{ label: "Bandcamp", url: "https://nightshift.bandcamp.com" }], genres: ["punk"] },
  aiFields: ["shortPitch", "shortBio", "bio", "releases", "notableShows", "pressQuotes", "musicLinks", "genres"],
  sources: { shortPitch: ["https://nightshift.bandcamp.com"], shortBio: ["https://nightshift.bandcamp.com"], bio: ["https://nightshift.bandcamp.com"], releases: ["https://nightshift.bandcamp.com"], notableShows: ["https://www.instagram.com/nightshiftband"], pressQuotes: ["https://nightshift.bandcamp.com"], musicLinks: ["https://nightshift.bandcamp.com"], genres: [] },
  checklist: ["Add a tech rider", "Add a press photo", "Add a live photo"], look: "punk", bookingPitch: "We'd love to play your room.", quotesNeedPermission: true
};

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}
async function open(browser, width, { available = true, credits = 0, owned = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: width < 760, isMobile: width < 760, deviceScaleFactor: 2 });
  const page = await ctx.newPage(), state = { calls: [], errors: [], credits, owned, job: null, steps: 0, review: null };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("https://checkout.stripe.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Stripe test</title><p>Stripe Checkout (test)</p>" }));
  await page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    state.calls.push(`${method} ${p}`);
    const body = request.postData() ? JSON.parse(request.postData()) : {};
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.test" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift" } }));
    if (p === "/epk" && method === "GET") return route.fulfill(json({ kit: null, publicId: "", published: false }));
    if (p === "/epk/ai") return route.fulfill(json({ available, searchAvailable: true, priceCents: 500, feeCents: 130, totalCents: 630, rewritesIncluded: 3, disclaimer: DISCLAIMER, comingSoon: available ? "" : "AI builder coming soon", owned: state.owned, credits: state.credits, draft: state.draft || null, job: state.job, review: state.review }));
    if (p === "/epk/ai/identify") {
      state.input = body.input;
      state.draft = { input: body.input, confirmed: body.input.links, candidates: [...body.input.links.map(url => ({ url, title: "Bandcamp", site: "nightshift.bandcamp.com", own: true })), { url: "https://other-night-shift.example.com/about", title: "Night Shift — the other one", snippet: "A different band from Leeds with the same name.", site: "other-night-shift.example.com", own: false }, { url: "https://www.instagram.com/nightshiftband", title: "Night Shift (@nightshiftband)", snippet: "Oakland punk.", site: "instagram.com", own: false }] };
      return route.fulfill(json({ draft: state.draft, searchAvailable: true, note: "" }));
    }
    if (p === "/epk/ai/confirm") { state.draft.confirmed = body.urls; state.confirmed = body.urls; return route.fulfill(json({ draft: state.draft })); }
    if (p === "/tour-manager/ai-epk/checkout") return route.fulfill(json({ checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_ai", totalCents: 630, testMode: true }));
    if (p === "/epk/ai/build") {
      if (state.credits < 1) return route.fulfill({ status: 402, contentType: "application/json", body: JSON.stringify({ error: "Pay for the AI build first.", needsPayment: true }) });
      state.credits -= 1; state.job = { id: "job1", status: "reading", progress: ["Starting your build…"], alsoFound: [], draft: null };
      return route.fulfill(json({ job: state.job }));
    }
    if (p === "/epk/ai/step") {
      state.steps += 1;
      const lines = ["Reading Bandcamp…", "Reading Instagram…", "Found 1 release…", "Writing your bio…", "Your draft is ready. Check every section before you publish."];
      state.job = { ...state.job, progress: ["Starting your build…", ...lines.slice(0, state.steps)], status: state.steps >= lines.length ? "draft_ready" : "extracting", alsoFound: state.steps >= lines.length ? [{ url: "https://press.example.com/review", title: "Review in Punk Weekly", site: "press.example.com" }] : [], draft: state.steps >= lines.length ? draft : null };
      return route.fulfill(json({ job: state.job }));
    }
    if (p === "/epk/ai/review") { state.reviews = [...(state.reviews || []), body]; return route.fulfill(json({ review: { pending: [] } })); }
    return route.fulfill(json({}));
  });
  return { ctx, page, state };
}
const geometry = (page, root) => page.evaluate(root => ({
  overflow: document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(`${root} *`)].some(node => { const r = node.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }),
  small: [...document.querySelectorAll(`${root} button, ${root} input[type=checkbox], ${root} a`)].filter(node => { const r = node.getBoundingClientRect(); return r.height > 0 && node.type !== "checkbox" && r.height < 43.5; }).map(node => node.textContent.trim() || node.className)
}), root);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const snap = [360, 390].includes(width);
      // A. First purchase: Start -> Who -> Is this you? -> Pay -> Stripe (test).
      {
        const label = `${width}px buy`;
        const { ctx, page, state } = await open(browser, width);
        await page.goto(`${baseUrl}/epk.html`, { waitUntil: "domcontentloaded" });
        const start = page.locator("#epkAiStart");
        await start.waitFor({ timeout: 15000 });
        assert.match(await start.textContent(), /Let AI build it\s*\$6\.30/, `${label}: price on the AI choice`);
        assert.equal(await page.locator("#epkAiChoice .ds-btn-tonal").getAttribute("aria-label"), "Build it myself, free", `${label}: building by hand is free`);
        assert.equal(await start.getAttribute("aria-label"), "Let AI build it, $6.30");
        if (snap) await shot(page, `0-choice-${width}`);
        await start.click();
        const sheet = page.locator("dialog.epk-ai-sheet");
        await sheet.waitFor({ state: "visible" });
        assert.equal(await sheet.locator("#epkAiTitle").textContent(), "Let AI build your EPK");
        assert.match(await sheet.textContent(), /3 AI rewrites of any section/);
        assert.match(await sheet.textContent(), /1 booking pitch email to one venue, included/);
        assert.match(await sheet.textContent(), /No refund once a draft is made/);
        assert.ok((await sheet.textContent()).includes(DISCLAIMER), `${label}: disclaimer before purchase`);
        let g = await geometry(page, "dialog.epk-ai-sheet"); assert.equal(g.overflow, false, `${label}: start overflow`); assert.deepEqual(g.small, [], `${label}: start targets`);
        if (snap) await shot(page, `1-start-${width}`);
        await sheet.getByRole("button", { name: "Start" }).click();
        await sheet.locator("input[name=artistName]").fill("Night Shift");
        await sheet.locator("input[name=city]").fill("Oakland");
        await sheet.locator("input[name=genre]").fill("punk");
        await sheet.locator("textarea[name=links]").fill("https://nightshift.bandcamp.com");
        assert.match(await sheet.textContent(), /never used to train AI/);
        g = await geometry(page, "dialog.epk-ai-sheet"); assert.equal(g.overflow, false, `${label}: who overflow`);
        if (snap) await shot(page, `2-who-${width}`);
        await sheet.getByRole("button", { name: "Find me" }).click();
        await sheet.locator(".epk-ai-found li").first().waitFor();
        assert.equal(await sheet.locator("#epkAiTitle").textContent(), "Is this you?");
        assert.equal(await sheet.locator(".epk-ai-found input:checked").count(), 1, `${label}: only your own link is ticked`);
        assert.ok(!/null|undefined/.test(await sheet.textContent()), `${label}: no stray null/undefined text`);
        await sheet.locator(".epk-ai-found label", { hasText: "@nightshiftband" }).click();
        g = await geometry(page, "dialog.epk-ai-sheet"); assert.equal(g.overflow, false, `${label}: confirm overflow`);
        if (snap) await shot(page, `3-is-this-you-${width}`);
        await sheet.getByRole("button", { name: "These are me" }).click();
        await sheet.locator(".epk-ai-bill").waitFor();
        assert.deepEqual(state.confirmed, ["https://nightshift.bandcamp.com", "https://www.instagram.com/nightshiftband"], `${label}: the other band is not used`);
        assert.equal((await sheet.locator(".epk-ai-bill").textContent()).replace(/\s+/g, ""), "AIEPK$5.00DanzStakfee$1.30Total$6.30");
        g = await geometry(page, "dialog.epk-ai-sheet"); assert.equal(g.overflow, false, `${label}: pay overflow`); assert.deepEqual(g.small, [], `${label}: pay targets`);
        if (snap) await shot(page, `4-pay-${width}`);
        await sheet.getByRole("button", { name: "Pay $6.30" }).click();
        await page.waitForURL(/checkout\.stripe\.com/);
        assert.ok(state.calls.includes("POST /tour-manager/ai-epk/checkout"));
        assert.ok(!state.calls.includes("POST /epk/ai/build"), `${label}: nothing is built before paying`);
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
      // B. Paid: back from Stripe -> build -> draft in the editor with marks -> review gate; no price shown.
      {
        const label = `${width}px build`;
        const { ctx, page, state } = await open(browser, width, { credits: 1, owned: true });
        state.draft = { input: { artistName: "Night Shift", city: "Oakland", genre: "punk", actType: "band", links: ["https://nightshift.bandcamp.com"] }, confirmed: ["https://nightshift.bandcamp.com"], candidates: [{ url: "https://nightshift.bandcamp.com", title: "Bandcamp", site: "nightshift.bandcamp.com", own: true }] };
        await page.goto(`${baseUrl}/epk.html?ai-epk=paid`, { waitUntil: "domcontentloaded" });
        const sheet = page.locator("dialog.epk-ai-sheet");
        await sheet.waitFor({ state: "visible", timeout: 15000 });
        await sheet.locator(".epk-ai-progress li").nth(2).waitFor({ timeout: 15000 });
        if (snap) await shot(page, `5-building-${width}`);
        const openDraft = sheet.getByRole("button", { name: "Open my draft" });
        await openDraft.waitFor({ timeout: 20000 });
        assert.ok(page.url().endsWith("/epk.html"), `${label}: the ?ai-epk=paid marker is cleared`);
        assert.match(await sheet.textContent(), /Also found — is this you\?/);
        if (snap) await shot(page, `6-ready-${width}`);
        await openDraft.click();
        await sheet.waitFor({ state: "hidden" });
        assert.equal(await page.locator("#bio").inputValue(), draft.kit.bio);
        assert.equal(await page.locator("#musicLinks").inputValue(), "Bandcamp | https://nightshift.bandcamp.com");
        assert.equal(await page.locator("#pressQuotes").inputValue(), "Raw, fast and smart. | Punk Weekly, 2025-03 | https://nightshift.bandcamp.com");
        assert.equal(await page.locator("#epkLook").inputValue(), "punk", `${label}: suggested look`);
        assert.equal(await page.locator(".epk-ai-mark").count(), draft.aiFields.length, `${label}: every AI section is marked`);
        assert.match(await page.locator('.epk-ai-mark[data-field="bio"]').textContent(), /AI draft — check it\s*Sources:\s*nightshift\.bandcamp\.com/);
        assert.equal(await page.locator("#heroImage").inputValue(), "", `${label}: no web image`);
        assert.ok(await page.locator("#epkAiReviewGate").isVisible(), `${label}: review gate above Publish`);
        await page.locator('.epk-ai-mark[data-field="bio"]').scrollIntoViewIfNeeded();
        if (snap) await shot(page, `7-draft-marks-${width}`);
        await page.locator('.epk-ai-mark[data-field="bio"] button').click();
        assert.equal(await page.locator('.epk-ai-mark[data-field="bio"]').count(), 0);
        assert.deepEqual(state.reviews.at(-1), { sections: ["bio"], quotesPermission: false });
        await page.locator("#shortPitch").fill("Oakland punk.");
        await page.waitForTimeout(200);
        assert.equal(await page.locator('.epk-ai-mark[data-field="shortPitch"]').count(), 0, `${label}: editing counts as checking`);
        await page.locator("#epkAiReviewGate input").click(); // the gate removes itself once the server saves the review
        await page.waitForFunction(() => !document.querySelector(".epk-ai-mark") && !document.getElementById("epkAiReviewGate"));
        assert.deepEqual(state.reviews.at(-1), { all: true, confirmed: true });
        // Bought: no price on the AI choice any more.
        assert.doesNotMatch(await page.locator("#epkAiStart").textContent(), /\$/);
        const g = await geometry(page, "#epkForm");
        assert.equal(g.overflow, false, `${label}: editor overflow`);
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
      // C. Device Back closes the sheet and stays on the builder; no key = coming soon, no price, no sheet.
      if ([360, 1366].includes(width)) {
        const { ctx, page, state } = await open(browser, width);
        await page.goto(`${baseUrl}/epk.html`, { waitUntil: "domcontentloaded" });
        await page.locator("#epkAiStart").click();
        await page.locator("dialog.epk-ai-sheet").waitFor({ state: "visible" });
        await page.goBack();
        await page.locator("dialog.epk-ai-sheet").waitFor({ state: "hidden" });
        assert.ok(page.url().endsWith("/epk.html"), "Back stays on the EPK builder");
        assert.deepEqual(state.errors, []);
        await ctx.close();
        const closed = await open(browser, width, { available: false });
        await closed.page.goto(`${baseUrl}/epk.html`, { waitUntil: "domcontentloaded" });
        const start = closed.page.locator("#epkAiStart");
        await start.waitFor({ timeout: 15000 });
        assert.equal((await start.textContent()).trim(), "AI builder coming soon");
        assert.equal(await start.isDisabled(), true);
        if (width === 360) await shot(closed.page, `8-coming-soon-${width}`);
        await closed.ctx.close();
      }
    }
  } finally { await browser.close(); }
  console.log(`AI EPK browser checks passed (${widths.join(", ")}px): choice with price until bought, Start with what's included + refund rule + disclaimer, Tell us who you are, Is this you? (only ticked pages), Pay $6.30 to Stripe test checkout, build progress, draft in the editor with marks + sources, Looks right / editing / review gate, Back, coming soon.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
