"use strict";
// Task 15-A visual proof: every curated city x every genre look, rendered from assets/hometown-looks.js
// (ground, ink, accent and motif), plus a few fallback towns. Fails on any pair under 4.5:1 as the browser paints it.
// Run: node browser-checks/hometown-swatches.cjs   (no server needed)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const output = path.resolve("docs/screenshots/hometown-looks");
const widths = [320, 375, 430, 768, 1366];
const script = fs.readFileSync("assets/hometown-looks.js", "utf8");
const page = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;padding:12px;background:#f4f4f2;font:14px/1.35 Arial,sans-serif;color:#172033}
h1{margin:0 0 4px;font-size:18px}p.note{margin:0 0 12px;color:#475467}
.city{margin:0 0 14px}.city h2{margin:0 0 6px;font-size:14px}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}
.sw{padding:10px;min-height:78px;background-color:var(--g);background-image:var(--m);color:var(--i)}
.sw b{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--a)}
.sw span{display:block;font-size:12px}
</style></head><body><h1>Hometown skins</h1><p class="note">Each tile: genre look tinted by the city, motif, ink and accent as composed by hometown-looks.js.</p><main id="out"></main>
<script>${script}</script><script>
const L=window.danzstakHometownLooks,out=document.getElementById("out");
const towns=[...L.CITIES.map(c=>c.name),"Springfield, IL","Gdańsk","Wollongong"];
for(const town of towns){const look=L.hometownLook(town),sec=document.createElement("section");sec.className="city";
sec.innerHTML="<h2></h2><div class=row></div>";sec.querySelector("h2").textContent=look.name+(look.curated?" · "+look.tokens.vibe:" · fallback");
for(const g of Object.keys(L.GENRES)){const k=L.compose(g,look),d=document.createElement("div");d.className="sw";d.dataset.town=look.id;d.dataset.genre=g;
d.style.setProperty("--g",k.ground);d.style.setProperty("--i",k.ink);d.style.setProperty("--a",k.accent);d.style.setProperty("--m",k.motif);
d.innerHTML="<b></b><span></span>";d.querySelector("b").textContent=g;d.querySelector("span").textContent=look.name;sec.querySelector(".row").append(d);}
out.append(sec);}
</script></body></html>`;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const tab = await context.newPage(), errors = [];
      tab.on("pageerror", e => errors.push(e.message));
      await tab.setContent(page, { waitUntil: "load" });
      const result = await tab.evaluate(() => {
        const lum = c => { const v = c.match(/\d+/g).slice(0, 3).map(n => { n /= 255; return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        const tiles = [...document.querySelectorAll(".sw")];
        const low = tiles.map(t => { const bg = getComputedStyle(t).backgroundColor; return { id: `${t.dataset.town}/${t.dataset.genre}`, ink: ratio(getComputedStyle(t.querySelector("span")).color, bg), accent: ratio(getComputedStyle(t.querySelector("b")).color, bg), motif: getComputedStyle(t).backgroundImage.startsWith('url("data:image/svg+xml') }; }).filter(r => r.ink < 4.5 || r.accent < 4.5 || !r.motif);
        return { tiles: tiles.length, low, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(result.tiles, 29 * 4, "every city and fallback town in every genre");
      assert.deepEqual(result.low, [], `${width}px tiles under 4.5:1 or without a motif`);
      assert.equal(result.overflow, false, `${width}px overflows`);
      assert.deepEqual(errors, []);
      if (width === 1366) await tab.screenshot({ path: path.join(output, `swatches-all-${width}.png`), fullPage: true, animations: "disabled" });
      for (const id of ["tacoma", "bologna", "berlin", "detroit", "town-springfield"]) await tab.locator(`.city:has([data-town="${id}"])`).screenshot({ path: path.join(output, `${id}-${width}.png`), animations: "disabled" });
      await context.close();
    }
    console.log(`Hometown swatch checks passed at ${widths.join(", ")}px: 29 towns x 4 genres painted at 4.5:1 or better with their motif.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
