"use strict";
// Owner 2026-11-19 (screenshot): the photo box beside the avatar covered the member's name. The box must start where
// the cover photo ends and never overlap the name, the avatar or the action buttons — for the showcase photo, the
// shop preview and the owner's "Fill this space" prompt, with long names, at 320–430px.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8135 node browser-checks/profile-showcase-fit.cjs   (CAPTURE=dir for screenshots)
const { chromium } = require("playwright");
const path = require("node:path");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8135").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", them = "22222222-2222-4222-8222-222222222222";
const svg = (w, h, color) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${color}"/></svg>`);
const cases = [
  { label: "showcase photo, visitor", owner: false, name: "Dachshund Records", showcase: svg(600, 300, "#0b0b0c"), products: [], aboveName: true },
  { label: "showcase photo, owner", owner: true, name: "Dachshund Records", showcase: svg(600, 300, "#0b0b0c"), products: [] },
  { label: "showcase photo, short name", owner: false, name: "Dax", showcase: svg(600, 300, "#0b0b0c"), products: [], fills: true },
  { label: "fill this space, owner", owner: true, name: "SFScoop", showcase: "", products: [] },
  { label: "shop preview, visitor", owner: false, name: "Eroticon Records Worldwide", showcase: "", products: [1, 2, 3].map(i => ({ id: `p${i}`, title: `Item ${i}`, available: true, imageUrl: svg(10, 10, "#ff5a1f"), priceCents: 1500 })) }
];
const overlap = (a, b) => a && b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  try {
    for (const c of cases) for (const width of [320, 360, 390, 430]) {
      const label = `${c.label} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const profile = { memberId: c.owner ? me : them, name: c.name, handle: "dachshund", bio: "", location: "Street Magistrini #30", work: "Dj & Techno Producer", isOwner: c.owner, cloudProfile: true, friendStatus: c.owner ? undefined : "friends", showcase: c.showcase, cover: svg(1600, 600, "#334"), picture: svg(200, 200, "#e85") };
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } }
          : p === "/profiles" ? { profile } : p === "/secure-posts" ? { posts: [] }
          : p.startsWith("/marketplace/shop") ? (c.products.length ? { shop: { name: c.name, status: "published", products: c.products } } : { shop: null }) : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      await page.goto(`${base}/profile.html${c.owner ? "" : "?member=" + them}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
      const r = await page.evaluate(() => {
        const rect = el => { if (!el || !el.getClientRects().length) return null; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
        const box = document.querySelector(".profile-shop-preview");
        const parts = box ? [box, ...box.querySelectorAll("*")].map(rect).filter(Boolean) : [];
        const union = parts.length ? parts.reduce((a, b) => ({ top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom), left: Math.min(a.left, b.left), right: Math.max(a.right, b.right) })) : null;
        const range = document.createRange(); range.selectNodeContents(document.getElementById("profileName"));
        const nameText = [...range.getClientRects()].map(b => ({ top: b.top, bottom: b.bottom, left: b.left, right: b.right }));
        const buttons = [...document.querySelectorAll(".profile-actions > *")].map(rect).filter(Boolean);
        return { nameText, buttons, photo: rect(document.querySelector(".profile-showcase-photo")), boxEl: rect(box), box: union, cover: rect(document.querySelector(".cover")), name: rect(document.getElementById("profileName")), avatar: rect(document.getElementById("profileInitial")), actions: rect(document.querySelector(".profile-actions")), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      if (!r.box) failures.push(`${label}: no box shown`);
      else {
        // The name's text, not its full-width line box: with a short name the box sits beside it (F4).
        if (r.nameText.some(line => overlap(r.box, line))) failures.push(`${label}: box covers the name ${JSON.stringify({ box: r.box, name: r.nameText })}`);
        if (r.buttons.some(button => overlap(r.box, button))) failures.push(`${label}: box covers an action button`);
        // Directive F4: the box fills the free space. A short name leaves the column free down to the action row; a long
        // name keeps the box above the name; the photo fills the box.
        if (c.fills) {
          const inColumn = r.buttons.filter(button => button.right > r.boxEl.left && button.left < r.boxEl.right);
          const floor = inColumn.length ? Math.min(...inColumn.map(button => button.top)) : r.avatar.bottom;
          if (r.boxEl.bottom < floor - 14) failures.push(`${label}: a short name leaves empty space under the box (box ends ${Math.round(r.boxEl.bottom)}, free down to ${Math.round(floor)})`);
          if (r.boxEl.bottom - r.boxEl.top < 80) failures.push(`${label}: the box is not tall with a short name (${Math.round(r.boxEl.bottom - r.boxEl.top)}px)`);
        }
        if (c.aboveName && r.boxEl.bottom > r.nameText[0].top + 0.5) failures.push(`${label}: with a long name the box must sit above the name`);
        if (c.showcase && !c.owner && r.photo && Math.abs((r.photo.right - r.photo.left) - (r.boxEl.right - r.boxEl.left)) > 1) failures.push(`${label}: the photo does not fill the box ${JSON.stringify({ photo: r.photo, box: r.boxEl })}`);
        if (overlap(r.box, r.avatar)) failures.push(`${label}: box covers the avatar`);
        if (overlap(r.box, r.actions)) failures.push(`${label}: box covers the action buttons`);
        if (r.box.top < r.cover.bottom - 1) failures.push(`${label}: box sits on the cover photo`);
        if (r.box.top - r.cover.bottom > 12) failures.push(`${label}: box does not meet the cover (gap ${Math.round(r.box.top - r.cover.bottom)}px)`);
      }
      if (c.fills && width === 390) {
        // Recompute on name change and on resize: a longer name moves the box above it; a narrower screen keeps it clear.
        const measure = () => page.evaluate(() => { const box = document.querySelector(".profile-shop-preview").getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(document.getElementById("profileName")); const lines = [...range.getClientRects()]; return { boxTop: box.top, boxBottom: box.bottom, boxLeft: box.left, boxRight: box.right, nameTop: lines[0].top, nameRight: Math.max(...lines.map(line => line.right)) }; });
        await page.evaluate(() => { document.getElementById("profileName").textContent = "Dachshund Records Worldwide"; });
        await page.waitForTimeout(400);
        let after = await measure();
        if (after.boxBottom > after.nameTop + 0.5) failures.push(`${label}: after a rename to a long name the box still reaches under the name ${JSON.stringify(after)}`);
        await page.evaluate(() => { document.getElementById("profileName").textContent = "Dax"; });
        await page.waitForTimeout(400);
        after = await measure();
        if (after.boxBottom - after.boxTop < 80) failures.push(`${label}: after a rename back to a short name the box does not grow again ${JSON.stringify(after)}`);
        await page.setViewportSize({ width: 320, height: 844 });
        await page.waitForTimeout(400);
        after = await measure();
        if (after.boxRight > 320 + 0.5) failures.push(`${label}: the box spills off a narrower screen ${JSON.stringify(after)}`);
      }
      if (r.overflow) failures.push(`${label}: sideways overflow`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      if (process.env.CAPTURE && [360, 390].includes(width)) await page.screenshot({ path: path.join(process.env.CAPTURE, `showcase-${c.label.replace(/[^a-z]+/gi, "-")}-${width}.png`), clip: { x: 0, y: 0, width, height: 520 } });
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Profile showcase fit: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exit(1); }
  console.log("Profile showcase fit passed at 320/360/390/430: the box meets the cover, never covers the name, avatar or buttons, fills the free space (tall with a short name, above a long name, photo edge to edge) and re-fits on rename and resize (photo, shop preview, fill-this-space).");
})();
