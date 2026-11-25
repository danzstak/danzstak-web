"use strict";
// Spec 46 SHOT part 1 (owner 2026-11-24/25: "when users upload a screen shot danzstak fixes their fotos", "we frame it and
// make it a proper photo and not a screenshot"). The real assets/photo-trim.js + assets/media-scale.js in a browser:
// test screenshots are drawn on a canvas (phone shape, status bar, app header, the photo, a caption, a reaction row; and
// a gallery viewer with black around the photo, like the owner's Maschine photo), picked through a file input with
// data-trim-screenshots, and the page's own change handler must receive only the photo (within 4 px on every edge of
// the screenshot, then scaled to 720p as before). Left whole, with no chip: a text-only chat, a 2×2 photo grid, a camera
// photo, a dark night photo, and any input without data-trim-screenshots (SYNC). Flat letterbox bars come off any photo.
// The chip "Trimmed from a screenshot · Undo" is tapped at its centre at 320/360/390/430px; Undo gives the whole picture.
// Run: node browser-checks/screenshot-trim.cjs   (DANZSTAK_BROWSER_CHANNEL=bundled for Playwright's own Chromium)
const path = require("node:path");
const { chromium } = require("playwright");

const draw = `
window.makeShot = async function (spec) {
  const c = document.createElement("canvas"); c.width = spec.w; c.height = spec.h;
  const g = c.getContext("2d");
  const rand = (() => { let s = spec.seed || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const photo = (x, y, w, h, dark) => {
    const img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const p = (j * w + i) * 4, n = rand() * 40 - 20;
      const base = dark ? 18 : 90;
      img.data[p] = Math.max(0, Math.min(255, base + 120 * i / w + n));
      img.data[p + 1] = Math.max(0, Math.min(255, base + 60 + 80 * j / h + n));
      img.data[p + 2] = Math.max(0, Math.min(255, (dark ? 30 : 160) - 60 * i / w + n));
      img.data[p + 3] = 255;
    }
    g.putImageData(img, x, y);
  };
  const text = (words, x, y, size, color) => { g.fillStyle = color; g.font = "600 " + size + "px sans-serif"; g.fillText(words, x, y); };
  g.fillStyle = spec.bg || "#ffffff"; g.fillRect(0, 0, spec.w, spec.h);
  if (spec.kind === "app") {
    g.fillStyle = "#1c1c1e"; g.fillRect(0, 0, spec.w, 80); text("7:37", 40, 56, 34, "#fff"); g.fillStyle = "#fff"; g.fillRect(spec.w - 120, 30, 70, 30);
    g.fillStyle = "#f2f2f2"; g.fillRect(0, 80, spec.w, 160); text("DanzStak", 40, 180, 54, "#111");
    text("Night Shift · 2h", 40, spec.p.y - 60, 40, "#222");
    photo(spec.p.x, spec.p.y, spec.p.w, spec.p.h);
    text("Three from the gig, what a night at the club", 40, spec.p.y + spec.p.h + 80, 38, "#222");
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(90 + k * 220, spec.p.y + spec.p.h + 180, 30, 0, 7); g.strokeStyle = "#555"; g.lineWidth = 6; g.stroke(); }
    g.fillStyle = "#fafafa"; g.fillRect(0, spec.h - 170, spec.w, 170); text("Home   Search   Profile", 60, spec.h - 70, 40, "#333");
  } else if (spec.kind === "viewer") {
    g.fillStyle = "#000"; g.fillRect(0, 0, spec.w, spec.h); text("✕", 60, 160, 70, "#fff"); text("1 di 1", spec.w / 2 - 80, 160, 64, "#fff");
    photo(spec.p.x, spec.p.y, spec.p.w, spec.p.h);
  } else if (spec.kind === "chat") {
    g.fillStyle = "#1c1c1e"; g.fillRect(0, 0, spec.w, 80);
    for (let k = 0; k < 12; k++) { const mine = k % 2; g.fillStyle = mine ? "#dcf8c6" : "#eeeeee"; g.fillRect(mine ? 360 : 40, 200 + k * 170, 680, 120); text("Message number " + k + " see you at the show", mine ? 390 : 70, 270 + k * 170, 36, "#111"); }
  } else if (spec.kind === "grid") {
    g.fillStyle = "#1c1c1e"; g.fillRect(0, 0, spec.w, 80);
    photo(30, 400, 500, 500); photo(550, 400, 500, 500); photo(30, 920, 500, 500); photo(550, 920, 500, 500);
  } else if (spec.kind === "camera") {
    photo(0, 0, spec.w, spec.h);
  } else if (spec.kind === "night") {
    photo(0, 0, spec.w, spec.h, true);
  } else if (spec.kind === "letterbox") {
    g.fillStyle = "#000"; g.fillRect(0, 0, spec.w, spec.h); photo(spec.p.x, spec.p.y, spec.p.w, spec.p.h);
  }
  const type = spec.type || "image/png";
  const blob = await new Promise(r => c.toBlob(r, type, 0.92));
  return new File([blob], spec.name || "Screenshot_20261125.png", { type });
};
window.pick = async function (id, spec) {
  const input = document.getElementById(id), file = await window.makeShot(spec);
  window.got = null;
  const t = new DataTransfer(); t.items.add(file); input.files = t.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};
window.received = async function () {
  if (!window.got) return null;
  const bitmap = await createImageBitmap(window.got);
  return { w: bitmap.width, h: bitmap.height };
};
`;

const W = 1080, H = 2400;
// Expected size after the 720p scaling (media-scale.js targetSize).
const scaled = (w, h) => { const [mw, mh] = w >= h ? [1280, 720] : [720, 1280]; const s = Math.min(1, mw / w, mh / h); return { w: Math.round(w * s), h: Math.round(h * s), s }; };
const cases = [
  { label: "Android app, landscape photo", spec: { kind: "app", w: W, h: H, p: { x: 0, y: 700, w: 1080, h: 720 } }, expect: { w: 1080, h: 720 } },
  { label: "app, square photo", spec: { kind: "app", w: W, h: H, p: { x: 40, y: 600, w: 1000, h: 1000 } }, expect: { w: 1000, h: 1000 } },
  { label: "iPhone app, portrait photo", spec: { kind: "app", w: 1170, h: 2532, p: { x: 0, y: 520, w: 1170, h: 1460 }, name: "IMG_4512.PNG" }, expect: { w: 1170, h: 1460 } },
  { label: "gallery viewer (1 di 1)", spec: { kind: "viewer", w: 720, h: 1600, p: { x: 0, y: 606, w: 720, h: 405 }, name: "1000032005.png" }, expect: { w: 720, h: 405 } },
  { label: "letterboxed photo (any photo)", spec: { kind: "letterbox", w: 1600, h: 1200, p: { x: 0, y: 150, w: 1600, h: 900 }, type: "image/jpeg", name: "IMG_2001.jpg" }, expect: { w: 1600, h: 900 } },
  { label: "text-only chat", spec: { kind: "chat", w: W, h: H }, whole: true },
  { label: "2×2 photo grid", spec: { kind: "grid", w: W, h: H }, whole: true },
  { label: "camera photo", spec: { kind: "camera", w: 1600, h: 1200, type: "image/jpeg", name: "IMG_2002.jpg" }, whole: true },
  { label: "dark night photo", spec: { kind: "night", w: 1600, h: 1200, type: "image/jpeg", name: "IMG_2003.jpg" }, whole: true }
];

(async () => {
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL;
  const browser = await chromium.launch(channel === "bundled" ? { headless: true } : { channel: channel || "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = []; page.on("pageerror", e => errors.push(e.message));
      await page.setContent('<!doctype html><meta name="viewport" content="width=device-width"><body><input type="file" id="trim" data-trim-screenshots accept="image/*"><input type="file" id="sync" accept="image/*"></body>');
      for (const file of ["photo-trim.js", "media-scale.js"]) await page.addScriptTag({ path: path.join(__dirname, "..", "assets", file) });
      await page.addScriptTag({ content: draw });
      await page.evaluate(() => { for (const id of ["trim", "sync"]) document.getElementById(id).addEventListener("change", e => { window.got = e.target.files[0]; }); });
      const runs = width === 390 ? cases : cases.slice(0, 1).concat(cases.slice(3, 4), cases.slice(5, 6));
      for (const c of runs) {
        const label = `${width}px ${c.label}`;
        await page.evaluate(spec => window.pick("trim", spec), c.spec);
        await page.waitForFunction(() => window.got, null, { timeout: 15000 }).catch(() => {});
        const got = await page.evaluate(() => window.received());
        const chip = await page.evaluate(() => { const n = document.getElementById("danzstakTrimNotice"); return Boolean(n && !n.hidden); });
        if (!got) { failures.push(`${label}: the page never got the photo`); continue; }
        const want = c.whole ? scaled(c.spec.w, c.spec.h) : scaled(c.expect.w, c.expect.h);
        const tol = Math.max(2, Math.ceil(4 * want.s)) + 1;
        if (Math.abs(got.w - want.w) > tol || Math.abs(got.h - want.h) > tol) failures.push(`${label}: got ${got.w}×${got.h}, want ${want.w}×${want.h}`);
        if (c.whole === chip) failures.push(`${label}: chip ${chip ? "shown" : "missing"}`);
        await page.evaluate(() => { const n = document.getElementById("danzstakTrimNotice"); if (n) n.hidden = true; });
      }
      // The chip: centre tap on Undo gives the whole screenshot back.
      await page.evaluate(spec => window.pick("trim", spec), cases[0].spec);
      await page.waitForFunction(() => window.got && !document.getElementById("danzstakTrimNotice")?.hidden, null, { timeout: 15000 }).catch(() => {});
      const undo = page.locator("#danzstakTrimNotice .photo-trim-undo");
      const box = await undo.boundingBox().catch(() => null);
      if (!box || box.height < 44) failures.push(`${width}px: Undo isn't a 44px button (${JSON.stringify(box)})`);
      else {
        const hit = await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest(".photo-trim-undo")), [box.x + box.width / 2, box.y + box.height / 2]);
        if (!hit) failures.push(`${width}px: the centre of Undo is covered`);
        const chipBox = await page.locator("#danzstakTrimNotice").boundingBox();
        if (chipBox.x < 0 || chipBox.x + chipBox.width > width) failures.push(`${width}px: the chip is wider than the screen`);
        if (process.env.CAPTURE && [360, 390].includes(width)) await page.screenshot({ path: path.join(process.env.CAPTURE, `screenshot-trim-chip-${width}.png`) });
        await page.evaluate(() => { window.got = null; });
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForFunction(() => window.got, null, { timeout: 15000 }).catch(() => {});
        const back = await page.evaluate(() => window.received()), whole = scaled(W, H);
        if (!back || Math.abs(back.w - whole.w) > 2 || Math.abs(back.h - whole.h) > 2) failures.push(`${width}px: Undo didn't give the whole screenshot back (${JSON.stringify(back)})`);
      }
      // SYNC and every other picker without the opt-in: never trimmed.
      await page.evaluate(spec => window.pick("sync", spec), cases[3].spec);
      await page.waitForFunction(() => window.got, null, { timeout: 15000 }).catch(() => {});
      const sync = await page.evaluate(() => window.received()), whole = scaled(720, 1600);
      if (!sync || Math.abs(sync.w - whole.w) > 2 || Math.abs(sync.h - whole.h) > 2) failures.push(`${width}px: a picker without data-trim-screenshots was trimmed (${JSON.stringify(sync)})`);
      if (errors.length) failures.push(`${width}px: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Screenshot trim: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exit(1); }
  console.log("Screenshot trim passed at 320/360/390/430px: app screenshots (landscape, square, portrait), the gallery viewer and a letterboxed photo come out as just the photo; a chat, a photo grid, a camera photo and a night photo stay whole; the chip's Undo gives the whole picture back; SYNC-style pickers are never trimmed.");
})();
