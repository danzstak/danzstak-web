"use strict";
// Whole-site fixes (fix-it 18, owner 2026-11-17): links that leave DanzStak (SoundCloud, Mixcloud, YouTube, any other
// site) open outside the app — a new tab, or the phone's own app — instead of replacing DanzStak in the same tab.
(() => {
  const own = new Set([location.host, "danzstak.com", "www.danzstak.com", "review.danzstak.com"]);
  function external(anchor) {
    if (!(anchor instanceof HTMLAnchorElement) || !anchor.href || anchor.hasAttribute("download")) return false;
    let url; try { url = new URL(anchor.href, location.href); } catch { return false; }
    return /^https?:$/.test(url.protocol) && !own.has(url.host);
  }
  function mark(anchor) {
    if (!external(anchor)) return;
    anchor.target = "_blank";
    const rel = new Set(String(anchor.rel || "").split(/\s+/).filter(Boolean));
    rel.add("noopener"); rel.add("noreferrer");
    anchor.rel = [...rel].join(" ");
  }
  const scan = root => { if (root instanceof HTMLAnchorElement) mark(root); root.querySelectorAll?.("a[href]").forEach(mark); };
  // Also catch links whose href is set after insertion, and any click that slips through.
  document.addEventListener("click", event => { const a = event.target.closest?.("a[href]"); if (a) mark(a); }, true);
  const start = () => {
    scan(document);
    new MutationObserver(records => records.forEach(record => {
      if (record.type === "attributes") mark(record.target);
      else record.addedNodes.forEach(node => { if (node.nodeType === 1) scan(node); });
    })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
  window.danzstakIsExternalLink = external;
})();
