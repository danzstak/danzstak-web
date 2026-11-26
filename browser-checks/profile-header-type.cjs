"use strict";
// UIKIT screen 4b part 2c (docs/tasks/39-modern-look.md, CLAUDE.md F4/F9): the profile header's type is the kit's.
// At 320/360/390/430px, owner and visitor, Day and Night, plus Italian:
// - the name is the kit title (.ds.ds-profile-name): Archivo 800 at width 110%, kit ink, transparent on the card,
//   28px for a short name; a long name scales down (never under 15px) and is never cut off or over the avatar;
// - the bio is kit body text (.ds.ds-profile-bio): 15/22 in the kit's soft ink, Archivo;
// - Night keeps both dark on the light card (no dark ink on dark, no light ink on white) until the whole profile moves;
// - no sideways scroll.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8135 node browser-checks/profile-header-type.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8135").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", them = "22222222-2222-4222-8222-222222222222";
const INK = "rgb(11, 11, 12)", SOFT = "rgb(58, 59, 63)";

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  const runs = [];
  for (const owner of [true, false]) for (const width of [320, 360, 390, 430]) for (const scheme of ["light", "dark"]) runs.push({ owner, width, scheme, lang: "en", long: false });
  for (const width of [320, 430]) runs.push({ owner: false, width, scheme: "light", lang: "en", long: true });
  runs.push({ owner: true, width: 390, scheme: "light", lang: "it", long: false });
  try {
    for (const { owner, width, scheme, lang, long } of runs) {
      const label = `${owner ? "owner" : "visitor"} ${width}px ${scheme} ${lang}${long ? " long name" : ""}`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, locale: lang === "it" ? "it-IT" : "en-US", serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const name = long ? "The Extremely Long Named Underground Orchestra of Bologna" : owner ? "Dachshund Records" : "Night Shift";
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const profile = { memberId: owner ? me : them, name, handle: owner ? "dachshund" : "nightshift", bio: "Techno from Bologna, vinyl only.", isOwner: owner, cloudProfile: true };
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } }
          : p === "/profiles" ? { profile } : p === "/secure-posts" ? { posts: [] }
          : p === "/friends" ? { friends: [], outgoing: [], incoming: [], count: 0 }
          : p === "/friends/of" ? { friends: [], mutualCount: 0, listVisible: false } : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      try {
        await page.goto(`${base}/profile.html${owner ? "" : "?member=" + them}`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(name => {
          const n = document.getElementById("profileName"), bio = document.querySelector(".profile-bio");
          return n && n.textContent === name && n.getClientRects().length && bio && !bio.hidden && document.querySelector(".profile-actions");
        }, name, { timeout: 20000, polling: 200 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        const r = await page.evaluate(() => {
          const n = document.getElementById("profileName"), bio = document.querySelector(".profile-bio"), avatar = document.getElementById("profileInitial");
          const ns = getComputedStyle(n), bs = getComputedStyle(bio), nr = n.getBoundingClientRect(), ar = avatar.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(n);
          const text = range.getBoundingClientRect(), lines = new Set([...range.getClientRects()].map(b => Math.round(b.top))).size;
          return {
            kit: n.matches(".ds.ds-profile-name"), bioKit: bio.matches(".ds.ds-profile-bio"),
            family: ns.fontFamily, weight: ns.fontWeight, stretch: ns.fontStretch, size: parseFloat(ns.fontSize), color: ns.color, bg: ns.backgroundColor,
            archivo: document.fonts.check(`800 ${ns.fontSize} Archivo`),
            clipped: n.scrollWidth > n.clientWidth + 0.5, lines, textRight: text.right, textLeft: text.left, nameRight: nr.right, avatarRight: ar.right,
            bioFamily: bs.fontFamily, bioSize: parseFloat(bs.fontSize), bioLine: bs.lineHeight, bioColor: bs.color, bioBg: bs.backgroundColor,
            overflow: document.documentElement.scrollWidth > innerWidth, vw: innerWidth,
          };
        });
        if (!r.kit) failures.push(`${label}: the name is not the kit title`);
        if (!r.bioKit) failures.push(`${label}: the bio is not kit body text`);
        if (!/^Archivo\b/.test(r.family) || !r.archivo) failures.push(`${label}: the name is not in Archivo (${r.family})`);
        if (r.weight !== "800" || r.stretch !== "110%") failures.push(`${label}: the name is not 800 at 110% (${r.weight}, ${r.stretch})`);
        // The title starts at 28px and is fitted into its column beside the avatar (F4): one line down to 18px, then two
        // lines. "Night Shift" stays (nearly) the full title; "Dachshund Records" may take two lines at 320–360px.
        if (!long && !owner && r.size < 26) failures.push(`${label}: "Night Shift" is ${r.size}px, expected the 28px title`);
        if (!long && (r.size > 28 || r.size < 18 || r.lines > 2)) failures.push(`${label}: a short name is ${r.size}px on ${r.lines} line(s)`);
        if (long && (r.size >= 28 || r.size < 15)) failures.push(`${label}: a long name did not scale into its column (${r.size}px)`);
        if (r.clipped || r.textRight > r.vw + 0.5) failures.push(`${label}: the name is cut off`);
        if (r.textLeft < r.avatarRight - 0.5) failures.push(`${label}: the name runs over the avatar`);
        if (r.color !== INK) failures.push(`${label}: the name is ${r.color}, expected the kit's Day ink on the light card`);
        if (r.bg !== "rgba(0, 0, 0, 0)" || r.bioBg !== "rgba(0, 0, 0, 0)") failures.push(`${label}: the header type paints a background (${r.bg}, ${r.bioBg})`);
        if (!/^Archivo\b/.test(r.bioFamily) || r.bioSize !== 15 || r.bioLine !== "22px") failures.push(`${label}: the bio is not 15/22 Archivo (${r.bioFamily} ${r.bioSize}px/${r.bioLine})`);
        if (r.bioColor !== SOFT) failures.push(`${label}: the bio is ${r.bioColor}, expected the kit's soft ink`);
        if (r.overflow) failures.push(`${label}: sideways scroll`);
        if (errors.length) failures.push(`${label}: page errors ${JSON.stringify(errors)}`);
        if (width === 390 && !long) await page.screenshot({ path: `docs/screenshots/launch/profile-header-type-${owner ? "owner" : "visitor"}-${scheme}-${lang}-390.png` }).catch(() => {});
      } catch (error) {
        failures.push(`${label}: ${error.message.split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length) { console.error("Profile header type failed:\n- " + failures.join("\n- ")); process.exit(1); }
  console.log(`Profile header type passed (${runs.length} runs: owner/visitor, 320–430px, Day/Night, long name, Italian).`);
})();
