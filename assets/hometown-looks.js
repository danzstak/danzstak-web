"use strict";
// Hometown skins (task 15-A, owner 2026-11-17): data + matcher, no DOM.
// A hometown is a token set layered on top of the genre look (assets/epk-looks.css): it tints the genre ground
// with the city's hue, brings one accent and an original CSS/SVG motif. No photos, logos, team marks, transit
// branding, flags or third-party artwork. Matching is local, from the hometown text the artist typed.
(function (root) {
  // ---------- colour maths (sRGB, WCAG 2.x contrast) ----------
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  function hexToRgb(hex) { const h = String(hex).replace("#", ""); const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h; return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); }
  const rgbToHex = rgb => "#" + rgb.map(c => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0")).join("");
  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hslToRgb([h, s, l]) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((c, i) => c + (hexToRgb(b)[i] - c) * t));
  function luminance(hex) { return hexToRgb(hex).map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0); }
  function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
  // Move a colour's lightness away from the ground until it reaches the target contrast (deterministic).
  function ensureContrast(fg, bg, target = 4.6) {
    if (contrast(fg, bg) >= target) return fg;
    const [h, s, l0] = rgbToHsl(hexToRgb(fg)), up = luminance(bg) < 0.18;
    for (let step = 1; step <= 100; step++) {
      const l = clamp(l0 + (up ? step : -step) / 100, 0, 1), c = rgbToHex(hslToRgb([h, s, l]));
      if (contrast(c, bg) >= target) return c;
    }
    return up ? "#ffffff" : "#000000";
  }

  // ---------- genre looks (must match assets/epk-looks.css; the test checks it) ----------
  const GENRES = Object.freeze({
    techno: { ground: "#0b0b0c", ink: "#ededea", accent: "#ff5a1f" },
    punk: { ground: "#efe8da", ink: "#121110", accent: "#e5452e" },
    metal: { ground: "#0e0d0d", ink: "#e6decb", accent: "#9e1b1b" },
    house: { ground: "#0f2e26", ink: "#fff4e0", accent: "#ffc93c" }
  });

  // ---------- motif library: original line patterns, drawn in the accent at low strength ----------
  const MOTIF_ALPHA = 0.1;
  const MOTIFS = Object.freeze({
    rain: { size: 24, body: '<path d="M4 0l-3 9M16 8l-3 9M10 15l-3 9"/>' },
    brick: { size: 32, body: '<path d="M0 .5h32M0 16.5h32M.5 0v16M16.5 16v16"/>' },
    concrete: { size: 28, body: '<path d="M3 4h1M17 2h1M9 12h1M23 10h1M5 20h1M15 23h1M25 18h1M12 27h1"/>' },
    arches: { size: 32, body: '<path d="M0 32V18a16 16 0 0 1 32 0v14"/>' },
    rails: { size: 24, body: '<path d="M0 6h24M0 18h24M4 0v24M16 0v24"/>' },
    waterline: { size: 40, body: '<path d="M0 10q10-6 20 0t20 0M0 30q10-6 20 0t20 0"/>' },
    haze: { size: 40, body: '<path d="M0 8h40M0 22h26M10 34h30"/>' },
    grid: { size: 24, body: '<path d="M0 .5h24M.5 0v24"/>' },
    pines: { size: 30, body: '<path d="M8 26l7-14 7 14zM15 12l-4 8M15 12l4 8"/>' }
  });
  function motifImage(name, color) {
    const m = MOTIFS[name] || MOTIFS.concrete;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${m.size}" height="${m.size}" viewBox="0 0 ${m.size} ${m.size}"><g fill="none" stroke="${color}" stroke-opacity="${MOTIF_ALPHA}" stroke-width="1.5" stroke-linecap="square">${m.body}</g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  // ---------- curated scene cities (punk, metal and electronic first) ----------
  // ground: the city's hue/saturation (applied at the genre's lightness); accent: one accent; tint: 0-1 strength.
  // lat/lon: the city centre, 2 decimals. Never the artist's address.
  const CITIES = Object.freeze([
    ["tacoma", "Tacoma", ["tacoma", "t town", "tac"], "#26302c", "#e9efe9", "#8fd0b0", 0.4, "rain", "Puget Sound grey, mill steam", 47.25, -122.44],
    ["seattle", "Seattle", ["seattle", "sea town"], "#23303a", "#e8eef2", "#7cc4e0", 0.38, "rain", "Rain on the viaduct, ferry grey", 47.61, -122.33],
    ["bremerton", "Bremerton", ["bremerton"], "#263236", "#e7eef0", "#9bb7c4", 0.38, "waterline", "Shipyard steel, Sinclair Inlet chop", 47.57, -122.63],
    ["olympia", "Olympia", ["olympia", "oly"], "#24302a", "#ecf2e8", "#a8d08d", 0.4, "pines", "Moss, pines and basement shows", 47.04, -122.9],
    ["portland", "Portland", ["portland", "pdx"], "#2b2f2a", "#efeee8", "#c9a86a", 0.36, "pines", "Bridges, drizzle, old-growth green", 45.52, -122.68],
    ["san-francisco", "San Francisco", ["san francisco", "sf", "san fran", "frisco"], "#2c2a33", "#efedf3", "#ff8a5b", 0.36, "haze", "Fog off the bay, warehouse haze", 37.77, -122.42],
    ["oakland", "Oakland", ["oakland", "the town"], "#2a2622", "#f2eee8", "#f2b134", 0.38, "rails", "Port cranes, freight rails, East Bay sun", 37.8, -122.27],
    ["los-angeles", "Los Angeles", ["los angeles", "la", "l a", "hollywood", "east la"], "#2f2420", "#f4ece8", "#ff9a62", 0.38, "haze", "Freeway dusk, desert heat haze", 34.05, -118.24],
    ["san-diego", "San Diego", ["san diego", "sd"], "#1f2c33", "#e8f1f2", "#5fd1c7", 0.36, "waterline", "Harbor blue, border-town sun", 32.72, -117.16],
    ["milwaukee", "Milwaukee", ["milwaukee", "mke"], "#2d2620", "#f3eee6", "#e0a458", 0.4, "brick", "Cream City brick, lake wind", 43.04, -87.91],
    ["chicago", "Chicago", ["chicago", "chi town", "chitown"], "#24272e", "#eceef2", "#e86b5f", 0.36, "rails", "Elevated tracks, lake wind, warehouse brick", 41.88, -87.63],
    ["detroit", "Detroit", ["detroit", "motor city", "the d"], "#232326", "#ececf0", "#b9c7ff", 0.34, "grid", "Factory floor, motor city grid", 42.33, -83.05],
    ["nashville", "Nashville", ["nashville"], "#2c2420", "#f3ede6", "#e6b450", 0.38, "brick", "Honky-tonk brick, river bend", 36.16, -86.78],
    ["austin", "Austin", ["austin", "atx"], "#2e2620", "#f4ede6", "#ff8f4a", 0.38, "haze", "Hill Country heat, late nights downtown", 30.27, -97.74],
    ["new-york", "New York", ["new york", "new york city", "nyc", "ny", "brooklyn", "manhattan", "queens", "the bronx", "bronx"], "#26262a", "#eeeef0", "#ffd23f", 0.34, "grid", "Grid streets, steam from the grates", 40.71, -74.01],
    ["philadelphia", "Philadelphia", ["philadelphia", "philly"], "#2b2423", "#f3ecea", "#e08a6f", 0.38, "brick", "Rowhouse brick, river wards", 39.95, -75.17],
    ["berlin", "Berlin", ["berlin"], "#222224", "#ededee", "#a6e86f", 0.32, "concrete", "Concrete, cold nights, long weekends", 52.52, 13.4],
    ["mannheim", "Mannheim", ["mannheim"], "#232729", "#ebeff1", "#7fb3d5", 0.34, "grid", "Squares street grid, Rhine-Neckar", 49.49, 8.47],
    ["bologna", "Bologna", ["bologna", "bologne", "bolonia"], "#33241c", "#f6ece4", "#e08a3c", 0.44, "arches", "Portico terracotta and ochre", 44.49, 11.34],
    ["milan", "Milan", ["milan", "milano", "milán"], "#26242a", "#efedf1", "#e3b04b", 0.34, "grid", "Steel, trams, canal fog", 45.46, 9.19],
    ["rome", "Rome", ["rome", "roma"], "#30241e", "#f5ece6", "#e0784a", 0.42, "arches", "Travertine, ochre walls, summer heat", 41.9, 12.5],
    ["paris", "Paris", ["paris", "parigi", "parís"], "#25262c", "#eeeef2", "#b8a6e0", 0.34, "concrete", "Zinc rooftops, outer-ring concrete", 48.86, 2.35],
    ["london", "London", ["london", "londra", "londres"], "#24262b", "#eeeff1", "#e86a6a", 0.34, "brick", "Wet brick, night bus, river fog", 51.51, -0.13],
    ["manchester", "Manchester", ["manchester", "manny"], "#262427", "#efedef", "#e3735e", 0.36, "brick", "Red-brick mills, rain off the hills", 53.48, -2.24],
    ["amsterdam", "Amsterdam", ["amsterdam", "dam"], "#1f2a2e", "#e9f0f2", "#f08a3c", 0.36, "waterline", "Canal water, gabled brick", 52.37, 4.9],
    ["barcelona", "Barcelona", ["barcelona", "barcellona", "barcelone", "bcn"], "#2e2722", "#f5efe8", "#f2c14e", 0.38, "haze", "Mediterranean sun, late nights", 41.39, 2.17]
  ].map(([id, name, aliases, ground, ink, accent, tint, motif, vibe, lat, lon]) => Object.freeze({ id, name, aliases: Object.freeze(aliases), ground, ink, accent, tint, motif, vibe, lat, lon })));

  // ---------- matcher ----------
  const REGION = new Set(["usa", "us", "u s", "u s a", "united states", "america", "uk", "united kingdom", "england", "scotland", "germany", "deutschland", "italy", "italia", "france", "spain", "espana", "netherlands", "nederland", "holland", "the netherlands",
    "wa", "or", "ca", "wi", "il", "mi", "tn", "tx", "pa", "washington", "oregon", "california", "wisconsin", "illinois", "michigan", "tennessee", "texas", "pennsylvania", "new york state", "bw", "baden wurttemberg", "emilia romagna", "lombardy", "lombardia", "lazio", "catalonia", "catalunya", "ile de france", "greater manchester", "noord holland", "north holland"]);
  const normalize = text => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9,]+/g, " ").replace(/\s+/g, " ").trim();
  const aliasMap = new Map();
  for (const city of CITIES) for (const alias of [city.id.replace(/-/g, " "), city.name, ...city.aliases]) aliasMap.set(normalize(alias), city);
  function stripRegion(words) {
    const out = words.slice();
    while (out.length > 1) {
      let removed = false;
      for (let n = Math.min(3, out.length - 1); n >= 1; n--) if (REGION.has(out.slice(-n).join(" "))) { out.splice(-n, n); removed = true; break; }
      if (!removed) break;
    }
    return out.join(" ");
  }
  function townKey(text) {
    const parts = normalize(text).split(",").map(p => p.trim()).filter(Boolean);
    if (!parts.length) return "";
    const first = stripRegion(parts[0].split(" "));
    return first || parts[0];
  }
  function findCity(text) {
    const parts = normalize(text).split(",").map(p => p.trim()).filter(Boolean);
    if (!parts.length) return null;
    const candidates = [stripRegion(parts[0].split(" ")), parts[0], stripRegion(parts.join(" ").split(" "))];
    for (const key of candidates) if (aliasMap.has(key)) return aliasMap.get(key);
    return null;
  }

  // ---------- fallback: the same town always gets the same skin ----------
  function hash(text) { let h = 2166136261; for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  const titleCase = text => String(text || "").trim().replace(/\s+/g, " ").split(" ").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
  function fallbackLook(text) {
    const key = townKey(text), h = hash(key), hue = h % 360;
    const display = titleCase(String(text).split(",")[0].replace(/\b(?:usa|us|uk)\b/gi, ""));
    return Object.freeze({ id: `town-${key.replace(/ /g, "-").slice(0, 40)}`, name: display || titleCase(key), aliases: Object.freeze([key]), ground: rgbToHex(hslToRgb([hue, 0.18, 0.16])), ink: rgbToHex(hslToRgb([hue, 0.12, 0.93])), accent: rgbToHex(hslToRgb([hue, 0.62, 0.62])), tint: 0.3, motif: "concrete", vibe: "", lat: null, lon: null });
  }

  // hometownLook("Tacoma, WA") -> { id, curated, name, tokens }
  function hometownLook(text) {
    if (!normalize(text).replace(/,/g, "").trim()) return null;
    const city = findCity(text), look = city || fallbackLook(text);
    return { id: look.id, curated: Boolean(city), name: look.name, tokens: { ground: look.ground, ink: look.ink, accent: look.accent, tint: look.tint, motif: look.motif, vibe: look.vibe, lat: look.lat, lon: look.lon } };
  }
  const cityById = id => CITIES.find(c => c.id === id) || null;

  // Layer a hometown over a genre look: keep the genre's light/dark, tint toward the city hue, one accent,
  // and keep every text/background pair at 4.5:1 or better, even over the motif.
  function compose(genreId, look) {
    const genre = GENRES[genreId] || GENRES.techno;
    if (!look) return { ground: genre.ground, ink: genre.ink, accent: genre.accent, motif: "none", motifName: "", worstGround: genre.ground };
    const t = look.tokens || look;
    const [gh, gs, gl] = rgbToHsl(hexToRgb(genre.ground)), [ch, cs] = rgbToHsl(hexToRgb(t.ground));
    const shade = rgbToHex(hslToRgb([ch, Math.max(cs, gs * 0.5), gl]));
    const ground = mix(genre.ground, shade, clamp(Number(t.tint) || 0, 0, 1));
    const worstFor = color => mix(ground, color, MOTIF_ALPHA);
    let ink = contrast(genre.ink, ground) >= 4.5 ? genre.ink : t.ink;
    if (contrast(ink, worstFor(ink)) < 4.5) ink = ensureContrast(ink, worstFor(ink), 4.6);
    let accent = ensureContrast(t.accent, ground, 4.6);
    accent = ensureContrast(accent, worstFor(accent), 4.6);
    return { ground, ink, accent, motif: motifImage(t.motif, accent), motifName: t.motif, worstGround: worstFor(accent) };
  }
  // CSS custom properties for an element (used by 15-B/15-C). Values are colours and a data: URI only.
  function cssVars(genreId, look) {
    const c = compose(genreId, look);
    return { "--epk-ground": c.ground, "--epk-ink": c.ink, "--epk-accent": c.accent, "--home-motif": c.motif };
  }

  const api = Object.freeze({ CITIES, GENRES, MOTIFS, MOTIF_ALPHA, hometownLook, cityById, compose, cssVars, motifImage, contrast, normalize, townKey });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.danzstakHometownLooks = api;
})(typeof window !== "undefined" ? window : globalThis);
