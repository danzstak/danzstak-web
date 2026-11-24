"use strict";
// Tour Manager hometown vibe (task 15-C, owner 2026-11-17). The band's backstage wears its hometown as accents only:
// header stripe, section eyebrows, day-sheet header, an "Out of <town>" line and an origin badge on Keep going and
// Tour so far. Forms, buttons, the map and the pipeline keep the DanzStak frame and colours.
// One setting for both places: the EPK's hometownSkin (auto / city / off). No EPK yet: the booking workspace's home
// town, then off. Matching is local (assets/hometown-looks.js); nothing goes to a third party.
(() => {
  const API = "https://api.danzstak.com";
  const PAGE_GROUND = "#ffffff"; // the booking pages are light; accents are tuned to stay at 4.5:1 or better on it
  const t = text => window.danzstakTranslate?.(text) || text;
  let current = null, started = null;

  const looks = () => window.danzstakHometownLooks;
  function fromKit(kit) {
    const L = looks(); if (!L || !kit) return undefined;
    const skin = kit.hometownSkin && typeof kit.hometownSkin === "object" ? kit.hometownSkin : { mode: "auto" };
    if (skin.mode === "off") return null;
    if (skin.mode === "city") { const city = L.cityById(skin.city); if (city) return L.hometownLook(city.name); }
    return kit.hometown ? L.hometownLook(kit.hometown) : undefined; // auto without a hometown: fall back
  }
  async function getJson(path) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try { const r = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store", signal: controller.signal }); return r.ok ? await r.json().catch(() => null) : null; }
    catch { return null; } finally { clearTimeout(timer); }
  }
  async function resolve() {
    const epk = await getJson("/epk"), fromEpk = fromKit(epk?.kit);
    if (fromEpk !== undefined) return fromEpk; // the EPK decides (including "off")
    const typed = document.getElementById("pitchHometown")?.value?.trim();
    const hometown = typed || (await getJson("/booking-pipeline"))?.artist?.hometown || "";
    return hometown ? looks()?.hometownLook(hometown) || null : null;
  }

  function apply(look) {
    current = look || null;
    const body = document.body, L = looks();
    for (const name of ["--tour-accent", "--tour-motif"]) body.style.removeProperty(name);
    delete body.dataset.tourHometown;
    if (current && L) {
      const tuned = L.accentOn(current, PAGE_GROUND);
      body.dataset.tourHometown = current.id;
      body.style.setProperty("--tour-accent", tuned.accent);
      body.style.setProperty("--tour-motif", tuned.motif);
    }
    decorate();
    window.dispatchEvent(new CustomEvent("danzstak:tour-hometown", { detail: current }));
  }

  // "Out of Tacoma": the label and the town are separate nodes so the label translates and the town does not.
  function outOf(className = "tour-out-of") {
    if (!current) return null;
    const line = document.createElement("span");
    line.className = className;
    line.append(document.createTextNode(t("Out of")), " ");
    const town = document.createElement("strong"); town.textContent = current.name; town.dataset.noTranslate = "";
    line.append(town);
    return line;
  }
  // Put the origin on the pieces that render before or after the setting resolves.
  function decorate() {
    document.querySelectorAll(".tour-out-of, .tour-origin-badge").forEach(node => node.remove());
    if (!current) return;
    const summary = document.querySelector(".route-summary h3");
    if (summary) { const line = document.createElement("p"); line.className = "tour-out-of-line"; line.append(outOf()); summary.after(line); }
    document.querySelectorAll(".tour-keep-going > h3, .tour-legs-so-far").forEach(node => { const badge = outOf("tour-origin-badge"); if (badge) node.prepend(badge, " "); });
    document.querySelectorAll(".tour-day-sheet").forEach(sheet => { if (!sheet.querySelector(".tour-day-sheet-head")) { const head = document.createElement("p"); head.className = "tour-day-sheet-head"; head.append(outOf()); sheet.prepend(head); } else sheet.querySelector(".tour-day-sheet-head").replaceChildren(outOf()); });
  }

  function start() {
    if (started) return started;
    started = resolve().then(apply).catch(() => apply(null));
    // Re-decorate when the route, the day sheet or Keep going render.
    const missing = () => (document.querySelector(".route-summary h3") && !document.querySelector(".tour-out-of-line"))
      || [...document.querySelectorAll(".tour-keep-going > h3, .tour-legs-so-far")].some(node => !node.querySelector(".tour-origin-badge"))
      || [...document.querySelectorAll(".tour-day-sheet")].some(sheet => !sheet.querySelector(".tour-day-sheet-head"));
    // The route results are built by script (no fixed id), so watch the page and check once per frame.
    let queued = false;
    new MutationObserver(() => { if (queued || !current) return; queued = true; requestAnimationFrame(() => { queued = false; if (missing()) decorate(); }); }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
    return started;
  }

  window.danzstakTourHometown = Object.freeze({ start, resolve, apply, fromKit, outOf, get current() { return current; } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
