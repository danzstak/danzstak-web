"use strict";
// Directive F4 (owner 2026-11-19): "put the name to the right of the profile image and move the image box below the
// name… make the font size smaller to fit the space if needed… this also gives room for a bigger image. Think like a
// Marvell chip designer." Checks at 320/360/390/430px, for short and very long names, for the showcase photo (visitor
// and owner), the shop preview, the owner's "Fill this space" prompt and a profile with no band:
// - the name sits to the right of the avatar, is never clipped and nothing overlaps it;
// - the picture band is below the name row at full content width (a 16:7 photo that fills it);
// - no gap of more than 12px anywhere in the header (cover → name, name row → band, band → actions, actions → tabs);
// - renaming re-fits the name (shrinks to one line, then two, the whole name always shows);
// - the owner's ⋯ on the photo opens Change / Remove when its centre is tapped.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8135 node browser-checks/profile-showcase-fit.cjs   (CAPTURE=dir for screenshots)
const { chromium } = require("playwright");
const path = require("node:path");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8135").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", them = "22222222-2222-4222-8222-222222222222";
const svg = (w, h, color) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${color}"/></svg>`);
const photo = svg(800, 350, "#0b0b0c");
const items = [1, 2, 3].map(i => ({ id: `p${i}`, title: `Item ${i}`, available: true, imageUrl: svg(10, 10, "#ff5a1f"), priceCents: 1500 }));
const cases = [
  { label: "short name, photo", owner: false, name: "Dax", showcase: photo, products: [], band: "photo" },
  { label: "long name, photo", owner: false, name: "Dachshund Records", showcase: photo, products: [], band: "photo" },
  { label: "very long name, photo", owner: false, name: "Eroticon Records Worldwide Distribution Collective", showcase: photo, products: [], band: "photo" },
  { label: "owner photo", owner: true, name: "Dachshund Records", showcase: photo, products: [], band: "photo", menu: true },
  { label: "owner fill this space", owner: true, name: "SFScoop", showcase: "", products: [], band: "prompt" },
  { label: "shop preview", owner: false, name: "Eroticon Records Worldwide", showcase: "", products: items, band: "shop" },
  { label: "no band", owner: false, name: "Plain Member", showcase: "", products: [], band: "" }
];
const overlap = (a, b) => a && b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

async function measure(page) {
  return page.evaluate(() => {
    const rect = element => { if (!element || !element.getClientRects().length) return null; const b = element.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height }; };
    const name = document.getElementById("profileName"), range = document.createRange();
    range.selectNodeContents(name);
    const lines = [...range.getClientRects()].map(b => ({ top: b.top, bottom: b.bottom, left: b.left, right: b.right }));
    const content = document.getElementById("profileContent"), style = getComputedStyle(content);
    return {
      cover: rect(document.querySelector(".cover")), avatar: rect(document.getElementById("profileInitial")), name: rect(name), lines,
      nameText: name.textContent, fontSize: parseFloat(getComputedStyle(name).fontSize), clipped: name.scrollWidth > name.clientWidth + 0.5,
      band: rect(document.querySelector(".profile-shop-preview")), photo: rect(document.querySelector(".profile-showcase-photo")),
      buttons: [...document.querySelectorAll(".profile-actions > *")].map(rect).filter(Boolean), actions: rect(document.querySelector(".profile-actions")),
      tabs: rect(document.querySelector(".profile-tabs")),
      contentLeft: content.getBoundingClientRect().left + parseFloat(style.paddingLeft), contentRight: content.getBoundingClientRect().right - parseFloat(style.paddingRight),
      overflow: document.documentElement.scrollWidth > innerWidth
    };
  });
}

function judge(r, c, label, failures) {
  const lastLine = r.lines[r.lines.length - 1];
  // Name: right of the avatar, whole, unobstructed, at least 15px (18px on one line before it wraps).
  if (!r.lines.length) { failures.push(`${label}: no name`); return; }
  if (Math.min(...r.lines.map(line => line.left)) < r.avatar.right + 4) failures.push(`${label}: the name is not to the right of the avatar ${JSON.stringify({ avatar: r.avatar.right, name: r.lines })}`);
  if (r.clipped || Math.max(...r.lines.map(line => line.right)) > r.contentRight + 0.5) failures.push(`${label}: the name is clipped ${JSON.stringify(r.lines)}`);
  if (r.fontSize < 15 || (r.lines.length === 1 && r.fontSize < 18 && r.nameText.length < 16)) failures.push(`${label}: the name is too small (${r.fontSize}px on ${r.lines.length} line(s))`);
  for (const [what, box] of [["band", r.band], ["avatar", r.avatar], ["actions", r.actions]]) if (r.lines.some(line => overlap(line, box))) failures.push(`${label}: the ${what} overlaps the name`);
  if (r.lines[0].top - r.cover.bottom > 12) failures.push(`${label}: gap of ${Math.round(r.lines[0].top - r.cover.bottom)}px between the cover and the name`);
  const rowBottom = Math.max(r.avatar.bottom, lastLine.bottom);
  // Band: below the name row, full content width; the photo fills it at about 16:7.
  if (c.band) {
    if (!r.band) { failures.push(`${label}: the picture band is missing`); return; }
    if (r.band.top < rowBottom - 0.5) failures.push(`${label}: the band is not below the name row ${JSON.stringify({ band: r.band.top, row: rowBottom })}`);
    if (Math.abs(r.band.left - r.contentLeft) > 1 || Math.abs(r.band.right - r.contentRight) > 1) failures.push(`${label}: the band is not full width ${JSON.stringify({ band: [r.band.left, r.band.right], content: [r.contentLeft, r.contentRight] })}`);
    if (r.band.top - rowBottom > 12) failures.push(`${label}: gap of ${Math.round(r.band.top - rowBottom)}px between the name row and the band`);
    if (r.actions.top - r.band.bottom > 12) failures.push(`${label}: gap of ${Math.round(r.actions.top - r.band.bottom)}px between the band and the actions`);
    if (r.band.bottom > r.actions.top + 0.5) failures.push(`${label}: the band overlaps the action row`);
    if (c.band === "photo") {
      if (!r.photo || Math.abs(r.photo.width - r.band.width) > 1) failures.push(`${label}: the photo does not fill the band ${JSON.stringify({ photo: r.photo, band: r.band })}`);
      else if (Math.abs(r.photo.width / r.photo.height - 16 / 7) > 0.05) failures.push(`${label}: the photo is not about 16:7 (${(r.photo.width / r.photo.height).toFixed(2)})`);
    }
  } else if (r.band) failures.push(`${label}: a band shows with nothing to show`);
  else if (r.actions.top - rowBottom > 12) failures.push(`${label}: gap of ${Math.round(r.actions.top - rowBottom)}px between the name row and the actions`);
  if (r.tabs.top - r.actions.bottom > 12) failures.push(`${label}: gap of ${Math.round(r.tabs.top - r.actions.bottom)}px between the actions and the tabs`);
  if (r.buttons.some(button => overlap(button, r.band))) failures.push(`${label}: the band covers an action button`);
  if (r.overflow) failures.push(`${label}: sideways overflow`);
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  try {
    for (const c of cases) for (const width of [320, 360, 390, 430]) {
      const label = `${c.label} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const profile = { memberId: c.owner ? me : them, name: c.name, handle: "dachshund", bio: "", location: "Street Magistrini #30", work: "Dj & Techno Producer", isOwner: c.owner, cloudProfile: true, friendStatus: c.owner ? undefined : "friends", showcase: c.showcase };
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } }
          : p === "/profiles" ? { profile } : p === "/secure-posts" ? { posts: [] }
          : p.startsWith("/marketplace/shop") ? (c.products.length ? { shop: { name: c.name, status: "published", products: c.products } } : { shop: null }) : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      try {
      await page.goto(`${base}/profile.html${c.owner ? "" : "?member=" + them}`, { waitUntil: "domcontentloaded" });
      await page.locator(".profile-tabs").waitFor({ timeout: 15000 });
      if (c.band) await page.locator(".profile-shop-preview").waitFor({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      judge(await measure(page), c, label, failures);
      if (process.env.CAPTURE && [360, 390].includes(width)) await page.screenshot({ path: path.join(process.env.CAPTURE, `header-${c.label.replace(/[^a-z]+/gi, "-")}-${width}.png`), clip: { x: 0, y: 0, width, height: 620 } });
      if (c.label === "short name, photo") {
        // Renaming re-fits the name: a very long name shrinks and wraps, and the header still holds together.
        await page.evaluate(() => { document.getElementById("profileName").textContent = "Dachshund Records Worldwide Distribution"; });
        await page.waitForTimeout(400);
        const renamed = await measure(page);
        judge(renamed, c, `${label} after a rename`, failures);
        if (renamed.fontSize >= 26) failures.push(`${label}: a much longer name did not shrink (${renamed.fontSize}px)`);
      }
      if (c.menu) {
        // The owner's ⋯ on the photo: tap its centre, Change and Remove show, nothing else floats over the photo.
        const toggle = page.locator(".profile-showcase-menu > summary");
        const box = await toggle.boundingBox({ timeout: 3000 }).catch(() => null);
        if (!box || box.width < 44 || box.height < 44) failures.push(`${label}: the ⋯ is not a 44px target`);
        else {
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(200);
          const open = await page.evaluate(() => [...document.querySelectorAll(".profile-showcase-tools button")].filter(button => button.getClientRects().length).map(button => button.textContent.trim()));
          if (open.join("|") !== "Change this photo|Remove this photo") failures.push(`${label}: the ⋯ does not open Change / Remove: ${JSON.stringify(open)}`);
        }
      }
      } catch (error) { failures.push(`${label}: ${String(error.message || error).split("\n")[0]}`); }
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Profile header (F4): ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exit(1); }
  console.log("Profile header (F4) passed at 320/360/390/430px: the name sits right of the avatar and always shows in full, the picture band is below it at full width (16:7 photo, shop items, Fill this space), no gap over 12px, renames re-fit, and the owner's ⋯ opens Change / Remove.");
})();
