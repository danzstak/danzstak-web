"use strict";
// Task 22 (owner 2026-11-18): "make a test store … a model to show users how to build their shop".
// Three made-up shops (fan, band, record shop) built from the same product grid as a real member shop, with short
// guide notes. Everything here is front-end only: it never calls the API, so no example can reach the Bazaar,
// search or Mix, and nothing can be bought. All names and artwork are fictional and drawn here.
(() => {
  const byId = id => document.getElementById(id);
  const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  // Buyer-paid fee (owner 2026-11-16, final): 6% plus $1 on orders under $30; the seller keeps the full price and shipping.
  const allIn = cents => Math.round(cents * 1.06) + (cents < 3000 ? 100 : 0);
  const node = (tag, text = "", className = "") => { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; };

  // ---------- Original artwork (inline SVG, no external images) ----------
  const esc = text => String(text).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  const display = 'font-family="Archivo, Arial Black, Arial, sans-serif" font-weight="900"';
  const mono = 'font-family="JetBrains Mono, ui-monospace, monospace"';
  const fit = (text, width, max) => Math.min(max, width / (String(text).length * 0.64)).toFixed(1); // keep a title inside its label
  const record = (cx, cy, r, label) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#111"/>${[0.92, 0.8, 0.68, 0.56].map(f => `<circle cx="${cx}" cy="${cy}" r="${r * f}" fill="none" stroke="#2b2b2b" stroke-width="2"/>`).join("")}<circle cx="${cx}" cy="${cy}" r="${r * 0.32}" fill="${label}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.04}" fill="#111"/>`;
  const sleeve = (x, y, s, a) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${a.bg}"/>
    <circle cx="${x + s * 0.5}" cy="${y + s * 0.42}" r="${s * 0.26}" fill="none" stroke="${a.accent}" stroke-width="${s * 0.05}"/>
    <path d="M${x + s * 0.08} ${y + s * 0.62} L${x + s * 0.92} ${y + s * 0.62}" stroke="${a.accent}" stroke-width="${s * 0.02}"/>
    <text x="${x + s * 0.08}" y="${y + s * 0.78}" ${display} font-size="${fit(a.title, s * 0.84, s * 0.11)}" fill="${a.ink}">${esc(a.title)}</text>
    <text x="${x + s * 0.08}" y="${y + s * 0.9}" ${mono} font-size="${fit(a.artist, s * 0.9, s * 0.055)}" fill="${a.ink}" opacity=".8">${esc(a.artist)}</text>`;
  const ART = {
    lp: a => `${record(272, 200, 150, a.accent)}${sleeve(40, 50, 300, a)}`,
    seven: a => `${record(250, 205, 112, a.accent)}${sleeve(70, 95, 220, a)}`,
    box: a => `<rect x="70" y="90" width="280" height="250" fill="#0d0d0d"/><rect x="58" y="78" width="280" height="250" fill="${a.bg}" stroke="#0d0d0d" stroke-width="6"/>
      ${[0, 1, 2, 3].map(i => `<rect x="${78 + i * 12}" y="${98 + i * 10}" width="200" height="12" fill="${i % 2 ? a.accent : a.ink}" opacity=".85"/>`).join("")}
      <text x="78" y="250" ${display} font-size="34" fill="${a.ink}">${esc(a.title)}</text><text x="78" y="290" ${mono} font-size="17" fill="${a.ink}">${esc(a.artist)}</text>`,
    tape: a => `<rect x="60" y="110" width="280" height="180" rx="14" fill="${a.bg}" stroke="#111" stroke-width="6"/><rect x="90" y="135" width="220" height="62" fill="#f4efe4"/>
      <text x="102" y="174" ${display} font-size="${fit(a.title, 196, 26)}" fill="#111">${esc(a.title)}</text>
      <rect x="125" y="212" width="150" height="50" rx="25" fill="#111"/><circle cx="150" cy="237" r="17" fill="#f4efe4"/><circle cx="250" cy="237" r="17" fill="#f4efe4"/>
      <circle cx="150" cy="237" r="6" fill="${a.accent}"/><circle cx="250" cy="237" r="6" fill="${a.accent}"/>`,
    cd: a => `<rect x="70" y="70" width="260" height="260" fill="#dfe3e8" stroke="#9aa3ad" stroke-width="4"/><rect x="90" y="85" width="230" height="230" fill="${a.bg}"/>
      <circle cx="205" cy="200" r="78" fill="none" stroke="${a.accent}" stroke-width="10"/><text x="104" y="300" ${display} font-size="${fit(a.title, 200, 26)}" fill="${a.ink}">${esc(a.title)}</text>`,
    tee: a => `<path d="M128 78 L172 58 Q200 92 228 58 L272 78 L338 136 L298 176 L280 160 L280 344 L120 344 L120 160 L102 176 L62 136 Z" fill="${a.bg}" stroke="#111" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="200" cy="168" r="42" fill="none" stroke="${a.accent}" stroke-width="10"/><text x="200" y="262" text-anchor="middle" ${display} font-size="30" fill="${a.ink}">${esc(a.title)}</text>`,
    tote: a => `<path d="M150 120 Q150 60 200 60 Q250 60 250 120" fill="none" stroke="#111" stroke-width="10"/><rect x="100" y="120" width="200" height="220" fill="${a.bg}" stroke="#111" stroke-width="5"/>
      <text x="200" y="230" text-anchor="middle" ${display} font-size="28" fill="${a.ink}">${esc(a.title)}</text><text x="200" y="262" text-anchor="middle" ${mono} font-size="14" fill="${a.ink}">TOUR ONLY</text>`,
    poster: a => `<rect x="85" y="40" width="230" height="320" fill="${a.bg}" stroke="#111" stroke-width="4"/><text x="105" y="105" ${display} font-size="40" fill="${a.accent}">${esc(a.title)}</text>
      ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="105" y="${140 + i * 30}" width="${150 - (i % 3) * 22}" height="12" fill="${a.ink}" opacity=".75"/>`).join("")}<text x="105" y="335" ${mono} font-size="14" fill="${a.ink}">${esc(a.artist)}</text>`,
    patch: a => [[140, 150, 82, a.accent], [265, 160, 64, a.ink], [200, 285, 72, a.alt]].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r - 9}" fill="none" stroke="#f4efe4" stroke-width="3" stroke-dasharray="6 5"/>`).join("") + `<text x="140" y="160" text-anchor="middle" ${display} font-size="26" fill="#f4efe4">${esc(a.title)}</text>`,
    zine: a => `<path d="M95 60 L305 70 L300 345 L90 335 Z" fill="${a.bg}" stroke="#111" stroke-width="4"/><rect x="190" y="62" width="6" height="22" fill="#777"/><rect x="186" y="318" width="6" height="22" fill="#777"/>
      ${esc(a.title).split(" ").map((word, i) => `<rect x="${112 + (i % 2) * 18}" y="${100 + i * 58}" width="${word.length * 22 + 20}" height="46" fill="${i % 2 ? a.accent : "#111"}" transform="rotate(${i % 2 ? 3 : -2} 200 200)"/><text x="${122 + (i % 2) * 18}" y="${134 + i * 58}" ${display} font-size="32" fill="${i % 2 ? "#111" : "#f4efe4"}" transform="rotate(${i % 2 ? 3 : -2} 200 200)">${word}</text>`).join("")}`,
    buttons: a => [[130, 140, a.accent], [255, 125, a.ink], [190, 230, a.alt], [100, 285, a.ink], [285, 270, a.accent]].map(([x, y, c], i) => `<circle cx="${x}" cy="${y}" r="58" fill="${c}" stroke="#111" stroke-width="4"/><text x="${x}" y="${y + 9}" text-anchor="middle" ${display} font-size="${i === 2 ? 22 : 26}" fill="#f4efe4">${["DIY", "NO", "LOUD", "PIT", "♥"][i]}</text>`).join(""),
    vest: a => `<path d="M130 60 L175 60 L200 150 L225 60 L270 60 L320 120 L310 345 L215 345 L215 160 L200 190 L185 160 L185 345 L90 345 L80 120 Z" fill="#3c5a80" stroke="#111" stroke-width="5" stroke-linejoin="round"/>
      <rect x="105" y="190" width="62" height="44" fill="${a.accent}"/><circle cx="262" cy="214" r="30" fill="${a.alt}"/><rect x="232" y="268" width="60" height="50" fill="${a.ink}"/>
      ${[0, 1, 2, 3, 4].map(i => `<circle cx="${112 + i * 12}" cy="${280 + (i % 2) * 10}" r="5" fill="#d9d9d9"/>`).join("")}`,
    print: a => `<rect x="60" y="60" width="280" height="280" fill="#111"/><rect x="78" y="78" width="244" height="244" fill="${a.bg}"/>
      <path d="M78 270 L150 190 L210 240 L260 170 L322 250 L322 322 L78 322 Z" fill="${a.accent}"/><circle cx="250" cy="125" r="28" fill="${a.alt}"/><text x="92" y="112" ${display} font-size="26" fill="${a.ink}">${esc(a.title)}</text>`,
    bundle: a => `<g transform="translate(0 30) scale(.62)">${ART.lp(a)}</g><g transform="translate(150 120) scale(.62)">${ART.tee(a)}</g>`
  };
  const artwork = art => { const holder = node("div", "", "example-art"); holder.innerHTML = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect width="400" height="400" fill="${art.ground || "#ebe6dc"}"/>${ART[art.kind](art)}</svg>`; return holder; };

  // ---------- The three example shops (fictional) ----------
  const punk = { bg: "#efe8da", ink: "#121110", accent: "#e5452e", alt: "#1c6e5a" };
  const metal = { bg: "#0e0d0d", ink: "#e6decb", accent: "#9e1b1b", alt: "#5d5d5d", ground: "#2a2725" };
  const house = { bg: "#0f2e26", ink: "#fff4e0", accent: "#ffc93c", alt: "#ff6fa8" };
  const SHOPS = {
    fan: {
      label: "Fan shop",
      name: "Basement Dispatch",
      eyebrow: "Example · fan shop · Oakland, CA",
      about: "Hand-stitched patches, a monthly zine and a few records from my own crate. Made at the kitchen table, shipped on Mondays.",
      why: [
        "Real photos of the real thing, square, in daylight. Crafts sell on the photo.",
        "One-of-a-kind pieces show stock 1, so nobody waits for a restock that never comes.",
        "Honest, small shipping: patches and zines go as a letter.",
        "Records from a personal crate still get Discogs-style grades for media and sleeve."
      ],
      sections: [
        { title: "Made by me", items: [
          { title: "Hand-stitched patch set (3)", details: "Wool felt, 3 in / 2.5 in / 2.75 in. Iron or sew on.", price: 1200, shipping: 200, stock: 6, art: { kind: "patch", title: "DIY", ...punk } },
          { title: "Basement Dispatch #7 (zine)", details: "28 pages, photocopied, show reviews and a flyer archive.", price: 500, shipping: 200, stock: 30, art: { kind: "zine", title: "DISPATCH 7", ...punk } },
          { title: "Button pack (5)", details: "1.25 in pin-back buttons, mixed designs.", price: 600, shipping: 200, stock: 20, art: { kind: "buttons", ...punk } },
          { title: "Custom battle vest", details: "Thrifted denim, hand-sewn patches, studs. Size M.", price: 14000, shipping: 1200, stock: 1, badges: ["1 of 1"], art: { kind: "vest", ...punk } },
          { title: "Night Show screen print (A3)", details: "Two-color print, numbered edition of 30.", price: 2500, shipping: 500, stock: 10, art: { kind: "print", title: "NIGHT SHOW", ...house } }
        ] },
        { title: "From my crate", items: [
          { title: "Static Ward – Ward Lights (LP, Night Tram Records NTR-014)", grade: ["VG+", "VG"], details: "Played a lot, still loud. Small seam split on the spine.", price: 1800, shipping: 500, stock: 1, art: { kind: "lp", title: "WARD LIGHTS", artist: "STATIC WARD", ...punk } },
          { title: "The Hollow Men – Out of Range (7\", self-released HM-01)", grade: ["VG+", "VG+"], price: 600, shipping: 300, stock: 1, art: { kind: "seven", title: "OUT OF RANGE", artist: "THE HOLLOW MEN", ...metal } }
        ] }
      ]
    },
    band: {
      label: "Band shop",
      name: "Static Ward",
      eyebrow: "Example · band shop · Tacoma, WA",
      about: "Fast, loud and local. Records, shirts and whatever is left from the last tour.",
      extras: "Every order comes with free stickers.",
      links: ["EPK", "Next gigs"],
      why: [
        "Merch, releases and tour stock sit together; tour-only items stay listed as sold out so fans see what they missed.",
        "A pre-order says when it ships. Bundles say what they save."
      ],
      sections: [
        { title: "Music", items: [
          { title: "Static Ward – Ward Lights (12\" LP, Night Tram Records NTR-014)", details: "Black vinyl, printed inner sleeve, download card.", price: 2400, shipping: 600, stock: 120, art: { kind: "lp", title: "WARD LIGHTS", artist: "STATIC WARD", ...punk } },
          { title: "Bundle: Ward Lights LP + tee", details: "Save $7 against buying them apart.", price: 4200, shipping: 800, stock: 40, badges: ["Bundle"], sizes: ["S", "M", "L", "XL", "XXL"], art: { kind: "bundle", title: "WARD LIGHTS", artist: "STATIC WARD", ...punk } },
          { title: "Static Ward – Live at the Hollow (Cassette, SW-03)", details: "Recorded on the last night of the 2026 tour.", price: 800, shipping: 300, stock: 60, art: { kind: "tape", title: "LIVE AT THE HOLLOW", ...punk } },
          { title: "Static Ward / Bone Choir – Split (7\", Night Tram Records NTR-021)", details: "Two songs each. Pre-order now.", price: 800, shipping: 300, stock: 200, badges: ["Pre-order · ships Mar 3, 2027"], art: { kind: "seven", title: "SPLIT", artist: "STATIC WARD / BONE CHOIR", ...metal } }
        ] },
        { title: "Merch", items: [
          { title: "Ward Lights tee", details: "Black, heavyweight cotton, screen printed in Tacoma.", price: 2500, shipping: 500, stock: 85, sizes: ["S", "M", "L", "XL", "XXL"], art: { kind: "tee", title: "STATIC WARD", ...{ ...punk, bg: "#1a1a1a", ink: "#efe8da" } } },
          { title: "2026 tour poster (signed, 18×24 in)", details: "Every date of the West Coast run, signed by the band.", price: 1500, shipping: 600, stock: 25, art: { kind: "poster", title: "TOUR 26", artist: "STATIC WARD", ...punk } },
          { title: "Tour-only tote", details: "Sold at shows on the 2026 run only.", price: 1800, shipping: 500, stock: 0, soldOut: true, art: { kind: "tote", title: "STATIC WARD", ...punk } }
        ] }
      ]
    },
    record: {
      label: "Record shop",
      name: "Night Tram Records",
      eyebrow: "Example · record shop · Portland, OR",
      about: "Used and new vinyl, tapes and CDs. Punk, metal and electronic first. In-store shows once a month.",
      discogs: true,
      why: [
        "Titles follow Artist – Title (Format, Label Cat#), so collectors find the exact pressing.",
        "Every record shows Discogs-style grades for media and sleeve (M, NM, VG+, VG…).",
        "New arrivals and staff picks lead; the full crate follows.",
        "A box set over $30 has no $1 order fee for the buyer."
      ],
      sections: [
        { title: "New arrivals", items: [
          { title: "Acid Garden – Low Sun (12\", Night Tram Records NTR-009)", grade: ["M", "M"], details: "Sealed. Deep house, four tracks.", price: 1600, shipping: 600, stock: 3, badges: ["New arrival"], art: { kind: "lp", title: "LOW SUN", artist: "ACID GARDEN", ...house } },
          { title: "Copper Saints – Saints (CD, Rustbelt RB-112)", grade: ["NM", "VG+"], details: "Jewel case has a small crack; disc is clean.", price: 800, shipping: 300, stock: 1, badges: ["New arrival"], art: { kind: "cd", title: "SAINTS", ...metal } }
        ] },
        { title: "Staff picks", items: [
          { title: "Bone Choir – Ossuary Hymns (LP, Grave Weather GW-031)", grade: ["VG+", "VG+"], details: "Staff pick, Mara: the doom record of the year.", price: 2200, shipping: 600, stock: 1, badges: ["Staff pick"], art: { kind: "lp", title: "OSSUARY HYMNS", artist: "BONE CHOIR", ...metal } },
          { title: "Grey Lantern – Teeth (LP, Night Tram Records NTR-011)", grade: ["NM", "VG+"], details: "Staff pick, Jo: noisy, short, perfect.", price: 1900, shipping: 600, stock: 2, badges: ["Staff pick"], art: { kind: "lp", title: "TEETH", artist: "GREY LANTERN", ...punk } }
        ] },
        { title: "The crate", items: [
          { title: "Static Ward – Complete Recordings 2019–2025 (4×LP Box Set, NTR-BOX1)", grade: ["M", "M"], details: "Numbered box, booklet, poster.", price: 8500, shipping: 1400, stock: 2, badges: ["Box set"], art: { kind: "box", title: "COMPLETE", artist: "STATIC WARD 2019–2025", ...punk } },
          { title: "The Hollow Men – Out of Range (7\", self-released HM-01)", grade: ["VG", "VG+"], price: 600, shipping: 300, stock: 1, art: { kind: "seven", title: "OUT OF RANGE", artist: "THE HOLLOW MEN", ...metal } },
          { title: "Various – Night Tram Vol. 1 (Cassette, NTR-C1)", grade: ["NM", "NM"], details: "Local comp, 14 bands.", price: 900, shipping: 300, stock: 8, art: { kind: "tape", title: "NIGHT TRAM VOL.1", ...house } }
        ] }
      ]
    }
  };

  // ---------- Rendering ----------
  function card(item) {
    const article = node("article", "", "product-card example-card");
    const art = artwork(item.art);
    art.append(node("span", "Example", "example-tag"));
    if (item.soldOut) art.append(node("span", "Sold out", "example-soldout"));
    const copy = node("div", "", "product-card-copy");
    copy.append(node("h3", item.title, "example-title"));
    const badges = [...(item.badges || []), ...(item.stock === 1 && !(item.badges || []).includes("1 of 1") ? ["Only 1"] : [])];
    if (badges.length) { const row = node("p", "", "example-badges"); for (const badge of badges) row.append(node("span", badge, "example-badge")); copy.append(row); }
    if (item.grade) copy.append(node("p", `Media ${item.grade[0]} · Sleeve ${item.grade[1]}`, "example-grade"));
    if (item.details) copy.append(node("p", item.details, "example-details"));
    if (item.sizes) copy.append(node("p", `Sizes ${item.sizes.join(" · ")}`, "example-sizes"));
    copy.append(node("p", money(allIn(item.price)), "product-price"));
    copy.append(node("p", `All-in for the buyer. Seller keeps ${money(item.price)}${item.shipping ? ` + ${money(item.shipping)} shipping` : ""}.`, "product-note"));
    const buy = node("button", "Example — not for sale", "example-buy");
    buy.type = "button"; buy.disabled = true;
    copy.append(buy);
    article.append(art, copy);
    return article;
  }

  function guide(title, lines) {
    const details = node("details", "", "example-guide"), summary = node("summary", title), list = node("ul");
    for (const line of lines) list.append(node("li", line));
    details.append(summary, list);
    return details;
  }

  const WALKTHROUGH = [
    ["dashboard", "Dashboard", "Sign in to Discogs in a browser and open your Dashboard."],
    ["inventory", "Inventory", "Open your Inventory: the records you have for sale."],
    ["export", "Export", "Choose Export and request an inventory export."],
    ["csv", "Download CSV", "Download the file when Discogs says it's ready. Keep it private."],
    ["moving", "Moving Day", "Open Moving Day on DanzStak and choose the file."],
    ["pick", "Pick", "Tick what moves. Nothing moves on its own."],
    ["price", "Price", "Check prices and shipping. Use the % change for € or £."],
    ["publish", "Publish", "Move as drafts, check them, then publish."]
  ];
  const ICONS = {
    dashboard: '<rect x="6" y="8" width="16" height="14" rx="2"/><rect x="26" y="8" width="16" height="9" rx="2"/><rect x="26" y="21" width="16" height="19" rx="2"/><rect x="6" y="26" width="16" height="14" rx="2"/>',
    inventory: '<circle cx="18" cy="24" r="12"/><circle cx="18" cy="24" r="3"/><path d="M32 12h10M32 20h10M32 28h10M32 36h10"/>',
    export: '<path d="M24 6v24M14 20l10 10 10-10"/><path d="M8 34v6h32v-6"/>',
    csv: '<path d="M12 6h18l8 8v28H12z"/><path d="M30 6v8h8"/><path d="M17 24h14M17 30h14M17 36h9"/>',
    moving: '<rect x="4" y="16" width="26" height="18" rx="2"/><path d="M30 22h8l6 6v6H30z"/><circle cx="13" cy="37" r="4"/><circle cx="36" cy="37" r="4"/>',
    pick: '<rect x="8" y="9" width="8" height="8" rx="1"/><path d="M10 13l2 2 3-4M22 13h18M22 24h18M22 35h18"/><rect x="8" y="20" width="8" height="8" rx="1"/><rect x="8" y="31" width="8" height="8" rx="1"/>',
    price: '<path d="M8 24L24 8h16v16L24 40z"/><circle cx="33" cy="15" r="3"/>',
    publish: '<circle cx="24" cy="24" r="16"/><path d="M16 24l6 6 11-12"/>'
  };
  function walkthrough() {
    const section = node("section", "", "example-walkthrough");
    section.setAttribute("aria-labelledby", "walkthroughTitle");
    const heading = node("h2", "Bring your Discogs inventory over"); heading.id = "walkthroughTitle";
    const list = node("ol", "", "example-steps");
    for (const [icon, title, text] of WALKTHROUGH) {
      const item = node("li"), figure = node("span", "", "example-step-icon");
      figure.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</svg>`;
      item.append(figure, node("strong", title), node("span", text));
      list.append(item);
    }
    const both = node("p", "", "example-note");
    both.append(node("strong", "Inventory export or collection export? "), "Selling on Discogs already? The inventory export keeps your prices. Pricing your own crate? Export your collection instead (on Discogs's Export page, choose Collection): it has no prices, so Moving Day asks you to set one for all picked items, or row by row, before anything moves.");
    const start = node("a", "Start Moving Day", "example-primary"); start.href = "moving-day.html?source=discogs";
    section.append(heading, node("p", "Free, in your browser, from your own export. DanzStak never logs in to Discogs and never copies their database."), list, both, start);
    return section;
  }

  const panel = byId("exampleShop"), tabs = [...document.querySelectorAll(".example-switch [role=tab]")];
  function show(key, focus = false) {
    const shop = SHOPS[key] || SHOPS.fan;
    for (const tab of tabs) { const selected = tab.dataset.shop === key; tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1; if (selected && focus) tab.focus(); }
    panel.setAttribute("aria-labelledby", `tab-${key}`);
    const hero = node("section", "", "store-hero example-hero");
    hero.append(node("p", shop.eyebrow, "store-eyebrow"), node("h2", shop.name, "example-shop-name"), node("p", shop.about));
    if (shop.extras) hero.append(node("p", shop.extras, "example-extras"));
    if (shop.links) { const links = node("p", "", "example-links"); links.title = "In a real band shop these open the band's EPK and gig list."; for (const label of shop.links) links.append(node("span", label)); hero.append(links); }
    const parts = [hero, guide(`Why ${shop.name} works`, shop.why)];
    if (shop.discogs) parts.push(walkthrough());
    for (const group of shop.sections) {
      const section = node("section", "", "example-section"), grid = node("div", "", "product-grid example-grid");
      section.append(node("h3", group.title, "example-section-title"));
      for (const item of group.items) grid.append(card(item));
      section.append(grid); parts.push(section);
    }
    panel.replaceChildren(...parts);
    document.title = `${shop.label} example | DanzStak`;
    const url = new URL(location.href); url.searchParams.set("shop", key); history.replaceState(null, "", url);
  }
  for (const tab of tabs) tab.addEventListener("click", () => show(tab.dataset.shop));
  byId("exampleSwitch").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const index = tabs.indexOf(document.activeElement); if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    show(tabs[next].dataset.shop, true);
  });
  const requested = new URLSearchParams(location.search).get("shop");
  show(SHOPS[requested] ? requested : "fan");
  window.DanzStakShopExamples = { shops: SHOPS, allIn }; // read by tests only
})();
